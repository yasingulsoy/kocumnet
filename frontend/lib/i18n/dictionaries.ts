import "server-only";
import type { Locale } from "./config";

/**
 * Sözlükler yalnızca sunucuda yüklenir — istemci bundle'ına binmez.
 * (Next.js i18n rehberindeki getDictionary deseni.)
 */
const dictionaries = {
  tr: () => import("./locales/tr.json").then((m) => m.default),
  en: () => import("./locales/en.json").then((m) => m.default),
  ar: () => import("./locales/ar.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["tr"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]() as Promise<Dictionary>;
}
