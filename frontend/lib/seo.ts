import type { Metadata } from "next";
import { LOCALE_OG, type Locale } from "@/lib/i18n/config";

const SITE_ADI = "Koçum.Net";

/**
 * Sitenin dile göre paylaşım görseli: app/[lang]/opengraph-image.tsx.
 *
 * Neden elle veriliyor: Next dosya tabanlı görseli yalnızca o segmentin
 * metadata'sına ekler. Bir alt sayfa kendi `openGraph` nesnesini yazınca
 * (her iç sayfa yazıyor: url, başlık, açıklama) üst segmentteki görsel
 * DÜŞER — `openGraph` alanı birleştirilmez, bütünüyle değiştirilir
 * (next/dist/lib/metadata/resolve-metadata.js, mergeMetadata). Sonuç:
 * yalnızca ana sayfa görselliydi; hizmetler, kurumsal, ürünler, iletişim,
 * blog ve kapaksız yazılar WhatsApp/LinkedIn'de görselsiz çıkıyordu.
 *
 * Adres layout'taki metadataBase ile mutlak olur. Türkçe görsel /tr/... altında
 * kalır: proxy.ts tanımadığı /tr segmentlerine dokunmaz.
 */
export function siteOgImage(lang: Locale) {
  return {
    url: `/${lang}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: `${SITE_ADI} — ${lang === "tr" ? "Sınava kadar aklında" : "Exam preparation coaching"}`,
  };
}

/**
 * İç sayfa metadata'sı: başlık, açıklama, kanonik adres + hreflang, Open
 * Graph ve X kartı tek yerde. Eskiden beş sayfada kopyaydı ve X kartı
 * (twitter:title) her iç sayfada sitenin genel başlığını gösteriyordu.
 */
export function sayfaMetadata({
  lang,
  title,
  description,
  path,
  languages,
}: {
  lang: Locale;
  title: string;
  description: string;
  /** Göreli kanonik yol, ör. localizedPath("services", lang). */
  path: string;
  /** hreflang karşılıkları, ör. languageAlternates("services"). */
  languages?: Record<string, string>;
}): Metadata {
  const tamBaslik = `${title} | ${SITE_ADI}`;
  const gorsel = siteOgImage(lang);

  return {
    title,
    description,
    alternates: { canonical: path, ...(languages ? { languages } : {}) },
    openGraph: {
      title: tamBaslik,
      description,
      url: path,
      type: "website",
      locale: LOCALE_OG[lang],
      siteName: SITE_ADI,
      images: [gorsel],
    },
    twitter: {
      card: "summary_large_image",
      title: tamBaslik,
      description,
      images: [gorsel.url],
    },
  };
}
