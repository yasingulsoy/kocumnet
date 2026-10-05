const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Yazı sürümleri: içeriği değiştiren her kayıttan sonra yazının o anki
 * metin alanlarının anlık görüntüsü. En yenisi yazının şu anki hâlidir.
 *
 * Neden: yanlışlıkla silinen bir paragraf, üstüne yazılan bir taslak ya da
 * iki editörün birbirinin değişikliğini ezmesi geri alınabilsin. Yazı başına
 * son 30 sürüm tutulur (routes/blogs.js → SURUM_SINIRI); yazı silinince
 * sürümleri de silinir (CASCADE).
 *
 * Saklanmayanlar: adres (slug), kapak dosyası, yayın durumu, dil — geri
 * yükleme yayındaki adresi ya da yayın durumunu değiştirmesin.
 */
const BlogRevision = sequelize.define(
  'BlogRevision',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    blog_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'blogs', key: 'id' },
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    image_alt: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    /** Bu sürümü kaydeden personel (hesap silinse de sürüm kalır). */
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'blog_revisions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['blog_id', 'created_at'] }],
  }
);

module.exports = BlogRevision;
