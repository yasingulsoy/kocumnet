const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Mesajlara hazır yanıt şablonları.
 *
 * Neden tablo, neden kodda sabit metin değil: yanıtların dili işletmenin
 * dili (fiyat, paket, görüşme düzeni gibi henüz netleşmemiş konulara
 * değiniyor); her ifade değişikliği için kod dağıtımı gerekmemeli ve metni
 * mesajları yanıtlayan ekip yazmalı. Şablon SMTP gerektirmez: panel,
 * gönderenin dilindeki şablonu mailto: gövdesine koyar, posta personelin
 * kendi istemcisinden gider.
 *
 * Yer tutucular: {ad} gönderenin adı, {imza} yanıtlayan personelin adı,
 * {konu} mesajın konusu.
 */
const ReplyTemplate = sequelize.define(
  'ReplyTemplate',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    /** Panelde görünen kısa ad: "Teşekkür, sizi arayacağız". */
    title: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    /** tr | en | ar — gönderenin diline göre önerilir. */
    locale: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: 'tr',
    },
    /** Düz metin; e-posta gövdesi. */
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    /** Listedeki sıra (küçük önce). */
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'reply_templates',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['locale', 'sort_order'] }],
  }
);

module.exports = ReplyTemplate;
