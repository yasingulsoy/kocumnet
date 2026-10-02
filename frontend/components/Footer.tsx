import Link from "next/link";
import { SITE_BRAND } from "@/lib/site-brand";
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

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  const servicesHref = localizedPath("services", locale);

  return (
    <footer className="mt-auto border-t border-line bg-brand-deep text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          <div className="lg:col-span-1">
            <Link href={localizedPath("home", locale)} className="inline-flex" aria-label={SITE_BRAND.name}>
              <Wordmark tone="light" size="lg" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/80">
              {dict.meta.siteDescription}
            </p>
            <div className="mt-6 flex gap-4 text-white/90">
              <a
                href={SITE_BRAND.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition hover:text-white"
                aria-label="Instagram"
              >
                <InstagramIcon className="size-5" />
                <span className="text-sm">{SITE_BRAND.instagramHandle}</span>
              </a>
            </div>
          </div>

          <nav aria-label={dict.footer.quickLinks}>
            <h2 className="text-micro font-semibold uppercase tracking-[0.18em] text-brand-bright">
              {dict.footer.quickLinks}
            </h2>
            <ul className="mt-5 space-y-3 text-sm">
              {QUICK_KEYS.map((key) => (
                <li key={key}>
                  <Link
                    href={localizedPath(key, locale)}
                    className="text-white/85 transition hover:text-white hover:underline"
                  >
                    {dict.nav[key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={dict.footer.servicesTitle}>
            <h2 className="text-micro font-semibold uppercase tracking-[0.18em] text-brand-bright">
              {dict.footer.servicesTitle}
            </h2>
            <ul className="mt-5 space-y-3 text-sm">
              {SERVICE_ANCHORS.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${servicesHref}#${item.id}`}
                    className="text-white/85 transition hover:text-white hover:underline"
                  >
                    {dict.services[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-micro font-semibold uppercase tracking-[0.18em] text-brand-bright">
              {dict.footer.contactTitle}
            </h2>
            <address className="mt-5 space-y-4 text-sm not-italic leading-relaxed text-white/85">
              <p>
                <span className="block text-white/60">{dict.contact.email}</span>
                <a href={`mailto:${SITE_BRAND.email}`} className="text-brand-bright hover:underline">
                  {SITE_BRAND.email}
                </a>
              </p>
              <p>
                <span className="block text-white/60">{dict.contact.location}</span>
                {SITE_BRAND.addressLocality}, {dict.nav.country}
              </p>
            </address>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-caption text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {SITE_BRAND.name}. {dict.footer.rights}
          </p>
          <p className="text-white/55">{dict.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
