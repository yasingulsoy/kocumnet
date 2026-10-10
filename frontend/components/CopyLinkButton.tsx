"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";

/**
 * Yazının bağlantısını panoya kopyalar — Instagram, Telegram, e-posta ya da
 * okul grubuna yapıştırmak için. Paylaşım düğmelerinin hiçbiri bunu
 * karşılamıyordu.
 *
 * Görünüm TailAdmin üst çubuğundaki yuvarlak ikon düğmeleri (paylaşım
 * düğmeleriyle aynı). Kopyalanınca simge ✓ olur, düğme yeşile döner ve
 * ekran okuyucuya "kopyalandı" duyurulur.
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
        className={cx(
          "flex size-10 cursor-pointer items-center justify-center rounded-full border shadow-theme-xs transition",
          kopyalandi
            ? "border-success-200 bg-success-50 text-success-700"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700",
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
