/**
 * Madde analizi listesinin süzgeç, sıralama ve adres kuralları — liste
 * sayfası ve CSV dışa aktarma AYNI fonksiyonları kullanır: indirilen dosya
 * ekrandaki listenin kendisidir (sayfalama hariç).
 *
 * Saf modül (veritabanı yok); satırlar item-analysis.ts'ten gelir.
 */
import { BULGU_SIRASI, ESIK, gorunenR, type BulguKey } from "./item-flags";
import { isExamScope, type ExamScope } from "./format";
import type { ItemRow } from "./item-analysis";

export type Sutun = "oncelik" | "n" | "p" | "r" | "bos" | "sure";
export type Yon = "asc" | "desc";

/** Bir sütuna ilk tıklamada en çok işe yarayan yön: sorunlu olan üstte. */
export const ILK_YON: Record<Sutun, Yon> = { oncelik: "desc", n: "desc", p: "asc", r: "asc", bos: "desc", sure: "desc" };

export const DEGER: Record<Sutun, (x: ItemRow) => number | null> = {
  oncelik: (x) => x.oncelik,
  n: (x) => x.n,
  p: (x) => x.p,
  r: (x) => gorunenR(x),
  bos: (x) => x.blank / x.n,
  sure: (x) => (x.medianMs === null || x.targetTimeSeconds <= 0 ? null : x.medianMs / (x.targetTimeSeconds * 1000)),
};

export const MIN_SECENEK = [1, 10, ESIK.minN, 50] as const;

/** Zaman süzgeci: cevabın geldiği testin bitiş tarihi. Boş = hepsi. */
export const DONEM_SECENEK = [
  { gun: 30, ad: "Son 30 gün" },
  { gun: 90, ad: "Son 90 gün" },
  { gun: 365, ad: "Son 1 yıl" },
] as const;

export interface AnalizSuzgeci {
  konu: string;
  /** Ham bulgu parametresi ("hepsi" ya da bulgu anahtarı). */
  bulgu: string;
  bulguKey: BulguKey | null;
  sadeceBulgulu: boolean;
  minN: number;
  /** Cevapların geldiği testin sınavı (paketin sınavı). Boş = hepsi. */
  sinav: ExamScope | "";
  /** Son kaç günün testleri. null = hepsi. */
  gun: number | null;
  sirala: Sutun;
  yon: Yon;
  sayfa: number;
}

type Params = Record<string, string | string[] | undefined>;
const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function analizSuzgeci(sp: Params): AnalizSuzgeci {
  const bulgu = tek(sp.bulgu);
  // hasOwn: `in` "toString" gibi prototip adlarını da kabul ederdi.
  const sirala: Sutun = Object.hasOwn(DEGER, tek(sp.sirala)) ? (tek(sp.sirala) as Sutun) : "oncelik";
  const yonHam = tek(sp.yon);
  const sinavHam = tek(sp.sinav);
  const gunHam = Number(tek(sp.donem));
  return {
    konu: tek(sp.konu).slice(0, 100),
    bulgu: (BULGU_SIRASI as string[]).includes(bulgu) || bulgu === "hepsi" ? bulgu : "",
    bulguKey: (BULGU_SIRASI as string[]).includes(bulgu) ? (bulgu as BulguKey) : null,
    sadeceBulgulu: bulgu === "hepsi",
    minN: MIN_SECENEK.find((m) => String(m) === tek(sp.min)) ?? 1,
    sinav: isExamScope(sinavHam) ? sinavHam : "",
    gun: DONEM_SECENEK.some((d) => d.gun === gunHam) ? gunHam : null,
    sirala,
    yon: yonHam === "asc" || yonHam === "desc" ? yonHam : ILK_YON[sirala],
    sayfa: Math.max(1, Math.floor(Number(tek(sp.sayfa) || 1)) || 1),
  };
}

/** Sekme sayıları için: konu ve en az cevap süzgecinden sonra, bulgu süzgecinden önce. */
export function analizKapsami(rows: ItemRow[], s: AnalizSuzgeci): ItemRow[] {
  return rows.filter((x) => x.n >= s.minN && (!s.konu || x.topicSlug === s.konu));
}

/** Ekrandaki liste: kapsam + bulgu süzgeci + sıralama. */
export function analizListesi(rows: ItemRow[], s: AnalizSuzgeci): ItemRow[] {
  return analizKapsami(rows, s)
    .filter((x) =>
      s.bulguKey ? x.bulgular.some((b) => b.key === s.bulguKey) : s.sadeceBulgulu ? x.bulgular.length > 0 : true
    )
    .sort((a, b) => {
      const va = DEGER[s.sirala](a);
      const vb = DEGER[s.sirala](b);
      // Değeri olmayan (az veride r, hiç işaretlenmemişte süre) her yönde sonda.
      if (va === null && vb === null) return b.n - a.n;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (s.yon === "asc" ? va - vb : vb - va) || b.n - a.n;
    });
}

/**
 * Süzgeci adrese yazar (varsayılanlar atılır). `ek` ile alan değiştirilir;
 * undefined verilen alan adresten çıkar.
 */
export function analizParametreleri(
  s: AnalizSuzgeci,
  ek: Partial<Record<"konu" | "bulgu" | "min" | "sinav" | "donem" | "sirala" | "yon" | "sayfa", string | number | undefined>> = {}
): Record<string, string | number | undefined> {
  return {
    konu: s.konu || undefined,
    bulgu: s.bulgu || undefined,
    min: s.minN > 1 ? s.minN : undefined,
    sinav: s.sinav || undefined,
    donem: s.gun ?? undefined,
    sirala: s.sirala !== "oncelik" ? s.sirala : undefined,
    yon: s.sirala !== "oncelik" || s.yon !== "desc" ? s.yon : undefined,
    sayfa: s.sayfa > 1 ? s.sayfa : undefined,
    ...ek,
  };
}

/** Süzgeç açıklaması ("TYT · son 90 gün") — başlık ve dosya için. */
export function donemAdi(gun: number | null): string {
  return DONEM_SECENEK.find((d) => d.gun === gun)?.ad ?? "Tüm zamanlar";
}
