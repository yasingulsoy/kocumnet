import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOCALES, isLocale } from "@/lib/i18n/config";

/**
 * Paylaşım görseli (Open Graph / Twitter). Eskiden HİÇ yoktu: WhatsApp,
 * LinkedIn ve X'te paylaşılan her sayfa görselsiz çıkıyordu.
 *
 * Marka gradyanı + K işareti + wordmark + dile göre slogan. Yazı tipleri
 * assets/fonts altında (OFL lisanslı): Satori woff2 okumaz, TTF ister ve
 * DEĞİŞKEN (variable) fontu da okuyamıyor — Inter'in değişken dosyası
 * "reading '256'" hatasıyla düşüyordu; iki statik Poppins kesimi kullanılıyor.
 */
export const alt = "Koçum.Net";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const SLOGAN: Record<string, { ust: string; alt: string }> = {
  tr: { ust: "Sınava kadar aklında", alt: "Sınav hazırlık koçluğu · tercih danışmanlığı · matematik check-up" },
  en: { ust: "In your mind until the exam", alt: "Exam coaching · university choice counselling · math check-up" },
  /*
   * Arapça metin BİLEREK yok: Satori'de karmaşık yazı şekillendirme (harf
   * bitişmesi, sağdan sola) yok — Arapça harfler kopuk ve ters çıkıyor,
   * `direction: rtl` ise çizimi düşürüyor. Bozuk Arapça yerine İngilizce.
   */
  ar: { ust: "In your mind until the exam", alt: "Exam coaching · university choice counselling · math check-up" },
};

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const dil = isLocale(lang) ? lang : "tr";
  const s = SLOGAN[dil];
  const [kalin, normal] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Poppins-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Poppins-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundImage: "linear-gradient(135deg, #17305e 0%, #1a5fb4 55%, #0e90d5 100%)",
          color: "#fff",
          fontFamily: "Poppins",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="96" height="96" viewBox="0 0 32 32">
            <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.3)" />
            <g stroke="#fff" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M11 8.8 V 23.2" />
              <path d="M12.8 16 L 21.4 23.2" />
              <path d="M12.8 16 L 19.8 10.2" />
            </g>
            <circle cx="22.4" cy="8.6" r="2.4" fill="#fff" />
          </svg>
          <div style={{ display: "flex", fontWeight: 700, fontSize: 56, letterSpacing: -1 }}>
            Koçum<span style={{ color: "#8ecdf5" }}>.Net</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{s.ust}</div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.78)", maxWidth: 1000 }}>{s.alt}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(255,255,255,0.7)" }}>
          <span>kocum.net</span>
          <span>İstanbul</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Poppins", data: kalin, weight: 700, style: "normal" },
        { name: "Poppins", data: normal, weight: 400, style: "normal" },
      ],
    }
  );
}
