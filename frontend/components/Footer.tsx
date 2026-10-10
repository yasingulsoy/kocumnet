import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SITE_BRAND } from "@/lib/site-brand";
import { CHECKUP_URL } from "@/lib/site";
import { Wordmark } from "./LogoMark";
import { InstagramIcon } from "./icons";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, type RouteKey } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const QUICK_KEYS: RouteKey[] = ["home", "about", "services", "products", "blog", "contact"];

/** Hizmetler bölümü: hizmet sayfasındaki çapa id'leri (dilden bağımsız, sabit). */
const SERVICE_ANCHORS = [
  { id: "tercih-danismanligi", key: "tercihTitle" },
  { id: "sinav-hazirlik-materyalleri", key: "materyalTitle" },
  { id: "sinav-calisma-koclugu", key: "koclukTitle" },
  { id: "ogrenci-koclugu", key: "ogrenciTitle" },
  { id: "psikolojik-destek", key: "psikolojikTitle" },
  { id: "beslenme-danismanligi", key: "beslenmeTitle" },
] as const;

const BASLIK = "text-theme-xs font-medium tracking-wide text-gray-400 uppercase";
const BAGLANTI = "text-gray-300 transition hover:text-white hover:underline";

/*
 * Lacivert altbilgi — kitin giriş sayfasındaki marka paneliyle aynı zemin
 * (brand-950, logodaki lacivert). Kontrast: gray-300 metin 11:1, gray-400
 * başlık ve küçük yazı 6:1 (AA). Eskiden başlıklar camgöbeğiydi (3,7:1).
 */
export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  const servicesHref = localizedPath("services", locale);

  return (
    <footer className="zemin-koyu mt-auto bg-brand-950 text-gray-300">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <Link href={localizedPath("home", locale)} className="inline-flex rounded-lg" aria-label={SITE_BRAND.name}>
              <Wordmark tone="light" size="lg" />
            </Link>
            <p className="mt-5 max-w-sm text-theme-sm leading-relaxed text-gray-400">{dict.meta.siteDescription}</p>
            <a
              href={SITE_BRAND.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-3.5 text-theme-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              aria-label={`Instagram: ${SITE_BRAND.instagramHandle}`}
            >
              <InstagramIcon className="size-4" />
              <bdi>{SITE_BRAND.instagramHandle}</bdi>
            </a>
          </div>

          <nav aria-label={dict.footer.quickLinks}>
            <h2 className={BASLIK}>{dict.footer.quickLinks}</h2>
            <ul className="mt-5 space-y-3 text-theme-sm">
              {QUICK_KEYS.map((key) => (
                <li key={key}>
                  <Link href={localizedPath(key, locale)} className={BAGLANTI}>
                    {dict.nav[key]}
                  </Link>
                </li>
              ))}
              {CHECKUP_URL ? (
                <li>
                  <a href={CHECKUP_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${BAGLANTI}`}>
                    {dict.nav.checkup}
                    <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                    <span className="sr-only"> ({dict.nav.opensInNewTab})</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>

          <nav aria-label={dict.footer.servicesTitle}>
            <h2 className={BASLIK}>{dict.footer.servicesTitle}</h2>
            <ul className="mt-5 space-y-3 text-theme-sm">
              {SERVICE_ANCHORS.map((item) => (
                <li key={item.id}>
                  <Link href={`${servicesHref}#${item.id}`} className={BAGLANTI}>
                    {dict.services[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className={BASLIK}>{dict.footer.contactTitle}</h2>
            <address className="mt-5 space-y-4 text-theme-sm leading-relaxed not-italic">
              <p>
                <span className="block text-theme-xs text-gray-400">{dict.contact.email}</span>
                <a
                  href={`mailto:${SITE_BRAND.email}`}
                  className="font-medium text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
                >
                  {SITE_BRAND.email}
                </a>
              </p>
              <p>
                <span className="block text-theme-xs text-gray-400">{dict.contact.location}</span>
                {SITE_BRAND.addressLocality}, {dict.nav.country}
              </p>
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-theme-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {SITE_BRAND.name}. {dict.footer.rights}
          </p>
          <p>{dict.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
