"use client";

import { useEffect } from "react";

/**
 * Yazdırırken sayfadaki kapalı <details>'leri açar; yazdırma bitince
 * yalnızca KENDİ açtıklarını geri kapatır.
 *
 * Neden: Chrome kapalı <details>'in içini basmıyor. Sonuç ekranındaki kazanım
 * ve soru kartları, yanlış defterindeki kartlar "Yazdır / PDF"te başlığıyla
 * kalıyor, içi boş çıkıyordu; veliye giden PDF'te özetler yoktu.
 *
 * "Yazdır / PDF" düğmesi (PrintButton, window.print) de tarayıcının kendi
 * yazdırma komutu (Ctrl+P) de beforeprint / afterprint olaylarını tetikler;
 * ikisi de buradan geçer. Öğrencinin elle açtığı kart yazdırmadan sonra açık
 * kalır: hangilerini açtığımızı hatırlıyoruz. Denetimli <details>
 * (AnswerReview) toggle olayıyla kendi durumunu eşitler.
 *
 * Görünmez; sayfaya bir kez konur.
 */
export function YazdirirkenAc() {
  useEffect(() => {
    const acilanlar = new Set<HTMLDetailsElement>();

    const ac = () => {
      document.querySelectorAll<HTMLDetailsElement>("details:not([open])").forEach((d) => {
        d.open = true;
        acilanlar.add(d);
      });
    };
    const kapat = () => {
      acilanlar.forEach((d) => {
        if (d.isConnected) d.open = false;
      });
      acilanlar.clear();
    };

    window.addEventListener("beforeprint", ac);
    window.addEventListener("afterprint", kapat);
    return () => {
      window.removeEventListener("beforeprint", ac);
      window.removeEventListener("afterprint", kapat);
    };
  }, []);

  return null;
}
