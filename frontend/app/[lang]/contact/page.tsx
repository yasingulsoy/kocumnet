import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/ContactForm";
import { Container, IconBox, KART_GOLGE, Section, SectionHead } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
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
    title: t.contact.title,
    description: t.contact.metaDescription,
    path: localizedPath("contact", lang),
    languages: languageAlternates("contact"),
  });
}

const SATIR = "flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4";

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const c = t.contact;

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
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="contact" />
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
                    <IconBox>
                      <Icon />
                    </IconBox>
                    <span className="min-w-0">
                      <span className="block text-theme-xs text-gray-500">{label}</span>
                      {/* bdi: Arapça sayfada "@kocum_net" ters dizilmesin. */}
                      <span className="block truncate text-base font-medium text-gray-800">
                        <bdi>{value}</bdi>
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={cx(SATIR, KART_GOLGE, "transition hover:border-gray-300 hover:shadow-theme-md")}
                      >
                        {govde}
                      </a>
                    ) : (
                      <div className={cx(SATIR, KART_GOLGE)}>{govde}</div>
                    )}
                  </li>
                );
              })}
            </ul>

            <Alert variant="info" className="mt-8">
              {c.note}
            </Alert>
          </Reveal>

          {/* Sağ: form — kitin başlıklı kartı */}
          <Reveal delay={0.1}>
            <ComponentCard title={c.formTitle} desc={c.formDesc} className="shadow-theme-md">
              <ContactForm dict={t} locale={lang} source="contact" />
            </ComponentCard>
          </Reveal>
        </Container>
      </Section>
    </main>
  );
}
