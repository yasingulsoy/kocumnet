import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { CtaCard } from "@/components/CtaCard";
import { Container, Eyebrow, IconBox, KART_GOLGE, Section } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { ResponsiveImage } from "@/components/tailadmin/media/ResponsiveImage";
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
   * Hizmet sırası, ikonu ve çapa kimlikleri `lib/services.ts`'te.
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
      image?: { src: string; alt: string; width: number; height: number };
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
      image: { src: "/images/hizmet-materyal.webp", alt: s.materyalImageAlt, width: 1400, height: 933 },
    },
    "sinav-calisma-koclugu": {
      paragraphs: [s.koclukP1],
      bullets: [
        { title: s.koclukBullet1Title, text: s.koclukBullet1Text },
        { title: s.koclukBullet2Title, text: s.koclukBullet2Text },
        { title: s.koclukBullet3Title, text: s.koclukBullet3Text },
      ],
      image: { src: "/images/hizmet-calisma-koclugu.webp", alt: s.koclukImageAlt, width: 1400, height: 936 },
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
      image: { src: "/images/hizmet-beslenme.webp", alt: s.beslenmeImageAlt, width: 1400, height: 933 },
    },
  };

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="services" />
      {/* Üst etiket "Ne yapıyoruz": eskiden menü adıydı ve başlığın aynısıydı
          (Hizmetlerimiz / Hizmetlerimiz), üç dilde de. */}
      <PageHero eyebrow={t.home.servicesEyebrow} title={s.title} description={s.heroSubtitle}>
        {/* Altı hizmete atlama: kitin kart diliyle küçük bağlantılar (dar ekranda alt alta). */}
        <nav aria-label={s.title}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ id, titleKey, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex h-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:border-gray-300 hover:text-brand-500"
                >
                  <Icon className="size-5 shrink-0 text-brand-500" aria-hidden />
                  {s[titleKey]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>

      <Section>
        <Container className="space-y-20 sm:space-y-24">
          {SERVICES.map((ref, i) => {
            const d = icerik[ref.id];
            if (!d) return null;
            const saga = i % 2 === 1;
            const Icon = ref.icon;

            return (
              <article
                key={ref.id}
                id={ref.id}
                /* Çapa boşluğu globals.css'teki scroll-padding-top ile. */
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
              >
                <Reveal className={saga ? "lg:order-2" : undefined}>
                  <div className="flex items-start gap-4">
                    <IconBox>
                      <Icon />
                    </IconBox>
                    <div className="min-w-0">
                      <h2 className="font-display text-title-sm font-semibold tracking-tight text-balance text-gray-800">
                        {s[ref.titleKey]}
                      </h2>
                      {d.expert ? <p className="mt-1 text-sm font-medium text-brand-500">{d.expert}</p> : null}
                    </div>
                  </div>

                  {d.lead ? <Eyebrow className="mt-6">{d.lead}</Eyebrow> : null}

                  <div className="mt-6 space-y-4 text-base text-gray-600">
                    {d.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>

                  {d.bullets ? (
                    <StaggerGroup className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                      {d.bullets.map((b) => (
                        <StaggerItem key={b.title}>
                          <Card className={cx(KART_GOLGE, "h-full p-5")}>
                            <h3 className="text-base font-semibold text-gray-800">{b.title}</h3>
                            <p className="mt-2 text-sm text-gray-500">{b.text}</p>
                          </Card>
                        </StaggerItem>
                      ))}
                    </StaggerGroup>
                  ) : null}
                </Reveal>

                <Reveal delay={0.1} className={saga ? "lg:order-1" : undefined}>
                  {d.people ? (
                    <div className={cx("grid gap-4", d.people.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                      {d.people.map((person) => (
                        /* Kitin görsel kutusu + alt yazı: fotoğrafın altında ad. */
                        <figure
                          key={`${person.src}-${person.name}`}
                          className="rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-xs"
                        >
                          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                            <Image
                              src={person.src}
                              alt={person.name}
                              fill
                              className="object-cover object-top"
                              sizes={d.people!.length > 1 ? "(min-width: 1024px) 270px, 45vw" : "(min-width: 1024px) 560px, 100vw"}
                            />
                          </div>
                          <figcaption className="px-2 pt-3 pb-1.5 text-sm font-semibold text-gray-800">{person.name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : d.image ? (
                    <ResponsiveImage
                      src={d.image.src}
                      alt={d.image.alt}
                      width={d.image.width}
                      height={d.image.height}
                      className="shadow-theme-lg"
                      sizes="(min-width: 1024px) 560px, 100vw"
                    />
                  ) : null}
                </Reveal>
              </article>
            );
          })}
        </Container>
      </Section>

      <CtaCard
        title={s.ctaTitle}
        description={s.ctaDesc}
        actions={
          <ButtonLink href={localizedPath("contact", lang)} size="md" endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
            {s.ctaButton}
          </ButtonLink>
        }
      />
    </main>
  );
}
