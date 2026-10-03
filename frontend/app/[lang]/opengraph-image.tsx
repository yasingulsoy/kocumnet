import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOCALES, isLocale } from "@/lib/i18n/config";
import { BRAND_COLORS, WORDMARK } from "@/lib/brand-paths";

/**
 * Paylaşım görseli (Open Graph / X / WhatsApp / LinkedIn) — "Fosfor".
 *
 * Kâğıt zemin, logo, dile göre slogan; sloganın son kelimesi logodaki gibi
 * fosforlu kalemle çizilmiş. Logo yol verisinden çiziliyor (lib/brand-paths.ts),
 * yazı tipine bağlı değil.
 *
 * Satori TTF ister ve değişken (variable) fontu okuyamıyor: slogan için iki
 * statik Poppins kesimi assets/fonts altında. Arapça BİLEREK İngilizce:
 * Satori Arapça harfleri bitiştiremiyor, bozuk Arapça yerine İngilizce.
 */
export const alt = "Koçum.Net — Sınava kadar aklında";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const METIN: Record<string, { bas: string; son: string; alt: string }> = {
  tr: { bas: "Sınava kadar", son: "aklında.", alt: "Sınav koçluğu · tercih danışmanlığı · matematik check-up" },
  en: { bas: "In your mind until", son: "the exam.", alt: "Exam coaching · university choice counselling · math check-up" },
  ar: { bas: "In your mind until", son: "the exam.", alt: "Exam coaching · university choice counselling · math check-up" },
};

const LOGO_GEN = 380;
const LOGO_YUK = Math.round((LOGO_GEN * WORDMARK.height) / WORDMARK.width);

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = METIN[isLocale(lang) ? lang : "tr"];
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
          padding: "68px 80px",
          background: "#fffdf6",
          color: BRAND_COLORS.ink,
          fontFamily: "Poppins",
        }}
      >
        <svg width={LOGO_GEN} height={LOGO_YUK} viewBox={WORDMARK.viewBox}>
          <path d={WORDMARK.swipe} fill={BRAND_COLORS.highlight} />
          <path d={WORDMARK.koc} fill={BRAND_COLORS.ink} />
          <path d={WORDMARK.net} fill={BRAND_COLORS.ink} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: 24,
              fontWeight: 700,
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            <span>{t.bas}</span>
            <div style={{ display: "flex", position: "relative" }}>
              {/* Fosforlu kalem: metnin arkasında, hafif eğik. */}
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  right: -14,
                  top: 26,
                  bottom: -4,
                  background: BRAND_COLORS.highlight,
                  borderRadius: 6,
                  transform: "rotate(-2.5deg)",
                }}
              />
              <span style={{ position: "relative" }}>{t.son}</span>
            </div>
          </div>
          <div style={{ fontWeight: 400, fontSize: 30, color: "#5b6478" }}>{t.alt}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#5b6478" }}>
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
