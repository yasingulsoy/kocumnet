/**
 * "Bu hafta" ekranının kuralları — saf modül (veri bu-hafta.ts'te toplanır).
 * Koçun pazartesi sabahı sorusu: kime ne yapmalıyım? Satır öğrenci; önce
 * müdahale gerekenler. Test: app/scripts/koc-panel-test.mts.
 */

import { oranaSayilir } from "./grup-kurallari";
import { RISK_ESIK, type RiskBulgusu, type RiskOdevi } from "./risk";
import { tamamlandiMi } from "./shared/odev";

const GUN = 86_400_000;

export interface BuHaftaSatiri {
  id: string;
  name: string;
  email: string;
  sonEtkinlik: Date;
  /** Bu hafta (pazartesi 00:00 Türkiye'den beri) işaretlenen soru; "Bilmiyorum" ve boş sayılmaz. */
  haftaSoru: number;
  /** Son RISK_ESIK.odevPencereGun günde süresi dolan ödevler: tamamlanan / sayılan. */
  gecenOdev: { tamamlayan: number; sayilan: number };
  /** Son tarihi gelmemiş ödevler: hepsi ve henüz bitirmedikleri. */
  acikOdev: { toplam: number; bekleyen: number };
  /** Bu haftanın planı: biten / toplam iş; plan yoksa null. */
  plan: { biten: number; toplam: number } | null;
  bulgular: RiskBulgusu[];
  /** risk.ts riskPuani. */
  puan: number;
  /** Cevap bekleyen "Koça sor" soruları. */
  bekleyenSoru: number;
}

/** Son pencerede süresi dolan ödevler: tamamlayan (geç dahil) / sayılan (son tarihten önce katılmış). */
export function gecenOdevOzeti(odevler: readonly RiskOdevi[], now: Date): { tamamlayan: number; sayilan: number } {
  const alt = now.getTime() - RISK_ESIK.odevPencereGun * GUN;
  let tamamlayan = 0;
  let sayilan = 0;
  for (const o of odevler) {
    const son = o.dueAt.getTime();
    if (son >= now.getTime() || son < alt || !oranaSayilir({ createdAt: o.katildi }, o)) continue;
    sayilan += 1;
    if (tamamlandiMi(o.durum)) tamamlayan += 1;
  }
  return { tamamlayan, sayilan };
}

/** Açık ödevler: son tarihi henüz gelmemiş; bekleyen = henüz tamamlamadığı. */
export function acikOdevOzeti(odevler: readonly RiskOdevi[], now: Date): { toplam: number; bekleyen: number } {
  const acik = odevler.filter((o) => o.dueAt.getTime() >= now.getTime());
  return { toplam: acik.length, bekleyen: acik.filter((o) => !tamamlandiMi(o.durum)).length };
}

/**
 * Müdahale gerekir: en az bir risk bulgusu ya da süresi dolup yapılmamış ödev
 * (ikincisi risk.ts'in "Ödevi yapmadı" bulgusuyla aynı pencere ve kural;
 * bulgusu olmadan ödev açığı olan satır kalmasın diye ayrıca bakılıyor).
 */
export function mudahaleGerekir(s: Pick<BuHaftaSatiri, "bulgular" | "gecenOdev">): boolean {
  return s.bulgular.length > 0 || s.gecenOdev.sayilan > s.gecenOdev.tamamlayan;
}

const ADA_GORE = new Intl.Collator("tr-TR", { sensitivity: "base" });

/**
 * Sıra: önce müdahale gerekenler — risk puanı (en ciddi bulgu), sonra
 * yapılmamış ödev sayısı, sonra en uzun süredir sessiz olan. Geri kalanlar
 * ada göre: o öğrenciler için sıranın bir anlamı yok, koç adı arar.
 */
export function buHaftaSirala<T extends BuHaftaSatiri>(satirlar: readonly T[]): T[] {
  const yapilmayan = (s: BuHaftaSatiri) => s.gecenOdev.sayilan - s.gecenOdev.tamamlayan;
  return [...satirlar].sort((a, b) => {
    const ma = mudahaleGerekir(a);
    const mb = mudahaleGerekir(b);
    if (ma !== mb) return ma ? -1 : 1;
    if (ma) {
      return (
        b.puan - a.puan ||
        yapilmayan(b) - yapilmayan(a) ||
        a.sonEtkinlik.getTime() - b.sonEtkinlik.getTime() ||
        ADA_GORE.compare(a.name, b.name)
      );
    }
    return ADA_GORE.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}
