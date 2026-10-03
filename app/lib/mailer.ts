import nodemailer, { type Transporter } from "nodemailer";

/**
 * E-posta gönderimi — check-up uygulaması.
 *
 * ⚠️ SESSİZ BAŞARISIZLIK YOK. SMTP yapılandırılmamışsa `isMailConfigured()`
 * false döner ve çağıran akış kullanıcıya dürüst bir mesaj gösterir
 * ("parola sıfırlama şu an kapalı, bize yazın"). Geliştirmede SMTP yoksa
 * posta sunucu günlüğüne yazılır — akış test edilebilsin diye.
 *
 * Şablon backend'dekiyle (backend/utils/mailer.js) aynı: aynı başlık, aynı
 * düğme, aynı renkler. Öğrenciye giden posta ile personele giden posta aynı
 * markadan çıkmış görünsün.
 *
 * Geliştirme taşıyıcısı: SMTP_URL=log://console → "gönderildi" sayılır,
 * günlüğe yazılır. Üretimde reddedilir.
 */

const SMTP_URL = (process.env.SMTP_URL ?? "").trim();
const MAIL_FROM = process.env.MAIL_FROM ?? "Koçum.Net Check-up <noreply@kocum.net>";
const LOG_TASIYICI = /^log:/i.test(SMTP_URL);
const URETIM = process.env.NODE_ENV === "production";

if (LOG_TASIYICI && URETIM) {
  throw new Error("SMTP_URL=log:// yalnızca geliştirmede kullanılabilir; üretimde gerçek bir SMTP adresi ver.");
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

export function isMailConfigured(): boolean {
  return SMTP_URL !== "";
}

let transportCache: Transporter | null = null;

/** nodemailer URL alınca havuz/zaman aşımı seçeneklerini yok sayıyor; URL'i kendimiz çözüyoruz. */
function getTransport(): Transporter | null {
  if (!isMailConfigured() || LOG_TASIYICI) return null;
  if (transportCache) return transportCache;
  const u = new URL(SMTP_URL);
  const secure = u.protocol === "smtps:";
  transportCache = nodemailer.createTransport({
    host: u.hostname,
    port: Number(u.port) || (secure ? 465 : 587),
    secure,
    auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return transportCache;
}

function kacir(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface MailIcerik {
  baslik: string;
  metin: string | string[];
  eylem?: { etiket: string; url: string };
  sonMetin?: string | string[];
  /** Alıntı kutusu (ham metin). */
  kutu?: string;
  dipnot?: string;
  /** Alt bilgideki küçük bağlantı (abonelik kapatma gibi). */
  altBaglanti?: { etiket: string; url: string };
}

const dizi = (p?: string | string[]) => (Array.isArray(p) ? p : p ? [p] : []);

/** Marka şablonu: satır içi CSS (e-posta istemcileri <style> bloğuna güvenmez). */
export function renderMail({ baslik, metin, eylem, sonMetin, kutu, dipnot, altBaglanti }: MailIcerik): { html: string; text: string } {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net").replace(/\/$/, "");
  const on = dizi(metin);
  const son = dizi(sonMetin);
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4b5471;">${kacir(t)}</p>`;

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${kacir(baslik)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e6eaf2;overflow:hidden;">
  <tr><td style="background:#ffffff;padding:26px 28px 8px;">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;"><img src="${appUrl()}/brand/eposta-logo.png" width="160" height="39" alt="Koçum.Net" style="display:block;border:0;outline:none;"></td>
      <td style="vertical-align:middle;padding-left:10px;"><span style="display:inline-block;padding:3px 7px;border-radius:6px;background:#f4f6fb;color:#4b5471;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">check-up</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 28px 10px;">
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:700;color:#111834;letter-spacing:-0.01em;">${kacir(baslik)}</h1>
    ${on.map(p).join("")}
    ${kutu ? `<div style="margin:6px 0 18px;padding:14px 16px;background:#f6f8fc;border:1px solid #e6eaf2;border-radius:12px;font-size:15px;line-height:1.6;color:#111834;white-space:pre-wrap;">${kacir(kutu)}</div>` : ""}
    ${
      eylem
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;"><tr><td style="border-radius:12px;background:#1a5fb4;"><a href="${kacir(eylem.url)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${kacir(eylem.etiket)}</a></td></tr></table>
           <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#6b7392;word-break:break-all;">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br><a href="${kacir(eylem.url)}" style="color:#1a5fb4;">${kacir(eylem.url)}</a></p>`
        : ""
    }
    ${son.map(p).join("")}
  </td></tr>
  <tr><td style="padding:14px 28px 26px;border-top:1px solid #e6eaf2;">
    ${dipnot ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7392;">${kacir(dipnot)}</p>` : ""}
    ${altBaglanti ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;"><a href="${kacir(altBaglanti.url)}" style="color:#1a5fb4;">${kacir(altBaglanti.etiket)}</a></p>` : ""}
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8990a8;">Koçum.Net Matematik Check-up · <a href="${site}" style="color:#6b7392;">kocum.net</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [baslik, "", ...on, kutu ? `\n${kutu}\n` : null, eylem ? `${eylem.etiket}: ${eylem.url}` : null, ...son, dipnot ? `\n${dipnot}` : null, altBaglanti ? `${altBaglanti.etiket}: ${altBaglanti.url}` : null, `\n— Koçum.Net Check-up · ${appUrl()}`]
    .filter((s): s is string => typeof s === "string")
    .join("\n");

  return { html, text };
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** List-Unsubscribe gibi ek başlıklar. */
  headers?: Record<string, string>;
}

/**
 * Hata FIRLATMAZ: `{sent:false}` döner ve günlüğe yazar. Çağıran akış
 * kullanıcıya ne söyleyeceğine buna bakarak karar verir.
 */
export async function sendMail(mail: Mail): Promise<{ sent: boolean; reason?: string }> {
  const transport = getTransport();
  if (!transport) {
    if (!URETIM) {
      console.log(LOG_TASIYICI ? "\n─── E-POSTA (log taşıyıcısı) ───" : "\n─── E-POSTA (SMTP yok, gönderilmedi) ───");
      console.log("Kime:", mail.to);
      console.log("Konu:", mail.subject);
      console.log(mail.text);
      console.log("────────────────────────────────────────\n");
    }
    return LOG_TASIYICI ? { sent: true, reason: "logged" } : { sent: false, reason: "not-configured" };
  }
  try {
    await transport.sendMail({ from: MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers });
    return { sent: true };
  } catch (e) {
    console.error("E-posta gönderilemedi:", mail.subject, "→", mail.to, "—", (e as Error).message);
    return { sent: false, reason: "error" };
  }
}

// ─────────────────────────────────────────────────────────────
// Akışlar
// ─────────────────────────────────────────────────────────────

const ilkAd = (ad: string) => ad.trim().split(/\s+/)[0] || ad;

/** Kayıt sonrası hoş geldin: ne yapacağını söyler, tek düğme. Pazarlama değil. */
export function sendWelcomeMail(p: { to: string; name: string }) {
  const { html, text } = renderMail({
    baslik: `Hoş geldin ${ilkAd(p.name)}, ilk check-up'ın seni bekliyor`,
    metin: [
      "Hesabın açıldı. Check-up, hangi konuda güçlü hangisinde zayıf olduğunu 20 dakikada ölçer; sonunda rapor değil, bu hafta ne çalışacağın çıkar.",
      "İlk adım: Tanışma Check-up'ı — 12 soru, 15 dakika, ücretsiz.",
    ],
    eylem: { etiket: "İlk check-up'ı başlat", url: `${appUrl()}/paketler` },
    sonMetin: ["Sonucun ve haftalık planın panelinde durur; istediğin zaman geri dönebilirsin."],
    dipnot: "Bu hesabı sen açmadıysan bu postayı yok sayabilirsin; hiçbir işlem yapılmaz.",
  });
  return sendMail({ to: p.to, subject: "Hoş geldin · Koçum.Net Check-up", text, html });
}

export function sendPasswordResetMail(p: { to: string; name: string; link: string; dakika: number }) {
  const { html, text } = renderMail({
    baslik: "Parolanı sıfırla",
    metin: [`Merhaba ${ilkAd(p.name)},`, "Check-up hesabın için parola sıfırlama isteği aldık. Yeni parolanı belirlemek için düğmeye tıkla."],
    eylem: { etiket: "Yeni parola belirle", url: p.link },
    sonMetin: [`Bağlantı ${p.dakika} dakika geçerli ve yalnızca bir kez kullanılabilir.`],
    dipnot: "Bu isteği sen yapmadıysan bir şey yapmana gerek yok; parolan değişmedi.",
  });
  return sendMail({ to: p.to, subject: "Parola sıfırlama · Koçum.Net Check-up", text, html });
}

/** Parola değişti — hesabı ele geçirilen biri haberdar olsun. */
export function sendPasswordChangedMail(p: { to: string; name: string }) {
  const zaman = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const { html, text } = renderMail({
    baslik: "Parolan değiştirildi",
    metin: [`Merhaba ${ilkAd(p.name)},`, `Check-up hesabının parolası az önce değiştirildi (${zaman}). Diğer cihazlardaki oturumların kapatıldı.`],
    eylem: { etiket: "Giriş yap", url: `${appUrl()}/giris` },
    dipnot: `Bu değişikliği sen yapmadıysan hemen "Parolamı unuttum" ile yeni parola belirle ve bize yaz: ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "info@kocum.net"}`,
  });
  return sendMail({ to: p.to, subject: "Parolan değiştirildi · Koçum.Net Check-up", text, html });
}
