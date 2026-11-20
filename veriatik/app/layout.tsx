import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Yazı tipleri sitenin kendisinden sunulur (Google'a istek gitmez).
// latin-ext: Türkçe karakterler (İ, ş, ğ…).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
});

const ACIKLAMA =
  "VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş. — Eğitim Yayıncılığında ve Ölçme-Değerlendirmede Yeni Bir AR-GE Merkezi. Web sitemiz çok yakında yayında.";

export const metadata: Metadata = {
  metadataBase: new URL("https://veriatik.com"),
  title: "VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş. | Çok Yakında",
  description: ACIKLAMA,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://veriatik.com",
    siteName: "VERİATİK",
    title: "VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş.",
    description: ACIKLAMA,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
