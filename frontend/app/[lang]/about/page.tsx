import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Apple, ArrowRight, Compass, GraduationCap, HeartHandshake, Rocket, Telescope } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { Card, Container, Eyebrow, LinkButton, Section, SectionHead } from "@/components/ui";
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
 * Kurumsal sayfa ortak tasarım diline taşındı. Bu sayfa eski kalıpta
 * kalmıştı: ham hex (#1a5fb4, #17305e, rgba gölge), keyfi ölçüler
 * (text-[11px], tracking-[0.28em], text-[15px]), elle yazılmış düğmeler,
 * satır içi SVG ikonlar ve tıklanmadığı halde üstüne gelince havalanan
 * ekip kartları (yanlış "tıkla" ipucu). Vizyon etiketi camgöbeği renkte
 * açık zeminde 3,3:1 kontrastla okunmuyordu. İçerik aynı.
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

  const team: { name: string; role: string; photo?: string }[] = [
    { name: a.team1Name, role: a.team1Role, photo: "/images/team/serhat.webp" },
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
            <div className="mt-6 space-y-5 text-body text-ink-soft sm:text-lead">
              <p>{a.whoBody}</p>
              <p>{a.whoClosing}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <div aria-hidden className="absolute -top-4 -start-4 size-full rounded-3xl border-2 border-brand/20" />
            <div className="relative overflow-hidden rounded-3xl shadow-pop">
              <Image
                src="/images/biz-kimiz-kocluk.webp"
                alt={a.imageAlt}
                width={1600}
                height={1067}
                className="h-full w-full object-cover"
                sizes="(min-width: 1024px) 520px, 100vw"
              />
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Uzmanlık alanları */}
      <Section tone="sunk" className="border-y border-line">
        <Container>
          <Reveal>
            <SectionHead center title={a.expertiseTitle} />
          </Reveal>
          <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {expertise.map(({ icon: Icon, text }) => (
              <StaggerItem key={text} className="h-full">
                <Card className="flex h-full flex-col items-center gap-4 px-5 py-7 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-wash text-brand">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <p className="font-display text-h4 font-semibold text-ink text-balance">{text}</p>
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
                <Card className="h-full p-8 sm:p-10">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-wash text-brand">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
                  <h2 className="font-display mt-2 text-h2 font-semibold tracking-tight text-ink">{title}</h2>
                  <p className="mt-4 text-body text-ink-soft">{body}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* Uzman kadro */}
      <Section tone="sunk" className="border-t border-line">
        <Container>
          <Reveal>
            <SectionHead center title={a.teamTitle} description={a.teamDesc} />
          </Reveal>
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <StaggerItem key={member.name} className="h-full">
                <Card className="flex h-full flex-col items-center p-6 text-center">
                  {member.photo ? (
                    <div className="relative size-24 overflow-hidden rounded-full shadow-raised ring-2 ring-brand/15">
                      {/* Ad hemen altında: alt metin aynı adı ikinci kez okutmasın. */}
                      <Image src={member.photo} alt="" fill className="object-cover object-top" sizes="96px" />
                    </div>
                  ) : (
                    <div
                      aria-hidden
                      className="font-display flex size-24 items-center justify-center rounded-full bg-brand-gradient text-h2 font-semibold text-white shadow-raised"
                    >
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <h3 className="font-display mt-4 text-h4 font-semibold text-ink">{member.name}</h3>
                  <p className="mt-1 text-caption text-brand">{member.role}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* Kapanış */}
      <Section>
        <Container>
          <Reveal>
            <SectionHead center title={t.home.ctaTitle} description={t.home.ctaDesc} />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton href={localizedPath("contact", lang)} size="lg">
                {t.nav.contact} <ArrowRight className="rtl:rotate-180" />
              </LinkButton>
              <LinkButton href={localizedPath("services", lang)} variant="secondary" size="lg">
                {t.nav.services}
              </LinkButton>
            </div>
          </Reveal>
        </Container>
      </Section>
    </main>
  );
}
