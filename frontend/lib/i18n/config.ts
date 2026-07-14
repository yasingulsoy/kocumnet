/**
 * Dil yapılandırması — hem sunucu hem istemci tarafında kullanılabilir (dictionary import etmez).
 */
export const LOCALES = ["tr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

/** Türkçe varsayılan: kökte servis edilir (/hizmetlerimiz), prefix almaz. */
export const DEFAULT_LOCALE: Locale = "tr";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  tr: "ltr",
  en: "ltr",
  ar: "rtl",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  ar: "العربية",
};

/** Open Graph / hreflang için tam dil kodları */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  ar: "ar",
};

export const LOCALE_OG: Record<Locale, string> = {
  tr: "tr_TR",
  en: "en_US",
  ar: "ar_AR",
};

/** Tarih biçimlendirme için */
export const LOCALE_INTL: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  ar: "ar-EG",
};

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return LOCALE_DIR[locale];
}
