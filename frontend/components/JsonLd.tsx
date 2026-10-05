import { SITE_BRAND } from "@/lib/site-brand";
import { jsonLd } from "@/lib/jsonld";
import { getSiteUrl } from "@/lib/site";
import { LOCALE_HREFLANG, type Locale } from "@/lib/i18n/config";
import { localizedPath, type RouteKey } from "@/lib/routes";
import { SERVICES } from "@/lib/services";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const LANGUAGE_NAMES: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
  ar: "Arabic",
};

/**
 * Sitenin kimlik grafiği (her sayfada, düzenden): kurum, hizmet, web sitesi.
 *
 * Kurum EducationalOrganization (Organization'ın alt türü; Google'ın kurum
 * özellikleri aynen geçerli). Kurucular yalnızca Kurumsal sayfasında
 * "Kurucu" unvanıyla yazan iki kişi; ad ve unvan sözlükten, sitede görünen
 * metnin birebir aynısı — yeni bir iddia eklenmiyor. Açıklama ve hizmet
 * adları da sayfanın dilinde (eskiden İngilizce/Arapça sayfada Türkçeydi).
 */
export function JsonLd({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const url = getSiteUrl();
  const homeUrl = `${url}${localizedPath("home", locale)}`;
  const logoUrl = `${url}/icons/icon-512.png`;
  const a = dict.about;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${url}/#organization`,
        name: SITE_BRAND.name,
        alternateName: SITE_BRAND.tagline,
        description: dict.meta.siteDescription,
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
        founder: [
          { "@type": "Person", name: a.team1Name, jobTitle: a.team1Role },
          { "@type": "Person", name: a.team2Name, jobTitle: a.team2Role },
        ],
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
        description: dict.meta.siteDescription,
        url: homeUrl,
        provider: { "@id": `${url}/#organization` },
        serviceType: SERVICES.map((s) => dict.services[s.titleKey]),
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
        description: dict.meta.siteDescription,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: LOCALE_HREFLANG[locale],
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
  );
}

/**
 * Sayfa yolu (BreadcrumbList): arama sonucunda adres yerine "Koçum.Net ›
 * Hizmetlerimiz" gibi okunur bir yol gösterilsin. Yollar göreli verilir.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  const url = getSiteUrl();
  const veri = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((oge, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: oge.name,
      item: `${url}${oge.path}`,
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(veri) }} />;
}

/** İç sayfalar için kısa yol: Ana Sayfa › <menü adı>. */
export function SayfaYoluJsonLd({ lang, dict, sayfa }: { lang: Locale; dict: Dictionary; sayfa: RouteKey }) {
  return (
    <BreadcrumbJsonLd
      items={[
        { name: dict.nav.home, path: localizedPath("home", lang) },
        { name: dict.nav[sayfa], path: localizedPath(sayfa, lang) },
      ]}
    />
  );
}
