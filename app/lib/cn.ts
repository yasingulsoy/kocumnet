import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge yalnızca Tailwind'in varsayılan ölçeğini tanır. Projenin
 * (tokens.css) ve kitin (tailadmin.css) özel adları ona öğretilmezse
 * `text-micro`'yu RENK sanıyor ve yanına gelen `text-white` gibi bir renk
 * sınıfıyla "çakışıyor" diye siliyordu: yazı sessizce varsayılan boyuta
 * dönüyordu (sonuç ekranındaki karar çipleri, seviye şeridi, şık harfleri).
 * Aynı şekilde `shadow-card` gölge değil gölge rengi sayılıyordu.
 *
 * Yeni bir belirteç (yazı boyutu, gölge, animasyon) eklenirse buraya da yaz;
 * `npm run smoke` birkaç tanesini denetler.
 */
const YAZI_BOYUTLARI = [
  // tokens.css
  "micro",
  "caption",
  "body",
  "read",
  "lead",
  "h1",
  "h2",
  "h3",
  "h4",
  "display",
  "num-sm",
  "num-md",
  "num-lg",
  // TailAdmin kiti
  "theme-xs",
  "theme-sm",
  "theme-xl",
  "title-sm",
  "title-md",
  "title-lg",
  "title-xl",
  "title-2xl",
];

const RENKLER = [
  // tokens.css
  "bg",
  "canvas",
  "surface",
  "surface-sunk",
  "surface-hover",
  "ink",
  "ink-soft",
  "ink-faint",
  "ink-muted",
  "line",
  "line-strong",
  "brand",
  "brand-hover",
  "brand-deep",
  "brand-bright",
  "brand-wash",
  "brand-wash-strong",
  "ok",
  "ok-fill",
  "ok-wash",
  "warn",
  "warn-fill",
  "warn-wash",
  "bad",
  "bad-fill",
  "bad-wash",
  "highlight",
  "highlight-ink",
  // TailAdmin kiti: gray/brand/success/error/warning/blue-light/orange-<adım>
  (deger: string) => /^(gray|brand|success|error|warning|blue-light|orange)-\d{2,3}$/.test(deger),
  "theme-pink-500",
  "theme-purple-500",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: YAZI_BOYUTLARI,
      color: RENKLER,
      shadow: ["card", "raised", "pop", "brand", "theme-xs", "theme-sm", "theme-md", "theme-lg", "theme-xl", "focus-ring", "tooltip"],
      animate: ["rise", "fade", "soft-pulse"],
      breakpoint: ["2xsm", "xsm", "3xl"],
    },
    classGroups: {
      // Arka plan GÖRSELİ (gradyan, ızgara); zemin rengiyle çakışmaz.
      "bg-image": ["bg-brand-gradient", "bg-grid-fade"],
    },
  },
});

/**
 * Sınıf birleştirici. twMerge çakışan Tailwind sınıflarını çözer: bileşenin
 * varsayılan `px-5`'i ile çağıranın verdiği `px-3` yan yana gelirse
 * sonuncusu kazanır — `!px-3` gibi önem işaretlerine gerek kalmaz.
 *
 * Kitin bileşenleri (components/tailadmin) bunu KULLANMAZ: orada className
 * yalnızca ekler (`cx`), varyant prop'la seçilir.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
