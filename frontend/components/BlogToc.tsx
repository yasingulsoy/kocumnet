"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import type { IcindekilerOgesi } from "@/lib/blog-content";

/**
 * Bölüm başlığı ekranın üstünden bu kadar piksele (sabit header 120-128px +
 * pay) çıkınca o bölüm "okunuyor" sayılır. globals.css'teki scroll-padding-top
 * (8.5rem = 136px) ile uyumlu: içindekilerden tıklanan başlık tam bu çizginin
 * altına gelir ve hemen vurgulanır.
 */
const OKUMA_CIZGISI = 160;

/**
 * Geniş ekranda (xl) yazının yanında yapışkan duran içindekiler; okunan
 * bölüm vurgulu (aria-current). Daha dar ekranlarda yazının başındaki
 * açılır kutu kullanılır (sunucuda çizilir, JS gerektirmez).
 *
 * Vurgu yalnızca renk ve çizgi değişimi — hareket yok. Tıklayınca yerel çapa
 * kaydırması: hareket azaltma tercihinde globals.css onu da anlık yapar.
 * Kaydırma dinleyicisi pasif ve kare başına en fazla bir ölçüm.
 */
export function BlogToc({ items, label }: { items: IcindekilerOgesi[]; label: string }) {
  const [aktif, setAktif] = useState<string | null>(null);

  useEffect(() => {
    const basliklar = items
      .map((oge) => document.getElementById(oge.id))
      .filter((el): el is HTMLElement => el !== null);
    if (basliklar.length === 0) return;

    let kare = 0;
    const hesapla = () => {
      kare = 0;
      let secili: string | null = null;
      for (const b of basliklar) {
        if (b.getBoundingClientRect().top <= OKUMA_CIZGISI) secili = b.id;
        else break;
      }
      // Kısa son bölümün başlığı çizgiye hiç ulaşamayabilir: sayfa sonundaysak o.
      const sonda = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const sonBaslik = basliklar[basliklar.length - 1];
      if (sonda && sonBaslik.getBoundingClientRect().top < window.innerHeight) secili = sonBaslik.id;
      setAktif(secili);
    };
    const planla = () => {
      if (!kare) kare = requestAnimationFrame(hesapla);
    };

    planla();
    window.addEventListener("scroll", planla, { passive: true });
    window.addEventListener("resize", planla);
    return () => {
      cancelAnimationFrame(kare);
      window.removeEventListener("scroll", planla);
      window.removeEventListener("resize", planla);
    };
  }, [items]);

  return (
    <nav aria-label={label}>
      <p className="text-micro font-semibold uppercase tracking-[0.18em] text-brand">{label}</p>
      <ol className="mt-4 border-s border-line">
        {items.map((oge) => {
          const secili = oge.id === aktif;
          return (
            <li key={oge.id}>
              <a
                href={`#${oge.id}`}
                aria-current={secili ? "true" : undefined}
                className={cn(
                  "-ms-px block border-s-2 py-1.5 text-caption leading-snug transition-colors",
                  oge.seviye === 3 ? "ps-6" : "ps-4",
                  secili
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-ink-faint hover:border-line-strong hover:text-ink"
                )}
              >
                {oge.metin}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
