const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Siteden gelen iletişim mesajları.
 *
 * Neden veritabanı: mesaj yalnızca e-posta ile iletilseydi, SMTP bir gün
 * susunca (kota, parola değişimi, spam filtresi) gelen talepler sessizce
 * kaybolurdu. Kayıt önce buraya düşer; bildirim e-postası bunun üstüne,
 * "olursa iyi olur" katmanıdır.
 *
 * KVKK: ad, e-posta, telefon ve mesaj kişisel veridir. IP'nin kendisi
 * saklanmaz, yalnızca tekrarlayan spam'i tanımaya yetecek bir özeti tutulur.
 */
const ContactMessage = sequelize.define(
  'ContactMessage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    /** Hangi dildeki siteden geldi — yanıtı o dilde yazmak için. */
    locale: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'tr',
    },
    /** Hangi form: "contact" (iletişim sayfası) veya "hero" (ana sayfa kısa form). */
    source: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'contact',
    },
    /** new | read | archived | spam */
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'new',
    },
    /** Panelde kimin ilgilendiği görünsün diye. */
    handled_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    handled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** IP'nin tuzlanmış özeti (ham IP saklanmıyor). */
    ip_hash: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
  },
  {
    tableName: 'contact_messages',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['status', 'created_at'] },
      { fields: ['created_at'] },
      { fields: ['email'] },
    ],
  }
);

module.exports = ContactMessage;
