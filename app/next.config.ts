import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /*
       * Varsayılan 1 MB. Geometri şekli olarak telefonla çekilmiş bir fotoğraf
       * rahatlıkla 4-5 MB tutuyor ve sınır aşılınca yükleme sessizce reddediliyor.
       *
       * Sınır HAM gövdeye uygulanır (multipart sınırları ve alan başlıkları
       * dahil), o yüzden kabul ettiğimiz 8 MB dosyanın üstünde pay bırakıyoruz.
       * Dosya boyutu ayrıca lib/actions/media.ts içinde de denetleniyor.
       */
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
