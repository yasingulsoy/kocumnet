import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  experimental: {
    /**
     * Check-up şekil yükleme bir server action. Varsayılan gövde sınırı 1 MB:
     * telefonla çekilmiş bir şekil fotoğrafı bunu aşar ve yükleme sessizce
     * reddedilir. Dosya sınırı 8 MB (lib/checkup/media-image.ts); pay bırakıyoruz.
     * Toplu soru içe aktarma (.md + görseller tek istekte) da bu sınıra tabi:
     * değiştirirsen lib/checkup/import-report.ts → ISTEK_SINIRI'nı da değiştir.
     */
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  /**
   * Geliştirme: panel (:3001) ile API (:5000) farklı kökende; HttpOnly oturum
   * çerezi aynı kökene düşsün diye giriş/çıkış istekleri Next üzerinden
   * backend'e aktarılır (/api-backend → backend). Üretimde çerez
   * AUTH_COOKIE_DOMAIN=.kocum.net ile paylaşılır, yeniden yazma gerekmez.
   */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const backend =
      process.env.BACKEND_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:5000";
    return [{ source: "/api-backend/:path*", destination: `${backend.replace(/\/$/, "")}/:path*` }];
  },
};

export default nextConfig;
