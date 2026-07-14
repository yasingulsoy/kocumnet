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
  images: {
    remotePatterns,
  },
};

export default nextConfig;
