import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
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
    // Geçersiz URL ise remotePatterns boş kalır.
  }
}

const nextConfig: NextConfig = {
  /**
   * Dev ortamında /api-backend ile backend'e proxy sırasında istek gövdesi için üst sınır.
   * Aksi halde multipart dosya yüklemede gövdenin yalnızca ilk ~10 MB'ı backend'e iletilirdi.
   * (Tek dosya sunucuda 50 MB'a kadar; toplu yük için daha yüksek tutuluyor.)
   * Not: middlewareClientMaxBodySize ile birlikte kullanılamaz (Next 16).
   */
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },

  /* config options here */
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
    
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  images: {
    remotePatterns,
    unoptimized: process.env.NODE_ENV === 'development',
  },

  /**
   * Geliştirme: admin (ör. :3001) ile API (:5000) farklı origin; HttpOnly çerez için
   * istekler aynı origin üzerinden proxy’lenir (/api-backend → backend).
   */
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const backend =
      process.env.BACKEND_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:5000';
    const base = backend.replace(/\/$/, '');
    return [
      { source: '/api-backend/:path*', destination: `${base}/:path*` },
      // Blog içerik görselleri HTML'de relatif /uploads/... ile saklanır; dev'de
      // editörde ve önizlemede görünmeleri için backend'e proxy'le.
      { source: '/uploads/:path*', destination: `${base}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
