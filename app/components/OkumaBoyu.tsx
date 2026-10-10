"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";

/*
 * Okuma boyu — sınav ve alıştırma ekranında A− / A+ (üç adım).
 *
 * 0 bugünkü boy (varsayılan), 1 ve 2 daha büyük; küçültme yok: soru ve şık
 * metni text-read/text-body'nin altına düşmez. Ölçek CSS'te
 * (globals.css → "Okuma boyu"): ekran kökü `data-okuma-boyu` taşır, soru
 * metni, şıklar ve çözüm `.okuma` kabında em ile büyür (KaTeX dahil).
 *
 * Tercih bu cihazda (localStorage, her erişim try/catch). Depo kapalıysa
 * (gizli sekme) seçim yalnızca bu oturumda geçerli. Sayfa sunucudan
 * gelince varsayılan boyla çizilir; kökteki satır içi betik (OkumaBetigi)
 * seçimi ilk boyamadan önce uygular, yani yazı sonradan zıplamaz.
 */

export type OkumaBoyu = 0 | 1 | 2;

const ANAHTAR = "kocum:okuma-boyu";
const ADLAR = ["normal", "büyük", "en büyük"] as const;

function coz(ham: string | null): OkumaBoyu {
  return ham === "1" ? 1 : ham === "2" ? 2 : 0;
}

/** Depo kapalıysa seçim burada kalır (yalnızca bu sayfa açıkken). */
let bellek: OkumaBoyu | null = null;
const dinleyiciler = new Set<() => void>();

function oku(): OkumaBoyu {
  if (bellek !== null) return bellek;
  try {
    return coz(window.localStorage.getItem(ANAHTAR));
  } catch {
    return 0;
  }
}

function yaz(boyut: OkumaBoyu) {
  bellek = boyut;
  try {
    window.localStorage.setItem(ANAHTAR, String(boyut));
  } catch {
    // Gizli sekme ya da kapalı depo: seçim bu oturumda geçerli.
  }
  for (const d of dinleyiciler) d();
}

function abone(degisti: () => void) {
  dinleyiciler.add(degisti);
  // Başka sekmede değiştiyse bu sekme de uysun.
  const depo = (e: StorageEvent) => {
    if (e.key !== ANAHTAR) return;
    bellek = null;
    degisti();
  };
  window.addEventListener("storage", depo);
  return () => {
    dinleyiciler.delete(degisti);
    window.removeEventListener("storage", depo);
  };
}

/** Okuma boyu ve değiştirici. Sunucuda ve ilk hidrasyonda varsayılan (0). */
export function useOkumaBoyu(): [OkumaBoyu, (b: OkumaBoyu) => void] {
  const boyut = useSyncExternalStore(abone, oku, () => 0 as OkumaBoyu);
  return [boyut, yaz];
}

/**
 * Ekran kökünün İLK çocuğu olmalı: ayrıştırılırken çalışır ve seçimi
 * köke (üst öğe) yazar. İstemcide çizilince (sayfalar arası geçiş) betik
 * çalışmaz, `text/plain` olarak durur; orada useOkumaBoyu zaten doğru
 * değerle başlar. Kökte de suppressHydrationWarning olmalı.
 */
export function OkumaBetigi() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var b=localStorage.getItem(${JSON.stringify(ANAHTAR)});if(b==="1"||b==="2")document.currentScript.parentElement.setAttribute("data-okuma-boyu",b)}catch(e){}})()`,
      }}
    />
  );
}

/**
 * A− / A+ düğmeleri. Sınırda düğme `aria-disabled` (gerçek disabled odağı
 * düşürürdü: klavyeyle üst üste basan öğrenci yerini kaybederdi).
 */
export function OkumaBoyuDugmeleri({
  boyut,
  onDegis,
  className,
}: {
  boyut: OkumaBoyu;
  onDegis: (b: OkumaBoyu) => void;
  className?: string;
}) {
  const [duyuru, setDuyuru] = useState("");
  const degistir = useCallback(
    (yeni: number) => {
      if (yeni < 0 || yeni > 2 || yeni === boyut) return;
      onDegis(yeni as OkumaBoyu);
      setDuyuru(`Yazı boyu: ${ADLAR[yeni]}`);
    },
    [boyut, onDegis]
  );
  const dugme =
    "flex h-9 w-10 cursor-pointer touch-manipulation items-center justify-center gap-px text-gray-700 transition hover:bg-gray-50 aria-disabled:cursor-default aria-disabled:text-gray-400 aria-disabled:hover:bg-transparent";

  return (
    <div
      role="group"
      aria-label="Yazı boyu"
      className={cx("flex shrink-0 items-center overflow-hidden rounded-lg bg-white ring-1 ring-gray-300 ring-inset", className)}
    >
      <button
        type="button"
        onClick={() => degistir(boyut - 1)}
        aria-disabled={boyut === 0 || undefined}
        aria-label="Yazıyı küçült"
        title="Yazıyı küçült"
        className={dugme}
      >
        <span aria-hidden className="font-display text-[13px] leading-none font-semibold">
          A
        </span>
        <Minus aria-hidden className="size-3" strokeWidth={2.5} />
      </button>
      <span aria-hidden className="h-5 w-px bg-gray-200" />
      <button
        type="button"
        onClick={() => degistir(boyut + 1)}
        aria-disabled={boyut === 2 || undefined}
        aria-label="Yazıyı büyüt"
        title="Yazıyı büyüt"
        className={dugme}
      >
        <span aria-hidden className="font-display text-[17px] leading-none font-semibold">
          A
        </span>
        <Plus aria-hidden className="size-3" strokeWidth={2.5} />
      </button>
      <span className="sr-only" aria-live="polite">
        {duyuru}
      </span>
    </div>
  );
}
