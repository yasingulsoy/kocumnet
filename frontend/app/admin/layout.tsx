import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "../globals.css";

/*
 * Site yönetimi kök düzeni. app/[lang]/layout.tsx'ten AYRI bir kök: panel
 * dil öneki almaz, pazarlama başlığı/altbilgisi yoktur, arama motoruna
 * kapalıdır. Yazı tipleri siteyle aynı (Poppins + Inter).
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Site yönetimi · Koçum.Net", template: "%s · Koçum.Net Yönetim" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export const viewport: Viewport = { themeColor: "#f4f6fb" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
