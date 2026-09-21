import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Matematik Check-up · Koçum.Net",
    template: "%s · Koçum.Net Check-up",
  },
  description:
    "Kısa bir matematik testiyle seviyeni ölç, zayıf konularını gör ve nereden çalışman gerektiğini öğren.",
  // Check-up bir uygulama, pazarlama sayfası değil: arama motorlarına açılacak
  // yüzey /kocum.net; burası giriş gerektiriyor.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#17305e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
    >
      <head>
        {/*
          KaTeX CSS'i public/ üzerinden: Tailwind v4 node_modules'den @import
          çözmüyor. Formüller sunucuda HTML'e çevriliyor, bu yüzden KaTeX'in
          ~280 KB'lık JS'i istemciye HİÇ gitmiyor — yalnızca bu stil dosyası.
        */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- Tailwind v4
            node_modules'den @import çözmüyor; dosya public/ altına kopyalandı. */}
        <link rel="stylesheet" href="/katex/katex.min.css" />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
