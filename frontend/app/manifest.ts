import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koçum.Net — Sınava kadar aklında",
    short_name: "Koçum.Net",
    description:
      "Sınav hazırlık koçluğu, tercih danışmanlığı ve özel soru kütüphanesiyle sınava kadar yanınızdayız.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a5fb4",
    lang: "tr",
    dir: "ltr",
    categories: ["education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android adaptive icon — kenarlarda güvenli alan bırakır, kırpılınca "K" kesilmez
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
