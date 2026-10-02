const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Personel için tek kullanımlık bağlantı jetonları: davet (parola belirleme)
 * ve parola sıfırlama.
 *
 * Jetonun kendisi SAKLANMAZ, SHA-256 özeti saklanır: veritabanı sızsa bile
 * geçerli bir bağlantı üretilemez. Jeton 32 bayt rastgele olduğu için yavaş
 * KDF gerekmez (sözlük saldırısına konu değil).
 */
const StaffToken = sequelize.define(
  'StaffToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    /** invite | reset */
    purpose: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Daveti/sıfırlamayı başlatan personel (varsa). */
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'staff_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id', 'purpose'] }, { fields: ['expires_at'] }],
  }
);

module.exports = StaffToken;
