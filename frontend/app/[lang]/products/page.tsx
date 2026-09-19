import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_OG } from "@/lib/i18n/config";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { PRODUCTS, PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/products";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";

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

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#1a5fb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export default async function ProductsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const p = t.products;

  const features = [p.feature1, p.feature2, p.feature3];

  return (
    <main className="bg-white text-[#444] antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5] py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">{p.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {p.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{p.heroSubtitle}</p>
        </div>
      </section>

      {/* Ortak özellikler şeridi */}
      <section className="border-b border-gray-100 bg-[#fafbfe]">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-8 gap-y-3 px-6 py-5 text-sm text-[#33415c]">
          {features.map((f) => (
            <span key={f} className="inline-flex items-center gap-2">
              <CheckIcon />
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* Kategoriler */}
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="space-y-16">
          {PRODUCT_CATEGORIES.map((cat) => {
            const items = PRODUCTS.filter((prod) => prod.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <Reveal>
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-1.5 rounded-full bg-[#1a5fb4]" aria-hidden />
                    <h2 className="font-display text-2xl font-bold tracking-tight text-[#151a33] sm:text-3xl">
                      {p[CAT_LABEL_KEY[cat]]}
                    </h2>
                    <span className="text-sm font-medium text-[#8a93a6]">({items.length})</span>
                  </div>
                </Reveal>

                <StaggerGroup className="mt-8 grid gap-6 md:grid-cols-2">
                  {items.map((prod) => (
                    <StaggerItem
                      key={prod.id}
                      className="group flex flex-col rounded-2xl border border-[#1a5fb4]/12 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#1a5fb4]/30 hover:shadow-[0_20px_50px_-24px_rgba(26,95,180,0.45)] sm:p-7"
                    >
                      {/* Sınav etiketleri */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {prod.exams.map((exam) => (
                          <span
                            key={exam}
                            className="rounded-full bg-[#1a5fb4]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1a5fb4]"
                          >
                            {exam}
                          </span>
                        ))}
                      </div>

                      <h3 className="font-display text-lg font-bold leading-snug text-[#151a33]">
                        {prod.name}
                      </h3>
                      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#555]">
                        {prod.tagline[lang]}
                      </p>

                      {/* Alt bilgi: soru sayısı + format */}
                      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-100 pt-4">
                        <span className="text-[#151a33]">
                          <span className="text-xl font-bold text-[#1a5fb4]">{prod.questionCount}</span>{" "}
                          <span className="text-sm text-[#666]">{p.questionsLabel}</span>
                        </span>
                        <span className="text-sm text-[#8a93a6]">{prod.format[lang]}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </section>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-[#fafbfe] py-16 text-center">
        <Reveal className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-3xl font-bold text-[#151a33]">{p.ctaTitle}</h2>
          <p className="mt-4 text-[#666]">{p.ctaDesc}</p>
          <Link
            href={localizedPath("contact", lang)}
            className="mt-8 inline-flex rounded-xl bg-[#1a5fb4] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#154a94]"
          >
            {p.ctaButton}
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
