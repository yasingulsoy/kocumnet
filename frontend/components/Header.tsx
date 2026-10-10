import Link from "next/link";
import { ArrowUpRight, BookOpen, Briefcase, Building2, House, Mail, MapPin, Newspaper } from "lucide-react";
import { SITE_BRAND } from "@/lib/site-brand";
import { CHECKUP_URL } from "@/lib/site";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, type RouteKey } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ExternalButton } from "./ui";
import { Wordmark } from "./LogoMark";
import { InstagramIcon } from "./icons";
import { HeaderNav, type HeaderNavItem } from "./HeaderNav";
import { LanguageMenu } from "./LanguageMenu";

const NAV: { key: RouteKey; icon: React.ReactNode }[] = [
  { key: "home", icon: <House aria-hidden /> },
  { key: "about", icon: <Building2 aria-hidden /> },
  { key: "services", icon: <Briefcase aria-hidden /> },
  { key: "products", icon: <BookOpen aria-hidden /> },
  { key: "blog", icon: <Newspaper aria-hidden /> },
  { key: "contact", icon: <Mail aria-hidden /> },
];

/**
 * Site başlığı: ince lacivert marka şeridi (konum · e-posta · check-up ·
 * Instagram · dil) ve beyaz ana çubuk (logo · menü · iletişim). TailAdmin'in
 * üst çubuğu gibi: h-16, lg'de h-18, alt kenarlık; menü öğeleri kitin
 * menu-item tonlarında. lg altında menü yan çekmeceye iner.
 *
 * SUNUCU bileşeni: logo, şerit ve düğmeler HTML olarak gelir, JavaScript'e
 * girmez. Yalnızca iki küçük istemci parçası var: HeaderNav (etkin bağlantı,
 * çekmece) ve LanguageMenu (kitin açılır menüsü). Çekmecedeki ikonlar ve
 * düğmeler de burada çizilip prop olarak verilir.
 *
 * Eskiden kaydırınca gölgelenen başlık JS ile izleniyordu; TailAdmin'deki
 * gibi sabit alt kenarlık yeterli, kaydırma dinleyicisi yok.
 *
 * Yükseklik (40 + 64/72 px) globals.css'teki scroll-padding-top ile bağlı.
 */
export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items: HeaderNavItem[] = NAV.map(({ key, icon }) => ({
    key,
    href: localizedPath(key, locale),
    label: dict.nav[key],
    icon,
    exact: key === "home",
  }));
  const iletisim = localizedPath("contact", locale);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      {/* Marka şeridi — telefonda tek sıra: konum gizlenir, Instagram ikon kalır. */}
      <div className="zemin-koyu bg-brand-950 text-theme-sm text-gray-300">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-3 px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <MapPin className="size-3.5 shrink-0 text-gray-400" aria-hidden />
              {SITE_BRAND.addressLocality}, {dict.nav.country}
            </span>
            <a href={`mailto:${SITE_BRAND.email}`} className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-white">
              <Mail className="size-3.5 shrink-0 text-gray-400" aria-hidden />
              <bdi className="truncate">{SITE_BRAND.email}</bdi>
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Check-up uygulaması adresi tanımlıysa her sayfadan bir tık uzakta. */}
            {CHECKUP_URL ? (
              <a
                href={CHECKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1 font-medium text-white transition hover:underline md:inline-flex"
              >
                {dict.nav.checkup}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                <span className="sr-only"> ({dict.nav.opensInNewTab})</span>
              </a>
            ) : null}
            <a
              href={SITE_BRAND.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-white"
              aria-label={`Instagram: ${SITE_BRAND.instagramHandle}`}
            >
              <InstagramIcon className="size-3.5" />
              <bdi className="hidden sm:inline">{SITE_BRAND.instagramHandle}</bdi>
            </a>
            <LanguageMenu locale={locale} label={dict.nav.language} />
          </div>
        </div>
      </div>

      {/* Ana çubuk */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:h-18">
        <Link href={localizedPath("home", locale)} className="shrink-0 rounded-lg" aria-label="Koçum.Net">
          <Wordmark size="lg" />
        </Link>

        <HeaderNav
          locale={locale}
          items={items}
          logo={<Wordmark />}
          homeHref={localizedPath("home", locale)}
          labels={{ menu: dict.nav.menu, close: dict.nav.close, language: dict.nav.language }}
          cta={
            <ButtonLink href={iletisim} className="max-lg:hidden">
              {dict.nav.contact}
            </ButtonLink>
          }
          drawerActions={
            <>
              <ButtonLink href={iletisim} size="md" block>
                {dict.nav.contact}
              </ButtonLink>
              {CHECKUP_URL ? (
                <ExternalButton
                  href={CHECKUP_URL}
                  newTabLabel={dict.nav.opensInNewTab}
                  variant="soft"
                  size="md"
                  block
                  endIcon={<ArrowUpRight className="rtl:-scale-x-100" aria-hidden />}
                >
                  {dict.nav.checkup}
                </ExternalButton>
              ) : null}
            </>
          }
        />
      </div>
    </header>
  );
}
