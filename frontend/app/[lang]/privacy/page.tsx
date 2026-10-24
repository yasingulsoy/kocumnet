import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { SayfaYoluJsonLd } from "@/components/JsonLd";
import { Container, Section } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { sayfaMetadata } from "@/lib/seo";
import { languageAlternates, localizedPath } from "@/lib/routes";
import { CHECKUP_URL } from "@/lib/site";
import { SITE_BRAND } from "@/lib/site-brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);

  return sayfaMetadata({
    lang,
    title: t.privacy.title,
    description: t.privacy.metaDescription,
    path: localizedPath("privacy", lang),
    languages: languageAlternates("privacy"),
  });
}

const BASLIK = "font-display mt-12 text-xl font-semibold text-gray-800";
const METIN = "mt-3 text-base leading-relaxed text-gray-700";
const LISTE = "mt-3 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700";
const BAGLANTI = "font-medium text-brand-500 underline-offset-2 hover:underline";

/** Metindeki {email} yer tutucusunu iletişim adresine bağlantı yapar. */
function epostaIle(metin: string): ReactNode {
  const [once, sonra] = metin.split("{email}");
  if (sonra === undefined) return metin;
  return (
    <>
      {once}
      <a href={`mailto:${SITE_BRAND.email}`} className={BAGLANTI}>
        {SITE_BRAND.email}
      </a>
      {sonra}
    </>
  );
}

/*
 * Sitenin gizlilik sayfası (kocum.net). Check-up'ın kendi metni ayrı:
 * checkup.kocum.net/gizlilik (app/app/gizlilik/page.tsx).
 *
 * Metindeki her olgu kodda doğrulandı, kaynağı yanında:
 *  - Form alanları: backend/routes/contact.js (ContactForm telefon sormuyor).
 *  - Saklama: backend/utils/contactMessages.js (CONTACT_RETENTION_DAYS, varsayılan
 *    730; spam 90; bekleyene dokunulmaz). Süre değişirse privacy.retention da değişir.
 *  - Otomatik yanıt: backend/utils/mailer.js sendContactAutoReply (içerik yok, 24 saatte bir).
 *  - Hız sınırı: backend/middleware/rateLimits.js contactLimiter (saatte 5, bellekte).
 *  - Çerez: yalnızca personel oturumu lib/admin/auth.ts (admin_access_token, 6 saat).
 *    Canlıda ziyaretçiye Set-Cookie dönmüyor (22 Ekim 2026'da bakıldı).
 *  - Yazı tipleri next/font ile derlemede gömülür; görseller /images ve api.kocum.net/uploads.
 *
 * HUKUK: veri sorumlusunun tam unvanı ve adresi yazılmadı ("Koçum.Net" ve
 * iletişim adresi). Her veri grubu için işlemenin hukuki sebebi (KVKK m.5)
 * ve yurt dışına aktarımın dayanağı (KVKK m.9: Cloudflare, e-posta gönderim
 * hizmeti) hukukçudan gelecek; sağlayıcıların adı/ülkesi ve sunucunun
 * barındırma sağlayıcısı kullanıcıyla netleşmeli.
 * HUKUK: Cloudflare panelden güvenlik ya da analiz özelliği (bot doğrulaması,
 * Web Analytics) açılırsa Cloudflare kendi çerezini/betiğini ekleyebilir;
 * "çerez yok" cümlesi o gün yeniden doğrulanmalı.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const p = t.privacy;

  return (
    <main>
      <SayfaYoluJsonLd lang={lang} dict={t} sayfa="privacy" />
      <PageHero eyebrow={t.nav.privacy} title={p.heroTitle} description={p.heroSubtitle}>
        <p className="mt-4 text-theme-sm text-gray-500">{p.updated}</p>
      </PageHero>

      <Section>
        <Container>
          {/* Okuma ölçüsü: uzun metin satırı ~70 karakterde kalsın. */}
          <div className="max-w-3xl">
            <p className="text-base leading-relaxed text-gray-700">{epostaIle(p.intro)}</p>

            <h2 className={BASLIK}>{p.browseTitle}</h2>
            <ul className={LISTE}>
              {p.browse.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>

            <h2 className={BASLIK}>{p.formTitle}</h2>
            <p className={METIN}>{p.formIntro}</p>
            <ul className={LISTE}>
              {p.formFields.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className={METIN}>{p.formLimit}</p>

            <h2 className={BASLIK}>{p.whoTitle}</h2>
            <p className={METIN}>{p.whoBody}</p>

            <h2 className={BASLIK}>{p.autoReplyTitle}</h2>
            <p className={METIN}>{p.autoReplyBody}</p>

            <h2 className={BASLIK}>{p.retentionTitle}</h2>
            <ul className={LISTE}>
              {p.retention.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>

            <h2 className={BASLIK}>{p.providersTitle}</h2>
            <ul className={LISTE}>
              {p.providers.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>

            <h2 className={BASLIK}>{p.cookiesTitle}</h2>
            <p className={METIN}>{p.cookiesBody}</p>

            <h2 className={BASLIK}>{p.checkupTitle}</h2>
            <p className={METIN}>
              {p.checkupBody}
              {CHECKUP_URL ? (
                <>
                  {" "}
                  <a
                    href={`${CHECKUP_URL}/gizlilik`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 ${BAGLANTI}`}
                  >
                    {p.checkupLink}
                    <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                    <span className="sr-only"> ({t.nav.opensInNewTab})</span>
                  </a>
                </>
              ) : null}
            </p>

            <h2 className={BASLIK}>{p.rightsTitle}</h2>
            <p className={METIN}>{epostaIle(p.rightsBody)}</p>
          </div>
        </Container>
      </Section>
    </main>
  );
}
