import type { NextConfig } from "next";

/*
 * Server action gövde sınırı bilerek VARSAYILANDA (1 MB): öğrenci uygulaması
 * dosya almıyor. Şekil yükleme yönetim panelinde (kocumnet/admin) ve 10 MB'lık
 * sınır oradaki next.config.ts'te.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sınav ekranı başka bir siteye gömülemez (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Sıfırlama bağlantısındaki jeton, sayfadan çıkan isteklerle sızmasın.
        source: "/sifre-sifirla/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Veli raporu: jeton adreste. Referer ile sızmasın, aranmasın.
        source: "/veli/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
