import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./admin.css";

/*
 * Site yönetimi kök düzeni. app/[lang]/layout.tsx'ten AYRI bir kök: panel
 * dil öneki almaz, pazarlama başlığı/altbilgisi yoktur, arama motoruna
 * kapalıdır. Yazı tipleri siteyle aynı (Poppins + Inter). Arayüz TailAdmin
 * kitinden (components/tailadmin; kaynak design/tailadmin). Stil dosyası da
 * ayrı (admin.css): yönetimin sınıfları sitenin CSS'ine girmez.
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

// Üst çubuk beyaz (TailAdmin): telefonun tarayıcı çubuğu da beyaz.
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior: admin.css'teki yumuşak kaydırma sayfa geçişlerinde kapansın (Next uyarısı).
    <html lang="tr" data-scroll-behavior="smooth" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen bg-gray-50 font-sans text-gray-800">{children}</body>
    </html>
  );
}
