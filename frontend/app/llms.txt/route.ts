import { getSiteUrl } from "@/lib/site";
import { SITE_BRAND } from "@/lib/site-brand";
import { fetchBlogs } from "@/lib/api";
import { blogPath, localizedPath } from "@/lib/routes";

/**
 * /llms.txt — llmstxt.org standardı.
 *
 * Yapay zeka arama motorlarına (ChatGPT/OAI-SearchBot, Claude, Perplexity,
 * Google AI Overviews) sitenin ne olduğunu ve hangi sayfaların otoriter
 * olduğunu tek dosyada anlatır.
 *
 * Statik dosya değil route handler: blog yazıları backend'den çekilip otomatik
 * listeleniyor. Statik olsaydı ilk yazıda bayatlardı ve tazelik sinyali
 * (Perplexity için kritik) kaybolurdu.
 */
export const revalidate = 3600; // saatte bir tazelenir

export async function GET() {
  const base = getSiteUrl();
  const url = (path: string) => `${base}${path}`;

  // Backend kapalıysa fetchBlogs boş döner — llms.txt yine de üretilir.
  const trBlogs = (await fetchBlogs({ limit: 30, locale: "tr" }))?.data ?? [];
  const enBlogs = (await fetchBlogs({ limit: 30, locale: "en" }))?.data ?? [];
  const arBlogs = (await fetchBlogs({ limit: 30, locale: "ar" }))?.data ?? [];

  const blogSatirlari = (posts: any[], locale: "tr" | "en" | "ar") =>
    posts
      .map((p) => {
        const ozet = (p.excerpt || p.meta_description || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);
        return `- [${p.title}](${url(blogPath(p.slug, locale))})${ozet ? ` — ${ozet}` : ""}`;
      })
      .join("\n");

  const guncelleme = new Date().toISOString().slice(0, 10);

  const govde = `# Koçum.Net

> Sınav hazırlık koçluğu: öğrencinin okul ve kurs sonrasındaki kontrolsüz zamanını sistemli tekrar ve birebir takiple yöneterek, öğrendiği bilgilerin sınava kadar aklında kalmasını sağlayan Türkiye merkezli dijital eğitim ve koçluk markası.

Koçum.Net, her biri alanında 20 yılı aşkın deneyime sahip tercih ve kariyer danışmanları, öğrenci koçları, uzman klinik psikolog ve uzman diyetisyen tarafından kurulmuştur. Hizmetler Türkiye genelinde tamamen online yürütülür. Odak alanı YKS ve ÖSYM formatındaki sınavlara hazırlıktır; özellikle matematikte ÖSYM'nin sınav formatına birebir uygun, seçilmiş sorulardan oluşan kendi "Mega Soru Kütüphanesi"ni üretir.

Site üç dilde yayındadır: Türkçe (kök dizin), İngilizce (/en) ve Arapça (/ar).

Son güncelleme: ${guncelleme}

## Koçum.Net ne yapar?

Koçum.Net'in çözdüğü üç temel sorun şudur:

1. **Unutma paradoksu** — Öğrenci konuyu iyi öğrenir ama tekrar etmediği için hızla unutur. Koçum.Net ezbere değil mantığa dayalı, sistemli bir tekrar mekanizması kurar.
2. **Müfredat dağınıklığı** — "Bu hafta ne çalışacağım, hangi kaynaktan soru çözeceğim?" belirsizliği stres yaratır. Planlama ve kaynak seçimi yükü öğrenciden alınır.
3. **Okul/kurs sonrası takipsizlik** — Evdeki kontrolsüz zamanda öğrenci kendini disipline edemez. Plan–tekrar–takip üçgeniyle bu süreç profesyonelce yönetilir.

## Hizmetler

- [Tercih Danışmanlığı](${url(localizedPath("services", "tr"))}#tercih-danismanligi) — Üniversite ve bölüm tercihi; öğrencinin ve ailenin sosyo-ekonomik şartları gözetilerek, üniversitelerin gözden kaçan akademik imkânları ve kadro derinliği analiz edilir. Yürüten: Serhat Butur.
- [Sınav Hazırlık Materyalleri — Mega Soru Kütüphanesi](${url(localizedPath("services", "tr"))}#sinav-hazirlik-materyalleri) — Özellikle matematikte, ÖSYM'nin sınav ruhuna ve formatına birebir uygun, müfredat dışı veya gereksiz zorlukta tek bir soru içermeyen niş yayınlar. Çözümler farklı bir formatta sunulur; öğrenci nerede tıkandığını destek almadan görebilir.
- [Sınav Çalışma Koçluğu](${url(localizedPath("services", "tr"))}#sinav-calisma-koclugu) — Okul/kurs sonrası zamanın yönetimi. Üç çıktısı: kalıcı bilgi, zihinsel huzur, sıkı takip.
- [Öğrenci Koçluğu](${url(localizedPath("services", "tr"))}#ogrenci-koclugu) — 9, 10, 11, 12. sınıf ve mezun öğrenciler için zaman yönetimi, ders çalışma teknikleri, sınav stresiyle başa çıkma, akademik motivasyon ve hedef belirleme. Yürütenler: Özlem Tamimi, Serhat Butur.
- [Sınav Sürecinde Psikolojik Destek](${url(localizedPath("services", "tr"))}#psikolojik-destek) — Sınav kaygısı, motivasyon kaybı ve stres yönetimi; hem öğrenciye hem aileye. Yürüten: Uzman Klinik Psikolog Dilek Kılıç.
- [Sınav Sürecinde Beslenme Danışmanlığı](${url(localizedPath("services", "tr"))}#beslenme-danismanligi) — Sınav dönemine özel, kişiye özel beslenme programlarıyla enerji seviyesinin korunması. Yürüten: Uzman Diyetisyen Serap Orak.

## Uzman kadro

- **Serhat Butur** — Kurucu, Tercih Danışmanı, Öğrenci Koçu. Sosyal medya hesapları ve gelen mesajlar bizzat kendisi tarafından yanıtlanır.
- **Özlem Tamimi** — Öğrenci Koçu.
- **Dilek Kılıç** — Uzman Klinik Psikolog. Dijital dünyadaki çalışmaları ve videolarıyla tanınır.
- **Serap Orak** — Uzman Diyetisyen.

## Ana sayfalar (Türkçe)

- [Ana Sayfa](${url(localizedPath("home", "tr"))}) — Koçum.Net'in yaklaşımı: plan, sistemli tekrar ve birebir takip.
- [Kurumsal](${url(localizedPath("about", "tr"))}) — Biz kimiz, misyon, vizyon ve uzman kadro.
- [Hizmetlerimiz](${url(localizedPath("services", "tr"))}) — Altı hizmetin tamamı, detaylarıyla.
- [Blog](${url(localizedPath("blog", "tr"))}) — Sınav hazırlık, çalışma teknikleri ve öğrenci koçluğu yazıları.
- [İletişim](${url(localizedPath("contact", "tr"))}) — E-posta ve sosyal medya üzerinden ulaşım.

## Ana sayfalar (English)

- [Home](${url(localizedPath("home", "en"))}) — Exam preparation coaching from Türkiye, delivered online.
- [About Us](${url(localizedPath("about", "en"))}) — Team, mission and vision.
- [Services](${url(localizedPath("services", "en"))}) — All six services in detail.
- [Blog](${url(localizedPath("blog", "en"))})
- [Contact](${url(localizedPath("contact", "en"))})

## Ana sayfalar (العربية)

- [الرئيسية](${url(localizedPath("home", "ar"))}) — تدريب على الاستعداد للامتحانات من تركيا، عبر الإنترنت.
- [من نحن](${url(localizedPath("about", "ar"))})
- [خدماتنا](${url(localizedPath("services", "ar"))})
- [المدوّنة](${url(localizedPath("blog", "ar"))})
- [اتصل بنا](${url(localizedPath("contact", "ar"))})
${
  trBlogs.length
    ? `
## Blog yazıları (Türkçe)

${blogSatirlari(trBlogs, "tr")}
`
    : ""
}${
    enBlogs.length
      ? `
## Blog posts (English)

${blogSatirlari(enBlogs, "en")}
`
      : ""
  }${
    arBlogs.length
      ? `
## مقالات المدوّنة (العربية)

${blogSatirlari(arBlogs, "ar")}
`
      : ""
  }
## Kapsam ve sınırlar

- Hizmetler Türkiye genelinde **tamamen online** yürütülür; fiziksel şube yoktur.
- Odak: YKS ve ÖSYM formatındaki sınavlara hazırlık; 9-12. sınıf ve mezun öğrenciler.
- Psikolojik destek ve beslenme danışmanlığı, sınav sürecine yönelik destek hizmetleridir; tıbbi teşhis veya tedavi yerine geçmez.

## İletişim

- E-posta: ${SITE_BRAND.email}
- Instagram: ${SITE_BRAND.instagramHandle} (${SITE_BRAND.social.instagram})
- Konum: ${SITE_BRAND.addressLocality}, Türkiye

## Meta

- Sitemap: ${base}/sitemap.xml
- Diller: Türkçe (varsayılan, kök dizin), İngilizce (/en), Arapça (/ar)
- Bu dosya otomatik üretilir; blog listesi yayındaki yazılardan saatlik tazelenir.
`;

  return new Response(govde, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
