/*
 * Uyarlama: TailAdmin Free (MIT) — components/common/GridShape.tsx
 * (public/images/shape/grid-01.svg)
 *
 * TailAdmin iki köşeye bir ızgara görseli koyuyordu. Görsel dosyası yerine
 * aynı ızgara CSS'le: 51px aralıklı ince çizgiler (#b2b2b2, %30), yanlara ve aşağı
 * doğru sönen maske. Üst köşe ve onun 180° döndürülmüşü alt köşe; start/end
 * ile RTL'de yer değiştirir. Ebeveyn `relative z-1` olmalı (TailAdmin'deki gibi).
 */
import type { CSSProperties } from "react";

// Maske yatayda simetrik (RTL'de de doğru), kenarlara ve aşağı doğru söner.
const MASKE = "radial-gradient(ellipse 85% 100% at 50% 0%, black 25%, transparent 80%)";

const IZGARA: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgb(178 178 178 / 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgb(178 178 178 / 0.3) 1px, transparent 1px)",
  backgroundSize: "51.26px 52.1px",
  maskImage: MASKE,
  WebkitMaskImage: MASKE,
};

export function GridShape() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute end-0 top-0 -z-1 h-63.5 w-full max-w-62.5 xl:max-w-112.5" style={IZGARA} />
      <div
        aria-hidden
        className="pointer-events-none absolute start-0 bottom-0 -z-1 h-63.5 w-full max-w-62.5 rotate-180 xl:max-w-112.5"
        style={IZGARA}
      />
    </>
  );
}
