import { cx } from "@/components/tailadmin/cx";

/**
 * Backend'in ürettiği soru, şık ve çözüm HTML'i. Metin backend'de
 * kaçışlanır, formüller KaTeX ile (trust: false) HTML'e çevrilir (API.md
 * "Yazım biçimi"). Burada HTML ÜRETİLMEZ ve değiştirilmez; yalnızca gösterilir.
 */
export function HtmlIcerik({
  html,
  className,
  as: Etiket = "div",
  id,
}: {
  html: string;
  className?: string;
  as?: "div" | "span";
  id?: string;
}) {
  return <Etiket id={id} className={cx("soru-icerik", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
