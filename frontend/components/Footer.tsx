import Link from "next/link";
import type { SVGProps } from "react";
import { SITE_BRAND } from "@/lib/site-brand";
import { LogoMark } from "./LogoMark";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, type RouteKey } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function IconInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const QUICK_KEYS: RouteKey[] = ["home", "about", "services", "blog", "contact"];

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
    <footer className="mt-auto border-t border-[#1a5fb4]/15 bg-[#17305e] text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-14 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          <div className="lg:col-span-1">
            <Link href={localizedPath("home", locale)} className="inline-flex items-center gap-3">
              <LogoMark className="h-11 w-11 shrink-0" />
              <span className="font-sans text-xl font-bold tracking-tight">{SITE_BRAND.name}</span>
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
                <IconInstagram className="h-5 w-5" />
                <span className="text-sm">{SITE_BRAND.instagramHandle}</span>
              </a>
            </div>
          </div>

          <nav aria-label={dict.footer.quickLinks}>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#6eb3f7]">
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
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#6eb3f7]">
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
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#6eb3f7]">
              {dict.footer.contactTitle}
            </h2>
            <address className="mt-5 space-y-4 text-sm not-italic leading-relaxed text-white/85">
              <p>
                <span className="block text-white/60">{dict.contact.email}</span>
                <a href={`mailto:${SITE_BRAND.email}`} className="text-[#9dcbf9] hover:underline">
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

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-[13px] text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {SITE_BRAND.name}. {dict.footer.rights}
          </p>
          <p className="text-white/55">{dict.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
