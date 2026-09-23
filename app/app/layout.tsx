import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

/*
 * ⚠️ "latin-ext" ŞART: Google Fonts'un `latin` alt kümesinde ğ Ğ ş Ş İ ı YOK.
 * next/font istenmeyen alt kümeyi dosyadan attığı için tarayıcı bu harfleri
 * yedek fontla çiziyordu — "Gelişim", "Başarı", "Çözülen" gibi kelimelerin
 * ortasında harf harf font değişiyordu. Türkçe bir üründe en görünür kusur.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
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
