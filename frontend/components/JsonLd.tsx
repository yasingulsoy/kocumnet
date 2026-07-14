import { SITE_BRAND } from "@/lib/site-brand";
import { getSiteUrl } from "@/lib/site";
import { LOCALE_HREFLANG, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/routes";

const LANGUAGE_NAMES: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
  ar: "Arabic",
};

export function JsonLd({ locale }: { locale: Locale }) {
  const url = getSiteUrl();
  const homeUrl = `${url}${localizedPath("home", locale)}`;
  const logoUrl = `${url}/favicon.ico`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: SITE_BRAND.name,
        alternateName: SITE_BRAND.tagline,
        description: SITE_BRAND.descriptionShort,
        url,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
        email: SITE_BRAND.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: SITE_BRAND.addressLocality,
          addressCountry: SITE_BRAND.addressCountry,
        },
        sameAs: [SITE_BRAND.social.instagram],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SITE_BRAND.email,
          areaServed: SITE_BRAND.addressCountry,
          availableLanguage: Object.values(LANGUAGE_NAMES),
        },
      },
      {
        "@type": "ProfessionalService",
        "@id": `${url}/#business`,
        name: SITE_BRAND.name,
        description: SITE_BRAND.descriptionShort,
        url: homeUrl,
        provider: { "@id": `${url}/#organization` },
        serviceType: [
          "Sınav hazırlık koçluğu",
          "Tercih danışmanlığı",
          "Öğrenci koçluğu",
          "Sınav hazırlık materyalleri",
          "Sınav sürecinde psikolojik destek",
          "Sınav sürecinde beslenme danışmanlığı",
        ],
        areaServed: {
          "@type": "Country",
          name: "Türkiye",
        },
        availableLanguage: Object.values(LANGUAGE_NAMES),
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: SITE_BRAND.name,
        url: homeUrl,
        description: SITE_BRAND.descriptionShort,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: LOCALE_HREFLANG[locale],
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
