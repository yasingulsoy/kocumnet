"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useOnay } from "./Onay";

/**
 * Kaydedilmemiş değişiklik varken sayfadan ayrılmadan önce sorar.
 *
 * - Sekmeyi kapatma, yenileme, başka siteye gitme: tarayıcının kendi uyarısı
 *   (beforeunload).
 * - Panel içi bağlantılar (kenar çubuğu, Vazgeç, gezinti izi) istemci
 *   tarafında gezdiği için beforeunload'a düşmez; tıklama `window` üzerinde,
 *   yakalama evresinde (React'in dinleyicilerinden ÖNCE) durdurulur ve kitin
 *   onay penceresi sorar. "Yine de çık" denirse aynı adrese yönlendiriciyle
 *   gidilir.
 * - Tarayıcının geri/ileri tuşu yakalanmaz (istemci yönlendirmesi).
 *
 * `gonderiliyor` doğruyken (kayıt sürüyor, yönlendirme gelecek) sorulmaz.
 */
export function useUnsavedGuard(kirli: boolean, gonderiliyor: RefObject<boolean>) {
  const onayla = useOnay();
  const router = useRouter();

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
      e.preventDefault();
      e.stopPropagation();
      void onayla({
        title: "Kaydedilmemiş değişiklikler var",
        description: "Sayfadan çıkarsan kaydedilmemiş değişiklikler kaybolacak. Yine de çıkılsın mı?",
        confirmLabel: "Yine de çık",
        cancelLabel: "Sayfada kal",
        // Değişiklik kaybolur: odak "Sayfada kal"da başlasın (yanlışlıkla Enter çıkarmasın).
        tone: "danger",
      }).then((evet) => {
        if (evet) router.push(hedef.pathname + hedef.search + hedef.hash);
      });
    };
    window.addEventListener("beforeunload", kapanis);
    window.addEventListener("click", tiklama, true);
    return () => {
      window.removeEventListener("beforeunload", kapanis);
      window.removeEventListener("click", tiklama, true);
    };
  }, [kirli, gonderiliyor, onayla, router]);
}
