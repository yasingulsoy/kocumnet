import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Apple, ArrowRight, Compass, GraduationCap, HeartHandshake, Rocket, Telescope, UserRound } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { CtaCard } from "@/components/CtaCard";
import { Container, Eyebrow, IconBox, KART_GOLGE, Section, SectionHead } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { ResponsiveImage } from "@/components/tailadmin/media/ResponsiveImage";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { sayfaMetadata } from "@/lib/seo";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { SITE_BRAND } from "@/lib/site-brand";

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
    title: t.about.title,
    description: t.about.metaDescription,
    path: localizedPath("about", lang),
    languages: languageAlternates("about"),
  });
}

/*
 * Kurumsal sayfa — TailAdmin kitinin dilinde: ikon kutulu kartlar, ekip
 * kartlarında kitin avatarı (fotoğraf Next ile küçültülür; fotoğrafı
 * olmayan uzmanda kişi simgesi), görsel kitin görsel kutusu. Kartlar
 * tıklanmıyor; üstüne gelince havalanmıyorlar (yanlış "tıkla" ipucu).
 */
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const a = t.about;

  const expertise = [
    { icon: GraduationCap, text: a.expertise1 },
    { icon: Compass, text: a.expertise2 },
    { icon: HeartHandshake, text: a.expertise3 },
    { icon: Apple, text: a.expertise4 },
  ];

  const missionVision = [
    { icon: Rocket, eyebrow: a.missionSubtitle, title: a.missionTitle, body: a.missionBody },
    { icon: Telescope, eyebrow: a.visionSubtitle, title: a.visionTitle, body: a.visionBody },
  ];

  /*
   * Avatar fotoğrafları: portrelerde yüz üstte (object-top). Serhat Bey'in
   * fotoğrafı yatay ve boydan; avatar için aynı fotoğraftan kare portre
   * kesildi (serhat-portre.webp), hizmetler sayfası boydan hâlini kullanır.
   */
  const team: { name: string; role: string; photo?: string }[] = [
    { name: a.team1Name, role: a.team1Role, photo: "/images/team/serhat-portre.webp" },
    { name: a.team2Name, role: a.team2Role, photo: "/images/team/ozlem.webp" },
    { name: a.team3Name, role: a.team3Role, photo: "/images/team/dilek.webp" },
    { name: a.team4Name, role: a.team4Role },
  ];

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="about" />
      {/* Üst etiket marka adı: "Biz Kimiz?" aşağıdaki bölümün etiketi, Arapçada
          başlıkla aynı kelimeydi ("من نحن؟" / "من نحن"). */}
      <PageHero eyebrow={SITE_BRAND.name} title={a.title} description={a.heroSubtitle} />

      {/* Biz kimiz */}
      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <Reveal>
            <SectionHead eyebrow={a.whoTitle} title={a.whoHeading} />
            <div className="mt-6 space-y-5 text-base text-gray-600 sm:text-lg">
              <p>{a.whoBody}</p>
              <p>{a.whoClosing}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <ResponsiveImage
              src="/images/biz-kimiz-kocluk.webp"
              alt={a.imageAlt}
              width={1600}
              height={1067}
              className="shadow-theme-lg"
              sizes="(min-width: 1024px) 520px, 100vw"
            />
          </Reveal>
        </Container>
      </Section>

      {/* Uzmanlık alanları */}
      <Section tone="sunk">
        <Container>
          <Reveal>
            <SectionHead center title={a.expertiseTitle} />
          </Reveal>
          <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {expertise.map(({ icon: Icon, text }) => (
              <StaggerItem key={text} className="h-full">
                <Card className={cx(KART_GOLGE, "flex h-full flex-col items-center gap-4 px-5 py-7 text-center")}>
                  <IconBox>
                    <Icon />
                  </IconBox>
                  <p className="font-display text-base font-semibold text-balance text-gray-800">{text}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* Misyon & Vizyon */}
      <Section>
        <Container>
          <StaggerGroup className="grid gap-6 md:grid-cols-2">
            {missionVision.map(({ icon: Icon, eyebrow, title, body }) => (
              <StaggerItem key={title} className="h-full">
                <Card className={cx(KART_GOLGE, "h-full p-6 sm:p-8")}>
                  <IconBox>
                    <Icon />
                  </IconBox>
                  <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
                  <h2 className="font-display mt-3 text-title-sm font-semibold tracking-tight text-gray-800">{title}</h2>
                  <p className="mt-4 text-base text-gray-600">{body}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* Uzman kadro */}
      <Section tone="sunk">
        <Container>
          <Reveal>
            <SectionHead center title={a.teamTitle} description={a.teamDesc} />
          </Reveal>
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <StaggerItem key={member.name} className="h-full">
                <Card className={cx(KART_GOLGE, "flex h-full flex-col items-center p-6 text-center")}>
                  {member.photo ? (
                    /* Ad hemen altında: avatar ekran okuyucudan gizli, aynı ad iki kez okunmasın. */
                    <Avatar
                      src={member.photo}
                      name={member.name}
                      size="huge"
                      decorative
                      unoptimized={false}
                      className="ring-4 ring-brand-50 [&_img]:object-top"
                    />
                  ) : (
                    <span aria-hidden className="flex size-20 items-center justify-center rounded-full bg-gray-100 text-gray-500 ring-4 ring-gray-50">
                      <UserRound className="size-9" />
                    </span>
                  )}
                  <h3 className="font-display mt-5 text-base font-semibold text-gray-800">{member.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{member.role}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      <CtaCard
        title={t.home.ctaTitle}
        description={t.home.ctaDesc}
        actions={
          <>
            <ButtonLink href={localizedPath("contact", lang)} size="md" endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
              {t.nav.contact}
            </ButtonLink>
            <ButtonLink href={localizedPath("services", lang)} variant="outline" size="md">
              {t.nav.services}
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
