import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { Card, Container, Eyebrow, LinkButton, Section, SectionHead, cn } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { sayfaMetadata } from "@/lib/seo";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { SERVICES } from "@/lib/services";

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
    title: t.services.title,
    description: t.services.metaDescription,
    path: localizedPath("services", lang),
    languages: languageAlternates("services"),
  });
}

export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const s = t.services;

  /*
   * Hizmet sırası ve çapa kimlikleri `lib/services.ts`'te.
   *
   * Kimlikler dile bağımsız ve KALICI: footer'daki hızlı erişim linkleri,
   * ana sayfadaki hizmet kartları ve dışarıya verilmiş bağlantılar bunlara
   * bakıyor. Değiştirmek o bağlantıları kırar.
   */
  const icerik: Record<
    string,
    {
      expert?: string;
      lead?: string;
      paragraphs: string[];
      bullets?: { title: string; text: string }[];
      image?: { src: string; alt: string };
      people?: { src: string; name: string }[];
    }
  > = {
    "tercih-danismanligi": {
      expert: s.tercihExpert,
      paragraphs: [s.tercihP1, s.tercihP2],
      people: [{ src: "/images/team/serhat.webp", name: "Serhat Butur" }],
    },
    "sinav-hazirlik-materyalleri": {
      lead: s.materyalLead,
      paragraphs: [s.materyalP1, s.materyalP2],
      image: { src: "/images/hizmet-materyal.webp", alt: s.materyalImageAlt },
    },
    "sinav-calisma-koclugu": {
      paragraphs: [s.koclukP1],
      bullets: [
        { title: s.koclukBullet1Title, text: s.koclukBullet1Text },
        { title: s.koclukBullet2Title, text: s.koclukBullet2Text },
        { title: s.koclukBullet3Title, text: s.koclukBullet3Text },
      ],
      image: { src: "/images/hizmet-calisma-koclugu.webp", alt: s.koclukImageAlt },
    },
    "ogrenci-koclugu": {
      expert: s.ogrenciExpert,
      paragraphs: [s.ogrenciP1, s.ogrenciP2],
      people: [
        { src: "/images/team/ozlem.webp", name: "Özlem Tamimi" },
        { src: "/images/team/serhat.webp", name: "Serhat Butur" },
      ],
    },
    "psikolojik-destek": {
      expert: s.psikolojikExpert,
      paragraphs: [s.psikolojikP1, s.psikolojikP2],
      people: [{ src: "/images/team/dilek.webp", name: "Dilek Kılıç" }],
    },
    "beslenme-danismanligi": {
      expert: s.beslenmeExpert,
      paragraphs: [s.beslenmeP1, s.beslenmeP2],
      image: { src: "/images/hizmet-beslenme.webp", alt: s.beslenmeImageAlt },
    },
  };

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="services" />
      {/* Üst etiket "Ne yapıyoruz": eskiden menü adıydı ve başlığın aynısıydı
          (Hizmetlerimiz / Hizmetlerimiz), üç dilde de. */}
      <PageHero eyebrow={t.home.servicesEyebrow} title={s.title} description={s.heroSubtitle}>
        {/* Çapa rayı: altı hizmet telefonda tek satıra sığmaz, kaydırılır. */}
        <nav aria-label={s.title} className="scroll-x -mx-5 flex gap-2 px-5 sm:mx-0 sm:px-0">
          {SERVICES.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex min-h-10 shrink-0 items-center rounded-full bg-surface px-4 text-caption font-medium text-ink-soft ring-1 ring-inset ring-line transition hover:text-brand hover:ring-brand/30"
            >
              {s[item.titleKey]}
            </a>
          ))}
        </nav>
      </PageHero>

      <Section>
        <Container className="space-y-20 sm:space-y-24">
          {SERVICES.map((ref, i) => {
            const d = icerik[ref.id];
            if (!d) return null;
            const saga = i % 2 === 1;

            return (
              <article
                key={ref.id}
                id={ref.id}
                /* Çapa boşluğu globals.css'teki scroll-padding-top ile. */
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
              >
                <Reveal className={saga ? "lg:order-2" : undefined}>
                  <div className="flex items-start gap-4">
                    <span className="font-display mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-caption font-bold text-brand">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-h2 font-semibold tracking-tight text-ink text-balance">
                        {s[ref.titleKey]}
                      </h2>
                      {d.expert ? (
                        <p className="mt-1 text-caption font-semibold text-brand">{d.expert}</p>
                      ) : null}
                    </div>
                  </div>

                  {d.lead ? <Eyebrow className="mt-6">{d.lead}</Eyebrow> : null}

                  <div className="mt-6 space-y-4 text-body text-ink-soft">
                    {d.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>

                  {d.bullets ? (
                    <StaggerGroup className="mt-8 grid gap-3 sm:grid-cols-3">
                      {d.bullets.map((b) => (
                        <StaggerItem key={b.title}>
                          <Card className="h-full p-5">
                            <h3 className="text-h4 font-semibold text-ink">{b.title}</h3>
                            <p className="mt-2 text-caption text-ink-soft">{b.text}</p>
                          </Card>
                        </StaggerItem>
                      ))}
                    </StaggerGroup>
                  ) : null}
                </Reveal>

                <Reveal delay={0.1} className={cn("relative", saga && "lg:order-1")}>
                  {d.people ? (
                    <div
                      className={cn(
                        "grid gap-4",
                        d.people.length > 1 ? "grid-cols-2" : "grid-cols-1"
                      )}
                    >
                      {d.people.map((person) => (
                        <figure
                          key={`${person.src}-${person.name}`}
                          className="relative overflow-hidden rounded-3xl shadow-raised"
                        >
                          <div className="relative aspect-[4/5] bg-surface-sunk">
                            <Image
                              src={person.src}
                              alt={person.name}
                              fill
                              className="object-cover object-top"
                              sizes={
                                d.people!.length > 1
                                  ? "(min-width: 1024px) 270px, 45vw"
                                  : "(min-width: 1024px) 560px, 100vw"
                              }
                            />
                          </div>
                          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-deep/80 to-transparent px-4 pb-3 pt-10 text-caption font-semibold text-white">
                            {person.name}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : d.image ? (
                    <div className="relative aspect-[3/2] overflow-hidden rounded-3xl shadow-raised">
                      <Image
                        src={d.image.src}
                        alt={d.image.alt}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 560px, 100vw"
                      />
                    </div>
                  ) : null}
                </Reveal>
              </article>
            );
          })}
        </Container>
      </Section>

      <Section tone="sunk">
        <Container>
          <Reveal>
            <SectionHead center title={s.ctaTitle} description={s.ctaDesc} />
            <div className="mt-8 flex justify-center">
              <LinkButton href={localizedPath("contact", lang)} size="lg">
                {s.ctaButton} <ArrowRight className="rtl:rotate-180" />
              </LinkButton>
            </div>
          </Reveal>
        </Container>
      </Section>
    </main>
  );
}
