"use client";

import { useEffect, type RefObject } from "react";

const AYRILMA_UYARISI = "Kaydedilmemiş değişiklikler var. Sayfadan çıkarsan kaybolacak. Çıkılsın mı?";

/**
 * Kaydedilmemiş değişiklik varken sayfadan ayrılmadan önce sorar.
 *
 * - Sekmeyi kapatma, yenileme, başka siteye gitme: tarayıcının kendi uyarısı
 *   (beforeunload).
 * - Panel içi bağlantılar (kenar çubuğu, Vazgeç, gezinti izi) istemci
 *   tarafında gezdiği için beforeunload'a düşmez; tıklama yakalama evresinde
 *   soruluyor. Next'in Link'i `defaultPrevented` olayda gezinmiyor.
 * - Tarayıcının geri/ileri tuşu yakalanmaz (istemci yönlendirmesi).
 *
 * `gonderiliyor` doğruyken (kayıt sürüyor, yönlendirme gelecek) sorulmaz.
 */
export function useUnsavedGuard(kirli: boolean, gonderiliyor: RefObject<boolean>) {
  useEffect(() => {
    if (!kirli) return;
    const kapanis = (e: BeforeUnloadEvent) => {
      if (gonderiliyor.current) return;
      e.preventDefault();
      // Eski Chromium sürümleri uyarıyı yalnızca returnValue ile gösteriyor.
      e.returnValue = "";
    };
    const tiklama = (e: MouseEvent) => {
      if (gonderiliyor.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // yeni sekme
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return;
      const hedef = new URL(a.href, window.location.href);
      if (hedef.origin !== window.location.origin) return; // tam sayfa geçişi: beforeunload sorar
      if (hedef.pathname === window.location.pathname && hedef.search === window.location.search) return;
      if (!window.confirm(AYRILMA_UYARISI)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", kapanis);
    document.addEventListener("click", tiklama, true);
    return () => {
      window.removeEventListener("beforeunload", kapanis);
      document.removeEventListener("click", tiklama, true);
    };
  }, [kirli, gonderiliyor]);
}
