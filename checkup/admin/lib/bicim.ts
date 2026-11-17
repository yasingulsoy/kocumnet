/** Biçim yardımcıları (sunucu ve istemci). Saat dilimi Türkiye. */

const SAAT_DILIMI = "Europe/Istanbul";

/** 29900 → "299,00 TL"; 0 → "Ücretsiz". */
export function tl(kurus: number): string {
  if (!kurus) return "Ücretsiz";
  return `${(kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

/** Kuruşu TL alanına yazılacak metne çevirir: 29900 → "299,00". */
export function kurustanTlMetni(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Kullanıcının yazdığı TL tutarını kuruşa çevirir: "299", "299,5", "299.50",
 * "1.299,90" kabul edilir. Geçersizse null.
 */
export function tlMetnindenKurus(metin: string): number | null {
  let s = metin.trim().replace(/\s|TL|₺/gi, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Adres parçası pozitif tam sayı kimliği mi ("12" evet, "12a" ve "0" hayır). */
export function kimlikMi(v: unknown): boolean {
  return typeof v === "string" && /^[1-9]\d{0,9}$/.test(v);
}

/** Sorgu parametresinden kimlik; geçersizse null. */
export function kimlikAl(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  return kimlikMi(s) ? Number(s) : null;
}

/** Yanlış götürme oranı: 4 → "4 yanlış 1 doğru"; 0 → "Götürmez". */
export function goturmeMetni(n: number): string {
  return n > 0 ? `${n} yanlış 1 doğru` : "Götürmez";
}

export function sayi(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString("tr-TR") : "—";
}

/** Net gibi ondalıklı sayılar: en fazla iki basamak. */
export function ondalik(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—";
}

export function tarih(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { timeZone: SAAT_DILIMI, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function tarihSaat(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: SAAT_DILIMI,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 3120 → "52 dk"; 3725 → "1 sa 2 dk". */
export function sure(saniye: number | null | undefined): string {
  if (typeof saniye !== "number" || saniye < 0) return "—";
  if (saniye < 59.5) return `${Math.round(saniye)} sn`;
  // En yakın dakika (öğrencinin raporu da aynı kuralla gösterir).
  const dk = Math.round(saniye / 60);
  if (dk < 60) return `${dk} dk`;
  return dk % 60 === 0 ? `${dk / 60} sa` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
}

export function kisalt(metin: string, uzunluk = 120): string {
  const s = metin.replace(/\s+/g, " ").trim();
  return s.length > uzunluk ? `${s.slice(0, uzunluk - 1)}…` : s;
}

/** Türkçe büyük-küçük harf ve aksan farkı gözetmeyen arama anahtarı. */
export function aramaAnahtari(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export const ROL_ADI: Record<string, string> = { YONETICI: "Yönetici", EDITOR: "Editör" };

export const KAYNAK_ADI: Record<string, string> = {
  ust: "Üst menü",
  hero: "Ana sayfa girişi",
  bolum: "Sayfa bölümü",
  altbilgi: "Alt bilgi",
  blog: "Blog",
  iletisim: "İletişim",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  diger: "Diğer",
};

/** Sorgu dizesi: boş değerler atlanır. */
export function sorgu(degerler: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(degerler)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

/** Düzenlemede yalnızca değişen alanlar (PATCH gövdesi). */
export function degisenler<T extends object>(yeni: T, eski: T): Partial<T> {
  const sonuc: Partial<T> = {};
  for (const k of Object.keys(yeni) as (keyof T)[]) {
    if (yeni[k] !== eski[k]) sonuc[k] = yeni[k];
  }
  return sonuc;
}
