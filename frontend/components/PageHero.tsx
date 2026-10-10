import type { ReactNode } from "react";
import { cx } from "@/components/tailadmin/cx";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { Container, Eyebrow } from "@/components/ui";
import { fosforla } from "@/components/Marker";

/**
 * İç sayfa başlığı.
 *
 * Açık ton: TailAdmin'in gri tuvali (gray-50) ve köşelerde sönen ızgara
 * (kitin GridShape'i — giriş ve hata sayfalarıyla aynı desen). Başlık sola
 * hizalı, tipografiyle taşınır; sayfalar birbirinden içerikleriyle ayrılır.
 *
 * `tone="deep"`: lacivert (brand-950) + ızgara — kitin giriş sayfasındaki
 * marka paneli. Yalnızca gerçekten koyu zemin gereken yerde (blog yazısı:
 * uzun okumada başlık gövdeden net ayrılsın).
 *
 * Yönetimdeki yazı önizlemesi de bu bileşeni kullanır.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  tone = "light",
  breadcrumb,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Başlığın altındaki ek içerik: rozetler, çapa bağlantıları, yazar bilgisi. */
  children?: ReactNode;
  tone?: "light" | "deep";
  breadcrumb?: ReactNode;
}) {
  const deep = tone === "deep";
  /*
   * Açık zeminli iç sayfa başlıkları ana sayfa hero'su gibi fosforla çizilir
   * (marka imzası her sayfada). Koyu ton (blog yazısı) hariç: başlık yazarın
   * metni, rastgele bir kelimesini vurgulamak anlam katmaz.
   */
  const baslik = !deep && typeof title === "string" ? fosforla(title, { kisaysaTumu: true }) : title;

  return (
    <header className={cx("relative z-1 overflow-hidden", deep ? "zemin-koyu bg-brand-950" : "border-b border-gray-200 bg-gray-50")}>
      <GridShape />
      <Container className="py-14 sm:py-20">
        {breadcrumb ? <div className="mb-6">{breadcrumb}</div> : null}
        {eyebrow ? <Eyebrow dark={deep}>{eyebrow}</Eyebrow> : null}
        <h1
          className={cx(
            "font-display max-w-4xl text-title-md font-semibold tracking-tight text-balance sm:text-title-lg",
            eyebrow ? "mt-4" : undefined,
            deep ? "text-white" : "text-gray-800"
          )}
        >
          {baslik}
        </h1>
        {description ? (
          <p className={cx("mt-5 max-w-2xl text-base sm:text-lg", deep ? "text-gray-300" : "text-gray-600")}>{description}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </header>
  );
}
