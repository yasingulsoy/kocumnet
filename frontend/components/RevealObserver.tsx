"use client";

import { useEffect } from "react";

const BEKLEYEN = "[data-reveal]:not([data-revealed]), [data-reveal-group]:not([data-revealed])";

/**
 * Kaydırınca belirme animasyonunun TEK tetiği (bkz. components/Reveal.tsx).
 *
 * 1. Şu an ekranda ya da ekranın üstünde kalan işaretli öğeleri hemen
 *    "belirmiş" sayar — kullanıcının gördüğü hiçbir şey kaybolup geri gelmez.
 * 2. Ancak ondan sonra <html>'e `reveal-on` ekler: CSS yalnızca o zaman,
 *    yalnızca ekranın altındaki öğeleri gizler.
 * 3. Tek bir IntersectionObserver öğe görünüme girince `data-revealed` koyar;
 *    geçişi CSS oynatır.
 * Sayfa değişince (istemci yönlendirmesi, blog sayfalaması) eklenen öğeleri
 * MutationObserver yakalar; geri çağrısı boyamadan önce çalıştığı için
 * ekrana gelen yeni öğeler de bir an bile gizli görünmez.
 *
 * Hareket azaltma tercihinde ve baskıda CSS hiçbir şeyi gizlemez (globals.css).
 * Dönen işlev her şeyi geri alır.
 */
export function revealBaslat(): () => void {
  if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }

  const io = new IntersectionObserver(
    (girdiler) => {
      for (const g of girdiler) {
        if (!g.isIntersecting) continue;
        g.target.setAttribute("data-revealed", "");
        io.unobserve(g.target);
      }
    },
    // Alt kenardan %8 içeri girince: öğe ekranın dibinde yarım görünürken başlamasın.
    { rootMargin: "0px 0px -8% 0px" }
  );

  const isle = (ogeler: Element[]) => {
    if (ogeler.length === 0) return;
    const yukseklik = window.innerHeight;
    // Önce bütün ölçümler, sonra yazmalar: arada düzen yeniden hesaplanmasın.
    const ekranda = ogeler.map((el) => el.getBoundingClientRect().top < yukseklik);
    ogeler.forEach((el, i) => {
      if (ekranda[i]) el.setAttribute("data-revealed", "");
      else io.observe(el);
    });
  };

  isle(Array.from(document.querySelectorAll(BEKLEYEN)));
  document.documentElement.classList.add("reveal-on");

  const mo = new MutationObserver((kayitlar) => {
    const yeni: Element[] = [];
    for (const k of kayitlar) {
      k.addedNodes.forEach((dugum) => {
        if (!(dugum instanceof Element)) return;
        if (dugum.matches(BEKLEYEN)) yeni.push(dugum);
        yeni.push(...Array.from(dugum.querySelectorAll(BEKLEYEN)));
      });
    }
    isle(yeni);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    io.disconnect();
    document.documentElement.classList.remove("reveal-on");
  };
}

/** Düzende bir kez bulunur, hiçbir şey çizmez. */
export function RevealObserver() {
  useEffect(() => revealBaslat(), []);
  return null;
}
