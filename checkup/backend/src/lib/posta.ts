import nodemailer, { type Transporter } from "nodemailer";

/**
 * E-posta gönderimi.
 *
 * SMTP_URL:
 *   - smtp://kullanici:parola@sunucu:587 ya da smtps://…:465 → gerçek gönderim
 *   - log://console → geliştirme taşıyıcısı: ileti sunucu günlüğüne yazılır,
 *     "gönderildi" sayılır. Üretimde reddedilir (açılışta hata).
 *   - boş → gönderilmez; uyarı günlüğe yazılır.
 *
 * Testler kendi Posta nesnesini verir (createApp({ posta })) ve gönderilen
 * iletileri okur.
 */
export interface Ileti {
  kime: string;
  konu: string;
  metin: string;
  html?: string;
}

export interface Posta {
  gonder(ileti: Ileti): Promise<void>;
}

const kacisla = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function postaOlustur(secenek: { smtpUrl: string; gonderen: string; uretim: boolean }): Posta {
  const adres = secenek.smtpUrl.trim();

  if (/^log:/i.test(adres)) {
    if (secenek.uretim) throw new Error("SMTP_URL=log:// yalnızca geliştirmede kullanılabilir; üretimde gerçek bir SMTP adresi verin.");
    return {
      async gonder(ileti) {
        console.log(`\n─── E-POSTA (log taşıyıcısı) ───\nKime: ${ileti.kime}\nKonu: ${ileti.konu}\n${ileti.metin}\n────────────────────────────────\n`);
      },
    };
  }

  if (!adres) {
    return {
      async gonder(ileti) {
        console.warn(`[posta] SMTP_URL tanımlı değil; "${ileti.konu}" iletisi gönderilmedi.`);
      },
    };
  }

  let tasiyici: Transporter | null = null;
  const tasiyiciAl = () => {
    if (tasiyici) return tasiyici;
    // nodemailer URL alınca zaman aşımı seçeneklerini yok sayıyor; adresi kendimiz çözüyoruz.
    const u = new URL(adres);
    const guvenli = u.protocol === "smtps:";
    tasiyici = nodemailer.createTransport({
      host: u.hostname,
      port: Number(u.port) || (guvenli ? 465 : 587),
      secure: guvenli,
      auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
      pool: true,
      maxConnections: 2,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    return tasiyici;
  };

  return {
    async gonder(ileti) {
      await tasiyiciAl().sendMail({ from: secenek.gonderen, to: ileti.kime, subject: ileti.konu, text: ileti.metin, html: ileti.html });
    },
  };
}

/** Parola sıfırlama iletisi (düz metin + basit HTML). */
export function sifirlamaIletisi(p: { kime: string; adSoyad: string; baglanti: string; dakika: number }): Ileti {
  const ad = p.adSoyad.trim().split(/\s+/)[0] || p.adSoyad;
  const metin = [
    `Merhaba ${ad},`,
    "",
    "Koçum.Net Check-up hesabın için parola sıfırlama isteği aldık. Yeni parolanı belirlemek için bu bağlantıyı aç:",
    p.baglanti,
    "",
    `Bağlantı ${p.dakika} dakika geçerli ve yalnızca bir kez kullanılabilir.`,
    "Bu isteği sen yapmadıysan bir şey yapmana gerek yok; parolan değişmedi.",
  ].join("\n");
  const html = `<!doctype html><html lang="tr"><body style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#111834;line-height:1.6">
<p>Merhaba ${kacisla(ad)},</p>
<p>Koçum.Net Check-up hesabın için parola sıfırlama isteği aldık. Yeni parolanı belirlemek için düğmeye tıkla.</p>
<p><a href="${kacisla(p.baglanti)}" style="display:inline-block;padding:12px 20px;background:#1a5fb4;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Yeni parola belirle</a></p>
<p style="font-size:13px;color:#4b5471">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br>${kacisla(p.baglanti)}</p>
<p style="font-size:13px;color:#4b5471">Bağlantı ${p.dakika} dakika geçerli ve yalnızca bir kez kullanılabilir. Bu isteği sen yapmadıysan bir şey yapmana gerek yok.</p>
</body></html>`;
  return { kime: p.kime, konu: "Parola sıfırlama · Koçum.Net Check-up", metin, html };
}
