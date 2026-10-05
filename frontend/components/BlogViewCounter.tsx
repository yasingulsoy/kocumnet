"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { PUBLIC_BACKEND_URL } from "@/lib/api";

/**
 * Görüntülenme sayacı: sayfa açılınca bir kez artırır, güncel sayıyı gösterir.
 *
 * Backend adresi lib/api.ts'ten (tek kaynak). Eskiden burada ayrı bir yedek
 * zinciri vardı ve NEXT_PUBLIC_BACKEND_URL yoksa üretimde 127.0.0.1'e
 * istek atıyordu. Adres yoksa sayaç yalnızca ilk sayıyı gösterir.
 */
export function BlogViewCounter({
  slug,
  initialCount,
  label,
}: {
  slug: string;
  initialCount: number;
  label?: string;
}) {
  const [count, setCount] = useState(initialCount);
  // Geliştirmede StrictMode efekti iki kez çalıştırır; sayaç iki artmasın.
  const sayildi = useRef(false);

  useEffect(() => {
    if (sayildi.current || !PUBLIC_BACKEND_URL) return;
    sayildi.current = true;
    fetch(`${PUBLIC_BACKEND_URL}/api/blogs/slug/${encodeURIComponent(slug)}/view`, {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && typeof data.data?.view_count === "number") setCount(data.data.view_count);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Eye className="size-4" aria-hidden />
      <span className="tabular">{count}</span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
