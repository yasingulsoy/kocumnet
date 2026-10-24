const { Op } = require('sequelize');

/**
 * İletişim mesajları: saklama süresi ve otomatik yanıt sınırı.
 *
 * ── Saklama ── *
 * Ad, e-posta, telefon, konu, mesaj ve ekip notu kişisel veri; eskiden süresiz
 * duruyordu. Süre dolunca satır SİLİNMEZ, kişisel alanları boşaltılır
 * (anonimleştirme): kimlik, durum, dil, form, tarihler ve kimin yanıtladığı
 * kalır. Böylece panelin haftalık istatistikleri (gelen / yanıtlanan) geçmişe
 * dönük bozulmaz.
 *
 *   - Yanıtlanmış ya da arşivlenmiş mesaj: gönderilmesinden CONTACT_RETENTION_DAYS
 *     gün sonra (varsayılan 730 = 2 yıl).
 *   - Spam: 90 gün sonra (CONTACT_RETENTION_DAYS daha kısaysa o).
 *   - Bekleyen mesaja (yeni, okundu) DOKUNULMAZ: kimse dönüş yapmadan
 *     gönderenin adresi silinmesin.
 *
 * Ekibe giden bildirim postasındaki tam kopya bu saklamanın DIŞINDA: o posta
 * alıcıların posta kutusunda kalır (bkz. sitenin gizlilik sayfası).
 * Açılışta ve günde bir çalışır (server.js).
 */

const VARSAYILAN_GUN = 730;
const SPAM_GUN = 90;
// Yazım hatası ("7" yerine "730") yeni mesajları silmesin diye alt sınır.
const EN_AZ_GUN = 30;
const GUN_MS = 24 * 60 * 60 * 1000;

function saklamaGunu() {
  const ham = String(process.env.CONTACT_RETENTION_DAYS ?? '').trim();
  if (!ham) return VARSAYILAN_GUN;
  const gun = Number(ham);
  if (!Number.isInteger(gun) || gun < EN_AZ_GUN) {
    console.warn(
      `⚠️  CONTACT_RETENTION_DAYS="${ham}" geçersiz (en az ${EN_AZ_GUN} gün, tam sayı); ${VARSAYILAN_GUN} gün kullanılıyor.`
    );
    return VARSAYILAN_GUN;
  }
  return gun;
}

/** Anonimleştirilmiş satırın alanları. name ve message NOT NULL: boş yerine işaret. */
const ANONIM = {
  name: 'Anonim',
  email: '',
  phone: null,
  subject: null,
  message: '[Saklama süresi doldu: ad, e-posta, telefon, konu ve mesaj silindi.]',
  note: null,
  ip_hash: null,
  user_agent: null,
};

/**
 * Süresi dolan mesajları anonimleştirir; sayıları döner. İdempotent:
 * anonimleştirilmiş satırın e-postası boş, ikinci kez seçilmez.
 */
async function iletisimMesajlariniAnonimlestir(simdi = Date.now()) {
  const { ContactMessage } = require('../models');
  const gun = saklamaGunu();
  const spamGun = Math.min(SPAM_GUN, gun);

  const [kapali] = await ContactMessage.update(ANONIM, {
    where: {
      status: { [Op.in]: ['answered', 'archived'] },
      created_at: { [Op.lt]: new Date(simdi - gun * GUN_MS) },
      email: { [Op.ne]: '' },
    },
    // updated_at oynamasın: "son işlem" bilgisi personelin yaptığını göstersin.
    silent: true,
  });
  const [spam] = await ContactMessage.update(ANONIM, {
    where: {
      status: 'spam',
      created_at: { [Op.lt]: new Date(simdi - spamGun * GUN_MS) },
      email: { [Op.ne]: '' },
    },
    silent: true,
  });
  if (kapali + spam > 0) {
    console.log(`· İletişim mesajları anonimleştirildi: ${kapali} kapalı (${gun} gün), ${spam} spam (${spamGun} gün).`);
  }
  return { kapali, spam, gun, spamGun };
}

// ── Otomatik yanıt sınırı ──────────────────────────────────────

// Aynı adrese en fazla bu aralıkta bir otomatik yanıt.
const OTO_YANIT_ARALIGI_MS = 24 * 60 * 60 * 1000;

/**
 * Bu adrese son 24 saatte başka bir mesaj geldiyse otomatik yanıt GİTMEZ.
 * Formdaki adresi herkes yazabiliyor: sınır olmasa form, birinin posta
 * kutusunu bizim alan adımızdan gelen postalarla doldurmanın yolu olurdu
 * (IP sınırı tek başına yetmez: adres sabit kalıp IP değişebilir). Sayım
 * veritabanından: süreç yeniden başlasa da, birden çok kopya çalışsa da tutar.
 */
async function otoYanitGitsinMi(kayit, simdi = Date.now()) {
  const { ContactMessage } = require('../models');
  const onceki = await ContactMessage.count({
    where: {
      email: kayit.email,
      id: { [Op.ne]: kayit.id },
      created_at: { [Op.gte]: new Date(simdi - OTO_YANIT_ARALIGI_MS) },
    },
  });
  return onceki === 0;
}

module.exports = {
  iletisimMesajlariniAnonimlestir,
  otoYanitGitsinMi,
  saklamaGunu,
  ANONIM_MESAJ: ANONIM.message,
};
