import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="min-h-screen bg-canvas font-sans text-ink">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "0.875rem",
              background: "var(--ink)",
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 500,
            },
          }}
        />
      </body>
    </html>
  );
}
