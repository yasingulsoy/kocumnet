import { cx } from "@/components/tailadmin/cx";

/**
 * Backend'in ürettiği soru/şık/çözüm HTML'i. Backend metni HTML'e çevirmeden
 * önce kaçışlar ve KaTeX'i `trust: false` ile çalıştırır (API.md "Yazım
 * biçimi"); burada yalnızca gösterilir.
 */
export function SoruHtml({ html, className, bos }: { html: string | null | undefined; className?: string; bos?: string }) {
  if (!html) return bos ? <p className={cx("text-sm text-gray-400 italic", className)}>{bos}</p> : null;
  return <div className={cx("soru-html", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Soru görseli: /medya/[id] üzerinden (backend adresi tarayıcıya inmez). */
export function SoruGorseli({ id, alt = "Soru görseli", className }: { id: string; alt?: string; className?: string }) {
  return (
    // Boyutu bilinmeyen, backend'de zaten küçültülmüş görsel: next/image gerekmez.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/medya/${encodeURIComponent(id)}`} alt={alt} loading="lazy" className={cx("max-h-80 max-w-full rounded-lg border border-gray-200 bg-white", className)} />
  );
}
