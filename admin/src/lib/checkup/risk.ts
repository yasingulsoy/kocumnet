/**
 * Riskli öğrenci kuralları — eşiklerin TEK yeri. Saf modül: veri
 * risk-data.ts'te toplanır, burada yalnızca karar verilir. Liste koçun
 * "bu hafta kimi aramalıyım" sorusuna cevap: her bulgu bir eylem önerir.
 *
 * Eşikler araç içindir, öğrenciye giden bir kural değildir. Hoca ya da koç
 * değiştirmek isterse yalnızca bu dosya değişir; ekrandaki açıklamalar da
 * buradan okunur.
 */

export const RISK_ESIK = {
  /**
   * Bu kadar gündür ne giriş ne test: öğrenci kopmuş olabilir. Haftalık plan
   * döngüsünün iki turu — iki pazartesi postasına rağmen dönmemiş demek.
   */
  pasifGun: 14,
  /**
   * Kayıttan bu kadar gün sonra hâlâ hiç test yok: tanışma testine bile
   * başlamamış. Kayıt günü sayılmaz; hafta sonu kaydolana nefes payı.
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
   * Son iki PAKET testinin başarı oranı arasındaki düşüş (puan). Kontrol
   * testleri (5 soru) ve seviyeli aşamalar hariç: uzunluk ve zorlukları
   * farklı, iki farklı türü kıyaslamak yanıltıcı.
   */
  dususPuan: 10,
} as const;

export type RiskKey = "pasif" | "dusus" | "plan" | "baslamadi";
export type RiskTon = "bad" | "warn" | "info";

/** Süzgeç sekmeleri, açıklama kutusu ve sıralama — ciddiyet sırasıyla. */
export const RISK_META: Record<RiskKey, { baslik: string; ton: RiskTon; aciklama: string; eylem: string }> = {
  pasif: {
    baslik: "Pasif",
    ton: "bad",
    aciklama: RISK_ESIK.pasifGun + " gündür ne giriş yaptı ne test çözdü.",
    eylem: "Ara ya da mesaj at; plan çok mu ağır geldi, sor.",
  },
  dusus: {
    baslik: "Düşüşte",
    ton: "warn",
    aciklama: "Son iki paket testinde başarı en az " + RISK_ESIK.dususPuan + " puan düştü.",
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
    aciklama: "Kayıttan " + RISK_ESIK.baslamadiGun + " gün geçti, hâlâ hiç test yok.",
    eylem: "Tanışma check-up'ını hatırlat.",
  },
};

export const RISK_SIRASI = Object.keys(RISK_META) as RiskKey[];

/** Bir öğrencinin karar için gereken özeti (risk-data.ts doldurur). */
export interface RiskOzeti {
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Son tamamlanan testin bitişi (her tür). */
  sonTest: Date | null;
  testSayisi: number;
  /** Son iki paket testinin başarı oranı (0-1): [son, önceki]. */
  sonIkiPaket: [number | null, number | null];
  /** Geçen haftanın planı: tamamlanan / toplam iş. Plan yoksa null. */
  gecenHaftaPlan: { biten: number; toplam: number } | null;
}

export interface RiskBulgusu {
  key: RiskKey;
  ton: RiskTon;
  baslik: string;
  /** Bu öğrenciye özgü ayrıntı ("19 gün", "%62 → %41"). */
  ayrinti: string;
}

const GUN = 86_400_000;

/** Son etkinlik: son giriş, son test ve kayıt tarihinin en yenisi. */
export function sonEtkinlik(o: Pick<RiskOzeti, "createdAt" | "lastLoginAt" | "sonTest">): Date {
  return [o.createdAt, o.lastLoginAt, o.sonTest]
    .filter((d): d is Date => d instanceof Date)
    .reduce((a, b) => (b > a ? b : a));
}

export function riskBulgulari(o: RiskOzeti, now: Date): RiskBulgusu[] {
  const out: RiskBulgusu[] = [];
  const ekle = (key: RiskKey, ayrinti: string) =>
    out.push({ key, ton: RISK_META[key].ton, baslik: RISK_META[key].baslik, ayrinti });

  const sessizGun = Math.floor((now.getTime() - sonEtkinlik(o).getTime()) / GUN);
  if (sessizGun >= RISK_ESIK.pasifGun) {
    ekle("pasif", sessizGun + " gündür etkinlik yok");
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
    ekle("baslamadi", "kayıt " + kayitGun + " gün önce");
  }

  return out;
}

const AGIRLIK: Record<RiskTon, number> = { bad: 100, warn: 10, info: 1 };

/** Sıralama: önce en ciddi bulgusu olan. */
export function riskPuani(liste: RiskBulgusu[]): number {
  return liste.reduce((t, b) => t + AGIRLIK[b.ton], 0);
}
