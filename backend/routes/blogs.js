const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const {
  createBlogWallUploadMiddleware,
  blogsWallDir,
  uploadsDir,
  deleteBlogFolder,
  deleteBlogWallFolder,
} = require('../middleware/blogUpload');
const { authenticateAdmin, requireRole, optionalAdmin } = require('../middleware/auth');
const { CONTENT_ROLES } = require('../utils/roles');
const { Blog, User } = require('../models');
const {
  normalizeBlogHtml,
  persistInlineImagesToBlogsWall,
  cleanupUnreferencedContentImages,
} = require('../utils/blogContent');
const { convertToWebp } = require('../utils/imageConverter');

const router = express.Router();

const createSlug = (text) =>
  text
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

const resolveUploadPath = (urlPath) => {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const clean = urlPath.replace(/^\/+/, '');
  return path.join(__dirname, '..', clean);
};

router.get('/', optionalAdmin, async (req, res) => {
  try {
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
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (locale) {
      where.locale = locale;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50));
    const offset = (pageNum - 1) * limit;

    const { count, rows } = await Blog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'first_name', 'last_name'],
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
  } catch (error) {
    console.error('Blog listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({
      where: { slug: req.params.slug, is_published: true },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'first_name', 'last_name'] }],
    });

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Blog getirme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.get('/:id', optionalAdmin, async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'first_name', 'last_name'] }],
    });

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    if (!blog.is_published && !req.isStaff) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Blog getirme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.post('/slug/:slug/view', async (req, res) => {
  try {
    const blog = await Blog.findOne({
      where: { slug: req.params.slug, is_published: true },
    });
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }
    await blog.increment('view_count');
    res.json({ success: true, data: { view_count: blog.view_count + 1 } });
  } catch (error) {
    console.error('View count hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.post('/', authenticateAdmin, requireRole(...CONTENT_ROLES), async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      tags,
      is_published,
      meta_title,
      meta_description,
      locale,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik gerekli' });
    }

    const normalizedContent = normalizeBlogHtml(content);

    let slug = createSlug(title);
    let existingBlog = await Blog.findOne({ where: { slug } });
    let counter = 1;
    while (existingBlog) {
      slug = `${createSlug(title)}-${counter}`;
      existingBlog = await Blog.findOne({ where: { slug } });
      counter++;
    }

    const published = is_published === true || is_published === 'true';
    const blog = await Blog.create({
      title,
      slug,
      content: normalizedContent,
      excerpt: excerpt || null,
      tags: Array.isArray(tags) ? tags : [],
      is_published: published,
      published_at: published ? new Date() : null,
      meta_title: meta_title || title,
      meta_description: meta_description || excerpt || null,
      locale: locale || 'tr',
      author_id: req.userId,
      view_count: 0,
    });

    // İçerikte base64 gömülü görseller varsa dosyaya yaz ve src'leri URL ile değiştir
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
      // Blog kaydını tümden başarısız yapma; kullanıcı tekrar güncelleyebilir.
    }

    res.json({ success: true, data: blog, message: 'Blog oluşturuldu.' });
  } catch (error) {
    console.error('Blog oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.post('/:id/image', authenticateAdmin, requireRole(...CONTENT_ROLES), async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    if (blog.image) {
      const oldImagePath = resolveUploadPath(blog.image);
      if (oldImagePath && fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    const upload = createBlogWallUploadMiddleware(blog.id);
    upload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Resim yüklenmedi' });
      }

      try {
        const { newFilename } = await convertToWebp(req.file.path);
        const imageUrl = `/uploads/blogsWall/${blog.id}/${newFilename}`;
        blog.image = imageUrl;
        await blog.save();

        res.json({
          success: true,
          data: { image: imageUrl },
          message: 'Resim başarıyla yüklendi',
        });
      } catch (convErr) {
        console.error('Kapak resmi dönüştürme hatası:', convErr);
        res.status(500).json({ success: false, error: 'Resim işlenirken bir hata oluştu' });
      }
    });
  } catch (error) {
    console.error('Resim yükleme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.delete('/:id/image', authenticateAdmin, requireRole(...CONTENT_ROLES), async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
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
  } catch (error) {
    console.error('Kapak resmi silme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.put('/:id', authenticateAdmin, requireRole(...CONTENT_ROLES), async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    const updateData = { ...req.body };

    // İçerik: normalize (XSS temizliği) + base64 gömülü görselleri dosyaya yaz
    if (updateData.content !== undefined && updateData.content !== null) {
      const normalized = normalizeBlogHtml(updateData.content);
      const persisted = await persistInlineImagesToBlogsWall({
        html: normalized,
        blogId: blog.id,
        blogsDir: uploadsDir,
      });
      updateData.content = persisted.html;
    }

    // Kapak yalnızca AÇIKÇA null/'' gönderilirse silinir (içerik düzenlemede image gelmez → dokunulmaz)
    if (updateData.image === null || updateData.image === '') {
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
      let slug = createSlug(updateData.title);
      let existingBlog = await Blog.findOne({ where: { slug, id: { [Op.ne]: blog.id } } });
      let counter = 1;
      while (existingBlog) {
        slug = `${createSlug(updateData.title)}-${counter}`;
        existingBlog = await Blog.findOne({ where: { slug, id: { [Op.ne]: blog.id } } });
        counter++;
      }
      updateData.slug = slug;
    }

    if (updateData.is_published !== undefined) {
      const published = updateData.is_published === true || updateData.is_published === 'true';
      updateData.is_published = published;
      if (published && !blog.published_at) {
        updateData.published_at = new Date();
      }
    }

    await blog.update(updateData);

    // Güncelleme sonrası içerikte artık referans edilmeyen content_* dosyalarını temizle
    if (updateData.content !== undefined) {
      cleanupUnreferencedContentImages({ html: blog.content, blogId: blog.id, blogsDir: uploadsDir });
    }

    res.json({ success: true, data: blog, message: 'Blog güncellendi.' });
  } catch (error) {
    console.error('Blog güncelleme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

router.delete('/:id', authenticateAdmin, requireRole(...CONTENT_ROLES), async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog bulunamadı' });
    }

    // Blog klasörlerini sil: içerik görselleri (uploads/blogs/{id}) + kapak (uploads/blogsWall/{id})
    deleteBlogFolder(blog.id);
    deleteBlogWallFolder(blog.id);

    await blog.destroy();
    res.json({ success: true, message: 'Blog ve tüm resimleri silindi.' });
  } catch (error) {
    console.error('Blog silme hatası:', error);
    res.status(500).json({ success: false, error: 'Bir hata oluştu' });
  }
});

module.exports = router;
