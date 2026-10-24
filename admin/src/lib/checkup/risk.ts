/**
 * Riskli öğrenci kuralları — eşiklerin TEK yeri. Saf modül: veri
 * risk-data.ts'te toplanır, burada yalnızca karar verilir. Liste koçun
 * "bu hafta kimi aramalıyım" sorusuna cevap: her bulgu bir eylem önerir.
 * Aynı bulgular üç ekranda: Riskli öğrenciler, Bu hafta ve öğrenci ayrıntısı.
 *
 * Eşikler araç içindir, öğrenciye giden bir kural değildir. Hoca ya da koç
 * değiştirmek isterse yalnızca bu dosya değişir; ekrandaki açıklamalar da
 * buradan okunur. Test: app/scripts/koc-panel-test.mts.
 */

import { oranaSayilir } from "./grup-kurallari";
import { tamamlandiMi, type OdevDurumu } from "./shared/odev";

export const RISK_ESIK = {
  /**
   * Bu kadar gündür ne giriş ne test ne alıştırma: öğrenci kopmuş olabilir.
   * Pilotta haftalık plan döngüsünün bir turu: pazartesi postasına ve
   * haftanın ödevine rağmen bir hafta dönmemiş demek (önceden 14 gündü;
   * pilotta iki hafta beklemek geç). Hocaya sorulacak. Etkinlik: son
   * etkinlik (lastSeenAt), son giriş, son biten test ve HER TÜRDEN oturumun
   * son başlama anı (alıştırma, defter tekrarı dahil).
   */
  pasifGun: 7,
  /**
   * Kayıttan bu kadar gün sonra hâlâ ÖLÇÜM sayılan test yok: tanışma testine
   * bile başlamamış ya da açıp boş/yarım kapatmış (shared/insights.ts
   * olcumDisi). Kayıt günü sayılmaz; hafta sonu kaydolana nefes payı.
   */
  baslamadiGun: 3,
  /**
   * GEÇEN HAFTANIN planında tamamlanan iş oranı bunun altındaysa. Öğrenci
   * uygulaması %50'nin altında planı kendisi küçültüyor (app/lib/plan.ts);
   * %40 "küçültülmüş planı da yapmıyor" sinyali. Bu hafta bitmediği için
   * içinde bulunulan hafta sayılmaz.
   */
  planOrani: 0.4,
  /**
   * Son iki PAKET testinin başarı oranı arasındaki düşüş (puan). Hangi testler:
   * öğrenci uygulamasının eğilim kuralı (app/lib/insights.ts egilimeGirer:
   * paket testi, ölçüm sayılan (boş ve yarım değil), öğrencinin sınavında;
   * kâğıt dahil) ve ikisi AYNI paket türünden (STANDARD, INTRO, MOCK).
   * Kontrol testleri (5 soru), seviyeli aşamalar hariç; deneme ile kısa test
   * de kıyaslanmaz: uzunluk ve zorlukları farklı. Sorgu risk-data.ts'te.
   */
  dususPuan: 10,
  /**
   * "Ödevi yapmadı": son bu kadar günde süresi dolan ve tamamlanmayan ödev
   * (geç tamamlanan yapılmış sayılır). Bir hafta: ödevin varsayılan süresi
   * (shared/odev.ts VARSAYILAN_SURE_GUN) ve koçun haftalık bakışı. Daha eski
   * yapılmamış ödev listede birikmesin; koç onu grup sayfasında görür.
   */
  odevPencereGun: 7,
} as const;

export type RiskKey = "pasif" | "odev" | "dusus" | "plan" | "baslamadi";
export type RiskTon = "bad" | "warn" | "info";

/** Süzgeç sekmeleri, açıklama kutusu ve sıralama — ciddiyet sırasıyla. */
export const RISK_META: Record<RiskKey, { baslik: string; ton: RiskTon; aciklama: string; eylem: string }> = {
  pasif: {
    baslik: "Pasif",
    ton: "bad",
    aciklama: RISK_ESIK.pasifGun + " gündür ne uygulamaya girdi ne test ya da alıştırma başlattı.",
    eylem: "Ara ya da mesaj at; plan çok mu ağır geldi, sor.",
  },
  odev: {
    baslik: "Ödevi yapmadı",
    ton: "warn",
    aciklama: "Son " + RISK_ESIK.odevPencereGun + " günde süresi dolan bir ödevi tamamlamadı.",
    eylem: "Ödevi neden yapamadığını sor; gerekirse süresini uzat.",
  },
  dusus: {
    baslik: "Düşüşte",
    ton: "warn",
    aciklama: "Hedef sınavındaki aynı türden son iki testte başarı en az " + RISK_ESIK.dususPuan + " puan düştü.",
    eylem: "Düşen konulara bak; planı o konulara daralt.",
  },
  plan: {
    baslik: "Planı yapmıyor",
    ton: "warn",
    // Sayıdan sonra ek yok: eşik değişince "%40'ından" gibi ekler yanlış kalırdı.
    aciklama:
      "Geçen haftanın planında tamamlanan iş oranı eşiğin (%" + Math.round(RISK_ESIK.planOrani * 100) + ") altında.",
    eylem: "Koç notuyla bu haftanın tek önceliğini yaz.",
  },
  baslamadi: {
    baslik: "Hiç başlamadı",
    ton: "info",
    aciklama:
      "Kayıttan " +
      RISK_ESIK.baslamadiGun +
      " gün geçti, hâlâ sayılan bir testi yok. Boş ya da yarım bırakılan test sayılmaz.",
    eylem: "Tanışma check-up'ını hatırlat; başlayıp bıraktıysa nedenini sor.",
  },
};

export const RISK_SIRASI = Object.keys(RISK_META) as RiskKey[];

/** Öğrencinin bir ödevdeki durumu, karar için gereken kadarı (risk-data.ts doldurur). */
export interface RiskOdevi {
  title: string;
  dueAt: Date;
  durum: OdevDurumu;
  /** Gruba katıldığı an: son tarihten sonra katıldıysa ödev ona sayılmaz. */
  katildi: Date;
}

/** Bir öğrencinin karar için gereken özeti (risk-data.ts doldurur). */
export interface RiskOzeti {
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Son etkinlik (oturumla yapılan son istek; en fazla saatte bir yazılır). */
  lastSeenAt: Date | null;
  /** Son tamamlanan testin bitişi (her tür; boş gönderilen de: o da etkinlik). */
  sonTest: Date | null;
  /** Her türden oturumun (alıştırma dahil, bitmemiş de) son başlama anı. */
  sonBaslama: Date | null;
  /** Ölçüm sayılan test (boş ve yarım hariç; shared/insights.ts olcumDisi). */
  testSayisi: number;
  /** Kapanan (puanlanan) bütün testler, boş ve yarım dahil. */
  kapananTest: number;
  /**
   * Son iki paket testinin başarı oranı (0-1): [son, önceki]. İkisi de aynı
   * paket türünden, ölçüm sayılan ve öğrencinin sınavında (risk-data.ts).
   */
  sonIkiPaket: [number | null, number | null];
  /** Geçen haftanın planı: tamamlanan / toplam iş. Plan yoksa null. */
  gecenHaftaPlan: { biten: number; toplam: number } | null;
  /** Etkin gruplardaki, iptal edilmemiş, yakın tarihli (açık ya da yeni süresi dolan) ödevler. */
  odevler: RiskOdevi[];
}

export interface RiskBulgusu {
  key: RiskKey;
  ton: RiskTon;
  baslik: string;
  /** Bu öğrenciye özgü ayrıntı ("19 gün", "%62 → %41"). */
  ayrinti: string;
}

const GUN = 86_400_000;

/** Son etkinlik: son görülme, son giriş, son test, son oturum başlangıcı ve kayıt tarihinin en yenisi. */
export function sonEtkinlik(
  o: Pick<RiskOzeti, "createdAt" | "lastLoginAt" | "lastSeenAt" | "sonTest" | "sonBaslama">
): Date {
  return [o.createdAt, o.lastLoginAt, o.lastSeenAt, o.sonTest, o.sonBaslama]
    .filter((d): d is Date => d instanceof Date)
    .reduce((a, b) => (b > a ? b : a));
}

/**
 * "Ödevi yapmadı" sayılan ödevler: son tarihi son odevPencereGun gün içinde
 * GEÇMİŞ, tamamlanmamış (geç tamamlanan yapılmış sayılır) ve öğrenciye
 * sayılan (son tarihten önce katılmış; grup-kurallari.ts oranaSayilir).
 * Süresi henüz dolmayan ödev bulgu değil: öğrencinin hâlâ vakti var.
 * En yeni son tarih önce.
 */
export function yapilmayanOdevler<T extends RiskOdevi>(odevler: readonly T[], now: Date): T[] {
  const alt = now.getTime() - RISK_ESIK.odevPencereGun * GUN;
  return odevler
    .filter((o) => {
      const son = o.dueAt.getTime();
      return son < now.getTime() && son >= alt && oranaSayilir({ createdAt: o.katildi }, o) && !tamamlandiMi(o.durum);
    })
    .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());
}

/** Rozette uzun ödev başlığı satırı taşırmasın. */
function kisalt(metin: string, n = 40): string {
  return metin.length > n ? metin.slice(0, n - 1).trimEnd() + "…" : metin;
}

export function riskBulgulari(o: RiskOzeti, now: Date): RiskBulgusu[] {
  const out: RiskBulgusu[] = [];
  const ekle = (key: RiskKey, ayrinti: string) =>
    out.push({ key, ton: RISK_META[key].ton, baslik: RISK_META[key].baslik, ayrinti });

  const sessizGun = Math.floor((now.getTime() - sonEtkinlik(o).getTime()) / GUN);
  if (sessizGun >= RISK_ESIK.pasifGun) {
    ekle("pasif", sessizGun + " gündür etkinlik yok");
  }

  const yapilmayan = yapilmayanOdevler(o.odevler, now);
  if (yapilmayan.length > 0) {
    ekle("odev", yapilmayan.length === 1 ? kisalt(yapilmayan[0].title) : yapilmayan.length + " ödev");
  }

  const [son, onceki] = o.sonIkiPaket;
  if (son !== null && onceki !== null) {
    const fark = Math.round((son - onceki) * 100);
    if (-fark >= RISK_ESIK.dususPuan) {
      ekle("dusus", "%" + Math.round(onceki * 100) + " → %" + Math.round(son * 100) + " (" + fark + " puan)");
    }
  }

  const p = o.gecenHaftaPlan;
  if (p && p.toplam > 0 && p.biten / p.toplam < RISK_ESIK.planOrani) {
    ekle("plan", p.biten + "/" + p.toplam + " iş");
  }

  const kayitGun = Math.floor((now.getTime() - o.createdAt.getTime()) / GUN);
  if (o.testSayisi === 0 && kayitGun >= RISK_ESIK.baslamadiGun) {
    // Açıp boş ya da yarım kapattıysa koç bunu bilsin: "hiç açmadı" ile "açıp bıraktı" ayrı konuşma.
    const bos = o.kapananTest;
    ekle("baslamadi", "kayıt " + kayitGun + " gün önce" + (bos > 0 ? " · " + bos + " test boş ya da yarım" : ""));
  }

  return out;
}

const AGIRLIK: Record<RiskTon, number> = { bad: 100, warn: 10, info: 1 };

/** Sıralama: önce en ciddi bulgusu olan. */
export function riskPuani(liste: RiskBulgusu[]): number {
  return liste.reduce((t, b) => t + AGIRLIK[b.ton], 0);
}
