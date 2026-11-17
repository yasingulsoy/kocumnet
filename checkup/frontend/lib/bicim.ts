/*
 * Sayı, para, tarih ve süre biçimleri. Saf modül: sunucuda da istemcide de
 * çalışır. Saat dilimi her yerde Türkiye (sunucu UTC'de çalışabilir).
 */

const SAAT_DILIMI = "Europe/Istanbul";

const paraBicimi = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const netBicimi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const tarihBicimi = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: SAAT_DILIMI });
const tarihSaatBicimi = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SAAT_DILIMI,
});
const kisaTarihBicimi = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: SAAT_DILIMI });

/** Kuruş → "299,00 TL"; 0 → "Ücretsiz". */
export function ucret(kurus: number): string {
  if (!kurus || kurus <= 0) return "Ücretsiz";
  return `${paraBicimi.format(kurus / 100)} TL`;
}

/** 27 → "27", 27.5 → "27,5", 27.25 → "27,25". */
export function net(deger: number | null | undefined): string {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return "–";
  return netBicimi.format(deger);
}

export function tarih(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : tarihBicimi.format(d);
}

export function tarihSaat(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : tarihSaatBicimi.format(d);
}

export function kisaTarih(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : kisaTarihBicimi.format(d);
}

/** 3120 → "52 dk", 4380 → "1 sa 13 dk", 45 → "45 sn". */
export function sure(saniye: number | null | undefined): string {
  if (saniye === null || saniye === undefined || saniye < 0) return "–";
  const s = Math.round(saniye);
  if (s < 60) return `${s} sn`;
  // En yakın dakika (admin'deki rapor da aynı kuralla gösterir).
  const toplamDk = Math.round(s / 60);
  const sa = Math.floor(toplamDk / 60);
  const dk = toplamDk % 60;
  if (sa === 0) return `${dk} dk`;
  return dk === 0 ? `${sa} sa` : `${sa} sa ${dk} dk`;
}

/** Dakika → "75 dakika" / "1 saat 15 dakika" (kural ekranı). */
export function dakikaMetni(dakika: number): string {
  const sa = Math.floor(dakika / 60);
  const dk = dakika % 60;
  if (sa === 0) return `${dk} dakika`;
  return dk === 0 ? `${sa} saat` : `${sa} saat ${dk} dakika`;
}

/** Geri sayım: 4509000 → "1:15:09", 309000 → "05:09". */
export function sayac(ms: number): string {
  const toplam = Math.max(0, Math.ceil(ms / 1000));
  const sa = Math.floor(toplam / 3600);
  const dk = Math.floor((toplam % 3600) / 60);
  const sn = toplam % 60;
  const iki = (n: number) => String(n).padStart(2, "0");
  return sa > 0 ? `${sa}:${iki(dk)}:${iki(sn)}` : `${iki(dk)}:${iki(sn)}`;
}

/** Ekran okuyucu için: "1 saat 15 dakika kaldı". */
export function sayacMetni(ms: number): string {
  const toplam = Math.max(0, Math.ceil(ms / 1000));
  const sa = Math.floor(toplam / 3600);
  const dk = Math.floor((toplam % 3600) / 60);
  if (toplam < 60) return `${toplam} saniye`;
  if (sa === 0) return `${dk} dakika`;
  return dk === 0 ? `${sa} saat` : `${sa} saat ${dk} dakika`;
}

/** Yanlış götürme kuralı, kısa cümle. */
export function goturmeMetni(yanlisGoturme: number): string {
  return yanlisGoturme > 0 ? `${yanlisGoturme} yanlış 1 doğruyu götürür.` : "Yanlışlar doğruyu götürmez.";
}

/** "Ayşe Nur Yılmaz" → "Ayşe" */
export function ilkAd(adSoyad: string): string {
  return adSoyad.trim().split(/\s+/)[0] ?? adSoyad;
}
