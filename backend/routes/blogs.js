const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op, fn, col } = require('sequelize');
const {
  createBlogWallUploadMiddleware,
  uploadsDir,
  deleteBlogFolder,
  deleteBlogWallFolder,
} = require('../middleware/blogUpload');
const { authenticateAdmin, requireRole, optionalAdmin } = require('../middleware/auth');
const { CONTENT_ROLES } = require('../utils/roles');
const { writeLimiter, viewLimiter } = require('../middleware/rateLimits');
const { parseId, escapeLike, asyncHandler, toBool } = require('../utils/http');
const { sequelize } = require('../config/database');
const { Blog, User } = require('../models');
const {
  normalizeBlogHtml,
  persistInlineImagesToBlogsWall,
  cleanupUnreferencedContentImages,
} = require('../utils/blogContent');
const { convertToWebp } = require('../utils/imageConverter');
const { sniffImageFile } = require('../utils/imageSignature');

const router = express.Router();

const AUTHOR_FIELDS = ['id', 'username', 'first_name', 'last_name'];

/** Yalnızca bu alanlar istemciden güncellenebilir. */
const GUNCELLENEBILIR_ALANLAR = [
  'title',
  'content',
  'excerpt',
  'tags',
  'is_published',
  'meta_title',
  'meta_description',
  'locale',
];

const META_TITLE_MAX = 255;

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
    const { is_published, include_drafts, search, locale, page, limit: limitParam } = req.query;
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
      order: [['created_at', 'DESC']],
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
    const { title, content, excerpt, tags, is_published, meta_title, meta_description, locale } =
      req.body || {};

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik gerekli' });
    }

    const normalizedContent = normalizeBlogHtml(content);
    const published = toBool(is_published);

    const govde = {
      title: String(title).slice(0, 500),
      content: normalizedContent,
      excerpt: excerpt || null,
      tags: Array.isArray(tags) ? tags.slice(0, 30).map((t) => String(t).slice(0, 60)) : [],
      is_published: published,
      published_at: published ? new Date() : null,
      // meta_title sütunu 255; başlık 500 olabiliyor ve taşma kaydı 500
      // hatasıyla düşürüyordu.
      meta_title: String(meta_title || title).slice(0, META_TITLE_MAX),
      meta_description: meta_description || excerpt || null,
      locale: String(locale || 'tr').slice(0, 10),
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

    res.status(201).json({ success: true, data: blog, message: 'Blog oluşturuldu.' });
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
    await blog.save();

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

    if (updateData.title !== undefined) updateData.title = String(updateData.title).slice(0, 500);
    if (updateData.meta_title !== undefined) {
      updateData.meta_title = String(updateData.meta_title).slice(0, META_TITLE_MAX);
    }
    if (updateData.tags !== undefined) {
      updateData.tags = Array.isArray(updateData.tags)
        ? updateData.tags.slice(0, 30).map((t) => String(t).slice(0, 60))
        : [];
    }
    if (updateData.locale !== undefined) updateData.locale = String(updateData.locale).slice(0, 10);

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
    }

    if (updateData.title && updateData.title !== blog.title) {
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

    if (updateData.content !== undefined) {
      cleanupUnreferencedContentImages({ html: blog.content, blogId: blog.id, blogsDir: uploadsDir });
    }

    res.json({ success: true, data: blog, message: 'Blog güncellendi.' });
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

    res.json({ success: true, message: 'Blog ve tüm resimleri silindi.' });
  })
);

module.exports = router;
