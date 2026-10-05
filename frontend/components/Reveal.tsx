import type { CSSProperties, ReactNode } from "react";

/*
 * Kaydırınca beliren bölümler — SAF CSS, sunucuda çizilir.
 *
 * Eskiden framer-motion'dı: başlangıç durumunu (opacity:0) sunucu HTML'ine
 * yazıyordu ve içerik JavaScript yüklenip sayfa hidrasyonu bitene kadar
 * görünmüyordu (yavaş telefonda iletişim formu dahil saniyelerce boşluk).
 * Kütüphane de her sayfanın paketindeydi.
 *
 * Şimdi bu bileşenler yalnızca işaret koyar (`data-reveal`, `data-reveal-group`).
 * Gizleme ve canlandırma globals.css'te ve YALNIZCA <html> `reveal-on`
 * sınıfını aldıysa devrededir; o sınıfı tek istemci bileşeni RevealObserver
 * ekler. JavaScript yoksa, hata verirse ya da kullanıcı hareket azaltmayı
 * seçtiyse hiçbir şey gizlenmez: içerik her zaman ilk HTML'de görünür.
 */

/** Tek öğe: görünüme girince yukarı kayarak belirir. */
export function Reveal({
  children,
  delay = 0,
  y,
  className,
}: {
  children: ReactNode;
  /** Saniye. */
  delay?: number;
  /** Başlangıç kayması (px), varsayılan 18. */
  y?: number;
  className?: string;
}) {
  const style: Record<string, string> = {};
  if (delay) style["--reveal-delay"] = `${delay}s`;
  if (y !== undefined) style["--reveal-y"] = `${y}px`;

  return (
    <div
      data-reveal=""
      className={className}
      style={Object.keys(style).length > 0 ? (style as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/** Izgara/kart grupları: grup görünüme girince çocuklar sırayla belirir. */
export function StaggerGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-reveal-group="" className={className}>
      {children}
    </div>
  );
}

/** StaggerGroup'un DOĞRUDAN çocuğu olmalı: sıra gecikmesi :nth-child ile verilir. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-reveal-item="" className={className}>
      {children}
    </div>
  );
}
