"use client";

import { useEffect } from "react";

const UYARI = "Kaydedilmemiş değişiklikler var. Sayfadan ayrılırsan kaybolacak. Yine de çıkılsın mı?";

/**
 * Kaydedilmemiş değişiklik varken sayfadan çıkmadan önce sorar:
 *  · sekmeyi kapatma, yenileme, başka siteye gitme → tarayıcının kendi uyarısı;
 *  · panel içi bağlantılar (kenar çubuğu, kırıntı) → onay kutusu.
 *
 * Next'in istemci yönlendirmesi engellenebilir bir olay yaymıyor; bu yüzden
 * bağlantı tıklaması `window` üzerinde, yakalama aşamasında — React'in
 * belgeye bağlı dinleyicilerinden ÖNCE — dinleniyor. Vazgeçilirse olay
 * durdurulur; <Link> hiç çalışmaz. Geri tuşu yakalanmaz: tarayıcılar izin vermiyor.
 */
export function useUnsavedGuard(aktif: boolean) {
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
      if (!window.confirm(UYARI)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", kapanis);
    window.addEventListener("click", tik, true);
    return () => {
      window.removeEventListener("beforeunload", kapanis);
      window.removeEventListener("click", tik, true);
    };
  }, [aktif]);
}
