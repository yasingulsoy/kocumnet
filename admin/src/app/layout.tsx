import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

/*
 * Üç yüzeyde (site, check-up, panel) aynı çift: Poppins başlık, Inter gövde.
 * subsets'te "latin-ext" ŞART: ğ Ğ ş Ş İ ı "latin" alt kümesinde yok.
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

export const metadata: Metadata = {
  title: {
    default: "Check-up Paneli · Koçum.Net",
    template: "%s · Koçum.Net Panel",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

// Üst çubuk beyaz (TailAdmin): telefonun tarayıcı çubuğu da beyaz.
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      {/* Zemin kitin grisi (DashboardShell ile aynı); arayüz TailAdmin kitinden (components/tailadmin). */}
      <body className="min-h-screen bg-gray-50 font-sans text-gray-800">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "0.875rem",
              background: "var(--ink)",
              color: "var(--bg)",
              fontSize: "0.8125rem",
              fontWeight: 500,
            },
          }}
        />
      </body>
    </html>
  );
}
