const express = require('express');
const crypto = require('crypto');
const { ContactMessage } = require('../models');
const { contactLimiter } = require('../middleware/rateLimits');
const { asyncHandler } = require('../utils/http');
const { JWT_SECRET, FRONTEND_URL } = require('../config/env');
const { notifyNewContactMessage } = require('../utils/mailer');

const router = express.Router();

const IZINLI_DILLER = new Set(['tr', 'en', 'ar']);
const IZINLI_KAYNAKLAR = new Set(['contact', 'hero']);

// Kabaca "içinde @ olan, boşluksuz, noktalı bir şey". Amacı yazım hatasını
// yakalamak; adresin gerçekten var olduğunu ancak gönderilen e-posta gösterir.
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function metin(v, enFazla) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, enFazla);
}

function ipOzeti(req) {
  const ip = String(req.ip || '');
  if (!ip) return null;
  // Ham IP saklamıyoruz: aynı gönderenin tekrarını görmeye yetecek kadar.
  return crypto.createHmac('sha256', JWT_SECRET).update(ip).digest('hex').slice(0, 32);
}

/**
 * Siteden gelen iletişim mesajı. Oturum gerektirmez.
 *
 * Korumalar: hız sınırı (IP başına saatte 5), bal küpü alanı (`website`),
 * uzunluk sınırları ve biçim denetimi. CSRF'ten muaf (middleware/csrf.js):
 * oturum çerezi kullanılmadığı için kaçırılacak bir yetki yok.
 */
router.post(
  '/',
  contactLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message, locale, source, website } = req.body || {};

    // Bal küpü: gerçek kullanıcı bu alanı görmez, botlar doldurur.
    // Başarılı gibi yanıtlıyoruz ki bot tekrar denemesin.
    if (String(website ?? '').trim() !== '') {
      return res.status(201).json({ success: true, message: 'Mesajınız alındı.' });
    }

    const ad = metin(name, 120);
    const eposta = metin(email, 255).toLowerCase();
    const telefon = metin(phone, 40);
    const konu = metin(subject, 200);
    const mesaj = String(message ?? '').trim().slice(0, 5000);

    const hatalar = {};
    if (ad.length < 2) hatalar.name = 'Adınızı yazın.';
    if (!EPOSTA.test(eposta)) hatalar.email = 'Geçerli bir e-posta adresi yazın.';
    if (mesaj.length < 10) hatalar.message = 'Mesajınızı biraz daha açar mısınız?';

    if (Object.keys(hatalar).length > 0) {
      return res.status(400).json({ success: false, error: 'Form eksik ya da hatalı.', fields: hatalar });
    }

    const kayit = await ContactMessage.create({
      name: ad,
      email: eposta,
      phone: telefon || null,
      subject: konu || null,
      message: mesaj,
      locale: IZINLI_DILLER.has(String(locale)) ? String(locale) : 'tr',
      source: IZINLI_KAYNAKLAR.has(String(source)) ? String(source) : 'contact',
      ip_hash: ipOzeti(req),
      user_agent: metin(req.get('user-agent'), 300) || null,
    });

    // Bildirim e-postası "olursa iyi": SMTP kapalıysa ya da hata verirse
    // kullanıcıya başarısız demiyoruz — mesaj zaten kaydedildi.
    notifyNewContactMessage(kayit).catch((e) =>
      console.error('İletişim mesajı bildirimi gönderilemedi:', e.message)
    );

    console.log(`· Yeni iletişim mesajı #${kayit.id} (${kayit.source}, ${kayit.locale}) — ${FRONTEND_URL}`);

    res.status(201).json({ success: true, message: 'Mesajınız alındı.' });
  })
);

module.exports = router;
