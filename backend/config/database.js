const { Sequelize, DataTypes } = require('sequelize');
require('./env');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.DB_LOG_ALL_SQL === 'true' ? console.log : false,
  pool: {
    max: 10,
    min: 1,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
});

const testConnection = async () => {
  await sequelize.authenticate();
  console.log('✅ PostgreSQL bağlantısı başarılı');
};

/**
 * sync() yeni TABLO açar ama var olan tabloya SÜTUN eklemez (alter kapalı,
 * üretimde açılmamalı). Sonradan eklenen sütunlar burada "yoksa ekle" diye
 * listelenir; her açılışta çalışır, idempotent.
 */
const EK_SUTUNLAR = [
  { tablo: 'users', sutun: 'password_changed_at', tanim: { type: DataTypes.DATE, allowNull: true } },
];

async function ensureColumns() {
  const qi = sequelize.getQueryInterface();
  for (const { tablo, sutun, tanim } of EK_SUTUNLAR) {
    const mevcut = await qi.describeTable(tablo);
    if (!mevcut[sutun]) {
      await qi.addColumn(tablo, sutun, tanim);
      console.log(`· Sütun eklendi: ${tablo}.${sutun}`);
    }
  }
}

const syncDatabase = async () => {
  require('../models');
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });
  await ensureColumns();
  console.log('✅ Veritabanı tabloları senkronize edildi');
};

const closeConnection = async () => {
  await sequelize.close();
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
};
