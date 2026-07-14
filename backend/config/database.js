const { Sequelize } = require('sequelize');
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

const syncDatabase = async () => {
  require('../models');
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });
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
