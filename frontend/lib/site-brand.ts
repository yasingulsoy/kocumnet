/**
 * Marka ve iletişim — Header, Footer ve Schema.org için tek kaynak.
 */
export const SITE_BRAND = {
  name: "Koçum.Net",
  tagline: "Sınava kadar aklında",
  email: "bilgi@kocum.net",
  /** Boş bırakılırsa iletişim sayfasında gösterilmez */
  phone: "" as string,
  /** Çevrimiçi görünürlük / snippet için */
  addressLocality: "İstanbul",
  addressCountry: "TR",
  descriptionShort:
    "Sınav hazırlık koçluğu: tercih danışmanlığı, mega soru kütüphanesi, sistemli tekrar ve birebir takiple öğrendiğiniz bilgileri sınava kadar aklınızda tutuyoruz.",
  instagramHandle: "@kocum_net",
  social: {
    instagram: "https://www.instagram.com/kocum_net/",
  },
} as const;

export const FOOTER_NAV = {
  quick: [
    { href: "/", label: "Ana Sayfa" },
    { href: "/hizmetlerimiz", label: "Hizmetlerimiz" },
    { href: "/blog", label: "Blog" },
    { href: "/iletisim", label: "İletişim" },
  ],
  hizmetler: [
    { href: "/hizmetlerimiz#tercih-danismanligi", label: "Tercih Danışmanlığı" },
    { href: "/hizmetlerimiz#sinav-hazirlik-materyalleri", label: "Sınav Hazırlık Materyalleri" },
    { href: "/hizmetlerimiz#sinav-calisma-koclugu", label: "Sınav Çalışma Koçluğu" },
    { href: "/hizmetlerimiz#ogrenci-koclugu", label: "Öğrenci Koçluğu" },
    { href: "/hizmetlerimiz#psikolojik-destek", label: "Psikolojik Destek" },
    { href: "/hizmetlerimiz#beslenme-danismanligi", label: "Beslenme Danışmanlığı" },
  ],
} as const;
