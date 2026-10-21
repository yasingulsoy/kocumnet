/**
 * Deneme (MOCK paket) kuralları — SAF modül. Düzenleyici (istemci) göstergeleri
 * ve "Dağılıma göre doldur" (sunucu) aynı hesabı kullanır; sunucu her kuralı
 * yeniden denetler. Hiçbir şey içe aktarmaz: app/scripts/deneme-test.mts bu
 * dosyayı doğrudan yükleyip sınıyor.
 *
 * Deneme = gerçek sınavın provası: sorular pakette SABİT (PackageQuestion),
 * herkes aynı soruları aynı sırayla çözer. Yüzdelik dilim ancak böyle anlamlı.
 */

/** Denemenin soru sayısı. En büyük gerçek değer DGS 60; pay bırakıldı. */
export const DENEME_SORU_SINIRI = { min: 5, max: 120 } as const;

/** Yanlış götürme oranı: 0 (götürmez) … 1 (bir yanlış bir doğru). Veritabanında 4 hane. */
export const CEZA_SINIRI = { min: 0, max: 1 } as const;

export const ZORLUKLAR = [1, 2, 3, 4, 5] as const;

// ─────────────────────────────────────────────────────────────
// Dağılım
// ─────────────────────────────────────────────────────────────

/**
 * En büyük kalan yöntemi (Hamilton): ağırlıkları `toplam` tam sayıya oranlar,
 * toplam birebir tutar. Önce taban payları, artan yer kalanı en büyük olana;
 * eşitlikte verilen sıra (konu sırası) korunur — sonuç her çalıştırmada aynı.
 */
export function hamiltonDagit<K>(agirliklar: readonly { key: K; agirlik: number }[], toplam: number): Map<K, number> {
  const sonuc = new Map<K, number>();
  const gecerli = agirliklar.filter((a) => Number.isFinite(a.agirlik) && a.agirlik > 0);
  const tum = gecerli.reduce((t, a) => t + a.agirlik, 0);
  for (const a of agirliklar) sonuc.set(a.key, 0);
  if (tum <= 0 || toplam <= 0) return sonuc;

  const paylar = gecerli.map((a, sira) => {
    const kota = (a.agirlik / tum) * toplam;
    return { key: a.key, taban: Math.floor(kota), kalan: kota - Math.floor(kota), sira };
  });
  let dagitilan = paylar.reduce((t, p) => t + p.taban, 0);
  for (const p of paylar) sonuc.set(p.key, p.taban);
  const sirali = [...paylar].sort((a, b) => b.kalan - a.kalan || a.sira - b.sira);
  for (let i = 0; dagitilan < toplam && i < sirali.length; i++, dagitilan++) {
    sonuc.set(sirali[i].key, (sonuc.get(sirali[i].key) ?? 0) + 1);
  }
  return sonuc;
}

/** Konunun sınavdaki ağırlığı: Topic.examWeights[sınav] — gerçek sınavda ortalama soru sayısı. */
export interface DenemeHedefi {
  topicId: string;
  ad: string;
  agirlik: number;
}

/** Hedef dağılım: ağırlıklar soru sayısına ölçeklenir (en büyük kalan). */
export function hedefDagilim(hedefler: readonly DenemeHedefi[], soruSayisi: number): Map<string, number> {
  return hamiltonDagit(
    hedefler.map((h) => ({ key: h.topicId, agirlik: h.agirlik })),
    soruSayisi
  );
}

/** Zorluk hedefi: soru sayısı 1-5'e eşit yayılır ("dengeli"). */
export function zorlukHedefi(soruSayisi: number): Map<number, number> {
  return hamiltonDagit(
    ZORLUKLAR.map((z) => ({ key: z as number, agirlik: 1 })),
    soruSayisi
  );
}

// ─────────────────────────────────────────────────────────────
// Doldurma
// ─────────────────────────────────────────────────────────────

/** Listeye girebilecek soru: yayında, paketin sınavında sorulabilir, listede değil. */
export interface Aday {
  id: string;
  topicId: string;
  difficulty: number;
  /** Bu deneme dışında kaç denemenin listesinde. */
  digerDeneme: number;
  shownCount: number;
}

/**
 * Adayların sırası (küçük önce):
 *  1. Başka denemede kullanılmamış: denemeleri art arda çözen öğrenci aynı
 *     soruyu ikinci kez görmesin (hatırlar, neti şişer, yüzdelik bozulur).
 *  2. Zorluk açığı büyük olan: deneme 1-5'e dengeli yayılsın.
 *  3. Daha az gösterilmiş (havuzda yıpranmamış).
 *  4. Kimlik: aynı girdi her zaman aynı listeyi versin.
 */
function adayKarsilastir(acik: (d: number) => number) {
  return (a: Aday, b: Aday) =>
    Number(a.digerDeneme > 0) - Number(b.digerDeneme > 0) ||
    acik(b.difficulty) - acik(a.difficulty) ||
    a.shownCount - b.shownCount ||
    a.digerDeneme - b.digerDeneme ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export interface DoldurmaGirdisi {
  soruSayisi: number;
  /** Listede zaten duranlar (elle eklenenler korunur, hedefe sayılır). */
  mevcut: readonly { id: string; topicId: string; difficulty: number }[];
  hedefler: readonly DenemeHedefi[];
  /** Konu → adaylar (yayında, sınavda sorulabilen, listede olmayan). */
  adaylar: ReadonlyMap<string, readonly Aday[]>;
}

export interface DoldurmaSonucu {
  /** Eklenecek sorular, eklenme sırasıyla. */
  eklenen: Aday[];
  /** Doldurulamayan yerler: açık rapor (sessizce başka konudan doldurulmaz). */
  eksikler: string[];
  /** Bilgi notları (kırpma, başka denemeden gelen soru). */
  notlar: string[];
}

/**
 * "Dağılıma göre doldur": listedeki boş yerleri hedef dağılıma göre doldurur.
 *
 * - Hedef = examWeights soru sayısına ölçeklenmiş (en büyük kalan).
 * - Elle eklenmiş sorular korunur ve kendi konularının hedefinden düşer.
 *   Hedef dışı konudan elle eklenen varsa kalan yer, ihtiyaçlara oranla
 *   (yine en büyük kalan) kırpılır.
 * - Konular sırayla birer birer doldurulur ki zorluk dengesi tek bir konuya
 *   yığılmasın; her adımda adayKarsilastir'ın en iyisi seçilir.
 * - Havuz yetmeyen konu BAŞKA KONUDAN DOLDURULMAZ: deneme gerçek sınavın
 *   dağılımını taşımalı. Eksik açıkça raporlanır.
 */
export function dagilimaGoreDoldur(g: DoldurmaGirdisi): DoldurmaSonucu {
  const eksikler: string[] = [];
  const notlar: string[] = [];
  const hedefler = g.hedefler.filter((h) => h.agirlik > 0);
  if (hedefler.length === 0) {
    return {
      eklenen: [],
      eksikler: [
        "Bu sınavın konularında ağırlık (examWeights) tanımlı değil: hedef dağılım hesaplanamıyor. Soruları elle ekle ya da konu ağırlıklarını tanımlat.",
      ],
      notlar,
    };
  }
  const bos = g.soruSayisi - g.mevcut.length;
  if (bos <= 0) {
    return { eklenen: [], eksikler: [], notlar: [`Liste zaten dolu (${g.mevcut.length}/${g.soruSayisi}); doldurulacak yer yok.`] };
  }

  const hedef = hedefDagilim(hedefler, g.soruSayisi);
  const listede = new Map<string, number>();
  for (const q of g.mevcut) listede.set(q.topicId, (listede.get(q.topicId) ?? 0) + 1);

  let ihtiyac = new Map(hedefler.map((h) => [h.topicId, Math.max(0, (hedef.get(h.topicId) ?? 0) - (listede.get(h.topicId) ?? 0))]));
  const toplamIhtiyac = [...ihtiyac.values()].reduce((t, n) => t + n, 0);
  if (toplamIhtiyac > bos) {
    // Hedef dışı ya da hedefini aşmış konudan elle eklenen sorular yer kapladı.
    ihtiyac = hamiltonDagit(
      hedefler.map((h) => ({ key: h.topicId, agirlik: ihtiyac.get(h.topicId) ?? 0 })),
      bos
    );
    notlar.push(
      `Listede hedef dağılımın dışında ${toplamIhtiyac - bos} soruluk fazla var (hedefi aşan ya da ağırlığı olmayan konular); kalan ${bos} yer konulara oranla paylaştırıldı.`
    );
  }

  // Zorluk açığı: hedef − listede (doldurdukça güncellenir).
  const zHedef = zorlukHedefi(g.soruSayisi);
  const zListede = new Map<number, number>(ZORLUKLAR.map((z) => [z, 0]));
  for (const q of g.mevcut) zListede.set(q.difficulty, (zListede.get(q.difficulty) ?? 0) + 1);
  const acik = (d: number) => (zHedef.get(d) ?? 0) - (zListede.get(d) ?? 0);
  const siralama = adayKarsilastir(acik);

  const havuz = new Map(hedefler.map((h) => [h.topicId, [...(g.adaylar.get(h.topicId) ?? [])]]));
  const kalan = new Map(ihtiyac);
  const eklenen: Aday[] = [];

  // Konulardan sırayla birer soru: zorluk açığı her adımda yeniden hesaplanır.
  let ilerledi = true;
  while (ilerledi) {
    ilerledi = false;
    for (const h of hedefler) {
      const n = kalan.get(h.topicId) ?? 0;
      const adaylar = havuz.get(h.topicId)!;
      if (n <= 0 || adaylar.length === 0) continue;
      adaylar.sort(siralama);
      const secilen = adaylar.shift()!;
      eklenen.push(secilen);
      kalan.set(h.topicId, n - 1);
      zListede.set(secilen.difficulty, (zListede.get(secilen.difficulty) ?? 0) + 1);
      ilerledi = true;
    }
  }

  for (const h of hedefler) {
    const n = kalan.get(h.topicId) ?? 0;
    if (n > 0) {
      const istenen = ihtiyac.get(h.topicId) ?? 0;
      eksikler.push(
        `${h.ad}: ${istenen} soru gerekiyordu, ${istenen - n} eklendi — havuzda bu sınavda sorulabilen yayında soru kalmadı (${n} eksik).`
      );
    }
  }
  const tekrar = eklenen.filter((a) => a.digerDeneme > 0).length;
  if (tekrar) {
    notlar.push(`${tekrar} soru başka bir denemede de var: o konularda kullanılmamış soru yetmedi.`);
  }
  return { eklenen, eksikler, notlar };
}

/**
 * "Benzeriyle değiştir": aynı konudan, zorluğu en yakın aday. Eşitlikte
 * başka denemede olmayan, sonra daha az gösterilen.
 */
export function benzerSec(kaynak: { topicId: string; difficulty: number }, adaylar: readonly Aday[]): Aday | null {
  const ayniKonu = adaylar.filter((a) => a.topicId === kaynak.topicId);
  ayniKonu.sort(
    (a, b) =>
      Math.abs(a.difficulty - kaynak.difficulty) - Math.abs(b.difficulty - kaynak.difficulty) ||
      Number(a.digerDeneme > 0) - Number(b.digerDeneme > 0) ||
      a.shownCount - b.shownCount ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return ayniKonu[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// Yayın kuralı
// ─────────────────────────────────────────────────────────────

const DURUM_ADI: Record<string, string> = { DRAFT: "taslak", REVIEW: "incelemede", ARCHIVED: "arşivde" };

export interface ListeDurumu {
  soruSayisi: number;
  listede: number;
  /** Yayında olmayan sorular, duruma göre: { ARCHIVED: 2, DRAFT: 1 }. */
  yayindaOlmayan: Readonly<Record<string, number>>;
  /** Paketin sınavında sorulamayan sorular (hedef sınavı başka). */
  sinavDisi: number;
}

/**
 * Deneme ancak liste uzunluğu = soru sayısı ve bütün sorular yayında (ve
 * paketin sınavında sorulabilir) ise yayınlanabilir. Engel yoksa boş liste;
 * varsa her biri ekranda ve yayın reddinde ayrı satır.
 */
export function denemeEngelleri(d: ListeDurumu): string[] {
  const r: string[] = [];
  if (d.listede < d.soruSayisi) r.push(`Listede ${d.listede} soru var, deneme ${d.soruSayisi} istiyor (${d.soruSayisi - d.listede} eksik).`);
  else if (d.listede > d.soruSayisi) r.push(`Listede ${d.listede} soru var, deneme ${d.soruSayisi} istiyor (${d.listede - d.soruSayisi} fazla).`);
  const olmayan = Object.entries(d.yayindaOlmayan).filter(([, n]) => n > 0);
  const toplam = olmayan.reduce((t, [, n]) => t + n, 0);
  if (toplam) {
    r.push(`${toplam} soru yayında değil (${olmayan.map(([s, n]) => n + " " + (DURUM_ADI[s] ?? s)).join(", ")}): yayına al ya da yerine başkasını koy.`);
  }
  if (d.sinavDisi) r.push(`${d.sinavDisi} soru bu denemenin sınavında sorulamıyor (hedef sınavı başka): çıkar.`);
  return r;
}

/** Listedeki satırlardan ListeDurumu (düzenleyici bunu canlı hesaplar). */
export function listeDurumu(soruSayisi: number, liste: readonly { status: string; sinavda: boolean }[]): ListeDurumu {
  const yayindaOlmayan: Record<string, number> = {};
  for (const q of liste) if (q.status !== "PUBLISHED") yayindaOlmayan[q.status] = (yayindaOlmayan[q.status] ?? 0) + 1;
  return { soruSayisi, listede: liste.length, yayindaOlmayan, sinavDisi: liste.filter((q) => !q.sinavda).length };
}
