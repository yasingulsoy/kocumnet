import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import Link from "next/link";
import "./globals.css";

/*
 * Hiçbir rotaya uymayan adresler için 404. İki kök düzen var ([lang] ve
 * admin), bu yüzden Next'in sıradan not-found'u burada yetmiyor:
 * global-not-found düzenleri atlayıp doğrudan çizilir. O yüzden yazı tipi ve
 * stil burada yeniden kuruluyor.
 *
 * Dil bilinmiyor (adres hiçbir dile uymadı): Türkçe + İngilizce.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin", "latin-ext"], weight: ["600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Sayfa bulunamadı · Koçum.Net",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="tr" className={`${inter.variable} ${poppins.variable} antialiased`}>
      <body className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 text-center font-sans text-ink-soft">
        <p className="font-display text-caption font-semibold uppercase tracking-[0.18em] text-brand">404</p>
        <h1 className="font-display mt-3 text-h2 font-semibold tracking-tight text-ink">Sayfa bulunamadı</h1>
        <p className="mt-2 max-w-md text-body">Aradığınız adres taşınmış ya da hiç var olmamış olabilir.</p>
        <p className="mt-1 max-w-md text-caption text-ink-faint">The page you are looking for does not exist.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-body font-semibold text-white shadow-brand transition hover:bg-brand-hover">
            Ana sayfa
          </Link>
          <Link href="/en" className="inline-flex min-h-11 items-center rounded-xl px-5 text-body font-semibold text-ink ring-1 ring-inset ring-line-strong transition hover:bg-surface-hover">
            English
          </Link>
        </div>
      </body>
    </html>
  );
}
