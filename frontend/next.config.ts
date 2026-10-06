import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    pathname: "/**",
  },
];

if (backendUrl) {
  try {
    const u = new URL(backendUrl);
    remotePatterns.push({
      protocol: u.protocol.replace(":", "") as "http" | "https",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: "/uploads/**",
    });
  } catch {
    // invalid URL
  }
}

remotePatterns.push({
  protocol: "http",
  hostname: "127.0.0.1",
  port: "5000",
  pathname: "/uploads/**",
});

remotePatterns.push({
  protocol: "http",
  hostname: "localhost",
  port: "5000",
  pathname: "/uploads/**",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns,
    /*
     * Next 16'da izinli kalite listesi zorunlu (varsayılan yalnızca 75).
     * 40: ana sayfa kapanış bandının arka planı — %88 lacivert örtünün
     * altında, kalite farkı görünmüyor; dosya ~%37 küçülüyor (1920px'te
     * 96 KB → 61 KB, sharp ile ölçüldü).
     */
    qualities: [40, 75],
  },
  experimental: {
    /**
     * /admin blog editörü: kapak görseli ve base64 gömülü içerik görselleri
     * server action gövdesiyle gelir. Varsayılan 1 MB bir kapağa yetmez.
     * Backend tarafı 10 MB; pay bırakıyoruz.
     */
    serverActions: { bodySizeLimit: "12mb" },
    /**
     * Hiçbir rotaya uymayan adresler (iki kök düzen var: [lang] ve admin;
     * sıradan not-found bir düzen gerektirir). app/global-not-found.tsx
     * düzenleri atlayıp doğrudan çizilir.
     */
    globalNotFound: true,
    /**
     * İyimser yönlendirme KAPALI. İstemci /en ve /ar'dan kökte dinamik bir
     * [lang] rotası olduğunu öğrenip görmediği her tek parçalı adresi
     * (/urunlerimiz, /iletisim) "[lang] = urunlerimiz" sanıyor ve ana sayfanın
     * parçasını (/$d$lang/__PAGE__) istiyordu. proxy.ts bu adresleri
     * /tr/products'a yazdığı için o parça yok: ön yükleme 404, sayfaya geçiş
     * ön yüklemesiz. Kapalıyken istemci önce rota ağacını sunucuya soruyor
     * (yeni rota başına bir istek daha) ve doğru parçayı alıyor.
     */
    optimisticRouting: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Yönetim paneli hiçbir çerçeveye gömülmez (clickjacking).
        source: "/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
