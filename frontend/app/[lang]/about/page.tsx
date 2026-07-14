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
    title: t.about.title,
    description: t.about.metaDescription,
    alternates: {
      canonical: localizedPath("about", lang),
      languages: languageAlternates("about"),
    },
    openGraph: {
      title: `${t.about.title} | Koçum.Net`,
      description: t.about.metaDescription,
      url: localizedPath("about", lang),
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const a = t.about;

  const expertise = [a.expertise1, a.expertise2, a.expertise3, a.expertise4];

  const team = [
    { name: a.team1Name, role: a.team1Role },
    { name: a.team2Name, role: a.team2Role },
    { name: a.team3Name, role: a.team3Role },
    { name: a.team4Name, role: a.team4Role },
  ];

  return (
    <main className="bg-white text-[#444] antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17305e] via-[#1a5fb4] to-[#0e90d5] py-20 sm:py-28">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Koçum.Net</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {a.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{a.heroSubtitle}</p>
        </div>
      </section>

      {/* Biz Kimiz */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1a5fb4]">
              {a.whoTitle}
            </p>
            <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-[#151a33] sm:text-4xl">
              {a.whoHeading}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[#444]">{a.whoBody}</p>
            <p className="mt-5 text-base leading-relaxed text-[#444]">{a.whoClosing}</p>
          </Reveal>
          <Reveal delay={0.12} className="relative">
            <div className="absolute -top-4 -start-4 h-full w-full rounded-2xl border-2 border-[#1a5fb4]/25" aria-hidden />
            <div className="relative overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(23,48,94,0.5)]">
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
        </div>
      </section>

      {/* Uzmanlık alanları */}
      <section className="border-y border-[#1a5fb4]/10 bg-[#edf0fa] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <h2 className="font-display text-center text-2xl font-bold tracking-tight text-[#151a33] sm:text-3xl">
              {a.expertiseTitle}
            </h2>
          </Reveal>
          <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {expertise.map((item) => (
              <StaggerItem
                key={item}
                className="rounded-xl border border-[#1a5fb4]/15 bg-white px-5 py-6 text-center text-sm font-semibold text-[#151a33] shadow-sm"
              >
                {item}
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Misyon & Vizyon */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <StaggerGroup className="grid gap-8 md:grid-cols-2">
          <StaggerItem className="relative overflow-hidden rounded-2xl border border-[#1a5fb4]/15 bg-gradient-to-br from-[#fafbff] to-white p-8 shadow-sm sm:p-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a5fb4]/10 text-[#1a5fb4]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 2.42m5.96 11.95a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </span>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1a5fb4]">
              {a.missionSubtitle}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[#151a33] sm:text-3xl">
              {a.missionTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#444]">{a.missionBody}</p>
            <div className="absolute -bottom-8 -end-8 h-32 w-32 rounded-full bg-[#1a5fb4]/5" aria-hidden />
          </StaggerItem>

          <StaggerItem className="relative overflow-hidden rounded-2xl border border-[#0e90d5]/20 bg-gradient-to-br from-[#fafbff] to-white p-8 shadow-sm sm:p-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0e90d5]/10 text-[#0e90d5]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0e90d5]">
              {a.visionSubtitle}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-[#151a33] sm:text-3xl">
              {a.visionTitle}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#444]">{a.visionBody}</p>
            <div className="absolute -bottom-8 -end-8 h-32 w-32 rounded-full bg-[#0e90d5]/5" aria-hidden />
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* Uzman kadro */}
      <section className="border-t border-gray-100 bg-[#fafbfe] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#151a33]">
              {a.teamTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-[#666]">{a.teamDesc}</p>
          </Reveal>
          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <StaggerItem
                key={member.name}
                className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1a5fb4] to-[#0e90d5] text-xl font-bold text-white shadow-md">
                  {member.name.charAt(0)}
                </div>
                <h3 className="mt-4 text-base font-bold text-[#151a33]">{member.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#1a5fb4]">{member.role}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <Reveal className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-3xl font-bold text-[#151a33]">{t.home.ctaTitle}</h2>
          <p className="mt-4 text-[#666]">{t.home.ctaDesc}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href={localizedPath("services", lang)}
              className="inline-flex rounded-xl bg-[#1a5fb4] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#154a94]"
            >
              {t.nav.services}
            </Link>
            <Link
              href={localizedPath("contact", lang)}
              className="inline-flex rounded-xl border-2 border-[#17305e] px-8 py-3.5 text-sm font-semibold text-[#17305e] transition hover:bg-[#17305e] hover:text-white"
            >
              {t.nav.contact}
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
