import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Compass,
  LineChart,
  Target,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
// Başlığın son kelimesi fosforlu kalemle çizilir — logodaki "net" gibi.
import { fosforla } from "@/components/Marker";
import { CtaCard } from "@/components/CtaCard";
import { Container, Eyebrow, ExternalButton, IconBox, KART_GOLGE, LINK_KART, Section, SectionHead, UZANAN_BAGLANTI } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { ResponsiveImage } from "@/components/tailadmin/media/ResponsiveImage";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/routes";
import { SERVICES, ilkCumle } from "@/lib/services";
import { PRODUCTS } from "@/lib/products";
// Check-up uygulamasının adresi: tanımlı değilse check-up bölümü HİÇ ÇIKMAZ
// (ana sayfada 404'e giden bir düğme, hiç düğme olmamasından kötü).
import { CHECKUP_URL } from "@/lib/site";

/**
 * Hero CSS animasyonuyla belirir (tokens.css `rise`), framer-motion ile DEĞİL.
 * framer-motion başlangıç durumunu (opacity:0) sunucu HTML'ine yazıyor ve
 * öğe ancak JavaScript yüklenip sayfa hidrasyonu bitince görünüyordu:
 * sayfanın en büyük öğesi (LCP: başlık, alt başlık, fotoğraf) yavaş telefonda
 * saniyelerce boş kalıyordu. CSS animasyonu ilk boyamayla başlar.
 * Fotoğraf bilerek canlandırılmıyor: yüklendiği an görünsün.
 */
const HERO_GIRIS = "animate-rise motion-reduce:animate-none";

const OK = <ArrowRight className="rtl:rotate-180" aria-hidden />;

/*
 * Görünüm TailAdmin kitinin dilinde: gri tuval (gray-50) üstünde beyaz,
 * kenarlıklı, hafif gölgeli kartlar; ikon kutuları, rozetler, kitin
 * düğmeleri. Pazarlama bölümleri kitin parçalarından kuruldu; pano düzeni yok.
 */
export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const h = t.home;
  const s = t.services;

  const problems = [
    { icon: BrainCircuit, title: h.problem1Title, problem: h.problem1Problem, solution: h.problem1Solution },
    { icon: Compass, title: h.problem2Title, problem: h.problem2Problem, solution: h.problem2Solution },
    { icon: CalendarCheck, title: h.problem3Title, problem: h.problem3Problem, solution: h.problem3Solution },
  ];

  const expertise = [t.about.expertise1, t.about.expertise2, t.about.expertise3, t.about.expertise4];

  /** Ana sayfada üç yayın: her kategoriden en güçlü olan. */
  const oneCikanUrunler = ["problemler-soru-paketi", "tyt-matematik-ilk-15", "paragraf-celdirici-kampi"]
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main>
      {/* ── Hero ────────────────────────────────────────────── */}
      {/*
        Açık zeminde, metin tipografiyle taşınıyor (eskiden fotoğrafın
        üstünde beyaz yazı + işletmeye form vardı). Zemin kitin gri tuvali,
        köşelerde kitin ızgarası; fotoğraf kitin görsel kutusu.
      */}
      <section className="relative z-1 overflow-hidden border-b border-gray-200 bg-gray-50">
        <GridShape />
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <Eyebrow className={HERO_GIRIS}>{h.heroEyebrow}</Eyebrow>
            <h1
              className={`font-display mt-5 text-display font-semibold tracking-tight text-balance text-gray-800 ${HERO_GIRIS}`}
              style={{ animationDelay: "50ms" }}
            >
              {fosforla(h.heroTitle)}
            </h1>
            <p
              className={`mt-5 max-w-xl text-base text-gray-600 sm:mt-6 sm:text-lg ${HERO_GIRIS}`}
              style={{ animationDelay: "100ms" }}
            >
              {h.heroSubtitle}
            </p>
            <div className={`mt-9 flex flex-wrap items-center gap-3 ${HERO_GIRIS}`} style={{ animationDelay: "150ms" }}>
              {CHECKUP_URL ? (
                <ExternalButton href={CHECKUP_URL} newTabLabel={t.nav.opensInNewTab} size="md" endIcon={OK}>
                  {h.checkupCta}
                </ExternalButton>
              ) : (
                <ButtonLink href={localizedPath("services", lang)} size="md" endIcon={OK}>
                  {h.heroCtaPrimary}
                </ButtonLink>
              )}
              <ButtonLink href={localizedPath("contact", lang)} variant="outline" size="md">
                {h.heroCtaSecondary}
              </ButtonLink>
            </div>
            <ul
              className={`mt-9 flex flex-wrap gap-x-6 gap-y-3 text-theme-sm text-gray-600 ${HERO_GIRIS}`}
              style={{ animationDelay: "200ms" }}
            >
              {[h.heroBadge1, h.heroBadge2, h.heroBadge3].map((badge) => (
                <li key={badge} className="inline-flex items-center gap-2">
                  <CircleCheck className="size-4.5 shrink-0 text-brand-500" aria-hidden />
                  {badge}
                </li>
              ))}
            </ul>
          </div>

          <ResponsiveImage
            src="/images/hero-student.webp"
            alt={h.heroImageAlt}
            width={1200}
            height={780}
            preload
            className="shadow-theme-xl"
            sizes="(min-width: 1024px) 560px, 100vw"
          />
        </Container>
      </section>

      {/* ── Check-up ────────────────────────────────────────── */}
      {/* Lacivert kart (brand-950 + ızgara): kitin giriş sayfasındaki marka paneli. */}
      {CHECKUP_URL ? (
        <Section>
          <Container>
            <Reveal>
              <div className="zemin-koyu relative z-1 overflow-hidden rounded-2xl bg-brand-950 px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
                <GridShape />
                <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
                  <div>
                    <SectionHead dark eyebrow={h.checkupEyebrow} title={h.checkupTitle} description={h.checkupDesc} />
                    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <ExternalButton href={CHECKUP_URL} newTabLabel={t.nav.opensInNewTab} variant="outline" size="md" endIcon={OK}>
                        {h.checkupCta}
                      </ExternalButton>
                      <p className="text-theme-sm font-medium tracking-wide text-gray-300">{h.checkupNote}</p>
                    </div>
                  </div>

                  <ul className="grid gap-3">
                    {[
                      { icon: Target, text: h.checkupPoint1 },
                      { icon: LineChart, text: h.checkupPoint2 },
                      { icon: ClipboardList, text: h.checkupPoint3 },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                        <IconBox dark>
                          <Icon />
                        </IconBox>
                        <span className="text-base font-medium text-white">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </Container>
        </Section>
      ) : null}

      {/* ── Sorun → Çözüm ───────────────────────────────────── */}
      <Section>
        <Container>
          <Reveal>
            <SectionHead eyebrow={h.problemsEyebrow} title={h.problemsTitle} description={h.problemsDesc} />
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-5 lg:grid-cols-3">
            {problems.map(({ icon: Icon, title, problem, solution }) => (
              <StaggerItem key={title}>
                {/* Tek kart: sorun sönük (gri rozet), çözüm vurgulu (marka rozeti). */}
                <Card className={cx(KART_GOLGE, "flex h-full flex-col p-6")}>
                  <IconBox>
                    <Icon />
                  </IconBox>
                  <h3 className="font-display mt-5 text-lg font-semibold text-balance text-gray-800">{title}</h3>
                  <div className="mt-4 flex-1">
                    <Badge size="sm" color="light">
                      {h.problemLabel}
                    </Badge>
                    <p className="mt-2 text-sm text-gray-500">{problem}</p>
                  </div>
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <Badge size="sm">{h.solutionLabel}</Badge>
                    <p className="mt-2 text-sm text-gray-700">{solution}</p>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* ── Hizmetler ───────────────────────────────────────── */}
      <Section tone="sunk">
        <Container>
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow={h.servicesEyebrow} title={h.servicesTitle} description={h.servicesDesc} />
              <ButtonLink href={localizedPath("services", lang)} variant="outline" endIcon={OK} className="max-sm:w-full">
                {h.servicesCta}
              </ButtonLink>
            </div>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ id, titleKey, leadKey, icon: Icon }) => (
              <StaggerItem key={id}>
                <Card className={cx(KART_GOLGE, LINK_KART, "flex h-full flex-col p-6")}>
                  <IconBox>
                    <Icon />
                  </IconBox>
                  <h3 className="font-display mt-5 text-base font-semibold text-balance text-gray-800 transition-colors group-hover:text-brand-500">
                    <Link href={`${localizedPath("services", lang)}#${id}`} className={UZANAN_BAGLANTI}>
                      {s[titleKey]}
                    </Link>
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-gray-500">{ilkCumle(s[leadKey])}</p>
                  <ArrowRight
                    className="mt-4 size-4 text-brand-500 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                    aria-hidden
                  />
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* ── Biz kimiz ───────────────────────────────────────── */}
      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <Reveal>
            <SectionHead eyebrow={t.about.whoTitle} title={h.aboutTeaserTitle} description={t.about.whoBody} />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {expertise.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-theme-xs"
                >
                  <CircleCheck className="size-5 shrink-0 text-brand-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <ButtonLink href={localizedPath("about", lang)} variant="outline" endIcon={OK} className="mt-8">
              {h.aboutTeaserCta}
            </ButtonLink>
          </Reveal>

          <Reveal delay={0.1} className="relative pb-6">
            <ResponsiveImage
              src="/images/biz-kimiz-kocluk.webp"
              alt={t.about.imageAlt}
              width={1600}
              height={1067}
              className="shadow-theme-lg"
              sizes="(min-width: 1024px) 480px, 100vw"
            />
            {/* Kitin bildirim kartı gibi: görselin köşesine taşan küçük kart. */}
            <div className="absolute inset-x-4 bottom-0 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 pe-5 shadow-theme-lg sm:inset-x-auto sm:start-6">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                <CalendarDays className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-theme-xs font-medium tracking-wide text-gray-500 uppercase">{h.aboutBadgeLabel}</p>
                <p className="text-sm font-semibold text-gray-800">{h.aboutBadgeText}</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── Yayınlar ────────────────────────────────────────── */}
      <Section tone="sunk">
        <Container>
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow={h.productsEyebrow} title={h.productsTitle} description={h.productsDesc} />
              <ButtonLink href={localizedPath("products", lang)} variant="outline" endIcon={OK} className="max-sm:w-full">
                {h.productsCta}
              </ButtonLink>
            </div>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-4 md:grid-cols-3">
            {oneCikanUrunler.map((product) => (
              <StaggerItem key={product.id}>
                <Card className={cx(KART_GOLGE, LINK_KART, "flex h-full flex-col p-6")}>
                  <div className="flex flex-wrap gap-1.5">
                    {product.exams.slice(0, 3).map((exam) => (
                      <Badge key={exam} size="sm">
                        {exam}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="font-display mt-4 text-base leading-snug font-semibold text-gray-800 transition-colors group-hover:text-brand-500">
                    <Link href={`${localizedPath("products", lang)}#${product.id}`} className={UZANAN_BAGLANTI}>
                      <bdi>{product.name}</bdi>
                    </Link>
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-gray-500">{product.tagline[lang]}</p>
                  {/* Soru sayısı kitin sayı kartı biçiminde. */}
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
                    <p className="flex items-baseline gap-1.5">
                      <span className="tabular font-display text-title-sm font-bold text-gray-800">{product.questionCount}</span>
                      <span className="text-sm text-gray-500">{t.products.questionsLabel}</span>
                    </p>
                    <ArrowRight
                      className="mb-2 size-4 text-brand-500 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* ── Kapanış ─────────────────────────────────────────── */}
      <CtaCard
        title={h.ctaTitle}
        description={h.ctaDesc}
        media={<Image src="/images/cta-ekip.webp" alt={h.ctaImageAlt} fill className="object-cover" sizes="(min-width: 1024px) 520px, 100vw" />}
        actions={
          <>
            <ButtonLink href={localizedPath("contact", lang)} size="md" endIcon={OK}>
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
