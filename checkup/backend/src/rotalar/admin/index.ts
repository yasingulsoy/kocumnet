import { Router } from "express";
import type { Baglam } from "../../http/baglam.js";
import { yoneticiOturumu } from "../../http/ara-katmanlar.js";
import { adminAgacRotalari } from "./agac.js";
import { adminAyarRotalari } from "./ayar.js";
import { adminAcikRotalar, adminHesapRotalari } from "./hesap.js";
import { adminOgrenciRotalari } from "./ogrenci.js";
import { adminSinavRotalari } from "./sinav.js";
import { adminSoruRotalari } from "./soru.js";

/**
 * /api/admin. Roller (checkup/API.md "Admin"):
 *   - Giriş yapmış her yönetici (EDITOR ve YONETICI): pano, okuma uçları,
 *     konu ağacı, sorular, önizleme, görsel, içe aktarma, check-up ayarları.
 *   - Yalnızca YONETICI: sınav ve tür yazma, öğrenciler ve raporları, yöneticiler.
 *     (Bu uçlarda yoneticiRoluGerekli ayrıca bağlıdır.)
 */
export function adminRotalari(b: Baglam): Router {
  const r = Router();
  r.use(adminAcikRotalar(b));
  r.use(yoneticiOturumu(b));
  r.use(adminHesapRotalari(b));
  r.use(adminSinavRotalari(b));
  r.use(adminAgacRotalari(b));
  r.use(adminAyarRotalari(b));
  r.use(adminSoruRotalari(b));
  r.use(adminOgrenciRotalari(b));
  return r;
}
