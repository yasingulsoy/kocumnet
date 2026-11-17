import type { NextConfig } from "next";

/**
 * Check-up paneli. Tarayıcı yalnızca bu uygulamayla konuşur; backend'e
 * sunucudan gidilir (lib/backend.ts). Dosya yüklemeleri (soru görseli,
 * Excel) server action değil route handler'dan geçer (app/api/**): server
 * action gövde sınırı 1 MB, görsel 10 MB'a kadar çıkabiliyor.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,

  // next/image'in görsel iyileştirme ucu kullanılmıyor (soru görselleri
  // /medya'dan düz <img> ile gelir). Kapalı tutmak saldırı yüzeyini küçültür.
  images: { unoptimized: true },

  experimental: {
    // proxy.ts yükleme rotalarını (/api/**) dışarıda bırakıyor; yine de
    // gövde ara belleği görsel sınırının (10 MB) altında kalmasın.
    proxyClientMaxBodySize: "12mb",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Panel arama motorlarına kapalı (robots.ts ve metadata ile birlikte).
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
