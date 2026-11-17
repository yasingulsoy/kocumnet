import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { adresleriGizle, prismaCalistir, rastgeleAd, veritabaniAc, veritabaniSil } from "../../scripts/pg-yardimci.js";
import { createApp } from "../../src/app.js";
import { veritabaniOlustur, type Veritabani } from "../../src/db.js";
import { HizSiniri } from "../../src/lib/hiz-siniri.js";
import { parolaOzetle } from "../../src/lib/parola.js";
import type { Ileti, Posta } from "../../src/lib/posta.js";

/**
 * API testlerinin ortamı:
 *   - TEST_DATABASE_BASE_URL sunucusunda `checkup_test_<rastgele>` açılır,
 *   - migration'lar `prisma migrate deploy` ile uygulanır,
 *   - uygulama rastgele portta başlar (ileri sarılabilen saat, yakalanan posta),
 *   - kapanışta veritabanı DROP edilir (hata olsa da).
 *
 * Koruma: NODE_ENV=production ya da sunucu yerel değilse test durur
 * (bilerek başka sunucuda koşmak için TEST_ZORLA=1).
 */

export interface TestOrtami {
  url: string;
  anahtar: string;
  db: Veritabani;
  saat: { kaydir(ms: number): void; sifirla(): void };
  iletiler: Ileti[];
  beklenmeyenHatalar: unknown[];
  yonetici: { eposta: string; parola: string };
  kapat(): Promise<void>;
}

const YEREL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function korumaDenetle(sunucu: string) {
  if (process.env.TEST_ZORLA === "1") return;
  if (process.env.NODE_ENV === "production") throw new Error("Testler NODE_ENV=production iken çalışmaz.");
  let host = "";
  try {
    host = new URL(sunucu).hostname.toLowerCase();
  } catch {
    throw new Error("TEST_DATABASE_BASE_URL geçerli bir adres değil.");
  }
  if (!YEREL.has(host)) throw new Error("TEST_DATABASE_BASE_URL yerel bir sunucuyu göstermiyor (bilerek başka sunucu için TEST_ZORLA=1).");
}

export async function testOrtamiKur(): Promise<TestOrtami> {
  const sunucu = process.env.TEST_DATABASE_BASE_URL?.trim();
  if (!sunucu) throw new Error("TEST_DATABASE_BASE_URL tanımlı değil (.env).");
  korumaDenetle(sunucu);

  const ad = rastgeleAd();
  let db: Veritabani | null = null;
  let http: Server | null = null;
  let hizSiniri: HizSiniri | null = null;
  let acildi = false;

  const temizle = async () => {
    if (http) await new Promise<void>((coz) => http!.close(() => coz()));
    hizSiniri?.kapat();
    if (db) await db.$disconnect().catch(() => undefined);
    if (!acildi) return;
    await veritabaniSil(sunucu, ad).catch((e: unknown) => console.error(`! Test veritabanı silinemedi (${ad}):`, adresleriGizle(String(e))));
  };

  try {
    const dbUrl = await veritabaniAc(sunucu, ad);
    acildi = true;
    const goc = await prismaCalistir(["migrate", "deploy"], { DATABASE_URL: dbUrl });
    if (goc.kod !== 0) throw new Error("Migration uygulanamadı:\n" + adresleriGizle(goc.cikti));

    db = veritabaniOlustur(dbUrl, 8);
    const yonetici = { eposta: "yonetici@test.local", parola: "Yonetici-Parola-1" };
    await db.yonetici.create({ data: { adSoyad: "Test Yönetici", eposta: yonetici.eposta, parolaHash: await parolaOzetle(yonetici.parola), rol: "YONETICI" } });

    let kayma = 0;
    const iletiler: Ileti[] = [];
    const beklenmeyenHatalar: unknown[] = [];
    const posta: Posta = {
      async gonder(ileti) {
        iletiler.push(ileti);
      },
    };
    const anahtar = randomBytes(32).toString("base64url");
    hizSiniri = new HizSiniri();
    const { app } = createApp({
      db,
      servisAnahtari: anahtar,
      frontendUrl: "http://frontend.test",
      posta,
      saat: { simdi: () => new Date(Date.now() + kayma) },
      hizSiniri,
      hataGunlugu: (e) => {
        beklenmeyenHatalar.push(e);
        console.error("[test] Beklenmeyen sunucu hatası:", e);
      },
    });
    http = await new Promise<Server>((coz) => {
      const s = app.listen(0, "127.0.0.1", () => coz(s));
    });
    const port = (http.address() as AddressInfo).port;

    return {
      url: `http://127.0.0.1:${port}`,
      anahtar,
      db,
      saat: {
        kaydir: (ms) => {
          kayma += ms;
        },
        sifirla: () => {
          kayma = 0;
        },
      },
      iletiler,
      beklenmeyenHatalar,
      yonetici,
      kapat: temizle,
    };
  } catch (e) {
    await temizle();
    throw e;
  }
}
