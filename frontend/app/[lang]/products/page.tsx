import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_OG } from "@/lib/i18n/config";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { PRODUCTS, PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/products";
import { Check } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { Badge, Card, Container, LinkButton, Section, SectionHead } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);

  return {
    title: t.products.title,
    description: t.products.metaDescription,
    alternates: {
      canonical: localizedPath("products", lang),
      languages: languageAlternates("products"),
    },
    openGraph: {
      title: `${t.products.title} | Koçum.Net`,
      description: t.products.metaDescription,
      url: localizedPath("products", lang),
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

const CAT_LABEL_KEY: Record<ProductCategory, "catProblem" | "catMatematik" | "catTurkce"> = {
  problem: "catProblem",
  matematik: "catMatematik",
  turkce: "catTurkce",
};

export default async function ProductsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const p = t.products;

  const features = [p.feature1, p.feature2, p.feature3];

  return (
    <main>
      <PageHero eyebrow={p.eyebrow} title={p.title} description={p.heroSubtitle}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {features.map((f) => (
            <li key={f} className="inline-flex items-center gap-2 text-caption text-ink-soft">
              <Check className="size-4 shrink-0 text-brand" />
              {f}
            </li>
          ))}
        </ul>
      </PageHero>

      {/* Kategoriler */}
      <Section>
        <Container className="space-y-16">
          {PRODUCT_CATEGORIES.map((cat) => {
            const items = PRODUCTS.filter((prod) => prod.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <Reveal>
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-1.5 rounded-full bg-brand" aria-hidden />
                    <h2 className="font-display text-h2 font-semibold tracking-tight text-ink">
                      {p[CAT_LABEL_KEY[cat]]}
                    </h2>
                    <span className="text-caption font-medium text-ink-faint">({items.length})</span>
                  </div>
                </Reveal>

                <StaggerGroup className="mt-8 grid gap-6 md:grid-cols-2">
                  {items.map((prod) => (
                    <StaggerItem key={prod.id}>
                      {/* Ana sayfadaki yayın kartları buraya çapayla geliyor. */}
                      <Card id={prod.id} interactive className="flex h-full scroll-mt-24 flex-col p-6">
                        <div className="flex flex-wrap gap-1.5">
                          {prod.exams.map((exam) => (
                            <Badge key={exam} tone="brand">
                              {exam}
                            </Badge>
                          ))}
                        </div>

                        <h3 className="font-display mt-4 text-h3 font-semibold leading-snug text-ink text-balance">
                          {prod.name}
                        </h3>
                        <p className="mt-3 flex-1 text-body text-ink-soft">{prod.tagline[lang]}</p>

                        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
                          <span className="flex items-baseline gap-1.5">
                            <span className="font-display text-h3 font-semibold text-brand">
                              {prod.questionCount}
                            </span>
                            <span className="text-caption text-ink-faint">{p.questionsLabel}</span>
                          </span>
                          <span className="text-caption text-ink-faint">{prod.format[lang]}</span>
                        </div>
                      </Card>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </section>
            );
          })}
        </Container>
      </Section>

      <Section tone="sunk">
        <Container>
          <Reveal>
            <SectionHead center title={p.ctaTitle} description={p.ctaDesc} />
            <div className="mt-8 flex justify-center">
              <LinkButton href={localizedPath("contact", lang)} size="lg">
                {p.ctaButton}
              </LinkButton>
            </div>
          </Reveal>
        </Container>
      </Section>
    </main>
  );
}
