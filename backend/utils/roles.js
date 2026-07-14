// Admin panel personel rolleri — tek doğruluk kaynağı.
// Yetki hiyerarşisi (yüksekten düşüğe): admin > manager > editor > viewer
const ROLES = ['admin', 'manager', 'editor', 'viewer'];
const DEFAULT_ROLE = 'viewer';

// Blog içeriğini oluşturabilen/düzenleyebilen roller (viewer salt-okunur).
const CONTENT_ROLES = ['admin', 'manager', 'editor'];

// Kullanıcı yönetimi görebilen roller (oluştur/sil/rol değişimi yalnız admin).
const USER_MANAGE_ROLES = ['admin', 'manager'];

const isValidRole = (r) => ROLES.includes(r);
const normalizeRole = (r) => (isValidRole(r) ? r : DEFAULT_ROLE);

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  CONTENT_ROLES,
  USER_MANAGE_ROLES,
  isValidRole,
  normalizeRole,
};
