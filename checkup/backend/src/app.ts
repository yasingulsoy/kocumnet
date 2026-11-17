import express, { type ErrorRequestHandler, type Express } from "express";
import helmet from "helmet";
import multer from "multer";
import type { Veritabani } from "./db.js";
import type { Baglam } from "./http/baglam.js";
import { servisAnahtariGerekli } from "./http/ara-katmanlar.js";
import { prismaHatasiCevir } from "./http/yardimcilar.js";
import { ApiHata, bulunamadi } from "./lib/hatalar.js";
import { HizSiniri } from "./lib/hiz-siniri.js";
import type { Posta } from "./lib/posta.js";
import { sistemSaati, type Saat } from "./lib/saat.js";
import { adminRotalari } from "./rotalar/admin/index.js";
import { ogrenciRotalari } from "./rotalar/ogrenci.js";

export interface UygulamaSecenekleri {
  db: Veritabani;
  servisAnahtari: string;
  frontendUrl: string;
  posta: Posta;
  saat?: Saat;
  hizSiniri?: HizSiniri;
  rastgele?: () => number;
  /** Beklenmeyen hataların günlüğü (testler susturabilir). */
  hataGunlugu?: (hata: unknown) => void;
}

export interface Uygulama {
  app: Express;
  baglam: Baglam;
}

/**
 * Express uygulamasını kurar; dinlemez. server.ts dinler, testler rastgele
 * portta açar. Bütün bağımlılıklar parametre: saat ileri sarılabilir, posta
 * yakalanabilir, hız sınırı her test çalıştırmasında temiz başlar.
 */
export function createApp(s: UygulamaSecenekleri): Uygulama {
  if (s.servisAnahtari.length < 32) throw new Error("SERVIS_ANAHTARI en az 32 karakter olmalı.");

  const baglam: Baglam = {
    db: s.db,
    saat: s.saat ?? sistemSaati,
    posta: s.posta,
    hizSiniri: s.hizSiniri ?? new HizSiniri(),
    servisAnahtari: s.servisAnahtari,
    frontendUrl: s.frontendUrl.replace(/\/+$/, ""),
    rastgele: s.rastgele ?? Math.random,
  };
  const gunluk = s.hataGunlugu ?? ((e: unknown) => console.error("[sunucu] Beklenmeyen hata:", e));

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false); // istemci IP'si yalnızca x-istemci-ip'den (servis anahtarı doğruysa)
  app.set("etag", false);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

  // Sağlık: servis anahtarı istemez.
  app.get("/api/saglik", (_req, res) => {
    res.json({ durum: "ok" });
  });

  app.use("/api", servisAnahtariGerekli(baglam));
  app.use("/api", express.json({ limit: "1mb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Görsel baytları: servis anahtarı ister, oturum istemez.
  app.get("/api/medya/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw bulunamadi("Görsel bulunamadı.");
    const g = await baglam.db.gorsel.findUnique({ where: { id }, select: { veri: true, mime: true } });
    if (!g) throw bulunamadi("Görsel bulunamadı.");
    res.setHeader("Content-Type", g.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(g.veri));
  });

  app.use("/api/ogrenci", ogrenciRotalari(baglam));
  app.use("/api/admin", adminRotalari(baglam));

  app.use((_req, _res, next) => next(bulunamadi("Böyle bir uç yok.")));

  const hataIsleyici: ErrorRequestHandler = (err, _req, res, _next) => {
    let hata: ApiHata;
    if (err instanceof ApiHata) {
      hata = err;
    } else if (err instanceof multer.MulterError) {
      hata =
        err.code === "LIMIT_FILE_SIZE"
          ? new ApiHata("DOGRULAMA", "Dosya en fazla 10 MB olabilir.", { alanlar: { dosya: "Dosya en fazla 10 MB olabilir." } })
          : new ApiHata("DOGRULAMA", 'Dosya "dosya" alanında, tek dosya olarak gönderilmeli.', { alanlar: { dosya: 'Dosya "dosya" alanında gönderilmeli.' } });
    } else if (err?.type === "entity.parse.failed") {
      hata = new ApiHata("DOGRULAMA", "Gövde geçerli JSON değil.");
    } else if (err?.type === "entity.too.large") {
      hata = new ApiHata("DOGRULAMA", "Gövde çok büyük (en fazla 1 MB).");
    } else {
      const cevrilen = prismaHatasiCevir(err);
      if (cevrilen) {
        hata = cevrilen;
      } else {
        gunluk(err);
        hata = new ApiHata("SUNUCU", "Beklenmeyen bir hata oluştu. Lütfen biraz sonra yeniden deneyin.");
      }
    }
    if (res.headersSent) return;
    res.status(hata.durum).json(hata.govde());
  };
  app.use(hataIsleyici);

  return { app, baglam };
}
