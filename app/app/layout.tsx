import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

/*
 * ⚠️ "latin-ext" ŞART: Google Fonts'un `latin` alt kümesinde ğ Ğ ş Ş İ ı YOK.
 * next/font istenmeyen alt kümeyi dosyadan attığı için tarayıcı bu harfleri
 * yedek fontla çiziyordu — "Gelişim", "Başarı", "Çözülen" gibi kelimelerin
 * ortasında harf harf font değişiyordu. Türkçe bir üründe en görünür kusur.
 */
/*
 * Üç yüzeyde (site, check-up, panel) aynı çift: Poppins başlık, Inter gövde.
 * Değişken adları tokens.css'teki --font-sans / --font-display tarafından
 * okunur; Geist kaldırıldı.
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"),
  applicationName: "Koçum.Net Check-up",
  title: {
    default: "Matematik Check-up · Koçum.Net",
    template: "%s · Koçum.Net Check-up",
  },
  description:
    "Kısa bir matematik testiyle seviyeni ölç, zayıf konularını gör ve nereden çalışman gerektiğini öğren.",
  // Check-up bir uygulama, pazarlama sayfası değil: arama motorlarına açılacak
  // yüzey /kocum.net; burası giriş gerektiriyor.
  robots: { index: false, follow: false },
  // Arama motoruna kapalı ama bağlantı WhatsApp'tan paylaşılıyor: önizleme
  // görseli app/opengraph-image.png (design/brand'den, sync ile gelir).
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Koçum.Net",
    title: "Matematik Check-up · Koçum.Net",
    description: "Net kaç değil, nerede eksiğin var? 20 dakikalık bir testle hangi konuda zayıf olduğunu gör.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  /*
   * Panelin zemin rengi. Eskiden lacivert (#17305e) yazıyordu: Android'de
   * durum çubuğu lacivert, hemen altındaki uygulama çubuğu beyaz oluyor ve
   * ekranın tepesinde sebepsiz bir şerit kalıyordu.
   */
  themeColor: "#f4f6fb",
  /*
   * viewport-fit=cover OLMADAN iOS'ta env(safe-area-inset-bottom) sıfır döner
   * ve .pb-safe hiçbir şey yapmaz — alt sekme çubuğu ile sınavdaki "Sonraki"
   * düğmesi iPhone ev çubuğunun altında kalıyordu.
   */
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${poppins.variable} antialiased`}
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
      <body className="min-h-screen bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
