const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Personel işlemlerinin kalıcı izi: kim, ne zaman, neyi yaptı.
 *
 * Eskiden yalnızca günlüğe yazılıyordu ("[denetim] …"): konteyner yeniden
 * başlayınca kayboluyordu ve "bu yazıyı kim yayından kaldırdı?", "bu hesabı
 * kim açtı?" sorularının cevabı yoktu. Site yönetiminde yalnızca yönetici
 * okur (/admin/etkinlik).
 *
 * Saklanan: işlemi yapanın kimliği ile o anki e-postası ve rolü (hesap
 * silinse de iz okunabilsin), eylem kodu, hedef, kısa Türkçe özet.
 * Saklanmayan: IP, yazı ve mesaj metinleri (KVKK: gereği kadar).
 * Ömür: 365 gün (utils/audit.js → eskiDenetimKayitlariniSil).
 */
const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    /** İşlemi yapan personel; oturumsuz işlemlerde (parolamı unuttum) boş. */
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actor_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    actor_role: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    /** Nokta ayrımlı eylem kodu: blog.publish, message.status, user.role … */
    action: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    /** blog | message | user | auth */
    target_type: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** İnsanın okuyacağı tek satır: "“TYT planı” yayınlandı". */
    summary: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
  },
  {
    tableName: 'audit_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['created_at'] },
      { fields: ['actor_id', 'created_at'] },
      { fields: ['target_type', 'target_id'] },
    ],
  }
);

module.exports = AuditLog;
