import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenText, Calculator, CircleCheck, Sigma } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { sayfaMetadata } from "@/lib/seo";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { PRODUCTS, PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/products";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { CtaCard } from "@/components/CtaCard";
import { Container, KART_GOLGE, Section } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);

  return sayfaMetadata({
    lang,
    title: t.products.title,
    description: t.products.metaDescription,
    path: localizedPath("products", lang),
    languages: languageAlternates("products"),
  });
}

const CAT_LABEL_KEY: Record<ProductCategory, "catProblem" | "catMatematik" | "catTurkce"> = {
  problem: "catProblem",
  matematik: "catMatematik",
  turkce: "catTurkce",
};

const CAT_ICON: Record<ProductCategory, React.ReactNode> = {
  problem: <Calculator aria-hidden />,
  matematik: <Sigma aria-hidden />,
  turkce: <BookOpenText aria-hidden />,
};

/** Kategorideki yayınların toplam soru sayısı ("1000+" gibi değer varsa sonuna +). */
function toplamSoru(urunler: typeof PRODUCTS): string {
  const toplam = urunler.reduce((n, u) => n + (Number.parseInt(u.questionCount, 10) || 0), 0);
  return `${toplam}${urunler.some((u) => u.questionCount.includes("+")) ? "+" : ""}`;
}

export default async function ProductsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const p = t.products;

  const features = [p.feature1, p.feature2, p.feature3];
  const kategoriler = PRODUCT_CATEGORIES.map((cat) => ({ cat, items: PRODUCTS.filter((prod) => prod.category === cat) })).filter(
    (k) => k.items.length > 0
  );

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="products" />
      <PageHero eyebrow={p.eyebrow} title={p.title} description={p.heroSubtitle}>
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {features.map((f) => (
            <li key={f} className="inline-flex items-center gap-2 text-theme-sm text-gray-600">
              <CircleCheck className="size-4.5 shrink-0 text-brand-500" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </PageHero>

      <Section>
        <Container className="space-y-16">
          {/* Kategoriler: kitin sayı kartları — toplam soru, tıklayınca kategoriye iner. */}
          <StaggerGroup className="grid gap-4 sm:grid-cols-3">
            {kategoriler.map(({ cat, items }) => (
              <StaggerItem key={cat} className="h-full">
                <MetricCard
                  label={p[CAT_LABEL_KEY[cat]]}
                  value={
                    <>
                      {toplamSoru(items)}
                      <span className="ms-1.5 font-sans text-base font-medium text-gray-500">{p.questionsLabel}</span>
                    </>
                  }
                  icon={CAT_ICON[cat]}
                  tone="brand"
                  href={`#${cat}`}
                  className={cx(KART_GOLGE, "h-full")}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>

          {kategoriler.map(({ cat, items }) => (
            <section key={cat} id={cat} aria-labelledby={`${cat}-baslik`}>
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id={`${cat}-baslik`} className="font-display text-title-sm font-semibold tracking-tight text-gray-800">
                    {p[CAT_LABEL_KEY[cat]]}
                  </h2>
                  <Badge color="light">{items.length}</Badge>
                </div>
              </Reveal>

              <StaggerGroup className="mt-8 grid gap-6 md:grid-cols-2">
                {items.map((prod) => (
                  <StaggerItem key={prod.id}>
                    {/*
                      Ana sayfadaki yayın kartları buraya çapayla geliyor; üst
                      boşluğu globals.css'teki scroll-padding-top veriyor.
                      Kart tıklanmıyor: havalanma efekti yok.
                    */}
                    <Card id={prod.id} className={cx(KART_GOLGE, "flex h-full flex-col p-6")}>
                      <div className="flex flex-wrap gap-1.5">
                        {prod.exams.map((exam) => (
                          <Badge key={exam} size="sm">
                            {exam}
                          </Badge>
                        ))}
                      </div>

                      <h3 className="font-display mt-4 text-lg leading-snug font-semibold text-balance text-gray-800">
                        {/* Ürün adı Türkçe (marka); bdi: Arapça sayfada tırnaklar yerinde kalsın. */}
                        <bdi>{prod.name}</bdi>
                      </h3>
                      <p className="mt-2 flex-1 text-sm text-gray-600">{prod.tagline[lang]}</p>

                      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-gray-100 pt-4">
                        <p className="flex items-baseline gap-1.5">
                          <span className="tabular font-display text-title-sm font-bold text-gray-800">{prod.questionCount}</span>
                          <span className="text-sm text-gray-500">{p.questionsLabel}</span>
                        </p>
                        <span className="pb-1.5 text-theme-sm text-gray-500">{prod.format[lang]}</span>
                      </div>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </section>
          ))}
        </Container>
      </Section>

      <CtaCard
        title={p.ctaTitle}
        description={p.ctaDesc}
        actions={
          <ButtonLink href={localizedPath("contact", lang)} size="md" endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
            {p.ctaButton}
          </ButtonLink>
        }
      />
    </main>
  );
}
