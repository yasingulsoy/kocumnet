import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

/*
 * Check-up paneli kök düzeni. Yazı tipleri sitenin ve öğrenci uygulamasının
 * aynısı (Poppins başlık, Inter gövde; latin-ext Türkçe harfler için).
 * Panel arama motorlarına kapalı: metadata + robots.ts + X-Robots-Tag.
 * KaTeX'in yalnızca CSS'i yüklenir: önizleme HTML'ini backend üretir.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Check-up Paneli · Koçum.Net", template: "%s · Check-up Paneli" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

// Üst çubuk beyaz: telefonun tarayıcı çubuğu da beyaz.
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function KokDuzen({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen font-sans text-gray-800">{children}</body>
    </html>
  );
}
