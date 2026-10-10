import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import Link from "next/link";
import { Wordmark } from "@/components/LogoMark";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import "./globals.css";

/*
 * Hiçbir rotaya uymayan adresler için 404. İki kök düzen var ([lang] ve
 * admin), bu yüzden Next'in sıradan not-found'u burada yetmiyor:
 * global-not-found düzenleri atlayıp doğrudan çizilir. O yüzden yazı tipi ve
 * stil burada yeniden kuruluyor. Görünüm kitin tam ekran hata sayfası.
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
      <body className="bg-white font-sans text-gray-600">
        <ErrorPage
          title="Sayfa bulunamadı"
          message={
            <>
              Aradığınız adres taşınmış ya da hiç var olmamış olabilir.
              <span lang="en" className="mt-1 block text-sm text-gray-500">
                The page you are looking for does not exist.
              </span>
            </>
          }
          top={
            <Link href="/" aria-label="Koçum.Net" className="rounded-lg">
              <Wordmark />
            </Link>
          }
          actions={
            <>
              <ButtonLink href="/" size="md">
                Ana sayfa
              </ButtonLink>
              <ButtonLink href="/en" hrefLang="en" lang="en" variant="outline" size="md">
                English
              </ButtonLink>
            </>
          }
          footer="kocum.net"
        />
      </body>
    </html>
  );
}
