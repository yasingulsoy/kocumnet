import type { ReactNode } from "react";
import { Container, Eyebrow, cn } from "@/components/ui";
import { fosforla } from "@/components/Marker";

/**
 * İç sayfa başlığı.
 *
 * Eskiden her iç sayfada (hizmetler, ürünler, hakkımızda, iletişim, blog,
 * blog detayı) şu blok birebir kopyalanmıştı:
 *
 *   bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5]
 *   + iki adet `h-96 w-96 rounded-full bg-white/20 blur-3xl` süs
 *
 * Altı kopya, yaklaşık 60 satır, ve altı sayfa birbirinin aynısı görünüyordu.
 * Yerine gelen tasarım kararı: koyu gradyan bandı bıraktık. Başlık artık
 * açık zeminde, sola hizalı ve tipografiye dayanıyor — sayfalar birbirinden
 * içerikleriyle ayrılıyor, süslemeyle değil.
 *
 * `tone="deep"` yalnızca gerçekten koyu zemin gereken yerde (blog detayı
 * gibi görselle açılan sayfalar) kullanılır.
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
  /** Başlığın altındaki ek içerik: rozetler, çapa linkleri, arama. */
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
    <header
      className={cn(
        "relative overflow-hidden border-b",
        deep ? "border-white/10 bg-brand-deep" : "border-line bg-surface-sunk"
      )}
    >
      {/* Tek dekoratif öğe: köşede çok hafif bir marka ışıması. Eskiden iki
          adet 384px bulanık daire vardı ve altı sayfada tekrar ediyordu. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-64",
          deep
            ? "bg-[radial-gradient(60%_100%_at_70%_0%,rgba(14,144,213,0.35),transparent_70%)]"
            : "bg-[radial-gradient(55%_100%_at_75%_0%,rgba(26,95,180,0.07),transparent_70%)]"
        )}
      />

      <Container className="relative py-14 sm:py-20">
        {breadcrumb ? <div className="mb-5">{breadcrumb}</div> : null}
        {eyebrow ? <Eyebrow tone={deep ? "light" : "brand"}>{eyebrow}</Eyebrow> : null}
        <h1
          className={cn(
            "font-display max-w-4xl text-h1 font-semibold tracking-tight text-balance sm:text-[3rem]",
            eyebrow ? "mt-3" : undefined,
            deep ? "text-white" : "text-ink"
          )}
        >
          {baslik}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-5 max-w-2xl text-lead",
              deep ? "text-white/75" : "text-ink-soft"
            )}
          >
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </header>
  );
}
