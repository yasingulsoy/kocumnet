const { Op } = require('sequelize');

/**
 * Denetim kaydı — personel işlemlerinin izi.
 *
 * Her kayıt iki yere gider: sunucu günlüğüne (eskisi gibi, "[denetim] …")
 * ve audit_logs tablosuna (models/AuditLog.js). Tabloya yazılamazsa asıl
 * işlem BOZULMAZ: denetim yan etkidir; hata yalnızca günlüğe düşer.
 *
 * Kullanım:
 *   await denetle(req, 'blog.publish', { hedefTur: 'blog', hedefId: 12, ozet: '“TYT planı” yayınlandı' });
 */

const OMUR_GUN = 365;

function kisaltma(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** Yazı/mesaj başlığını özette tırnak içinde göstermek için. */
function tirnak(s, n = 80) {
  return `“${kisaltma(s, n)}”`;
}

/**
 * @param {import('express').Request|null} req
 * @param {string} eylem   blog.publish, message.status, user.role …
 * @param {{hedefTur?: string|null, hedefId?: number|null, ozet: string, aktor?: object|null}} o
 *        aktor: req.user yoksa (giriş, parola sıfırlama) işlemi yapan hesap.
 */
async function denetle(req, eylem, { hedefTur = null, hedefId = null, ozet, aktor } = {}) {
  const kisi = aktor !== undefined ? aktor : (req && req.user) || null;
  const kim = kisi ? `${kisi.email} (#${kisi.id}, ${kisi.role})` : 'oturumsuz';
  const metin = kisaltma(ozet || eylem, 500);
  console.log(`[denetim] ${eylem} — ${kim} — ${metin}`);

  try {
    // Döngüsel require olmasın diye modeller burada yükleniyor.
    const { AuditLog } = require('../models');
    await AuditLog.create({
      actor_id: kisi ? kisi.id : null,
      actor_email: kisi ? String(kisi.email || '').slice(0, 255) : null,
      actor_role: kisi ? String(kisi.role || '').slice(0, 20) : null,
      action: String(eylem).slice(0, 60),
      target_type: hedefTur ? String(hedefTur).slice(0, 30) : null,
      target_id: Number.isInteger(hedefId) ? hedefId : null,
      summary: metin,
    });
  } catch (e) {
    console.error('Denetim kaydı tabloya yazılamadı:', eylem, '—', e.message);
  }
}

/** 365 günden eski kayıtları siler. Açılışta ve günde bir çalışır. */
async function eskiDenetimKayitlariniSil() {
  try {
    const { AuditLog } = require('../models');
    const sinir = new Date(Date.now() - OMUR_GUN * 24 * 60 * 60 * 1000);
    const silinen = await AuditLog.destroy({ where: { created_at: { [Op.lt]: sinir } } });
    if (silinen > 0) console.log(`· ${silinen} eski denetim kaydı silindi (${OMUR_GUN} gün).`);
  } catch (e) {
    console.error('Eski denetim kayıtları silinemedi:', e.message);
  }
}

module.exports = { denetle, tirnak, kisaltma, eskiDenetimKayitlariniSil, DENETIM_OMUR_GUN: OMUR_GUN };
