import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";
import { Card, Container, Section, SectionHead } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, LOCALE_OG } from "@/lib/i18n/config";
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
  const path = localizedPath("contact", lang);

  return {
    title: t.contact.title,
    description: t.contact.metaDescription,
    alternates: { canonical: path, languages: languageAlternates("contact") },
    openGraph: {
      title: `${t.contact.title} | Koçum.Net`,
      description: t.contact.metaDescription,
      url: path,
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: "Koçum.Net",
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const c = t.contact;

  /*
   * İkonlar artık lucide-react'ten. Eskiden bu dosyanın içinde dört ayrı
   * SVG fonksiyonu vardı ve aynı path verisi Header/Footer'da da kopyaydı
   * (Instagram ikonu sitede üç kez, konum ikonu iki kez yazılıydı).
   */
  const contactInfo = [
    { icon: Mail, label: c.email, value: SITE_BRAND.email, href: `mailto:${SITE_BRAND.email}` },
    ...(SITE_BRAND.phone
      ? [
          {
            icon: Phone,
            label: c.phone,
            value: SITE_BRAND.phone,
            href: `tel:${SITE_BRAND.phone.replace(/\s+/g, "")}`,
          },
        ]
      : []),
    {
      icon: InstagramIcon,
      label: c.instagram,
      value: SITE_BRAND.instagramHandle,
      href: SITE_BRAND.social.instagram,
    },
    {
      icon: MapPin,
      label: c.location,
      value: `${SITE_BRAND.addressLocality}, ${t.nav.country}`,
      href: null as string | null,
    },
  ];

  return (
    <main>
      <PageHero eyebrow={t.nav.contact} title={c.heroTitle} description={c.heroSubtitle} />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16">
          {/* Sol: ulaşım kanalları */}
          <Reveal>
            <SectionHead title={c.reachTitle} description={c.reachBody} />

            <ul className="mt-10 space-y-3">
              {contactInfo.map(({ icon: Icon, label, value, href }) => {
                const govde = (
                  <>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-wash text-brand">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-caption text-ink-faint">{label}</span>
                      <span className="block truncate text-body font-medium text-ink">{value}</span>
                    </span>
                  </>
                );

                return (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        {...(href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-hover"
                      >
                        {govde}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
                        {govde}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="mt-8 rounded-2xl bg-surface-sunk p-5 text-caption leading-relaxed text-ink-soft">
              {c.note}
            </p>
          </Reveal>

          {/* Sağ: form */}
          <Reveal delay={0.1}>
            <Card className="p-6 shadow-raised sm:p-8">
              <h2 className="font-display text-h3 font-semibold text-ink">{c.formTitle}</h2>
              <p className="mt-1.5 text-caption text-ink-soft">{c.formDesc}</p>
              <div className="mt-7">
                <ContactForm dict={t} locale={lang} source="contact" />
              </div>
            </Card>
          </Reveal>
        </Container>
      </Section>
    </main>
  );
}
