"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Blog editörünün yerel yedeği (localStorage): yazı kaydedilmeden sekme
 * kapanır, tarayıcı çöker ya da oturum düşüp sayfa yenilenirse emek
 * kaybolmasın. Yalnızca bu tarayıcıda durur; başarılı kayıttan sonra silinir.
 *
 * Sayfa açıldığında BULUNAN yedek (bu oturumda yazılanlar değil) bir kez
 * okunur ve sabit tutulur: kendi otomatik kayıtlarımız "yedek bulundu"
 * uyarısı olarak geri gelmesin.
 */

export interface YaziYedegi {
  /** Form alanları: title, excerpt, meta_title, meta_description, tags, slug, locale */
  alanlar: Record<string, string>;
  icerik: string;
  /** ms */
  zaman: number;
  /**
   * Yedeğin dayandığı yazı sürümü (editör açıldığında updated_at). Sunucudaki
   * sürüm farklıysa arada başkası kaydetmiştir: geri yükleme onun üzerine yazar.
   */
  taban?: string | null;
  /** Yer kalmadığı için gömülü görseller yedeğe alınamadı. */
  gorselsiz?: boolean;
}

const ONEK = "kocum-yonetim:yazi-yedegi:";
const ilkOkumalar = new Map<string, string | null>();
const unutmaZamanlayicilari = new Map<string, number>();
/** Yedek silinince açık bileşenler "bulunan yedek"i bıraksın diye. */
const dinleyiciler = new Set<() => void>();

function oku(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

const abone = (cb: () => void) => {
  dinleyiciler.add(cb);
  return () => {
    dinleyiciler.delete(cb);
  };
};

function cozumle(ham: string | null): YaziYedegi | null {
  if (!ham) return null;
  try {
    const v = JSON.parse(ham) as YaziYedegi;
    return v && typeof v.icerik === "string" && v.alanlar && typeof v.zaman === "number" ? v : null;
  } catch {
    return null;
  }
}

export function useDraftBackup(kimlik: string) {
  const k = ONEK + kimlik;
  const ham = useSyncExternalStore(
    abone,
    () => {
      if (!ilkOkumalar.has(k)) ilkOkumalar.set(k, oku(k));
      return ilkOkumalar.get(k) ?? null;
    },
    () => null
  );

  /*
   * Sayfadan çıkınca unut: geri gelindiğinde güncel yedek yeniden okunsun.
   * Silme bir sonraki tura ertelenir; hemen yeniden bağlanırsa (React Strict
   * Mode, kayıttan sonra key ile yeniden bağlama) iptal edilir — yoksa kendi
   * otomatik yedeğimiz "bulunan yedek" diye geri gelirdi.
   */
  useEffect(() => {
    window.clearTimeout(unutmaZamanlayicilari.get(k));
    return () => {
      unutmaZamanlayicilari.set(
        k,
        window.setTimeout(() => ilkOkumalar.delete(k), 0)
      );
    };
  }, [k]);

  const yaz = useCallback(
    (v: YaziYedegi) => {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch {
        // Kota doldu (gömülü görseller büyük): görselsiz dene.
        try {
          const icerik = v.icerik.replace(/src=(["'])data:[^"']*\1/g, 'src=""');
          window.localStorage.setItem(k, JSON.stringify({ ...v, icerik, gorselsiz: true }));
        } catch {
          /* yedek alınamadı; editör çalışmaya devam eder */
        }
      }
    },
    [k]
  );

  const sil = useCallback((...ekler: string[]) => {
    for (const anahtar of [k, ...ekler.map((e) => ONEK + e)]) {
      try {
        window.localStorage.removeItem(anahtar);
      } catch {
        /* yoksay */
      }
      if (ilkOkumalar.has(anahtar)) ilkOkumalar.set(anahtar, null);
    }
    for (const cb of dinleyiciler) cb();
  }, [k]);

  return { bulunan: cozumle(ham), yaz, sil };
}
