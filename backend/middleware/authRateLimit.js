const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'ADMIN_LOGIN_RATE_LIMIT',
    error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  },
});

module.exports = {
  adminLoginLimiter,
};
