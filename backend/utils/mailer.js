const { IS_PRODUCTION, ADMIN_URL } = require('../config/env');

/**
 * E-posta bildirimi — İSTEĞE BAĞLI katman.
 *
 * SMTP_URL tanımlı değilse hiçbir şey göndermez ve bunu günlüğe yazar;
 * çağıran taraf buna göre davranmaz çünkü asıl kayıt veritabanındadır.
 * Amaç: "mesaj geldi" bildirimini kimsenin panele bakmasını beklemeden
 * iletmek.
 */

let transportCache = null;
let uyarildi = false;

function getTransport() {
  const url = String(process.env.SMTP_URL || '').trim();
  if (!url) {
    if (!uyarildi) {
      uyarildi = true;
      console.warn(
        '⚠️  SMTP_URL tanımlı değil — iletişim mesajları yalnızca panelde görünecek, e-posta bildirimi gitmeyecek.'
      );
    }
    return null;
  }
  if (transportCache) return transportCache;

  // nodemailer yalnızca gerçekten gerekince yükleniyor.
  const nodemailer = require('nodemailer');
  transportCache = nodemailer.createTransport(url);
  return transportCache;
}

function alicilar() {
  const raw = String(process.env.CONTACT_NOTIFY_TO || process.env.ADMIN_EMAIL || '').trim();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

async function notifyNewContactMessage(kayit) {
  const transport = getTransport();
  const to = alicilar();
  if (!transport || to.length === 0) {
    if (!transport) return;
    console.warn('⚠️  CONTACT_NOTIFY_TO tanımlı değil — bildirim gönderilmedi.');
    return;
  }

  const baslik = kayit.subject ? `${kayit.subject}` : 'Yeni iletişim mesajı';
  const panelLink = `${ADMIN_URL.replace(/\/$/, '')}/mesajlar`;

  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Koçum.Net <noreply@kocum.net>',
    to,
    // Yanıtla dendiğinde doğrudan gönderene gitsin.
    replyTo: `${kayit.name} <${kayit.email}>`,
    subject: `[Koçum.Net] ${baslik} — ${kayit.name}`,
    text:
      `${kayit.name} <${kayit.email}>` +
      (kayit.phone ? ` · ${kayit.phone}` : '') +
      `\nDil: ${kayit.locale} · Form: ${kayit.source}\n\n${kayit.message}\n\nPanel: ${panelLink}\n`,
    html:
      `<p><strong>${kacir(kayit.name)}</strong> &lt;${kacir(kayit.email)}&gt;` +
      (kayit.phone ? ` · ${kacir(kayit.phone)}` : '') +
      `<br><small>Dil: ${kacir(kayit.locale)} · Form: ${kacir(kayit.source)}</small></p>` +
      `<p style="white-space:pre-wrap">${kacir(kayit.message)}</p>` +
      `<p><a href="${kacir(panelLink)}">Panelde aç</a></p>`,
  });

  if (!IS_PRODUCTION) console.log('· İletişim bildirimi gönderildi:', to.join(', '));
}

module.exports = { notifyNewContactMessage };
