import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { HeroContactForm } from "@/components/HeroContactForm";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/Reveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/routes";

const btnPrimary =
  "inline-flex min-h-[48px] items-center justify-center rounded-[5px] bg-[#1a5fb4] px-8 text-sm font-semibold uppercase tracking-[0.06em] text-white shadow-sm transition hover:bg-[#154a94]";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const h = t.home;

  const problems = [
    {
      title: h.problem1Title,
      problem: h.problem1Problem,
      solution: h.problem1Solution,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17.25h.008v.008H12v-.008z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: h.problem2Title,
      problem: h.problem2Problem,
      solution: h.problem2Solution,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      ),
    },
    {
      title: h.problem3Title,
      problem: h.problem3Problem,
      solution: h.problem3Solution,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const expertise = [
    t.about.expertise1,
    t.about.expertise2,
    t.about.expertise3,
    t.about.expertise4,
  ];

  return (
    <main className="bg-white text-[#444] antialiased">
      {/* Hero */}
      <section className="relative w-full">
        <Image
          src="/images/hero-student.webp"
          alt={h.heroImageAlt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#0b1e3f]/90 via-[#0b1e3f]/70 to-[#0b1e3f]/35 rtl:bg-gradient-to-l"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[min(92vh,860px)] max-w-[1320px] flex-col justify-center gap-12 px-4 py-24 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
          <div className="max-w-2xl flex-1">
            <Reveal y={24}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8ec3f8]">
                {h.heroEyebrow}
              </p>
            </Reveal>
            <Reveal y={24} delay={0.08}>
              <h1 className="mt-4 font-sans text-[2.4rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-[3.4rem]">
                {h.heroTitle}
              </h1>
            </Reveal>
            <Reveal y={24} delay={0.16}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                {h.heroSubtitle}
              </p>
            </Reveal>
            <Reveal y={24} delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href={localizedPath("services", lang)} className={`${btnPrimary} min-w-[180px]`}>
                  {h.heroCtaPrimary}
                </Link>
                <Link
                  href={localizedPath("contact", lang)}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[5px] border-2 border-white/70 bg-transparent px-8 text-sm font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white hover:text-[#17305e]"
                >
                  {h.heroCtaSecondary}
                </Link>
              </div>
            </Reveal>
            <Reveal y={24} delay={0.32}>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/70">
                {[h.heroBadge1, h.heroBadge2, h.heroBadge3].map((badge) => (
                  <li key={badge} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8ec3f8]" aria-hidden />
                    {badge}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal y={28} delay={0.2} className="w-full max-w-md lg:w-[380px] lg:shrink-0">
            <HeroContactForm dict={t} />
          </Reveal>
        </div>
      </section>

      {/* Sorun – Çözüm */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1a5fb4]">
            {h.problemsEyebrow}
          </p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-[#151a33] sm:text-4xl">
            {h.problemsTitle}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#555]">{h.problemsDesc}</p>
        </Reveal>
        <StaggerGroup className="mt-14 grid gap-7 lg:grid-cols-3">
          {problems.map((item) => (
            <StaggerItem
              key={item.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[#1a5fb4]/12 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#1a5fb4]/30 hover:shadow-[0_20px_50px_-20px_rgba(26,95,180,0.45)]"
            >
              <div className="flex items-start gap-4 border-b border-[#1a5fb4]/10 bg-gradient-to-br from-[#f4f7fe] to-white px-6 py-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1a5fb4]/10 text-[#1a5fb4] transition group-hover:bg-[#1a5fb4] group-hover:text-white">
                  {item.icon}
                </span>
                <h3 className="pt-1 text-lg font-bold leading-snug tracking-tight text-[#151a33]">
                  {item.title}
                </h3>
              </div>

              <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
                <div className="rounded-xl bg-[#fdf3f2] p-4">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-[#c0392b]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c0392b]">
                      {h.problemLabel}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#6b5552]">{item.problem}</p>
                </div>

                <div className="flex justify-center py-3" aria-hidden>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a5fb4]/10 text-[#1a5fb4]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12l-7.5 7.5L4.5 12m7.5 7.5V4.5" />
                    </svg>
                  </span>
                </div>

                <div className="flex-1 rounded-xl border border-[#1a5fb4]/15 bg-[#f2f7fe] p-4">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-[#1a5fb4]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a5fb4]">
                      {h.solutionLabel}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#33415c]">{item.solution}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Biz Kimiz (özet) → Kurumsal sayfasına yönlendirir */}
      <section className="border-y border-[#1a5fb4]/10 bg-[#edf0fa] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1a5fb4]">
                {t.about.whoTitle}
              </p>
              <h2 className="font-display mt-4 max-w-3xl text-3xl font-bold tracking-tight text-[#151a33] sm:text-4xl">
                {h.aboutTeaserTitle}
              </h2>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#444]">{t.about.whoBody}</p>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                {expertise.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-[#1a5fb4]/15 bg-white/80 px-5 py-4 text-sm font-semibold text-[#151a33]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={localizedPath("about", lang)}
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#1a5fb4] transition hover:text-[#154a94]"
              >
                {h.aboutTeaserCta}
                <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </Reveal>
            <Reveal delay={0.12} className="relative">
              <div className="absolute -top-4 -start-4 h-full w-full rounded-2xl border-2 border-[#1a5fb4]/25" aria-hidden />
              <div className="relative overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(23,48,94,0.5)]">
                <Image
                  src="/images/biz-kimiz-kocluk.webp"
                  alt={t.about.imageAlt}
                  width={1600}
                  height={1067}
                  className="h-full w-full object-cover"
                  sizes="(min-width: 1024px) 480px, 100vw"
                />
              </div>
              <div className="absolute -bottom-5 start-6 rounded-xl bg-[#1a5fb4] px-5 py-3 text-white shadow-lg">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                  {h.aboutBadgeLabel}
                </p>
                <p className="text-sm font-bold">{h.aboutBadgeText}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Misyon & Vizyon */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <StaggerGroup className="grid gap-8 md:grid-cols-2">
          <StaggerItem className="rounded-2xl border-s-4 border-[#1a5fb4] bg-[#fafbff] p-8 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-[#151a33]">{t.about.missionTitle}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#444]">{t.about.missionBody}</p>
          </StaggerItem>
          <StaggerItem className="rounded-2xl border-s-4 border-[#0e90d5] bg-[#fafbff] p-8 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-[#151a33]">{t.about.visionTitle}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#444]">{t.about.visionBody}</p>
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <Image
          src="/images/cta-ekip.webp"
          alt={h.ctaImageAlt}
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0b1e3f]/80" aria-hidden />
        <Reveal className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
          <h2 className="font-display max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {h.ctaTitle}
          </h2>
          <p className="mt-4 max-w-md text-sm text-white/80">{h.ctaDesc}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href={localizedPath("services", lang)} className={`${btnPrimary} px-10`}>
              {t.nav.services}
            </Link>
            <Link
              href={localizedPath("contact", lang)}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[5px] border-2 border-white/80 bg-transparent px-10 text-sm font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white hover:text-[#17305e]"
            >
              {t.nav.contact}
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
