/*
 * Uyarlama: TailAdmin Free (MIT) — layout/AppSidebar.tsx'teki NavItem türü
 * ve isActive kuralı.
 *
 * Etkin öğe: adresle eşleşen EN UZUN bağlantı. "/admin/mesajlar/sablonlar"
 * açıkken hem "Mesajlar" hem "Hazır yanıtlar" yanmasın. `exact`: yalnızca
 * tam eşleşme (genel bakış gibi kök adresler). `match`: öğeyi etkin yapan ek
 * adres önekleri (menüde kendi öğesi olmayan sayfa, ör. sonuç ekranı
 * "Gelişim"i yaksın); uzunluk karşılaştırmasında eşleşen önek sayılır.
 */
import type { ReactNode } from "react";

export interface NavSubItem {
  href: string;
  label: string;
  badge?: ReactNode;
  exact?: boolean;
  /** Site dışı bağlantı (<a>, yanında ↗). */
  external?: boolean;
  /** Bu bağlantıyı da etkin yapan adres önekleri ("/sonuc" gibi). */
  match?: string[];
}

export interface NavItem {
  label: string;
  /** Alt menüsü olan öğede yok: başlık akordeonu açar. */
  href?: string;
  /** Öğe olarak (<FileText />) — sunucudan da geçebilsin diye bileşen değil. */
  icon?: ReactNode;
  /** Etiketin sonunda sayı (okunmamış mesaj gibi). Dar çubukta nokta olur. */
  badge?: ReactNode;
  exact?: boolean;
  external?: boolean;
  /** Bu bağlantıyı da etkin yapan adres önekleri ("/sonuc" gibi). */
  match?: string[];
  children?: NavSubItem[];
}

export interface NavSection {
  /** Bölüm başlığı (büyük harf, gri); yoksa başlıksız. */
  title?: string;
  items: NavItem[];
}

interface Aday {
  href?: string;
  exact?: boolean;
  external?: boolean;
  match?: string[];
}

function eslesir(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href.endsWith("/") ? href : href + "/");
}

/** Adayın adresle eşleşen en uzun öneki; eşleşmiyorsa -1. */
function eslesmeUzunlugu(pathname: string, a: Aday): number {
  let uzunluk = a.href && eslesir(pathname, a.href, a.exact) ? a.href.length : -1;
  for (const m of a.match ?? []) if (eslesir(pathname, m)) uzunluk = Math.max(uzunluk, m.length);
  return uzunluk;
}

/** Bağlantılar arasında adrese en uzun eşleşenin href'i (alt sekme çubuğu da kullanır). */
export function enUzunEslesen(pathname: string, adaylar: Aday[]): string | null {
  let en: string | null = null;
  let enUzunluk = -1;
  for (const a of adaylar) {
    if (!a.href || a.external) continue;
    const uzunluk = eslesmeUzunlugu(pathname, a);
    if (uzunluk > enUzunluk) {
      en = a.href;
      enUzunluk = uzunluk;
    }
  }
  return en;
}

/** Bütün menüde adrese en uzun eşleşen bağlantı. */
export function etkinBaglanti(pathname: string, bolumler: NavSection[]): string | null {
  return enUzunEslesen(
    pathname,
    bolumler.flatMap((b) => b.items.flatMap((o) => [o, ...(o.children ?? [])]))
  );
}
