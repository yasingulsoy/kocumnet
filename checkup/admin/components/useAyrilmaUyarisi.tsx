"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";

/**
 * Kaydedilmemiş değişiklik varken sayfadan ayrılmayı sorar:
 *  · sekme kapatma / yenileme: tarayıcının kendi uyarısı (beforeunload),
 *  · panel içi bağlantılar (kenar çubuğu, iz): onay penceresi; "Ayrıl"
 *    denirse gidilir. Tıklama yakalama evresinde durdurulur: Next'in Link
 *    işleyicisi çalışmadan.
 * Dönen öğe bileşenin çıktısına konur (onay penceresi).
 */
export function useAyrilmaUyarisi(kirli: boolean): ReactNode {
  const router = useRouter();
  const [pencere, onayla] = useConfirm();

  useEffect(() => {
    if (!kirli) return;

    function kapanis(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function tiklama(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void onayla({
        title: "Kaydedilmemiş değişiklikler var",
        description: "Sayfadan ayrılırsanız yaptığınız değişiklikler kaybolur.",
        confirmLabel: "Ayrıl",
        cancelLabel: "Sayfada kal",
        tone: "warning",
      }).then((evet) => {
        if (evet) router.push(url.pathname + url.search + url.hash);
      });
    }

    window.addEventListener("beforeunload", kapanis);
    document.addEventListener("click", tiklama, true);
    return () => {
      window.removeEventListener("beforeunload", kapanis);
      document.removeEventListener("click", tiklama, true);
    };
  }, [kirli, onayla, router]);

  return pencere;
}
