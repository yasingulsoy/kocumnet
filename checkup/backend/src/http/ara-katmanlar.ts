import { isIP } from "node:net";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiHata } from "../lib/hatalar.js";
import type { SinirKurali } from "../lib/hiz-siniri.js";
import { guvenliEsit, jetonOzeti } from "../lib/jeton.js";
import type { Baglam, OgrenciKimligi, YoneticiKimligi } from "./baglam.js";

/**
 * Her istekte x-servis-anahtari (GET /api/saglik hariç; o bu katmandan önce
 * bağlanır). Anahtar doğruysa x-istemci-ip başlığına güvenilir.
 */
export function servisAnahtariGerekli(b: Baglam): RequestHandler {
  return (req, _res, next) => {
    const gelen = req.get("x-servis-anahtari") ?? "";
    if (!gelen || !guvenliEsit(gelen, b.servisAnahtari)) {
      throw new ApiHata("SERVIS_ANAHTARI", "Servis anahtarı yok ya da yanlış.");
    }
    const ip = (req.get("x-istemci-ip") ?? "").trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
    req.istemciIp = ip && ip.length <= 45 && isIP(ip) ? ip : (req.socket.remoteAddress ?? "yerel");
    next();
  };
}

function bearerJeton(req: Request): string | null {
  const baslik = req.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(baslik.trim());
  return m ? m[1]! : null;
}

const oturumYok = () => new ApiHata("OTURUM_YOK", "Oturum bulunamadı ya da süresi doldu. Yeniden giriş yapın.");

/** Öğrenci jetonu; yönetici jetonu burada geçmez. */
export function ogrenciOturumu(b: Baglam): RequestHandler {
  return async (req, _res, next) => {
    const jeton = bearerJeton(req);
    if (!jeton) throw oturumYok();
    const oturum = await b.db.oturum.findUnique({
      where: { jetonHash: jetonOzeti(jeton) },
      select: { id: true, bitis: true, ogrenci: { select: { id: true, adSoyad: true, eposta: true, olusturuldu: true } } },
    });
    if (!oturum || !oturum.ogrenci) throw oturumYok();
    if (oturum.bitis <= b.saat.simdi()) {
      await b.db.oturum.deleteMany({ where: { id: oturum.id } });
      throw oturumYok();
    }
    req.ogrenci = oturum.ogrenci satisfies OgrenciKimligi;
    req.oturumId = oturum.id;
    next();
  };
}

/** Yönetici jetonu; öğrenci jetonu burada geçmez. Pasif yönetici oturumu geçersizdir. */
export function yoneticiOturumu(b: Baglam): RequestHandler {
  return async (req, _res, next) => {
    const jeton = bearerJeton(req);
    if (!jeton) throw oturumYok();
    const oturum = await b.db.oturum.findUnique({
      where: { jetonHash: jetonOzeti(jeton) },
      select: { id: true, bitis: true, yonetici: { select: { id: true, adSoyad: true, eposta: true, rol: true, aktif: true } } },
    });
    if (!oturum || !oturum.yonetici || !oturum.yonetici.aktif) throw oturumYok();
    if (oturum.bitis <= b.saat.simdi()) {
      await b.db.oturum.deleteMany({ where: { id: oturum.id } });
      throw oturumYok();
    }
    req.yonetici = oturum.yonetici satisfies YoneticiKimligi;
    req.oturumId = oturum.id;
    next();
  };
}

/** Yalnızca YONETICI rolü (EDITOR'e YETKI_YOK). yoneticiOturumu'ndan sonra bağlanır. */
export const yoneticiRoluGerekli: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (req.yonetici?.rol !== "YONETICI") {
    throw new ApiHata("YETKI_YOK", "Bu işlem için yönetici (YONETICI) yetkisi gerekiyor.");
  }
  next();
};

/** Hız sınırı denetimi; aşıldıysa COK_FAZLA_ISTEK. */
export function sinirDenetle(b: Baglam, anahtar: string, kural: SinirKurali, res: Response): void {
  const bekle = b.hizSiniri.say(anahtar, kural);
  if (bekle !== null) {
    res.setHeader("Retry-After", String(bekle));
    const dakika = Math.ceil(bekle / 60);
    throw new ApiHata("COK_FAZLA_ISTEK", `Çok fazla deneme yapıldı. ${dakika} dakika sonra yeniden deneyin.`, { ek: { bekleSaniye: bekle } });
  }
}
