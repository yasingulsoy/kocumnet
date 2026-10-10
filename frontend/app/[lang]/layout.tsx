import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { JsonLd } from "@/components/JsonLd";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { RevealObserver } from "@/components/RevealObserver";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  LOCALES,
  LOCALE_DIR,
  LOCALE_HREFLANG,
  LOCALE_OG,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site";
import "../globals.css";

/*
 * ⚠️ subsets'te "latin-ext" ŞART.
 *
 * Türkçe ğ, ş, İ, ı, ç harfleri "latin" alt kümesinde YOK. next/font
 * istenmeyen alt kümeyi dosyadan attığı için tarayıcı bu harfleri yedek
 * fontla çiziyor: "Gelişim", "Başarı", "Çözüm" gibi kelimelerin ortasında
 * harf harf font değişiyor. Türkçe bir sitede en görünür kusur bu.
 */
/*
 * Üç yüzeyde (site, check-up, panel) aynı çift: Poppins başlık, Inter gövde.
 * Poppins logodaki yazıyla aynı; Inter tablo rakamlarını hizalı tutar ve
 * 13px'te okunur. Yazı tipi değişkenleri tokens.css'teki --font-sans /
 * --font-display tarafından okunur.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/*
 * Arapça: Readex Pro (OFL, @fontsource-variable/readex-pro). YALNIZCA /ar'da
 * kullanılır: yığın globals.css'te, html[lang="ar"].
 *
 *  · Okunurluk için tasarlandı (Lexend'in Arapçası); değişken font, bütün
 *    kalınlıklar tek dosyada, 22 KB. IBM Plex Sans Arabic üç kalınlıkta
 *    132 KB tuttu, /ar'ın Lighthouse puanı 90'dan 84'e düştü.
 *  · Yalnızca "arabic" alt kümesi + unicode-range: Latin harf, rakam ve
 *    boşluk bu fonta düşmez; Koçum.Net, TYT ve rakamlar Inter/Poppins'le.
 *  · preload: false. Bu düzen üç dilde ortak, ön yükleme dile göre
 *    seçilemiyor; açık olsaydı TR ve EN de dosyayı indirirdi. @font-face
 *    orada da CSS'te durur ama kullanan öğe olmadığı için dosya inmez.
 *  · adjustFontFallback: false. Üretilen yedek unicode-range'siz Arial
 *    olurdu ve listede önde durduğu için Latin harfleri de yakalardı.
 *    Arapçaya özel yedek globals.css'te ("Readex Yedek").
 */
const readexPro = localFont({
  src: "../../node_modules/@fontsource-variable/readex-pro/files/readex-pro-arabic-wght-normal.woff2",
  weight: "160 700",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC",
    },
  ],
});

/*
 * globals.css /ar'da --font-inter ve --font-poppins'i Arapça önce gelecek
 * biçimde yeniden kurar (tokens.css'teki --font-sans/--font-display bunları
 * okur ve `@theme inline` ile sınıflara gömülüdür). Bir değişken kendine
 * başvuramadığı için özgün aile adları ayrı adlarla buradan verilir.
 */
const ARAPCA_DEGISKENLER = {
  "--ar-readex": readexPro.style.fontFamily,
  "--ar-inter": inter.style.fontFamily,
  "--ar-poppins": poppins.style.fontFamily,
} as CSSProperties;

const siteUrl = getSiteUrl();

/** Üç dil de statik üretilir. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);

  const title = dict.meta.siteTitle;
  const description = dict.meta.siteDescription;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: "%s | Koçum.Net",
    },
    description,
    applicationName: "Koçum.Net",
    authors: [{ name: "Koçum.Net", url: siteUrl }],
    creator: "Koçum.Net",
    publisher: "Koçum.Net",
    category: "education",
    formatDetection: { email: false, address: false, telephone: false },
    alternates: {
      canonical: localizedPath("home", lang),
      languages: languageAlternates("home"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: LOCALE_OG[lang],
      alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => LOCALE_OG[l]),
      url: localizedPath("home", lang),
      siteName: "Koçum.Net",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const dir = LOCALE_DIR[locale];

  return (
    <html
      lang={LOCALE_HREFLANG[locale]}
      dir={dir}
      /*
       * <html>'e h-full (height:100%) verilmiyor — gereksiz ve kaydırma
       * hesaplarını bozabiliyor. Sticky footer, body'deki min-h-screen +
       * flex-col ve footer'daki mt-auto ile sağlanıyor.
       */
      className={`${inter.variable} ${poppins.variable} antialiased`}
      style={locale === "ar" ? ARAPCA_DEGISKENLER : undefined}
    >
      <body className="flex min-h-screen flex-col bg-white font-sans text-gray-600">
        {/*
          Güvenlik ağı: satır içi opacity:0 ile gelen bir öğe JavaScript
          yüklenmezse kalıcı olarak görünmez kalırdı (framer-motion döneminde
          bütün site böyleydi). Kaydırma animasyonları artık CSS ve JS'siz hiç
          gizlenmiyor (components/Reveal.tsx); blok yine de kalıyor — SİLME.
        */}
        <noscript>
          <style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <JsonLd locale={locale} dict={dict} />
        <RevealObserver />
        <a href="#icerik" className="skip-link">
          {dict.meta.skipToContent}
        </a>
        <Header locale={locale} dict={dict} />
        <div id="icerik" className="flex flex-1 flex-col">
          {children}
        </div>
        <Footer locale={locale} dict={dict} />
      </body>
    </html>
  );
}
