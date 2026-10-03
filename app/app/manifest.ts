import type { MetadataRoute } from "next";

/**
 * Ana ekrana ekle: öğrencilerin çoğu telefondan giriyor. Tam ekran (standalone)
 * açılır; zemin rengi panel tuvaliyle aynı ki açılış karesi beyaz çakmasın.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koçum.Net Matematik Check-up",
    short_name: "Check-up",
    description: "Kısa bir matematik testiyle seviyeni ölç, zayıf konularını gör, bu hafta ne çalışacağını öğren.",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#f4f6fb",
    lang: "tr",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
