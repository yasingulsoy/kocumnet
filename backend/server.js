const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { FRONTEND_URL, ADMIN_URL } = require('./config/env');
const { testConnection, syncDatabase, closeConnection } = require('./config/database');
const { createCsrfToken, csrfProtection } = require('./middleware/csrf');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  corsOrigins.push(FRONTEND_URL, ADMIN_URL, 'http://localhost:3000', 'http://localhost:3001');
}

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Kocumnet API çalışıyor' });
});

app.get('/api/csrf-token', (_req, res) => {
  res.json({ csrfToken: createCsrfToken() });
});

app.use('/api', csrfProtection);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/blogs', require('./routes/blogs'));

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı' });
});

app.use((err, _req, res, _next) => {
  console.error('Sunucu hatası:', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

async function start() {
  await testConnection();
  await syncDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Kocumnet API http://127.0.0.1:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

start().catch((err) => {
  console.error('Sunucu başlatılamadı:', err.message);
  process.exit(1);
});
