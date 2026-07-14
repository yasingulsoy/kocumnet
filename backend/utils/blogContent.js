const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { bufferToWebp } = require('./imageConverter');
const { FRONTEND_URL, BACKEND_URL } = require('../config/env');

/**
 * İç link mi? Site içi linklere nofollow BASILMAZ — aksi halde admin panelden
 * kaydedilen her blogda iç link ağı sessizce nofollow olur ve SEO çöker.
 * Dış linkler nofollow kalır.
 */
function isInternalHref(href) {
  const h = String(href || '').trim();
  if (!h) return false;
  if (h.startsWith('/') || h.startsWith('#')) return true;
  const siteHosts = [FRONTEND_URL, BACKEND_URL]
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u).host.replace(/^www\./, '');
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  try {
    const host = new URL(h).host.replace(/^www\./, '');
    return siteHosts.includes(host);
  } catch {
    return false;
  }
}

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Editörden gelen blog HTML'ini güvenli hale getirir (XSS koruması).
 * Frontend içeriği dangerouslySetInnerHTML ile bastığından bu şart.
 */
function normalizeBlogHtml(html) {
  if (typeof html !== 'string') return html;

  const normalized = html
    .replace(/ /g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&nsbp;?/gi, ' ');

  return sanitizeHtml(normalized, {
    allowedTags: [
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'dl', 'dt', 'dd',
      'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'pre', 'code',
      'div', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      '*': ['class', 'style'],
    },
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
        'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: isInternalHref(attribs.href)
            ? 'noopener'
            : 'noopener noreferrer nofollow',
        },
      }),
    },
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function safeDecodeBase64(base64Str) {
  const cleaned = base64Str.replace(/\s+/g, '');
  return Buffer.from(cleaned, 'base64');
}

/**
 * HTML içindeki data:image/...;base64,... img src'lerini dosyaya yazar ve src'leri
 * /uploads/blogs/{blogId}/{filename} şeklinde değiştirir.
 * Tüm görseller WebP formatına dönüştürülür.
 *
 * @returns {Promise<{ html: string, saved: string[] }>}
 */
async function persistInlineImagesToBlogsWall({ html, blogId, blogsDir }) {
  if (typeof html !== 'string' || !html) return { html, saved: [] };
  if (!blogId) throw new Error('blogId gerekli');
  if (!blogsDir) throw new Error('blogsDir gerekli');

  const blogDir = path.join(blogsDir, blogId.toString());
  ensureDir(blogDir);

  const saved = [];
  const matches = [];

  const re = /<img\b[^>]*?\bsrc\s*=\s*(['"])\s*(data:image\/[a-zA-Z0-9+.-]+;base64,([\s\S]*?))\s*\1/gi;

  let m;
  while ((m = re.exec(html)) !== null) {
    matches.push({
      fullMatch: m[0],
      quote: m[1],
      dataUri: m[2],
      index: m.index,
    });
  }

  if (matches.length === 0) return { html, saved };

  let out = '';
  let lastIndex = 0;

  for (const match of matches) {
    const { fullMatch, quote, dataUri } = match;

    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) continue;

    const meta = dataUri.slice(0, commaIdx);
    const b64 = dataUri.slice(commaIdx + 1);

    const mimeMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64$/i.exec(meta);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : null;
    const ext = mime && MIME_TO_EXT[mime];

    if (!ext) continue;

    const buf = safeDecodeBase64(b64);
    if (!buf || !buf.length) continue;

    const webpBuf = await bufferToWebp(buf);

    const name = `content_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.webp`;
    const filePath = path.join(blogDir, name);
    fs.writeFileSync(filePath, webpBuf);

    const publicUrl = `/uploads/blogs/${blogId}/${name}`;
    saved.push(publicUrl);

    out += html.slice(lastIndex, match.index);

    const replaced = fullMatch.replace(
      new RegExp(`\\bsrc\\s*=\\s*${quote}[\\s\\S]*?${quote}`, 'i'),
      `src=${quote}${publicUrl}${quote}`
    );
    out += replaced;

    lastIndex = match.index + fullMatch.length;
  }

  out += html.slice(lastIndex);
  return { html: out, saved };
}

/**
 * Blog klasöründe, içerikte referans edilmeyen content_* dosyalarını siler.
 * Kapak resmi (blogsWall'da ayrı klasörde) etkilenmez.
 */
function cleanupUnreferencedContentImages({ html, blogId, blogsDir }) {
  if (typeof html !== 'string' || !html) return;
  if (!blogId || !blogsDir) return;

  const blogDir = path.join(blogsDir, blogId.toString());
  if (!fs.existsSync(blogDir)) return;

  const referenced = new Set();
  const urlRe = new RegExp(`/uploads/blogs/${blogId}/([^"'>\\s]+)`, 'gi');
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    referenced.add(m[1]);
  }

  const files = fs.readdirSync(blogDir);
  for (const f of files) {
    if (!/^content_/.test(f)) continue;
    if (!referenced.has(f)) {
      try {
        fs.unlinkSync(path.join(blogDir, f));
      } catch {
        // best-effort
      }
    }
  }
}

module.exports = {
  normalizeBlogHtml,
  persistInlineImagesToBlogsWall,
  cleanupUnreferencedContentImages,
};
