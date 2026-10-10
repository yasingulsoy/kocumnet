"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";

/**
 * Kaydedilmemiş değişiklik varken sayfadan çıkmadan önce sorar:
 *  · sekmeyi kapatma, yenileme, başka siteye gitme → tarayıcının kendi uyarısı;
 *  · panel içi bağlantılar (kenar çubuğu, kırıntı) → kitin onay penceresi.
 *
 * Next'in istemci yönlendirmesi engellenebilir bir olay yaymıyor; bu yüzden
 * bağlantı tıklaması `window` üzerinde, yakalama aşamasında — React'in
 * belgeye bağlı dinleyicilerinden ÖNCE — dinleniyor ve durduruluyor; onay
 * gelirse aynı adrese yönlendiricinin kendisiyle gidilir. Geri tuşu
 * yakalanmaz: tarayıcılar izin vermiyor.
 *
 * Döndürdüğü pencere çağıranın çiziminde yer almalı:
 *   const cikisUyarisi = useUnsavedGuard(degisti);
 *   return <>{cikisUyarisi}…</>;
 */
export function useUnsavedGuard(aktif: boolean): ReactNode {
  const [pencere, onayla] = useConfirm();
  const router = useRouter();

  useEffect(() => {
    if (!aktif) return;

    const kapanis = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Eski tarayıcılar için; metni artık hiçbir tarayıcı göstermiyor.
      e.returnValue = "";
    };

    const tik = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#") || /^(mailto|tel):/i.test(href)) return;
      const hedef = new URL(a.href, window.location.href);
      if (hedef.origin === window.location.origin && hedef.pathname === window.location.pathname && hedef.search === window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      void onayla({
        title: "Kaydedilmemiş değişiklikler var",
        description: "Sayfadan ayrılırsan kaydedilmemiş değişiklikler kaybolacak. Yine de çıkılsın mı?",
        confirmLabel: "Yine de çık",
        cancelLabel: "Sayfada kal",
        tone: "warning",
      }).then((evet) => {
        if (!evet) return;
        window.removeEventListener("beforeunload", kapanis);
        if (hedef.origin === window.location.origin) router.push(hedef.pathname + hedef.search + hedef.hash);
        else window.location.assign(hedef.href);
      });
    };

    window.addEventListener("beforeunload", kapanis);
    window.addEventListener("click", tik, true);
    return () => {
      window.removeEventListener("beforeunload", kapanis);
      window.removeEventListener("click", tik, true);
    };
  }, [aktif, onayla, router]);

  return pencere;
}
