/**
 * Ortam değişkenleri (checkup/MIMARI.md "Ortam değişkenleri"). Yalnızca
 * server.ts okur; createApp() değerleri parametre olarak alır (testler kendi
 * değerlerini verir).
 */
export interface SunucuAyarlari {
  uretim: boolean;
  veritabaniUrl: string;
  havuzBoyutu: number;
  port: number;
  servisAnahtari: string;
  frontendUrl: string;
  smtpUrl: string;
  postaGonderen: string;
  ilkYonetici: { eposta: string; parola: string; ad: string } | null;
}

export function ortamdanOku(env: NodeJS.ProcessEnv = process.env): SunucuAyarlari {
  const uretim = env.NODE_ENV === "production";
  const sorunlar: string[] = [];

  const veritabaniUrl = (env.DATABASE_URL ?? "").trim();
  if (!veritabaniUrl) sorunlar.push("DATABASE_URL tanımlı değil.");

  const servisAnahtari = (env.SERVIS_ANAHTARI ?? "").trim();
  if (servisAnahtari.length < 32) sorunlar.push("SERVIS_ANAHTARI en az 32 karakter olmalı.");

  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) sorunlar.push("PORT geçerli bir sayı değil.");

  const frontendUrl = (env.FRONTEND_URL ?? "").trim().replace(/\/+$/, "") || (uretim ? "" : "http://localhost:3200");
  if (!frontendUrl) sorunlar.push("FRONTEND_URL tanımlı değil (parola sıfırlama bağlantısı için gerekli).");

  const havuzHam = Number(env.DATABASE_POOL_MAX || 10);
  const havuzBoyutu = Number.isInteger(havuzHam) && havuzHam >= 1 && havuzHam <= 100 ? havuzHam : 10;

  if (sorunlar.length) {
    throw new Error(`Yapılandırma eksik:\n  - ${sorunlar.join("\n  - ")}`);
  }

  const ilkEposta = (env.ILK_YONETICI_EPOSTA ?? "").trim();
  const ilkParola = env.ILK_YONETICI_PAROLA ?? "";

  return {
    uretim,
    veritabaniUrl,
    havuzBoyutu,
    port,
    servisAnahtari,
    frontendUrl,
    smtpUrl: (env.SMTP_URL ?? "").trim(),
    postaGonderen: (env.MAIL_FROM ?? "").trim() || "Koçum.Net Check-up <noreply@kocum.net>",
    ilkYonetici: ilkEposta && ilkParola ? { eposta: ilkEposta, parola: ilkParola, ad: (env.ILK_YONETICI_AD ?? "").trim() || "Yönetici" } : null,
  };
}
