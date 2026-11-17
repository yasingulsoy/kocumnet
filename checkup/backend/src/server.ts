import "dotenv/config";
import { createApp } from "./app.js";
import { ortamdanOku } from "./ayarlar.js";
import { veritabaniOlustur, type Veritabani } from "./db.js";
import { parolaOzetle } from "./lib/parola.js";
import { postaOlustur } from "./lib/posta.js";

/**
 * Sunucu: yalnızca dinler. Açılışta hiç yönetici yoksa ve ILK_YONETICI_EPOSTA
 * ile ILK_YONETICI_PAROLA tanımlıysa bir YONETICI oluşturur (yönetici varsa
 * bu değişkenlere bakılmaz). Migration'lar ayrı adımdır: `prisma migrate deploy`.
 */

async function ilkYoneticiyiOlustur(db: Veritabani, ilk: { eposta: string; parola: string; ad: string } | null): Promise<void> {
  if (!ilk) return;
  if ((await db.yonetici.count()) > 0) return;
  const eposta = ilk.eposta.trim().toLowerCase();
  if (ilk.parola.length < 8) {
    console.warn("[sunucu] ILK_YONETICI_PAROLA en az 8 karakter olmalı; ilk yönetici oluşturulmadı.");
    return;
  }
  await db.yonetici.create({
    data: { adSoyad: ilk.ad, eposta, parolaHash: await parolaOzetle(ilk.parola), rol: "YONETICI", aktif: true },
  });
  console.log("[sunucu] İlk yönetici oluşturuldu (ILK_YONETICI_EPOSTA).");
}

async function basla() {
  const ayar = ortamdanOku();
  const db = veritabaniOlustur(ayar.veritabaniUrl, ayar.havuzBoyutu);
  const posta = postaOlustur({ smtpUrl: ayar.smtpUrl, gonderen: ayar.postaGonderen, uretim: ayar.uretim });
  if (!ayar.smtpUrl) console.warn("[sunucu] SMTP_URL tanımlı değil: parola sıfırlama iletileri gönderilmeyecek.");

  await ilkYoneticiyiOlustur(db, ayar.ilkYonetici);

  const { app, baglam } = createApp({ db, servisAnahtari: ayar.servisAnahtari, frontendUrl: ayar.frontendUrl, posta });
  const sunucu = app.listen(ayar.port, () => {
    console.log(`[sunucu] Check-up backend ${ayar.port} portunda dinliyor.`);
  });

  let kapaniyor = false;
  const kapat = (sinyal: string) => {
    if (kapaniyor) return;
    kapaniyor = true;
    console.log(`[sunucu] ${sinyal} alındı, kapatılıyor…`);
    sunucu.close(() => {
      baglam.hizSiniri.kapat();
      db.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => kapat("SIGTERM"));
  process.on("SIGINT", () => kapat("SIGINT"));
}

basla().catch((e: unknown) => {
  console.error("[sunucu] Açılamadı:", e instanceof Error ? e.message : e);
  process.exit(1);
});
