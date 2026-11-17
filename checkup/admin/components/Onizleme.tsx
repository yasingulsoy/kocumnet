"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { cx } from "@/components/tailadmin/cx";
import { SoruHtml } from "@/components/SoruHtml";
import { onizle } from "@/lib/eylemler/sorular";

/**
 * Canlı formül önizlemesi: yazmayı 400 ms bırakınca POST /api/admin/onizleme
 * (server action üzerinden). Backend KaTeX hatasını `mesaj`la döner; alanın
 * altında gösterilir. Eski isteğin yanıtı yenisinin üstüne yazılmaz.
 *
 * Düzenlemede ilk metnin HTML'i GET yanıtında zaten var (`ilkHtml`): sayfa
 * açılırken her alan için ayrı istek atılmaz.
 */
export function useOnizleme(metin: string, ilkMetin = "", ilkHtml = "") {
  const [sonuc, setSonuc] = useState<{ metin: string; html: string; hata: string | null }>({
    metin: ilkMetin,
    html: ilkHtml,
    hata: null,
  });

  useEffect(() => {
    if (metin === sonuc.metin || !metin.trim()) return;
    let iptal = false;
    const zaman = window.setTimeout(async () => {
      const s = await onizle(metin);
      if (iptal) return;
      if (s.ok) setSonuc({ metin, html: s.veri.html, hata: null });
      // Hatada son geçerli önizleme kalır, altında hata yazar.
      else setSonuc((o) => ({ metin, html: o.html, hata: s.mesaj }));
    }, 400);
    return () => {
      iptal = true;
      window.clearTimeout(zaman);
    };
  }, [metin, sonuc.metin]);

  const bos = !metin.trim();
  return {
    html: bos ? "" : sonuc.html,
    hata: bos ? null : sonuc.hata,
    bekliyor: !bos && metin !== sonuc.metin,
  };
}

export const YAZIM_IPUCU = (
  <>
    Formül: <code className="rounded bg-gray-100 px-1">$x^2$</code> satır içi,{" "}
    <code className="rounded bg-gray-100 px-1">$$\frac{"{a}{b}"}$$</code> ayrı satırda ortalı,{" "}
    <code className="rounded bg-gray-100 px-1">\$</code> düz dolar işareti. Satır sonları korunur.
  </>
);

/** Önizleme kutusu: HTML, bekleme göstergesi ve LaTeX hatası. */
export function OnizlemeKutusu({
  html,
  hata,
  bekliyor,
  bos = "Yazdıkça önizleme burada görünür.",
  kompakt = false,
}: {
  html: string;
  hata: string | null;
  bekliyor: boolean;
  bos?: string;
  kompakt?: boolean;
}) {
  return (
    <div>
      <div
        className={cx(
          "relative rounded-xl border bg-gray-25 text-sm",
          kompakt ? "px-3 py-2" : "px-4 py-3",
          hata ? "border-error-300" : "border-gray-200"
        )}
        aria-live="polite"
      >
        <span className="sr-only">Önizleme:</span>
        <SoruHtml html={html} bos={bos} />
        {bekliyor ? (
          <LoaderCircle className="absolute end-2 top-2 size-4 animate-spin text-gray-400" aria-label="Önizleme hazırlanıyor" />
        ) : null}
      </div>
      {hata ? (
        <p className="mt-1.5 text-theme-xs text-error-600" role="alert">
          Formül hatası: {hata}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Çok satırlı metin + canlı önizleme (soru metni, çözüm). Kayıt hatası
 * (`error`) alanın altında, önizleme hatası önizlemenin altında.
 */
export function OnizlemeliMetin({
  label,
  value,
  onChange,
  ilkMetin,
  ilkHtml,
  error,
  hint,
  required,
  rows = 5,
  placeholder,
  yanYana = true,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  ilkMetin?: string;
  ilkHtml?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  /** Geniş ekranda alan ve önizleme yan yana. */
  yanYana?: boolean;
}) {
  const o = useOnizleme(value, ilkMetin, ilkHtml);
  return (
    <div className={cx("grid gap-3", yanYana && "lg:grid-cols-2")}>
      <Field label={label} error={error} hint={hint} required={required}>
        <TextArea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Önizleme</p>
        <OnizlemeKutusu html={o.html} hata={o.hata} bekliyor={o.bekliyor} />
      </div>
    </div>
  );
}
