/**
 * Sınav ekranının cihazdaki deposu (localStorage): yazılmamış cevap kuyruğu
 * ve "sonra bak" işaretleri. Yalnızca tarayıcıda çağrılır; her erişim
 * try/catch içinde (gizli sekme, dolu depo, kapalı çerez izni).
 */

import type { BekleyenKayit } from "@/lib/sinav-kuyrugu";

/*
 * Neden yerel depo: kayıt kuyruğu yalnızca bellekteydi. Bağlantı yokken
 * işaretleyip uygulamadan çıkan öğrencinin sekmesini telefon arka planda
 * kapatınca (ya da sayfa yenilenince) yazılmamış cevaplar kayboluyordu.
 * Şimdi kuyruk bu cihazda da saklı; ekran açılınca kaldığı yerden gönderilir.
 * "Sonra bak" işaretleri de burada: cihaza özel bir gezinme yardımı,
 * puanlamaya girmiyor, sunucuya gitmesi gerekmiyor.
 */
const DEPO_ONEKI = "kocum:sinav:";
const DEPO_OMRU_MS = 3 * 86_400_000;

export interface SinavDeposu {
  v: 1;
  /** Son yazılma — eski kayıtları temizlemek için. */
  t: number;
  sonra: string[];
  kuyruk: [string, BekleyenKayit][];
}

export function depoOku(sessionId: string): SinavDeposu | null {
  try {
    const ham = window.localStorage.getItem(DEPO_ONEKI + sessionId);
    const veri = ham ? (JSON.parse(ham) as SinavDeposu) : null;
    return veri?.v === 1 && Array.isArray(veri.sonra) && Array.isArray(veri.kuyruk) ? veri : null;
  } catch {
    return null;
  }
}

export function depoYaz(
  sessionId: string,
  sonra: ReadonlySet<string>,
  kuyruk: ReadonlyMap<string, BekleyenKayit>
) {
  try {
    if (sonra.size === 0 && kuyruk.size === 0) {
      window.localStorage.removeItem(DEPO_ONEKI + sessionId);
      return;
    }
    const veri: SinavDeposu = { v: 1, t: Date.now(), sonra: [...sonra], kuyruk: [...kuyruk] };
    window.localStorage.setItem(DEPO_ONEKI + sessionId, JSON.stringify(veri));
  } catch {
    // Gizli sekme ya da dolu depo: kuyruk yalnızca bellekte kalır (eski davranış).
  }
}

export function depoSil(sessionId: string) {
  try {
    window.localStorage.removeItem(DEPO_ONEKI + sessionId);
  } catch {
    // yoksay
  }
}

/** Bitmiş ya da terk edilmiş testlerden kalan eski kayıtlar birikmesin. */
export function eskiDepolariTemizle(haric: string) {
  try {
    const simdi = Date.now();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const anahtar = window.localStorage.key(i);
      if (!anahtar?.startsWith(DEPO_ONEKI) || anahtar === DEPO_ONEKI + haric) continue;
      const veri = JSON.parse(window.localStorage.getItem(anahtar) ?? "null") as SinavDeposu | null;
      if (!veri || typeof veri.t !== "number" || simdi - veri.t > DEPO_OMRU_MS) {
        window.localStorage.removeItem(anahtar);
      }
    }
  } catch {
    // yoksay
  }
}
