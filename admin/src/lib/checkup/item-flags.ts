/**
 * Madde analizi — saf hesaplar, eşikler ve bulgu metinleri. Veritabanı
 * bilmez: liste ekranı (SQL toplamı) ve soru ekranı (ham cevaplar) aynı
 * bulguları buradan üretir, iki ekran birbirini yalanlamaz.
 *
 * Klasik test kuramının iki ölçüsü kullanılıyor:
 *
 * - **Doğru oranı (p, madde güçlüğü):** soruyu doğru yapanların oranı. Boş
 *   bırakan doğru yapmamış sayılır — puanlamadaki gibi.
 * - **Ayırt edicilik (r):** soruyu doğru yapmakla aynı testin GERİ KALANINDAKİ
 *   başarı arasındaki korelasyon (madde-kalan korelasyonu). Testte iyi olanlar
 *   bu soruyu da daha çok yapıyorsa r yüksektir. Sıfıra yakınsa soru iyiyi
 *   zayıftan ayırmıyor; negatifse genelde anahtar ya da ifade hatalıdır.
 *
 * Paketler farklı uzunlukta olduğu için "kalan" puan oran olarak alınır.
 * Farklı paketlerdeki cevaplar birlikte değerlendirilir; bu ölçüyü biraz
 * gürültülü yapar ama yüzlerce cevapta sinyal belirgindir.
 *
 * Eşikler araç içindir, öğrenciye giden bir kural değildir — içerik ekibi
 * isterse burada değiştirilir.
 */

export const ESIK = {
  /** Bulgu üretmek için en az cevap. Daha azında oranlar yazı-turadan ayırt edilemez. */
  minN: 20,
  /** Ayırt edicilik bulguları için en az cevap — korelasyon daha çok veri ister. */
  minNR: 30,
  /** Ayırt edicilik bu kadar cevaptan azsa hiç gösterilmez (iki cevapla r = ±1 çıkar). */
  gosterR: 10,
  /** Doğru oranı bunun altındaysa: çok zor (5 şıkta şans düzeyi %20). */
  zorP: 0.25,
  /** r bunun altındaysa: ayırt etmiyor. */
  zayifR: 0.15,
  /** r bunun altındaysa: ters ayırt ediyor (küçük negatif değerler gürültü). */
  tersR: -0.05,
  /** r bunun üstündeyse: iyi. */
  iyiR: 0.3,
  /** Cevapların bundan azında seçilen çeldirici: çalışmıyor. (Bulgu metni "%5" yazıyor.) */
  oluCeldirici: 0.05,
  /** Boş bırakma oranı bunun üstündeyse: çok boş bırakılıyor. */
  bos: 0.3,
  /** Medyan süre hedefin bu katını aşarsa yavaş — öğrenciye "yavaş" denen eşikle aynı. */
  yavas: 1.3,
  /** Etiketlenen zorluk ile gözlenen zorluk arasında bu kadar kademe fark varsa. */
  zorlukFarki: 2,
} as const;

export type BulguKey = "ters" | "celdirici" | "zor" | "ayirtmiyor" | "bos" | "zorluk" | "olu" | "yavas";
export type BulguTon = "bad" | "warn" | "info";

export interface Bulgu {
  key: BulguKey;
  ton: BulguTon;
  baslik: string;
  /** Bu soruya özgü, ne yapılacağını söyleyen açıklama. */
  aciklama: string;
}

/** Süzgeç sekmeleri ve açıklama kutusu için — ciddiyet sırasıyla. */
export const BULGU_META: Record<BulguKey, { baslik: string; ton: BulguTon; kisa: string }> = {
  ters: {
    baslik: "Ters ayırt ediyor",
    ton: "bad",
    kisa: "Testte başarılı olanlar bu soruda daha çok yanılıyor — çoğunlukla anahtar hatası.",
  },
  celdirici: {
    baslik: "Çeldirici önde",
    ton: "warn",
    kisa: "Bir çeldirici doğru şıktan daha çok seçiliyor.",
  },
  zor: {
    baslik: "Şans düzeyinde",
    ton: "warn",
    kisa: "Doğru oranı şans düzeyine yakın: soru ya çok zor ya hatalı.",
  },
  ayirtmiyor: {
    baslik: "Ayırt etmiyor",
    ton: "warn",
    kisa: "İyi ve zayıf öğrenci bu soruda benzer başarıda.",
  },
  bos: {
    baslik: "Çok boş bırakılıyor",
    ton: "warn",
    kisa: "Öğrencilerin önemli bir kısmı soruya hiç girmiyor.",
  },
  zorluk: {
    baslik: "Zorluk etiketi uymuyor",
    ton: "info",
    kisa: "Etiketlenen zorluk gözlenenden en az iki kademe farklı; seçim bantları kayıyor.",
  },
  olu: {
    baslik: "Çalışmayan çeldirici",
    ton: "info",
    kisa: "Neredeyse hiç seçilmeyen şık var.",
  },
  yavas: {
    baslik: "Yavaş",
    ton: "info",
    kisa: "Medyan çözüm süresi hedef sürenin 1,3 katını aşıyor.",
  },
};

export const BULGU_SIRASI = Object.keys(BULGU_META) as BulguKey[];

export interface ItemStats {
  /** Cevap sayısı — boş bırakılanlar dahil. */
  n: number;
  correct: number;
  blank: number;
  /** İşaretlenen cevaplarda medyan süre. */
  medianMs: number | null;
  /** Madde-kalan korelasyonu. Varyans yoksa null. */
  r: number | null;
  /** Şıklar sırasıyla ve kaç kez işaretlendikleri. */
  choices: { label: string; isCorrect: boolean; count: number }[];
  /** Elle girilen zorluk (1-5). */
  difficulty: number;
  targetTimeSeconds: number;
}

const yuzde = (x: number) => "%" + Math.round(x * 100);
const virgullu = (x: number) => x.toFixed(2).replace(".", ",");

export function dogruOrani(s: Pick<ItemStats, "n" | "correct">): number | null {
  return s.n > 0 ? s.correct / s.n : null;
}

/** Gösterilecek r: az cevapta korelasyon anlamsız (iki cevapla ±1). */
export function gorunenR(s: Pick<ItemStats, "n" | "r">): number | null {
  return s.n >= ESIK.gosterR ? s.r : null;
}

/**
 * Gözlenen doğru oranına göre zorluk (1-5). Seçim zorluk etiketine göre
 * kolay/orta/zor bandı dolduruyor; etiket gerçeğe uymazsa test kayar.
 */
export function onerilenZorluk(p: number): number {
  if (p >= 0.85) return 1;
  if (p >= 0.7) return 2;
  if (p >= 0.45) return 3;
  if (p >= 0.25) return 4;
  return 5;
}

export function ayirtEdicilik(r: number | null): { etiket: string; ton: "ok" | "neutral" | "warn" | "bad" } {
  if (r === null) return { etiket: "—", ton: "neutral" };
  if (r >= ESIK.iyiR) return { etiket: "iyi", ton: "ok" };
  if (r >= ESIK.zayifR) return { etiket: "orta", ton: "neutral" };
  if (r > ESIK.tersR) return { etiket: "zayıf", ton: "warn" };
  return { etiket: "ters", ton: "bad" };
}

export function rYaz(r: number | null): string {
  return r === null ? "—" : virgullu(r);
}

/** Soru başına bulgular, ciddiyet sırasıyla. Az veride boş döner. */
export function bulgular(s: ItemStats): Bulgu[] {
  const out: Bulgu[] = [];
  if (s.n < ESIK.minN) return out;

  const p = s.correct / s.n;
  const anahtar = s.choices.find((c) => c.isCorrect);
  const celdiriciler = s.choices.filter((c) => !c.isCorrect);
  const ekle = (key: BulguKey, aciklama: string) =>
    out.push({ key, ton: BULGU_META[key].ton, baslik: BULGU_META[key].baslik, aciklama });

  if (s.r !== null && s.n >= ESIK.minNR && s.r <= ESIK.tersR) {
    ekle(
      "ters",
      "Ayırt edicilik " + virgullu(s.r) + ": testte başarılı öğrenciler bu soruda daha çok yanılıyor. " +
        "Önce cevap anahtarını, sonra soru metnini kontrol et."
    );
  }

  const onde = anahtar ? celdiriciler.filter((c) => c.count > anahtar.count).sort((a, b) => b.count - a.count) : [];
  if (anahtar && onde.length) {
    ekle(
      "celdirici",
      onde[0].label + " şıkkı (" + yuzde(onde[0].count / s.n) + ") doğru şıktan (" + anahtar.label + ", " +
        yuzde(anahtar.count / s.n) + ") daha çok seçiliyor. Yaygın bir yanılgıyı yakalıyorsa değerli bir " +
        "çeldirici; değilse anahtarı ve ifadeyi kontrol et."
    );
  }

  if (p < ESIK.zorP) {
    const sans = s.choices.length ? 1 / s.choices.length : 0.2;
    ekle(
      "zor",
      "Doğru oranı yalnızca " + yuzde(p) + "; şans düzeyi " + yuzde(sans) + ". " +
        (s.difficulty >= 5
          ? "Zorluk zaten 5: anahtarı, ifadeyi ve çözümü kontrol et."
          : "Anahtar ya da ifade hatalı olabilir; bilerek bu kadar zorsa zorluğu 5 yap.")
    );
  }

  if (s.r !== null && s.n >= ESIK.minNR && s.r > ESIK.tersR && s.r < ESIK.zayifR) {
    ekle(
      "ayirtmiyor",
      "Ayırt edicilik " + virgullu(s.r) + ": testte iyi olanla zayıf olan bu soruda benzer başarıda. " +
        "Soru dikkatsizliğe, şansa ya da ezbere dayanıyor olabilir."
    );
  }

  const bosOran = s.blank / s.n;
  if (bosOran >= ESIK.bos) {
    ekle(
      "bos",
      "Boş bırakma oranı " + yuzde(bosOran) + ". Soru anlaşılmıyor, uzun ya da süre yetmiyor olabilir."
    );
  }

  const oneri = onerilenZorluk(p);
  if (Math.abs(oneri - s.difficulty) >= ESIK.zorlukFarki) {
    ekle(
      "zorluk",
      "Zorluk " + s.difficulty + " etiketli ama doğru oranı " + yuzde(p) + " — gözlenen zorluk " + oneri +
        ". Seçim kolay/orta/zor bantlarını bu etikete göre dolduruyor; etiketi " + oneri + " yapmayı düşün."
    );
  }

  const isaretlenen = s.n - s.blank;
  if (isaretlenen > 0) {
    const olu = celdiriciler.filter((c) => c.count / s.n < ESIK.oluCeldirici);
    if (olu.length) {
      ekle(
        "olu",
        olu.map((c) => c.label).join(", ") +
          (olu.length > 1 ? " şıkları" : " şıkkı") +
          " cevapların %5'inden azında seçiliyor. Seçilmeyen şık çeldirici değildir: " +
          "yerine sık yapılan bir hatanın sonucunu koy."
      );
    }
  }

  if (s.medianMs !== null && s.targetTimeSeconds > 0 && s.medianMs > s.targetTimeSeconds * 1000 * ESIK.yavas) {
    const sn = Math.round(s.medianMs / 1000);
    ekle(
      "yavas",
      "Medyan çözüm süresi " + sn + " sn, hedef " + s.targetTimeSeconds + " sn. Hedef gerçekçi değilse güncelle; " +
        "gerçekçiyse soru gereğinden uzun olabilir."
    );
  }

  return out;
}

const AGIRLIK: Record<BulguTon, number> = { bad: 100, warn: 10, info: 1 };

/** Sıralama için: önce en ciddi bulgusu olan soru. */
export function oncelik(liste: Bulgu[]): number {
  return liste.reduce((t, b) => t + AGIRLIK[b.ton], 0);
}

/** Pearson korelasyonu. Varyans yoksa ya da üçten az nokta varsa null. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Medyan (boş dizide null). */
export function medyan(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
