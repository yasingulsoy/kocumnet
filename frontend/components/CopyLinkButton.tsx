"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Yazının bağlantısını panoya kopyalar — Instagram, Telegram, e-posta ya da
 * okul grubuna yapıştırmak için. Paylaşım düğmelerinin hiçbiri bunu
 * karşılamıyordu.
 *
 * Kopyalanınca simge ✓ olur ve ekran okuyucuya "kopyalandı" duyurulur.
 * Pano API'si yoksa (eski tarayıcı, güvensiz bağlam) gizli bir metin alanı
 * üstünden eski yönteme düşer.
 */
export function CopyLinkButton({
  url,
  label,
  copiedLabel,
  className,
}: {
  url: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    []
  );

  async function kopyala() {
    let basarili = false;
    try {
      await navigator.clipboard.writeText(url);
      basarili = true;
    } catch {
      const alan = document.createElement("textarea");
      alan.value = url;
      alan.setAttribute("readonly", "");
      alan.style.position = "fixed";
      alan.style.opacity = "0";
      document.body.appendChild(alan);
      alan.select();
      try {
        basarili = document.execCommand("copy");
      } catch {
        basarili = false;
      }
      alan.remove();
    }
    if (!basarili) return;
    setKopyalandi(true);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setKopyalandi(false), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={kopyala}
        aria-label={label}
        title={label}
        className={cn(
          "flex size-10 items-center justify-center rounded-full ring-1 ring-inset transition",
          kopyalandi
            ? "bg-ok-wash text-ok ring-ok/25"
            : "bg-surface-sunk text-ink-soft ring-line hover:bg-brand-wash hover:text-brand hover:ring-brand/20",
          className
        )}
      >
        {kopyalandi ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {kopyalandi ? copiedLabel : ""}
      </span>
    </>
  );
}
