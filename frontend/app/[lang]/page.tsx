import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  ClipboardList,
  Compass,
  LineChart,
  Target,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import {
  Badge,
  Card,
  Container,
  ExternalButton,
  Eyebrow,
  LinkButton,
  Section,
  SectionHead,
} from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/routes";
import { SERVICES, ilkCumle } from "@/lib/services";
import { PRODUCTS } from "@/lib/products";

/**
 * Check-up uygulamasının adresi.
 *
 * Tanımlı değilse check-up bölümü HİÇ ÇIKMAZ. Uygulama henüz yayına
 * alınmadığı için varsayılan vermiyoruz: ana sayfada 404'e giden bir düğme,
 * hiç düğme olmamasından kötü.
 */
const CHECKUP_URL = process.env.NEXT_PUBLIC_CHECKUP_URL?.trim();

/**
 * Başlığın son kelimesi fosforlu kalemle çizilir — logodaki "net" gibi.
 * Kelime sırası mantıksal; Arapçada da son kelime doğru yerde vurgulanır.
 */
function fosforla(baslik: string) {
  const i = baslik.trimEnd().lastIndexOf(" ");
  if (i < 0) return <span className="marker">{baslik}</span>;
  return (
    <>
      {baslik.slice(0, i + 1)}
      <span className="marker">{baslik.slice(i + 1)}</span>
    </>
  );
}

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
        Eski hero: tam ekran fotoğraf + koyu gradyan + üstünde beyaz metin +
        sağda iletişim formu. İki sorunu vardı — metin fotoğrafın üstünde
        okunuyordu (kontrast fotoğrafın o bölgesine bağlı) ve ilk ekranda
        öğrenciye "ne kazanacaksın" yerine işletmeye lead toplayan bir form
        duruyordu. Yeni hero açık zeminde, metin tipografiyle taşınıyor.
      */}
      <section className="relative overflow-hidden border-b border-line bg-surface-sunk">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_70%_at_85%_10%,rgba(14,144,213,0.10),transparent_65%)]"
        />
        <Container className="relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <Reveal y={20}>
              <Eyebrow>{h.heroEyebrow}</Eyebrow>
            </Reveal>
            <Reveal y={20} delay={0.06}>
              <h1 className="font-display mt-4 text-display font-semibold tracking-tight text-ink text-balance">
                {fosforla(h.heroTitle)}
              </h1>
            </Reveal>
            <Reveal y={20} delay={0.12}>
              <p className="mt-5 max-w-xl text-body text-ink-soft sm:mt-6 sm:text-lead">{h.heroSubtitle}</p>
            </Reveal>
            <Reveal y={20} delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {CHECKUP_URL ? (
                  <ExternalButton href={CHECKUP_URL} size="lg">
                    {h.checkupCta} <ArrowRight />
                  </ExternalButton>
                ) : (
                  <LinkButton href={localizedPath("services", lang)} size="lg">
                    {h.heroCtaPrimary} <ArrowRight />
                  </LinkButton>
                )}
                <LinkButton href={localizedPath("contact", lang)} variant="secondary" size="lg">
                  {h.heroCtaSecondary}
                </LinkButton>
              </div>
            </Reveal>
            <Reveal y={20} delay={0.24}>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-caption text-ink-faint">
                {[h.heroBadge1, h.heroBadge2, h.heroBadge3].map((badge) => (
                  <li key={badge} className="inline-flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-brand-bright" aria-hidden />
                    {badge}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal y={24} delay={0.12} className="relative">
            <div className="overflow-hidden rounded-3xl shadow-pop">
              <Image
                src="/images/hero-student.webp"
                alt={h.heroImageAlt}
                width={1200}
                height={780}
                priority
                className="h-full w-full object-cover"
                sizes="(min-width: 1024px) 560px, 100vw"
              />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ── Check-up ────────────────────────────────────────── */}
      {CHECKUP_URL ? (
        <Section tone="deep" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_80%_0%,rgba(14,144,213,0.35),transparent_70%)]"
          />
          <Container className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
            <Reveal>
              <SectionHead light eyebrow={h.checkupEyebrow} title={h.checkupTitle} description={h.checkupDesc} />
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ExternalButton href={CHECKUP_URL} variant="white" size="lg">
                  {h.checkupCta} <ArrowRight />
                </ExternalButton>
                <Badge tone="light">{h.checkupNote}</Badge>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ul className="grid gap-3">
                {[
                  { icon: Target, text: h.checkupPoint1 },
                  { icon: LineChart, text: h.checkupPoint2 },
                  { icon: ClipboardList, text: h.checkupPoint3 },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-4 rounded-2xl bg-white/8 px-5 py-4 ring-1 ring-inset ring-white/12"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-body font-medium text-white">{text}</span>
                  </li>
                ))}
              </ul>
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
                {/*
                  Eski kart: kırmızı "sorun" kutusu + aşağı ok + mavi "çözüm"
                  kutusu. Üç ayrı zemin rengi ve bir yön oku, üç kartta
                  dokuz kutu ediyordu. Yeni kurgu tek kart: sorun sönük,
                  çözüm vurgulu — hiyerarşi renkle değil ağırlıkla.
                */}
                <Card className="flex h-full flex-col p-6">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-wash text-brand">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-display mt-5 text-h3 font-semibold text-ink text-balance">{title}</h3>
                  <p className="mt-4 text-micro font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    {h.problemLabel}
                  </p>
                  <p className="mt-1.5 text-body text-ink-faint">{problem}</p>
                  <div className="mt-5 border-t border-line pt-5">
                    <Eyebrow className="text-[0.6875rem]">{h.solutionLabel}</Eyebrow>
                    <p className="mt-2 text-body text-ink">{solution}</p>
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
              <LinkButton href={localizedPath("services", lang)} variant="secondary" className="max-sm:w-full">
                {h.servicesCta} <ArrowRight />
              </LinkButton>
            </div>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <StaggerItem key={service.id}>
                <Link
                  href={`${localizedPath("services", lang)}#${service.id}`}
                  className="group block h-full"
                >
                  <Card interactive className="flex h-full flex-col p-5">
                    <h3 className="text-h4 font-semibold text-ink text-balance group-hover:text-brand">
                      {s[service.titleKey]}
                    </h3>
                    <p className="mt-2 flex-1 text-caption text-ink-faint">
                      {ilkCumle(s[service.leadKey])}
                    </p>
                    <ArrowRight className="mt-4 size-4 text-brand transition group-hover:translate-x-1 rtl:rotate-180" />
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* ── Biz kimiz ───────────────────────────────────────── */}
      <Section>
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <Reveal>
              <SectionHead eyebrow={t.about.whoTitle} title={h.aboutTeaserTitle} description={t.about.whoBody} />
              <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                {expertise.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl bg-surface-sunk px-4 py-3 text-caption font-medium text-ink ring-1 ring-inset ring-line"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <LinkButton href={localizedPath("about", lang)} variant="ghost" className="mt-6 -ms-2">
                {h.aboutTeaserCta} <ArrowRight className="rtl:rotate-180" />
              </LinkButton>
            </Reveal>

            <Reveal delay={0.1} className="relative">
              <div className="overflow-hidden rounded-3xl shadow-raised">
                <Image
                  src="/images/biz-kimiz-kocluk.webp"
                  alt={t.about.imageAlt}
                  width={1600}
                  height={1067}
                  className="h-full w-full object-cover"
                  sizes="(min-width: 1024px) 480px, 100vw"
                />
              </div>
              <div className="absolute -bottom-4 start-6 rounded-2xl bg-brand px-5 py-3 text-white shadow-brand">
                <p className="text-micro font-semibold uppercase tracking-[0.18em] text-white/75">
                  {h.aboutBadgeLabel}
                </p>
                <p className="text-body font-semibold">{h.aboutBadgeText}</p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Yayınlar ────────────────────────────────────────── */}
      <Section tone="sunk">
        <Container>
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow={h.productsEyebrow} title={h.productsTitle} description={h.productsDesc} />
              <LinkButton href={localizedPath("products", lang)} variant="secondary" className="max-sm:w-full">
                {h.productsCta} <ArrowRight />
              </LinkButton>
            </div>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-4 md:grid-cols-3">
            {oneCikanUrunler.map((product) => (
              <StaggerItem key={product.id}>
                <Link href={`${localizedPath("products", lang)}#${product.id}`} className="group block h-full">
                  <Card interactive className="flex h-full flex-col p-6">
                    <div className="flex flex-wrap gap-1.5">
                      {product.exams.slice(0, 3).map((exam) => (
                        <Badge key={exam} tone="brand">
                          {exam}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="font-display mt-4 text-h4 font-semibold leading-snug text-ink group-hover:text-brand">
                      {product.name}
                    </h3>
                    <p className="mt-3 flex-1 text-caption text-ink-faint">{product.tagline[lang]}</p>
                    <p className="mt-5 flex items-baseline gap-1.5 border-t border-line pt-4">
                      <span className="font-display text-h3 font-semibold text-brand">
                        {product.questionCount}
                      </span>
                      <span className="text-caption text-ink-faint">{t.products.questionsLabel}</span>
                    </p>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* ── Kapanış ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/cta-ekip.webp"
          alt={h.ctaImageAlt}
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-brand-deep/88" aria-hidden />
        <Container className="relative py-20 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-h2 font-semibold tracking-tight text-white text-balance sm:text-[2.25rem]">
              {h.ctaTitle}
            </h2>
            <p className="mt-4 text-lead text-white/75">{h.ctaDesc}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <LinkButton href={localizedPath("contact", lang)} variant="white" size="lg">
                {t.nav.contact} <ArrowRight />
              </LinkButton>
              <LinkButton href={localizedPath("services", lang)} variant="outlineLight" size="lg">
                {t.nav.services}
              </LinkButton>
            </div>
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
