import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_OG } from "@/lib/i18n/config";
import { languageAlternates, localizedPath } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);

  return {
    title: t.services.title,
    description: t.services.metaDescription,
    alternates: {
      canonical: localizedPath("services", lang),
      languages: languageAlternates("services"),
    },
    openGraph: {
      title: `${t.services.title} | Koçum.Net`,
      description: t.services.metaDescription,
      url: localizedPath("services", lang),
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const s = t.services;

  /** Çapa id'leri dilden bağımsız sabittir — footer linkleri bunlara bağlı. */
  const services = [
    {
      id: "tercih-danismanligi",
      title: s.tercihTitle,
      expert: s.tercihExpert,
      paragraphs: [s.tercihP1, s.tercihP2],
      image: { src: "/images/hizmet-tercih.webp", alt: s.tercihImageAlt },
    },
    {
      id: "sinav-hazirlik-materyalleri",
      title: s.materyalTitle,
      lead: s.materyalLead,
      paragraphs: [s.materyalP1, s.materyalP2],
      image: { src: "/images/hizmet-materyal.webp", alt: s.materyalImageAlt },
    },
    {
      id: "sinav-calisma-koclugu",
      title: s.koclukTitle,
      paragraphs: [s.koclukP1],
      bullets: [
        { title: s.koclukBullet1Title, text: s.koclukBullet1Text },
        { title: s.koclukBullet2Title, text: s.koclukBullet2Text },
        { title: s.koclukBullet3Title, text: s.koclukBullet3Text },
      ],
      image: { src: "/images/hizmet-calisma-koclugu.webp", alt: s.koclukImageAlt },
    },
    {
      id: "ogrenci-koclugu",
      title: s.ogrenciTitle,
      expert: s.ogrenciExpert,
      paragraphs: [s.ogrenciP1, s.ogrenciP2],
      image: { src: "/images/hizmet-ogrenci-koclugu.webp", alt: s.ogrenciImageAlt },
    },
    {
      id: "psikolojik-destek",
      title: s.psikolojikTitle,
      expert: s.psikolojikExpert,
      paragraphs: [s.psikolojikP1, s.psikolojikP2],
      image: { src: "/images/hizmet-psikolojik.webp", alt: s.psikolojikImageAlt },
    },
    {
      id: "beslenme-danismanligi",
      title: s.beslenmeTitle,
      expert: s.beslenmeExpert,
      paragraphs: [s.beslenmeP1, s.beslenmeP2],
      image: { src: "/images/hizmet-beslenme.webp", alt: s.beslenmeImageAlt },
    },
  ];

  return (
    <main className="bg-white text-[#444] antialiased">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5] py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Koçum.Net</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {s.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
            {s.heroSubtitle}
          </p>
        </div>
      </section>

      {/* Hizmet özet bağlantıları */}
      <section className="border-b border-gray-100 bg-[#fafbfe]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {services.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="font-medium text-[#1a5fb4] transition hover:underline">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="space-y-20 sm:space-y-24">
          {services.map((service, i) => (
            <article
              key={service.id}
              id={service.id}
              /* Çapa boşluğu globals.css'teki scroll-padding-top ile yönetilir. */
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
            >
              <Reveal className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <div className="flex items-start gap-4">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a5fb4]/10 text-sm font-bold text-[#1a5fb4]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-[#151a33] sm:text-3xl">
                      {service.title}
                    </h2>
                    {service.expert && (
                      <p className="mt-1 text-sm font-semibold text-[#1a5fb4]">{service.expert}</p>
                    )}
                  </div>
                </div>

                {service.lead && (
                  <p className="mt-6 inline-flex rounded-full bg-[#1a5fb4] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                    {service.lead}
                  </p>
                )}

                <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#444]">
                  {service.paragraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                {service.bullets && (
                  <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-3">
                    {service.bullets.map((b) => (
                      <StaggerItem
                        key={b.title}
                        className="rounded-xl border border-[#1a5fb4]/12 bg-[#fafbff] p-5"
                      >
                        <h3 className="text-base font-bold text-[#151a33]">{b.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#555]">{b.text}</p>
                      </StaggerItem>
                    ))}
                  </StaggerGroup>
                )}
              </Reveal>

              <Reveal delay={0.12} className={`relative ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                <div
                  className={`absolute -top-4 h-full w-full rounded-2xl border-2 border-[#1a5fb4]/20 ${
                    i % 2 === 1 ? "-end-4" : "-start-4"
                  }`}
                  aria-hidden
                />
                <div className="relative aspect-[3/2] overflow-hidden rounded-2xl shadow-[0_24px_60px_-28px_rgba(23,48,94,0.55)]">
                  <Image
                    src={service.image.src}
                    alt={service.image.alt}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 560px, 100vw"
                  />
                </div>
              </Reveal>
            </article>
          ))}
        </div>
      </div>

      <section className="border-t border-gray-100 bg-[#fafbfe] py-16 text-center">
        <Reveal className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-3xl font-bold text-[#151a33]">{s.ctaTitle}</h2>
          <p className="mt-4 text-[#666]">{s.ctaDesc}</p>
          <Link
            href={localizedPath("contact", lang)}
            className="mt-8 inline-flex rounded-xl bg-[#1a5fb4] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#154a94]"
          >
            {s.ctaButton}
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
