const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Blog = sequelize.define(
  'Blog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    published_at: {
      type: DataTypes.DATE,
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
    view_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locale: {
      type: DataTypes.STRING(10),
      defaultValue: 'tr',
      allowNull: false,
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'blogs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    /*
     * Liste sorgusu is_published + locale süzüp created_at'e göre sıralıyor.
     * Bu indeksler YALNIZCA tablo ilk kez oluşturulurken kurulur (sync);
     * var olan veritabanına eklemek için: npm run db:indexes
     */
    indexes: [
      { fields: ['is_published', 'created_at'] },
      { fields: ['locale', 'is_published', 'created_at'] },
      { fields: ['author_id'] },
    ],
  }
);

module.exports = Blog;
