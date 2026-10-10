import type { ReactNode } from "react";
import { cx } from "@/components/tailadmin/cx";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { Reveal } from "@/components/Reveal";
import { Container, Section } from "@/components/ui";

/**
 * Sayfa sonu çağrısı: açık mavi (brand-50) kart, köşede kitin ızgarası,
 * başlık + açıklama + düğmeler. Bütün iç sayfalar aynı kapanışı kullanır.
 *
 * `media` verilirse (ana sayfa: fotoğraf) geniş ekranda kartın yarısını
 * kaplar; telefonda gizli (gizli, geç yüklenen görsel hiç inmez). Görseli
 * çağıran çizer: bu dosya next/image'ı içe aktarmaz, yoksa görseli olmayan
 * sayfalar da görselin istemci kodunu indirirdi.
 */
export function CtaCard({
  title,
  description,
  actions,
  media,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions: ReactNode;
  /** `fill` ile çizilmiş görsel (next/image). */
  media?: ReactNode;
}) {
  return (
    <Section>
      <Container>
        <Reveal>
          <div
            className={cx(
              "relative z-1 grid overflow-hidden rounded-2xl border border-brand-100 bg-brand-50",
              media && "lg:grid-cols-[1.15fr_1fr]"
            )}
          >
            <GridShape />
            <div className={cx("px-6 py-12 sm:px-10 lg:py-16", media ? "text-center lg:px-14 lg:text-start" : "text-center")}>
              <h2 className="font-display mx-auto max-w-2xl text-title-sm font-semibold tracking-tight text-balance text-gray-800 sm:text-title-md">
                {title}
              </h2>
              {description ? <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">{description}</p> : null}
              <div className={cx("mt-8 flex flex-wrap justify-center gap-3", media && "lg:justify-start")}>{actions}</div>
            </div>
            {media ? <div className="relative hidden min-h-80 lg:block">{media}</div> : null}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
