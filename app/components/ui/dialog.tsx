"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Yerel <dialog> sarmalayıcısı.
 *
 * Neden kütüphane değil: showModal() odak kapanını, Escape ile kapanmayı,
 * arka planın etkisizleşmesini ve üst katmanı TARAYICIDAN veriyor. Elle
 * yazılmış bir modal bunların birini mutlaka kaçırıyor (önceki onay kutusu
 * odağı hapsetmiyordu).
 *
 * `sheet`: mobilde alttan açılan tabaka, geniş ekranda ortada kutu —
 * soru listesi gibi başparmakla kullanılan içerik için.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = "center",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  variant?: "center" | "sheet";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape ve form[method=dialog] buradan geçer; durumu dışarıyla eşitle.
      onClose={onClose}
      // Arka plana tıklayınca kapat: tıklanan öğe dialog'un kendisiyse
      // içeriğin dışına tıklanmıştır.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop",
        variant === "sheet" &&
          "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none",
        className
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="dialog-title" className="font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? <div className="mt-1 text-sm text-ink-soft">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="-me-1.5 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface-hover hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
