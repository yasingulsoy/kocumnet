const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op, fn, col } = require('sequelize');
const {
  createBlogWallUploadMiddleware,
  createMediaUploadMiddleware,
  uploadsDir,
  deleteBlogFolder,
  deleteBlogWallFolder,
} = require('../middleware/blogUpload');
const { authenticateAdmin, requireRole, optionalAdmin } = require('../middleware/auth');
const { CONTENT_ROLES } = require('../utils/roles');
const { writeLimiter, viewLimiter } = require('../middleware/rateLimits');
const { parseId, escapeLike, asyncHandler, toBool } = require('../utils/http');
const { sequelize } = require('../config/database');
const { Blog, BlogRevision, User, AuditLog } = require('../models');
const {
  normalizeBlogHtml,
  persistInlineImagesToBlogsWall,
  cleanupUnreferencedContentImages,
} = require('../utils/blogContent');
const { convertToWebp } = require('../utils/imageConverter');
const { sniffImage, sniffImageFile } = require('../utils/imageSignature');
const { denetle, tirnak } = require('../utils/audit');
const { gorseliIsle, gorseliKaydet } = require('../utils/blogMedia');

const router = express.Router();

const AUTHOR_FIELDS = ['id', 'username', 'first_name', 'last_name'];

/** Yalnızca bu alanlar istemciden güncellenebilir. */
const GUNCELLENEBILIR_ALANLAR = [
  'title',
  'slug',
  'content',
  'excerpt',
  'tags',
  'is_published',
  'meta_title',
  'meta_description',
  'locale',
  'image_alt',
];

const META_TITLE_MAX = 255;
/** Kapak alt metni sütunu 200; ekran okuyucular için ~125 karakter yeter. */
const IMAGE_ALT_MAX = 200;
const IZINLI_DILLER = new Set(['tr', 'en', 'ar']);

/**
 * Düz metin alanları (başlık, özet, meta): HTML etiketi taşımaz.
 *
 * Eskiden ham saklanıyordu ve site bunları JSON-LD <script> bloğuna
 * gömüyordu: "</script><script>…" içeren bir başlık sayfada betik
 * çalıştırabilirdi (depolanmış XSS, editör → yönetici yetki yükseltmesi).
 * Site tarafı da artık kaçırıyor; burada ikinci kat.
 */
function duzMetin(v, enFazla) {
  if (v === undefined || v === null) return null;
  const s = String(v)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, enFazla);
  return s === '' ? null : s;
}

function dilNormalize(v, varsayilan) {
  const s = String(v ?? '').trim().toLowerCase();
  return IZINLI_DILLER.has(s) ? s : varsayilan;
}

const createSlug = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Veritabanındaki yol değerini diskteki gerçek dosyaya çevirir.
 *
 * ⚠️ Yol HAPSİ burada: eski sürüm yalnızca baştaki "/" işaretlerini kırpıyordu,
 * yani "../../.env" gibi bir değer uploads dizininin dışını gösterebiliyordu.
 * Blog güncellemede alan sınırı da olmadığı için `image` alanına böyle bir yol
 * yazıp kapak silme ucuyla sunucudaki herhangi bir dosya sildirilebilirdi.
 */
const UPLOADS_KOK = path.resolve(__dirname, '..', 'uploads');

const resolveUploadPath = (urlPath) => {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const temiz = urlPath.replace(/^\/+/, '');
  if (!temiz.startsWith('uploads/')) return null;

  const tam = path.resolve(__dirname, '..', temiz);
  // path.resolve "../" adımlarını çözer; sonuç uploads kökünün altında
  // değilse dosyaya hiç dokunmuyoruz.
  if (tam !== UPLOADS_KOK && !tam.startsWith(UPLOADS_KOK + path.sep)) return null;
  return tam;
};

/** Çakışmayan bir slug üretir. */
async function benzersizSlug(baslik, haricId = null) {
  const temel = createSlug(baslik) || 'yazi';
  for (let i = 0; i <= 50; i++) {
    const slug = i === 0 ? temel : `${temel}-${i}`;
    const varMi = await Blog.findOne({
      where: { slug, ...(haricId ? { id: { [Op.ne]: haricId } } : {}) },
      attributes: ['id'],
    });
    if (!varMi) return slug;
  }
  // Sıra dışı durum: 50 çakışma. Zaman damgası kesin çözüyor.
  return `${temel}-${Date.now()}`;
}

const ALAN_ADLARI = {
  title: 'başlık',
  slug: 'adres',
  content: 'içerik',
  excerpt: 'özet',
  tags: 'etiketler',
  meta_title: 'meta başlık',
  meta_description: 'meta açıklama',
  locale: 'dil',
  image: 'kapak',
  image_alt: 'kapak açıklaması',
};

/** Denetim karşılaştırması için yazının alanları (etiketler tek metin). */
function blogDurumu(blog) {
  return {
    title: blog.title,
    slug: blog.slug,
    content: blog.content,
    excerpt: blog.excerpt,
    tags: (blog.tags || []).join(','),
    meta_title: blog.meta_title,
    meta_description: blog.meta_description,
    locale: blog.locale,
    image: blog.image,
    image_alt: blog.image_alt,
    is_published: blog.is_published,
  };
}

/**
 * Güncellemenin denetim kaydı: yayınlama/kaldırma ayrı eylem, diğer
 * değişiklikler tek satırda alan adlarıyla ("başlık, içerik güncellendi").
 * Hiçbir şey değişmediyse (aynı formu yeniden kaydetmek) kayıt yazılmaz.
 */
async function blogGuncellemeDenetimi(req, blog, once, { ustuneYazdi = false } = {}) {
  const simdi = blogDurumu(blog);
  const degisen = Object.keys(ALAN_ADLARI).filter((k) => (simdi[k] ?? null) !== (once[k] ?? null));
  const alanlar = degisen.map((k) => ALAN_ADLARI[k]).join(', ');
  const ad = tirnak(blog.title);
  // Çakışma uyarısına rağmen kaydedildiyse iz bıraksın: "kim kimin değişikliğini ezdi?"
  const ustuneNotu = ustuneYazdi ? ' — araya giren kaydın üzerine bilerek yazdı' : '';

  if (simdi.is_published !== once.is_published) {
    await denetle(req, simdi.is_published ? 'blog.publish' : 'blog.unpublish', {
      hedefTur: 'blog',
      hedefId: blog.id,
      ozet: `${ad} yazısını ${simdi.is_published ? 'yayınladı' : 'yayından kaldırdı'}${alanlar ? ` (ayrıca güncellendi: ${alanlar})` : ''}${ustuneNotu}`,
    });
    return;
  }
  if (degisen.length) {
    const adresNotu =
      degisen.includes('slug') && once.is_published ? ` — yayındaki adres değişti: /${once.slug} → /${simdi.slug}` : '';
    await denetle(req, 'blog.update', {
      hedefTur: 'blog',
      hedefId: blog.id,
      ozet: `${ad}: ${alanlar} güncellendi${adresNotu}${ustuneNotu}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Sürümler (models/BlogRevision.js)
// ─────────────────────────────────────────────────────────────

/** Yazı başına tutulan en fazla sürüm. */
const SURUM_SINIRI = 30;
/** Sürümde saklanan (ve geri yüklenen) alanlar. Adres, kapak, yayın, dil HARİÇ. */
const SURUM_ALANLARI = ['title', 'content', 'excerpt', 'meta_title', 'meta_description', 'tags', 'image_alt'];

function surumDegerleri(kaynak) {
  return {
    title: kaynak.title,
    content: kaynak.content || '',
    excerpt: kaynak.excerpt ?? null,
    meta_title: kaynak.meta_title ?? null,
    meta_description: kaynak.meta_description ?? null,
    tags: Array.isArray(kaynak.tags) ? kaynak.tags : [],
    image_alt: kaynak.image_alt ?? null,
  };
}

function surumAlanlariDegisti(a, b) {
  return SURUM_ALANLARI.some((k) =>
    k === 'tags' ? (a.tags || []).join('\u0000') !== (b.tags || []).join('\u0000') : (a[k] ?? null) !== (b[k] ?? null)
  );
}

/**
 * Sürüm kaydı; yazı başına son SURUM_SINIRI tanesi kalır. Hata kaydı
 * DÜŞÜRMEZ: sürüm yan üründür, asıl kayıt yapıldı.
 */
async function surumKaydet(blogId, degerler, kullaniciId, zaman) {
  try {
    await BlogRevision.create({
      blog_id: blogId,
      ...degerler,
      created_by: kullaniciId || null,
      // Önceki hâlin sürümü, yazının o hâliyle son kaydedildiği zamanı taşır.
      ...(zaman ? { created_at: zaman } : {}),
    });
    const fazlalar = await BlogRevision.findAll({
      where: { blog_id: blogId },
      attributes: ['id'],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      offset: SURUM_SINIRI,
    });
    if (fazlalar.length) await BlogRevision.destroy({ where: { id: fazlalar.map((r) => r.id) } });
  } catch (e) {
    console.error('Yazı sürümü kaydedilemedi:', blogId, '—', e.message);
  }
}

/**
 * Kullanılmayan içerik görsellerini siler — ESKİ SÜRÜMLERİN görsellerini de
 * kullanılıyor sayarak: yoksa bir sürüme dönüldüğünde görselleri kırık çıkardı.
 */
async function gorselTemizligi(blog) {
  try {
    const surumler = await BlogRevision.findAll({ where: { blog_id: blog.id }, attributes: ['content'] });
    cleanupUnreferencedContentImages({
      html: [blog.content || '', ...surumler.map((s) => s.content || '')].join('\n'),
      blogId: blog.id,
      blogsDir: uploadsDir,
    });
  } catch (e) {
    console.error('İçerik görseli temizliği atlandı:', blog.id, '—', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Aynı anda düzenleme koruması
// ─────────────────────────────────────────────────────────────

/**
 * İstemci, editörü açtığı andaki `updated_at`'i gönderir. Arada başkası
 * (ya da aynı kişi başka sekmede) kaydettiyse 409: sessizce birbirinin
 * değişikliğini ezmesinler. Sürüm göndermeyen istek (eski istemci)
 * denetlenmez; `force` ile bilerek üzerine yazılır.
 */
function surumCakisiyor(blog, beklenen) {
  if (beklenen === undefined || beklenen === null || beklenen === '') return false;
  const t = new Date(beklenen).getTime();
  return !Number.isFinite(t) || t !== new Date(blog.updated_at).getTime();
}

/** 409 yanıtı: son değişikliği kim, ne zaman, ne yaptı (denetim kaydından). */
async function cakismaYaniti(req, res, blog) {
  let son = null;
  try {
    son = await AuditLog.findOne({
      where: { target_type: 'blog', target_id: blog.id },
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      include: [{ model: User, as: 'actor', attributes: ['id', 'first_name', 'last_name'], required: false }],
    });
  } catch (e) {
    console.error('Çakışma bilgisi okunamadı:', e.message);
  }
  const ad = son && son.actor ? [son.actor.first_name, son.actor.last_name].filter(Boolean).join(' ').trim() : '';
  return res.status(409).json({
    success: false,
    code: 'EDIT_CONFLICT',
    error: 'Bu yazı sen açtıktan sonra değiştirildi.',
    conflict: {
      updated_at: blog.updated_at,
      by: ad || null,
      by_me: Boolean(son && son.actor_id === req.userId),
      // Özetteki yazı adı tekrar etmesin: "“TYT planı”: içerik güncellendi" → "içerik güncellendi"
      what: son ? String(son.summary).replace(/^“[^”]*”(: | yazısını )?/, '') : null,
      at: son ? son.created_at : blog.updated_at,
    },
  });
}

/** Elle girilen adres: küçük harf, rakam, tire. 3-120 karakter. */
const SLUG_DESENI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function benzersizSlugHatasi(error) {
  return error && error.name === 'SequelizeUniqueConstraintError';
}

// ─────────────────────────────────────────────────────────────
// Okuma
// ─────────────────────────────────────────────────────────────

router.get(
  '/',
  optionalAdmin,
  asyncHandler(async (req, res) => {
    const { is_published, include_drafts, search, locale, sort, page, limit: limitParam } = req.query;
    const where = {};

    if (include_drafts === 'true' && req.isStaff) {
      if (is_published !== undefined) {
        where.is_published = is_published === 'true';
      }
    } else {
      where.is_published = true;
    }

    if (search) {
      // % ve _ kaçırılmazsa "%" tek başına tüm kayıtları eşliyor.
      const desen = `%${escapeLike(String(search).slice(0, 100))}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: desen } },
        { excerpt: { [Op.iLike]: desen } },
      ];
    }

    if (locale) {
      where.locale = String(locale).slice(0, 10);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50));
    const offset = (pageNum - 1) * limit;

    const { count, rows } = await Blog.findAndCountAll({
      where,
      /*
       * Liste yanıtında `content` GÖNDERİLMİYOR: 50 yazının tam HTML'i her
       * liste isteğinde megabaytlara çıkıyordu. Okuma süresi için gereken
       * tek şey uzunluk, onu da veritabanı hesaplıyor.
       */
      attributes: {
        exclude: ['content'],
        include: [[fn('length', col('Blog.content')), 'content_length']],
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: AUTHOR_FIELDS,
          required: false,
        },
      ],
      // Site yönetiminin "son düzenlenenler" listesi için; herkese açık liste değişmez.
      order: sort === 'updated' && req.isStaff ? [['updated_at', 'DESC']] : [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  })
);

router.get(
  '/slug/:slug',
  asyncHandler(async (req, res) => {
    const where = { slug: String(req.params.slug).slice(0, 500), is_published: true };
    // Aynı slug birden fazla dilde olabilir; istenen dil verilmişse ona bak.
    if (req.query.locale) where.locale = String(req.query.locale).slice(0, 10);

    const blog = await Blog.findOne({
      where,
      include: [{ model: User, as: 'author', attributes: AUTHOR_FIELDS }],
    });

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    res.json({ success: true, data: blog });
  })
);

router.get(
  '/:id',
  optionalAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });

    const blog = await Blog.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: AUTHOR_FIELDS }],
    });

    if (!blog || (!blog.is_published && !req.isStaff)) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    res.json({ success: true, data: blog });
  })
);

router.post(
  '/slug/:slug/view',
  viewLimiter,
  asyncHandler(async (req, res) => {
    const blog = await Blog.findOne({
      where: { slug: String(req.params.slug).slice(0, 500), is_published: true },
      attributes: ['id'],
    });
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    // Atomik artış + yeni değeri veritabanından oku: eski sürüm okuduğu eski
    // değere 1 ekleyip döndürüyordu, eşzamanlı isteklerde hepsi aynı sayıyı
    // bildiriyordu.
    const [[satir]] = await sequelize.query(
      'UPDATE blogs SET view_count = view_count + 1 WHERE id = :id RETURNING view_count',
      { replacements: { id: blog.id } }
    );

    res.json({ success: true, data: { view_count: satir ? satir.view_count : null } });
  })
);

// ─────────────────────────────────────────────────────────────
// Yazma
// ─────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { title, content, excerpt, tags, is_published, meta_title, meta_description, locale, image_alt } =
      req.body || {};

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik gerekli' });
    }
    // Nesne/dizi gelirse sanitize-html'i atlayıp veritabanına kadar gidiyor, orada 500 veriyordu.
    if (typeof title !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik metin olmalı' });
    }

    const baslik = duzMetin(title, 500);
    if (!baslik) return res.status(400).json({ success: false, error: 'Başlık boş olamaz' });

    const normalizedContent = normalizeBlogHtml(content);
    const published = toBool(is_published);
    const ozet = duzMetin(excerpt, 1000);

    const govde = {
      title: baslik,
      content: normalizedContent,
      excerpt: ozet,
      tags: Array.isArray(tags) ? tags.map((t) => duzMetin(t, 60)).filter(Boolean).slice(0, 30) : [],
      is_published: published,
      published_at: published ? new Date() : null,
      /*
       * Meta alanları BOŞSA boş kalır. Eskiden başlık ve özet buraya
       * kopyalanıyordu: yazar sonra başlığı değiştirince Google'daki başlık
       * eski hâlinde donuyordu (site zaten boş meta için başlığa/özete düşüyor).
       */
      meta_title: duzMetin(meta_title, META_TITLE_MAX),
      meta_description: duzMetin(meta_description, 320),
      image_alt: duzMetin(image_alt, IMAGE_ALT_MAX),
      locale: dilNormalize(locale, 'tr'),
      author_id: req.userId,
      view_count: 0,
    };

    let blog;
    try {
      blog = await Blog.create({ ...govde, slug: await benzersizSlug(title) });
    } catch (e) {
      // İki yazı aynı anda aynı başlıkla kaydedilirse slug denetimiyle
      // ekleme arasında yarış oluşur; ikinci deneme kesin ayrık.
      if (!benzersizSlugHatasi(e)) throw e;
      blog = await Blog.create({ ...govde, slug: `${createSlug(title) || 'yazi'}-${Date.now()}` });
    }

    // İçerikteki base64 gömülü görselleri dosyaya yaz ve src'leri URL yap.
    try {
      const persisted = await persistInlineImagesToBlogsWall({
        html: blog.content,
        blogId: blog.id,
        blogsDir: uploadsDir,
      });
      if (persisted.html !== blog.content) {
        await blog.update({ content: persisted.html });
      }
      cleanupUnreferencedContentImages({ html: blog.content, blogId: blog.id, blogsDir: uploadsDir });
    } catch (e) {
      console.error('İçerik görsel dönüştürme hatası (create):', e);
      // Blog kaydını tümden başarısız yapmıyoruz; kullanıcı tekrar güncelleyebilir.
    }

    // İlk sürüm: yazının oluşturulduğu hâl.
    await surumKaydet(blog.id, surumDegerleri(blog), req.userId);

    await denetle(req, published ? 'blog.publish' : 'blog.create', {
      hedefTur: 'blog',
      hedefId: blog.id,
      ozet: `${tirnak(blog.title)} yazısını ${published ? 'oluşturup yayınladı' : 'taslak olarak oluşturdu'}`,
    });

    res.status(201).json({ success: true, data: blog, message: 'Blog oluşturuldu.' });
  })
);

// ─── Yazı içi görsel: seçilir seçilmez yükleme ───────────────

const medyaYukleyici = createMediaUploadMiddleware().single('image');

/**
 * Editör görseli seçer seçmez buraya yükler; dönen adres içeriğe girer.
 * Denetim: uzantı + MIME (multer), ilk baytlar (sihirli sayı), 10 MB.
 * SVG kabul edilmez (içinde betik taşıyabilir). Çıktı en fazla 1600 px WebP.
 * Yazıya bağlı değil: yeni (henüz kaydedilmemiş) yazıda da çalışır;
 * sahipsiz kalanları utils/blogMedia.js temizler.
 */
router.post(
  '/media',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  (req, res, next) =>
    medyaYukleyici(req, res, (err) => {
      if (!err) return next();
      const mesaj =
        err.code === 'LIMIT_FILE_SIZE'
          ? "Görsel 10 MB'ı aşıyor. Daha küçük bir dosya seç."
          : err.name === 'MulterError'
            ? 'Görsel yüklenemedi (tek dosya, "image" alanında).'
            : err.message;
      return res.status(400).json({ success: false, code: 'BAD_IMAGE', error: mesaj });
    }),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, code: 'BAD_IMAGE', error: 'Görsel seçilmedi.' });
    }
    const tur = sniffImage(req.file.buffer);
    if (!tur) {
      return res
        .status(400)
        .json({ success: false, code: 'BAD_IMAGE', error: 'Dosya geçerli bir resim değil (JPEG, PNG, WebP, GIF).' });
    }
    let islenmis;
    try {
      islenmis = await gorseliIsle(req.file.buffer, tur);
    } catch (e) {
      console.error('Yazı görseli işlenemedi:', e.message);
      return res
        .status(400)
        .json({ success: false, code: 'BAD_IMAGE', error: 'Görsel işlenemedi; dosya bozuk ya da çok büyük olabilir.' });
    }
    const url = gorseliKaydet(islenmis.data);
    res.status(201).json({ success: true, data: { url, width: islenmis.width, height: islenmis.height } });
  })
);

router.post(
  '/:id/image',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });

    const blog = await Blog.findByPk(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    const eskiGorsel = blog.image;
    const upload = createBlogWallUploadMiddleware(blog.id);

    upload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Resim yüklenmedi' });
      }

      const sil = (p) => {
        try {
          if (p && fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {
          console.error('Dosya silinemedi:', p, e.message);
        }
      };

      // Uzantı ve MIME istemcinin söyledikleri; asıl kanıt ilk baytlar.
      if (!sniffImageFile(req.file.path)) {
        sil(req.file.path);
        return res
          .status(400)
          .json({ success: false, error: 'Dosya geçerli bir resim değil (JPEG, PNG, WebP, GIF).' });
      }

      try {
        const { newFilename } = await convertToWebp(req.file.path);
        const imageUrl = `/uploads/blogsWall/${blog.id}/${newFilename}`;
        blog.image = imageUrl;
        await blog.save();
        await denetle(req, 'blog.cover', {
          hedefTur: 'blog',
          hedefId: blog.id,
          ozet: `${tirnak(blog.title)}: kapak görselini ${eskiGorsel ? 'değiştirdi' : 'ekledi'}`,
        });

        // Eski kapak ancak YENİSİ kaydedildikten sonra siliniyor: eski sürüm
        // önce siliyordu, yükleme reddedilince blog kaybolmuş bir dosyayı
        // gösterir kalıyordu.
        if (eskiGorsel && eskiGorsel !== imageUrl) sil(resolveUploadPath(eskiGorsel));

        res.json({
          success: true,
          data: { image: imageUrl },
          message: 'Resim başarıyla yüklendi',
        });
      } catch (convErr) {
        console.error('Kapak resmi dönüştürme hatası:', convErr);
        // Dönüştürülemeyen ham dosya herkese açık dizinde kalmasın.
        sil(req.file.path);
        res.status(500).json({ success: false, error: 'Resim işlenirken bir hata oluştu' });
      }
    });
  })
);

router.delete(
  '/:id/image',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });

    const blog = await Blog.findByPk(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }
    if (!blog.image) {
      return res.json({ success: true, data: { image: null }, message: 'Blog kapağı zaten boş' });
    }

    const imagePath = resolveUploadPath(blog.image);
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {
        console.error('Kapak resmi silme hatası:', e);
      }
    }

    blog.image = null;
    blog.image_alt = null;
    await blog.save();
    await denetle(req, 'blog.cover', { hedefTur: 'blog', hedefId: blog.id, ozet: `${tirnak(blog.title)}: kapak görselini kaldırdı` });

    return res.json({ success: true, data: { image: null }, message: 'Blog kapağı silindi' });
  })
);

router.put(
  '/:id',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });

    const blog = await Blog.findByPk(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    // Aynı anda düzenleme: editörün açtığı sürüm eskidiyse yazmadan dön.
    const zorla = toBool((req.body || {}).force);
    const cakisma = surumCakisiyor(blog, (req.body || {}).expected_updated_at);
    if (cakisma && !zorla) return cakismaYaniti(req, res, blog);

    /*
     * ALAN SINIRI (allowlist). Eskiden `{ ...req.body }` doğrudan update'e
     * gidiyordu: içerik yetkisi olan herkes author_id, slug, view_count,
     * created_at — hatta `image` alanını (dosya yolu!) yazabiliyordu.
     */
    const gelen = req.body || {};
    const updateData = {};
    for (const alan of GUNCELLENEBILIR_ALANLAR) {
      if (gelen[alan] !== undefined) updateData[alan] = gelen[alan];
    }

    if (updateData.content !== undefined && updateData.content !== null && typeof updateData.content !== 'string') {
      return res.status(400).json({ success: false, error: 'İçerik metin olmalı' });
    }
    if (updateData.title !== undefined && typeof updateData.title !== 'string') {
      return res.status(400).json({ success: false, error: 'Başlık metin olmalı' });
    }

    // Denetim kaydı ve sürüm için önceki hâl (güncellemeden sonra blog nesnesi değişiyor).
    const once = blogDurumu(blog);
    const onceSurum = surumDegerleri(blog);
    const onceZaman = blog.updated_at;

    if (updateData.title !== undefined) {
      updateData.title = duzMetin(updateData.title, 500);
      if (!updateData.title) return res.status(400).json({ success: false, error: 'Başlık boş olamaz' });
    }
    if (updateData.excerpt !== undefined) updateData.excerpt = duzMetin(updateData.excerpt, 1000);
    if (updateData.meta_title !== undefined) {
      updateData.meta_title = duzMetin(updateData.meta_title, META_TITLE_MAX);
    }
    if (updateData.meta_description !== undefined) {
      updateData.meta_description = duzMetin(updateData.meta_description, 320);
    }
    if (updateData.image_alt !== undefined) updateData.image_alt = duzMetin(updateData.image_alt, IMAGE_ALT_MAX);
    if (updateData.tags !== undefined) {
      updateData.tags = Array.isArray(updateData.tags)
        ? updateData.tags.map((t) => duzMetin(t, 60)).filter(Boolean).slice(0, 30)
        : [];
    }
    if (updateData.locale !== undefined) updateData.locale = dilNormalize(updateData.locale, blog.locale);

    // İçerik: XSS temizliği + base64 gömülü görselleri dosyaya yaz.
    if (updateData.content !== undefined && updateData.content !== null) {
      const normalized = normalizeBlogHtml(updateData.content);
      const persisted = await persistInlineImagesToBlogsWall({
        html: normalized,
        blogId: blog.id,
        blogsDir: uploadsDir,
      });
      updateData.content = persisted.html;
    }

    /*
     * Kapak: yalnızca SİLME isteği kabul edilir (null / ''). Serbest bir yol
     * değeri kabul etmek, dosya silme ucuyla birleşince sunucudaki herhangi
     * bir dosyayı sildirebilirdi. Yeni kapak POST /:id/image ile yüklenir.
     */
    if (gelen.image === null || gelen.image === '') {
      if (blog.image) {
        const oldImagePath = resolveUploadPath(blog.image);
        if (oldImagePath && fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (e) {
            console.error('Kapak resmi silme hatası:', e);
          }
        }
      }
      updateData.image = null;
      // Görsel yoksa açıklaması da anlamsız; sonraki kapak eski açıklamayı devralmasın.
      updateData.image_alt = null;
    }

    /*
     * ADRES (slug) KURALI:
     *  · Elle verilen slug her zaman kazanır (biçim + benzersizlik denetlenir).
     *  · Yayındaki yazının adresi başlık değişince DEĞİŞMEZ: paylaşılmış,
     *    indekslenmiş bir bağlantı 404 vermemeli. Eskiden başlıktaki tek bir
     *    harf düzeltmesi bile canlı adresi kırıyordu.
     *  · Taslakta başlık değişince adres başlığı izler (henüz kimse görmedi).
     */
    if (updateData.slug !== undefined) {
      const istenen = String(updateData.slug).trim().toLowerCase();
      if (!SLUG_DESENI.test(istenen) || istenen.length < 3 || istenen.length > 120) {
        return res.status(400).json({
          success: false,
          error: 'Adres yalnızca küçük harf, rakam ve tire içerebilir (3-120 karakter). Örnek: tyt-matematik-plani',
        });
      }
      if (istenen !== blog.slug) {
        const dolu = await Blog.findOne({ where: { slug: istenen, id: { [Op.ne]: blog.id } }, attributes: ['id'] });
        if (dolu) return res.status(400).json({ success: false, error: 'Bu adres başka bir yazıda kullanılıyor.' });
      }
      updateData.slug = istenen;
    } else if (updateData.title && updateData.title !== blog.title && !blog.is_published) {
      updateData.slug = await benzersizSlug(updateData.title, blog.id);
    }

    if (updateData.is_published !== undefined) {
      const published = toBool(updateData.is_published);
      updateData.is_published = published;
      if (published && !blog.published_at) {
        updateData.published_at = new Date();
      }
      // Yayından kaldırılan yazının tarihi de temizlenir; eskiden kalıyordu ve
      // yazı yeniden yayınlandığında site eski tarihi gösteriyordu.
      if (!published) {
        updateData.published_at = null;
      }
    }

    try {
      await blog.update(updateData);
    } catch (e) {
      if (!benzersizSlugHatasi(e)) throw e;
      await blog.update({
        ...updateData,
        slug: `${createSlug(updateData.title || blog.title) || 'yazi'}-${Date.now()}`,
      });
    }

    // Metin alanları değiştiyse sürüm. Bu özellikten önce oluşturulmuş yazının
    // hiç sürümü yoksa önce ESKİ hâlini kaydet: ilk düzenleme de geri alınabilsin.
    const yeniSurum = surumDegerleri(blog);
    if (surumAlanlariDegisti(onceSurum, yeniSurum)) {
      if ((await BlogRevision.count({ where: { blog_id: blog.id } })) === 0) {
        await surumKaydet(blog.id, onceSurum, blog.author_id, onceZaman);
      }
      await surumKaydet(blog.id, yeniSurum, req.userId);
    }

    if (updateData.content !== undefined) await gorselTemizligi(blog);

    await blogGuncellemeDenetimi(req, blog, once, { ustuneYazdi: cakisma && zorla });

    res.json({ success: true, data: blog, message: 'Blog güncellendi.' });
  })
);

// ─── Sürümler ────────────────────────────────────────────────

const SURUM_YAZARI = { model: User, as: 'author', attributes: ['id', 'first_name', 'last_name'], required: false };

/** Sürüm listesi (içeriksiz): en yeni önce; ilk satır yazının şu anki hâli. */
router.get(
  '/:id/revisions',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const blog = id ? await Blog.findByPk(id, { attributes: ['id'] }) : null;
    if (!blog) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    const rows = await BlogRevision.findAll({
      where: { blog_id: id },
      attributes: ['id', 'title', 'created_at', 'created_by', [fn('length', col('BlogRevision.content')), 'content_length']],
      include: [SURUM_YAZARI],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: SURUM_SINIRI,
    });
    res.json({ success: true, data: rows });
  })
);

/** Tek sürüm, tam içerikle (önizleme için). */
router.get(
  '/:id/revisions/:rid',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const rid = parseId(req.params.rid);
    const surum = id && rid ? await BlogRevision.findOne({ where: { id: rid, blog_id: id }, include: [SURUM_YAZARI] }) : null;
    if (!surum) return res.status(404).json({ success: false, error: 'Sürüm bulunamadı' });
    res.json({ success: true, data: surum });
  })
);

/**
 * Sürüme dön: metin alanları (başlık, içerik, özet, meta, etiketler, kapak
 * açıklaması) o sürümdeki hâline gelir. Adres, kapak, yayın durumu ve dil
 * DEĞİŞMEZ. Geri dönüş de yeni bir sürüm olarak kaydedilir (geri alınabilir).
 */
router.post(
  '/:id/revisions/:rid/restore',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const rid = parseId(req.params.rid);
    const blog = id ? await Blog.findByPk(id) : null;
    if (!blog) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    const surum = rid ? await BlogRevision.findOne({ where: { id: rid, blog_id: id } }) : null;
    if (!surum) return res.status(404).json({ success: false, error: 'Sürüm bulunamadı' });

    // Sürüme dönüş de aynı korumadan geçer: sayfa açıldıktan sonra yazı değiştiyse 409.
    const b = req.body || {};
    if (!toBool(b.force) && surumCakisiyor(blog, b.expected_updated_at)) return cakismaYaniti(req, res, blog);

    const hedef = surumDegerleri(surum);
    if (!surumAlanlariDegisti(surumDegerleri(blog), hedef)) {
      return res.json({ success: true, data: blog, message: 'Yazı zaten bu sürümle aynı.' });
    }
    await blog.update(hedef);
    await surumKaydet(blog.id, surumDegerleri(blog), req.userId);
    await gorselTemizligi(blog);

    const tarih = new Date(surum.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' });
    await denetle(req, 'blog.restore', {
      hedefTur: 'blog',
      hedefId: blog.id,
      ozet: `${tirnak(blog.title)}: ${tarih} tarihli sürüme döndü`,
    });
    res.json({ success: true, data: blog, message: 'Yazı seçilen sürüme döndü.' });
  })
);

router.delete(
  '/:id',
  authenticateAdmin,
  requireRole(...CONTENT_ROLES),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Blog bulunamadı' });

    const blog = await Blog.findByPk(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    // ÖNCE kayıt siliniyor: eski sıralamada dosyalar silinip ardından
    // destroy() başarısız olursa, blog kayıp dosyaları gösterir kalıyordu.
    await blog.destroy();

    deleteBlogFolder(blog.id);
    deleteBlogWallFolder(blog.id);
    await denetle(req, 'blog.delete', {
      hedefTur: 'blog',
      hedefId: blog.id,
      ozet: `${tirnak(blog.title)} yazısını sildi${blog.is_published ? ' (yayındaydı)' : ''}`,
    });

    res.json({ success: true, message: 'Blog ve tüm resimleri silindi.' });
  })
);

module.exports = router;
