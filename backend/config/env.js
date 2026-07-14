const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!isNonEmptyString(String(v || ''))) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

function requireOneOf(names) {
  for (const n of names) {
    if (isNonEmptyString(process.env[n])) return String(process.env[n]).trim();
  }
  throw new Error(`Missing required env: ${names.join(' or ')}`);
}

requireEnv('JWT_SECRET');
requireEnv('DB_HOST');
requireEnv('DB_NAME');
requireEnv('DB_USER');
requireEnv('DB_PASSWORD');
requireOneOf(['FRONTEND_URL', 'SITE_URL']);
requireOneOf(['BACKEND_URL', 'API_URL']);

module.exports = {
  JWT_SECRET: requireEnv('JWT_SECRET'),
  FRONTEND_URL: requireOneOf(['FRONTEND_URL', 'SITE_URL']),
  ADMIN_URL: String(process.env.ADMIN_URL || 'http://localhost:3001').trim(),
  BACKEND_URL: requireOneOf(['BACKEND_URL', 'API_URL']),
};
