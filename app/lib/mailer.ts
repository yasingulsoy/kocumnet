import nodemailer from "nodemailer";

/**
 * E-posta gönderimi.
 *
 * ⚠️ SESSİZ BAŞARISIZLIK YOK. SMTP yapılandırılmamışsa `isMailConfigured()`
 * false döner ve çağıran akış kullanıcıya dürüst bir mesaj gösterir
 * ("parola sıfırlama şu an kapalı, bize yazın"). Yapılandırılmamış bir
 * göndericiyi "başarılı" sayıp e-posta beklemeye bırakmak, kullanıcıyı
 * hesabının dışında bırakan en can sıkıcı hata türü.
 *
 * Geliştirmede SMTP yoksa bağlantı sunucu günlüğüne yazılır — akış test
 * edilebilsin diye.
 */

const SMTP_URL = process.env.SMTP_URL;
const MAIL_FROM = process.env.MAIL_FROM ?? "Koçum.Net Check-up <noreply@kocum.net>";

export function isMailConfigured(): boolean {
  return Boolean(SMTP_URL);
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  if (!SMTP_URL) {
    // Geliştirme kolaylığı: gönderemiyoruz ama akış görünür olsun.
    if (process.env.NODE_ENV !== "production") {
      console.log("\n─── E-POSTA (SMTP yok, gönderilmedi) ───");
      console.log("Kime:", mail.to);
      console.log("Konu:", mail.subject);
      console.log(mail.text);
      console.log("────────────────────────────────────────\n");
    }
    return { sent: false };
  }

  const transport = nodemailer.createTransport(SMTP_URL);
  await transport.sendMail({
    from: MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
  return { sent: true };
}
