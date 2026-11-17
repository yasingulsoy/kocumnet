import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { headers } from "next/headers";
import "katex/dist/katex.min.css";
import "./globals.css";

/*
 * "latin-ext" ŞART: Google Fonts'un `latin` alt kümesinde ğ Ş İ ı yok; o
 * harfler yedek yazı tipiyle çizilir ve kelimenin ortasında yazı tipi değişir.
 * Değişken adları tokens.css'teki --font-sans / --font-display'e bağlı.
 * next/font dosyaları derlemede indirip kendimiz sunuyoruz: ziyaretçinin
 * tarayıcısı Google'a istek atmaz.
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

/**
 * Paylaşım önizlemesinin (opengraph-image.png) mutlak adresi için kök adres.
 * Ayrı bir ortam değişkeni yerine isteğin kendi adresi: uygulama hangi alan
 * adında yayındaysa önizleme de oradan gelir.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  let metadataBase: URL | undefined;
  try {
    metadataBase = host ? new URL(`${proto}://${host}`) : undefined;
  } catch {
    metadataBase = undefined;
  }
  return { ...metadata, metadataBase };
}

const metadata: Metadata = {
  applicationName: "Koçum.Net Check-up",
  title: {
    default: "Check-up · Koçum.Net",
    template: "%s · Koçum.Net Check-up",
  },
  description: "Sınavına göre bir check-up çöz; netini, güçlü ve zayıf konularını ve her sorunun çözümünü gör.",
  // Giriş gerektiren bir uygulama: arama motorlarına kocum.net açılır, burası değil.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Koçum.Net",
    title: "Check-up · Koçum.Net",
    description: "Sınavına göre bir check-up çöz, nerede eksiğin olduğunu gör.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // iOS'ta env(safe-area-inset-*) ancak böyle çalışır (sınavdaki alt çubuk ev çubuğunun altında kalmasın).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen font-sans text-gray-800">{children}</body>
    </html>
  );
}
