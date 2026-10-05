const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'viewer',
      validate: {
        isIn: [['admin', 'manager', 'editor', 'viewer']],
      },
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /**
     * Parola en son ne zaman değişti. Bu andan ÖNCE imzalanmış oturum
     * jetonları geçersizdir (middleware/auth.js): çalınan bir çerez, parola
     * değişince 6 saat daha çalışmaz.
     */
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /**
     * "Bütün cihazlardan çıkış": bu andan önce imzalanmış jetonlar da
     * geçersiz. Parolayı değiştirmeden oturumları kapatmak için (kayıp
     * telefon, ortak bilgisayar). İki panelin de oturumu düşer.
     */
    sessions_revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = User;
