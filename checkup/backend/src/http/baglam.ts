import type { Veritabani } from "../db.js";
import type { HizSiniri } from "../lib/hiz-siniri.js";
import type { Posta } from "../lib/posta.js";
import type { Saat } from "../lib/saat.js";

/** Rotaların paylaştığı bağımlılıklar. createApp() kurar, testler kendi saatini ve postasını verir. */
export interface Baglam {
  db: Veritabani;
  saat: Saat;
  posta: Posta;
  hizSiniri: HizSiniri;
  servisAnahtari: string;
  frontendUrl: string;
  rastgele: () => number;
}

export interface OgrenciKimligi {
  id: number;
  adSoyad: string;
  eposta: string;
  olusturuldu: Date;
}

export interface YoneticiKimligi {
  id: number;
  adSoyad: string;
  eposta: string;
  rol: "YONETICI" | "EDITOR";
  aktif: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** x-istemci-ip (yalnızca servis anahtarı doğruysa) ya da soket adresi. */
      istemciIp: string;
      ogrenci?: OgrenciKimligi;
      yonetici?: YoneticiKimligi;
      oturumId?: number;
    }
  }
}
