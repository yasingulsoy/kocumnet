import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_BRAND } from "@/lib/site-brand";
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
    title: t.contact.title,
    description: t.contact.metaDescription,
    alternates: {
      canonical: localizedPath("contact", lang),
      languages: languageAlternates("contact"),
    },
    openGraph: {
      title: `${t.contact.title} | Koçum.Net`,
      description: t.contact.metaDescription,
      url: localizedPath("contact", lang),
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

function IconMail() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const c = t.contact;

  const contactInfo = [
    { icon: <IconMail />, label: c.email, value: SITE_BRAND.email, href: `mailto:${SITE_BRAND.email}` },
    ...(SITE_BRAND.phone
      ? [
          {
            icon: <IconPhone />,
            label: c.phone,
            value: SITE_BRAND.phone,
            href: `tel:${SITE_BRAND.phone.replace(/\s+/g, "")}`,
          },
        ]
      : []),
    {
      icon: <IconInstagram />,
      label: c.instagram,
      value: SITE_BRAND.instagramHandle,
      href: SITE_BRAND.social.instagram,
    },
    {
      icon: <IconPin />,
      label: c.location,
      value: `${SITE_BRAND.addressLocality}, ${t.nav.country}`,
      href: null as string | null,
    },
  ];

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#1a5fb4] focus:ring-2 focus:ring-[#1a5fb4]/20";

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
            {c.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{c.heroSubtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-[#151a33]">{c.reachTitle}</h2>
            <p className="mt-4 leading-relaxed text-[#666]">{c.reachBody}</p>

            <StaggerGroup className="mt-10 space-y-6">
              {contactInfo.map((item) => (
                <StaggerItem key={item.label} className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1a5fb4]/10 text-[#1a5fb4]">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-[#1a5fb4]">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a
                        href={item.href}
                        target={item.href.startsWith("http") ? "_blank" : undefined}
                        rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="mt-1 block text-[#151a33] transition hover:text-[#1a5fb4]"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-[#151a33]">{item.value}</p>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>

            <p className="mt-8 rounded-xl border border-[#1a5fb4]/15 bg-[#fafbff] p-4 text-sm leading-relaxed text-[#555]">
              {c.note}
            </p>
          </Reveal>

          <Reveal delay={0.12} className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg sm:p-10">
            <h2 className="text-xl font-bold text-[#151a33]">{c.formTitle}</h2>
            <p className="mt-2 text-sm text-[#666]">{c.formDesc}</p>
            <form className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium text-[#151a33]">
                    {c.formName}
                  </label>
                  <input id="c-name" type="text" required className={inputClass} placeholder={c.formNamePlaceholder} />
                </div>
                <div>
                  <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium text-[#151a33]">
                    {c.formEmail}
                  </label>
                  <input id="c-email" type="email" required className={inputClass} placeholder={c.formEmailPlaceholder} />
                </div>
              </div>
              <div>
                <label htmlFor="c-subject" className="mb-1.5 block text-sm font-medium text-[#151a33]">
                  {c.formSubject}
                </label>
                <input id="c-subject" type="text" required className={inputClass} placeholder={c.formSubjectPlaceholder} />
              </div>
              <div>
                <label htmlFor="c-message" className="mb-1.5 block text-sm font-medium text-[#151a33]">
                  {c.formMessage}
                </label>
                <textarea
                  id="c-message"
                  rows={5}
                  required
                  className={`${inputClass} resize-none`}
                  placeholder={c.formMessagePlaceholder}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#1a5fb4] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#154a94] hover:shadow-xl"
              >
                {c.formSend}
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
