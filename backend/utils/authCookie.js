const { IS_PRODUCTION } = require('../config/env');

const ADMIN_JWT_COOKIE = 'admin_access_token';

function getAdminCookieOptions() {
  const domain = (process.env.AUTH_COOKIE_DOMAIN || '').trim();
  const opts = {
    httpOnly: true,
    // IS_PRODUCTION kapalı tarafa düşüyor (yalnızca NODE_ENV=development geliştirme
    // sayılır) — NODE_ENV'i tanımlamayı unutmak oturum çerezini düz HTTP'ye açıyordu.
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: 6 * 60 * 60 * 1000,
  };
  if (domain) opts.domain = domain;
  return opts;
}

function setAdminAuthCookie(res, token) {
  res.cookie(ADMIN_JWT_COOKIE, token, getAdminCookieOptions());
}

function clearAdminAuthCookie(res) {
  const o = getAdminCookieOptions();
  res.clearCookie(ADMIN_JWT_COOKIE, {
    httpOnly: o.httpOnly,
    secure: o.secure,
    sameSite: o.sameSite,
    path: o.path,
    ...(o.domain ? { domain: o.domain } : {}),
  });
}

module.exports = {
  ADMIN_JWT_COOKIE,
  setAdminAuthCookie,
  clearAdminAuthCookie,
  getAdminCookieOptions,
};
