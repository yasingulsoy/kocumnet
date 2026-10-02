const { IS_PRODUCTION, FRONTEND_URL } = require('../config/env');

/**
 * E-posta altyapısı — tek kapı.
 *
 * İKİ KURAL:
 *  1. SESSİZ BAŞARISIZLIK YOK. `isMailConfigured()` false ise gönderen akış
 *     bunu bilir ve kullanıcıya dürüst davranır (ör. "parola sıfırlama şu an
 *     kapalı"). Geliştirmede mesaj sunucu günlüğüne yazılır — akış test
 *     edilebilsin diye.
 *  2. ŞABLON TEK YERDE. Bütün postalar aynı marka başlığını, aynı düğmeyi ve
 *     aynı alt bilgiyi kullanır (renderMail). Her akış yalnızca içeriği verir.
 *
 * Bağlantı: SMTP_URL (smtps://kullanici:parola@sunucu:465). Havuzlu bağlantı,
 * zaman aşımları açık — asılı kalan SMTP sunucusu isteği asılı bırakmasın.
 * Önerilen sağlayıcı: Resend (smtp.resend.com, kullanıcı "resend", parola API
 * anahtarı) — alan adı doğrulaması tek DNS kaydı.
 */

const SITE_URL = FRONTEND_URL.replace(/\/$/, '');
const SITE_ADMIN_URL = `${SITE_URL}/admin`;
const MAIL_FROM = (process.env.MAIL_FROM || 'Koçum.Net <noreply@kocum.net>').trim();
const MARKA = 'Koçum.Net';

function isMailConfigured() {
  return String(process.env.SMTP_URL || '').trim() !== '';
}

let transportCache = null;

/**
 * nodemailer bir URL aldığında havuz/zaman aşımı seçeneklerini yok sayıyor;
 * URL'i kendimiz çözüp seçeneklerle birlikte veriyoruz.
 */
function getTransport() {
  if (!isMailConfigured()) return null;
  if (transportCache) return transportCache;

  const u = new URL(String(process.env.SMTP_URL).trim());
  const secure = u.protocol === 'smtps:';
  const nodemailer = require('nodemailer');
  transportCache = nodemailer.createTransport({
    host: u.hostname,
    port: Number(u.port) || (secure ? 465 : 587),
    secure,
    auth: u.username
      ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) }
      : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return transportCache;
}

function kacir(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

/** Paragraflar: dizi ya da tek metin; HTML'de <p>, düz metinde boş satır. */
function paragraflar(p) {
  return (Array.isArray(p) ? p : [p]).filter(Boolean);
}

/**
 * Marka şablonu. Satır içi CSS: e-posta istemcileri <style> bloğunu güvenilmez
 * işler. Renkler tasarım belirteçleriyle aynı (design/tokens.css).
 *
 * @param {object} o
 * @param {string} o.baslik        Posta başlığı (h1)
 * @param {string|string[]} o.metin  Giriş paragrafları
 * @param {{etiket:string,url:string}} [o.eylem]  Düğme
 * @param {string|string[]} [o.sonMetin]  Düğmeden sonraki paragraflar
 * @param {string} [o.kutu]        Alıntı kutusu (iletişim mesajı gibi), ham metin
 * @param {string} [o.dipnot]      Alt bilgi notu ("bunu siz istemediyseniz…")
 * @param {'ltr'|'rtl'} [o.yon]
 * @returns {{html:string,text:string}}
 */
function renderMail({ baslik, metin, eylem, sonMetin, kutu, dipnot, yon = 'ltr' }) {
  const on = paragraflar(metin);
  const son = paragraflar(sonMetin);
  const align = yon === 'rtl' ? 'right' : 'left';

  const p = (t) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4b5471;">${kacir(t)}</p>`;

  const html = `<!doctype html>
<html lang="tr" dir="${yon}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${kacir(baslik)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e6eaf2;overflow:hidden;">
  <tr><td style="background:#17305e;background-image:linear-gradient(135deg,#17305e,#1a5fb4 55%,#0e90d5);padding:22px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;"><img src="${SITE_URL}/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:10px;"></td>
      <td style="vertical-align:middle;padding-left:12px;font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Koçum<span style="color:#8ecdf5;">.Net</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 28px 10px;text-align:${align};">
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:700;color:#111834;letter-spacing:-0.01em;">${kacir(baslik)}</h1>
    ${on.map(p).join('')}
    ${
      kutu
        ? `<div style="margin:6px 0 18px;padding:14px 16px;background:#f6f8fc;border:1px solid #e6eaf2;border-radius:12px;font-size:15px;line-height:1.6;color:#111834;white-space:pre-wrap;">${kacir(kutu)}</div>`
        : ''
    }
    ${
      eylem
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;"><tr><td style="border-radius:12px;background:#1a5fb4;">
             <a href="${kacir(eylem.url)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${kacir(eylem.etiket)}</a>
           </td></tr></table>
           <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#6b7392;word-break:break-all;">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br><a href="${kacir(eylem.url)}" style="color:#1a5fb4;">${kacir(eylem.url)}</a></p>`
        : ''
    }
    ${son.map(p).join('')}
  </td></tr>
  <tr><td style="padding:14px 28px 26px;border-top:1px solid #e6eaf2;text-align:${align};">
    ${dipnot ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7392;">${kacir(dipnot)}</p>` : ''}
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8990a8;">${MARKA} · <a href="${SITE_URL}" style="color:#6b7392;">kocum.net</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    baslik,
    '',
    ...on,
    kutu ? `\n${kutu}\n` : null,
    eylem ? `${eylem.etiket}: ${eylem.url}` : null,
    ...son,
    dipnot ? `\n${dipnot}` : null,
    `\n— ${MARKA} · ${SITE_URL}`,
  ]
    .filter((s) => s !== null && s !== undefined)
    .join('\n');

  return { html, text };
}

/**
 * Genel gönderim. SMTP yoksa geliştirmede günlüğe yazar, {sent:false} döner.
 * Hata fırlatmaz; çağıran tarafın "gönderildi mi" sorusuna dürüst cevap verir.
 */
async function sendMail({ to, subject, html, text, replyTo }) {
  const alicilar = Array.isArray(to) ? to : [to];
  const transport = getTransport();

  if (!transport) {
    if (!IS_PRODUCTION) {
      console.log('\n─── E-POSTA (SMTP yok, gönderilmedi) ───');
      console.log('Kime :', alicilar.join(', '));
      console.log('Konu :', subject);
      console.log(text);
      console.log('────────────────────────────────────────\n');
    }
    return { sent: false, reason: 'not-configured' };
  }

  try {
    await transport.sendMail({
      from: MAIL_FROM,
      to: alicilar,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (!IS_PRODUCTION) console.log('· E-posta gönderildi →', alicilar.join(', '), '·', subject);
    return { sent: true };
  } catch (e) {
    console.error('E-posta gönderilemedi:', subject, '→', alicilar.join(', '), '—', e.message);
    return { sent: false, reason: 'error', error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// Akışlar
// ─────────────────────────────────────────────────────────────

function bildirimAlicilari() {
  return String(process.env.CONTACT_NOTIFY_TO || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Yeni iletişim mesajı → ekibe bildirim. Panel bağlantısı kocum.net/admin. */
async function notifyNewContactMessage(kayit) {
  const to = bildirimAlicilari();
  if (to.length === 0) {
    if (isMailConfigured()) console.warn('⚠️  CONTACT_NOTIFY_TO tanımlı değil — bildirim gönderilmedi.');
    return { sent: false, reason: 'no-recipient' };
  }

  const konu = kayit.subject ? kayit.subject : 'Yeni iletişim mesajı';
  const { html, text } = renderMail({
    baslik: konu,
    metin: [
      `${kayit.name} <${kayit.email}>${kayit.phone ? ` · ${kayit.phone}` : ''}`,
      `Dil: ${kayit.locale} · Form: ${kayit.source}`,
    ],
    kutu: kayit.message,
    eylem: { etiket: 'Panelde aç', url: `${SITE_ADMIN_URL}/mesajlar/${kayit.id}` },
    dipnot: 'Bu postaya "Yanıtla" dersen cevap doğrudan gönderene gider.',
  });

  return sendMail({
    to,
    subject: `[${MARKA}] ${konu} — ${kayit.name}`,
    html,
    text,
    replyTo: { name: kayit.name, address: kayit.email },
  });
}

const OTO_YANIT = {
  tr: {
    konu: 'Mesajınızı aldık',
    baslik: 'Mesajınız bize ulaştı',
    metin: (ad) => [
      `Merhaba ${ad},`,
      'Koçum.Net ekibine yazdığınız için teşekkürler. Mesajınızı aldık; en kısa sürede, genellikle bir iş günü içinde size dönüş yapacağız.',
      'Aşağıda gönderdiğiniz mesajın bir kopyası var.',
    ],
    dipnot: 'Bu posta otomatik gönderildi; yanıtlamanız gerekmez.',
    yon: 'ltr',
  },
  en: {
    konu: 'We received your message',
    baslik: 'Your message has reached us',
    metin: (ad) => [
      `Hello ${ad},`,
      'Thank you for writing to Koçum.Net. We have received your message and will get back to you as soon as possible, usually within one business day.',
      'A copy of your message is below.',
    ],
    dipnot: 'This is an automated message; no reply is needed.',
    yon: 'ltr',
  },
  ar: {
    konu: 'لقد تلقّينا رسالتك',
    baslik: 'وصلتنا رسالتك',
    metin: (ad) => [
      `مرحباً ${ad}،`,
      'شكراً لتواصلك مع Koçum.Net. تلقّينا رسالتك وسنعود إليك في أقرب وقت ممكن، عادةً خلال يوم عمل واحد.',
      'تجد أدناه نسخة من رسالتك.',
    ],
    dipnot: 'هذه رسالة تلقائية؛ لا حاجة للرد عليها.',
    yon: 'rtl',
  },
};

/** Gönderene otomatik yanıt — formun dilinde. */
async function sendContactAutoReply(kayit) {
  const d = OTO_YANIT[kayit.locale] || OTO_YANIT.tr;
  const { html, text } = renderMail({
    baslik: d.baslik,
    metin: d.metin(kayit.name),
    kutu: kayit.message,
    dipnot: d.dipnot,
    yon: d.yon,
  });
  return sendMail({ to: kayit.email, subject: `${d.konu} · ${MARKA}`, html, text });
}

function adSoyad(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

/** Yeni personel daveti: parola belirleme bağlantısı. */
async function sendStaffInvite({ user, link, davetEden, saat }) {
  const { html, text } = renderMail({
    baslik: 'Koçum.Net yönetim paneline davet edildin',
    metin: [
      `Merhaba ${adSoyad(user)},`,
      `${davetEden ? `${davetEden} seni` : 'Seni'} Koçum.Net yönetim paneline ekledi. Hesabın hazır; giriş yapabilmek için bir parola belirlemen gerekiyor.`,
    ],
    eylem: { etiket: 'Parolamı belirle', url: link },
    sonMetin: [`Bağlantı ${saat} saat geçerli. Süresi dolarsa yöneticinden yeni bir davet isteyebilirsin.`],
    dipnot: 'Bu daveti beklemiyorsan postayı yok sayabilirsin; hesap parola belirlenmeden açılmaz.',
  });
  return sendMail({ to: user.email, subject: `Yönetim paneli daveti · ${MARKA}`, html, text });
}

/** Personel parola sıfırlama bağlantısı. */
async function sendStaffPasswordReset({ user, link, dakika }) {
  const { html, text } = renderMail({
    baslik: 'Parolanı sıfırla',
    metin: [
      `Merhaba ${adSoyad(user)},`,
      'Yönetim paneli hesabın için parola sıfırlama isteği aldık. Yeni parolanı belirlemek için düğmeye tıkla.',
    ],
    eylem: { etiket: 'Yeni parola belirle', url: link },
    sonMetin: [`Bağlantı ${dakika} dakika geçerli ve yalnızca bir kez kullanılabilir.`],
    dipnot: 'Bu isteği sen yapmadıysan bir şey yapmana gerek yok; parolan değişmedi.',
  });
  return sendMail({ to: user.email, subject: `Parola sıfırlama · ${MARKA}`, html, text });
}

/** Parola değişti bildirimi — hesabı ele geçirilen biri haberdar olsun. */
async function sendStaffPasswordChanged({ user }) {
  const { html, text } = renderMail({
    baslik: 'Parolan değiştirildi',
    metin: [
      `Merhaba ${adSoyad(user)},`,
      `Yönetim paneli hesabının parolası az önce değiştirildi (${new Date().toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
      })}). Açık oturumların kapatıldı.`,
    ],
    eylem: { etiket: 'Panele giriş yap', url: `${SITE_ADMIN_URL}/giris` },
    dipnot: 'Bu değişikliği sen yapmadıysan hemen bir yöneticiye haber ver.',
  });
  return sendMail({ to: user.email, subject: `Parolan değiştirildi · ${MARKA}`, html, text });
}

module.exports = {
  isMailConfigured,
  renderMail,
  sendMail,
  notifyNewContactMessage,
  sendContactAutoReply,
  sendStaffInvite,
  sendStaffPasswordReset,
  sendStaffPasswordChanged,
  SITE_ADMIN_URL,
};
