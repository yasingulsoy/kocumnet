/**
 * Check-up başlatırken soru seçimi (checkup/API.md "Soru seçimi"). Saf modül:
 * havuz ve rastgele sayı üreteci çağırandan gelir.
 *
 * KARMA:
 *   1. Önce kazanım satırları, sonra konu satırları doldurulur.
 *   2. Her satır kendi havuzundan rastgele seçer, daha önce seçilmiş soruyu almaz.
 *   3. Öğrencinin aynı sınavda daha önce gördüğü sorular, havuz yetiyorsa
 *      seçilmez; yetmiyorsa önce görülmemişlerin hepsi, eksik görülmüşlerden.
 *   4. Sorular ders ve konu sırasına göre dizilir; konu içindeki sıra rastgele.
 * SABIT: liste sırası korunur.
 */

export interface HavuzSorusu {
  id: number;
  dersId: number;
  dersSira: number;
  konuId: number;
  konuSira: number;
  kazanimId: number;
}

export interface SecimSatiri {
  konuId: number | null;
  kazanimId: number | null;
  soruSayisi: number;
}

export type Rastgele = () => number;

export class SecimHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "SecimHatasi";
  }
}

/** Fisher–Yates; girdiyi değiştirmez. */
export function karistir<T>(dizi: readonly T[], rastgele: Rastgele): T[] {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function karmaSec(p: {
  satirlar: SecimSatiri[];
  havuz: HavuzSorusu[];
  gorulen: ReadonlySet<number>;
  rastgele: Rastgele;
}): HavuzSorusu[] {
  const secilen = new Map<number, HavuzSorusu>();
  const sirali = [...p.satirlar.filter((s) => s.kazanimId != null), ...p.satirlar.filter((s) => s.kazanimId == null)];

  for (const satir of sirali) {
    const uygun = p.havuz.filter(
      (s) => !secilen.has(s.id) && (satir.kazanimId != null ? s.kazanimId === satir.kazanimId : s.konuId === satir.konuId)
    );
    if (uygun.length < satir.soruSayisi) {
      throw new SecimHatasi(`Havuz yetmiyor: satır ${satir.soruSayisi} soru istiyor, ${uygun.length} uygun soru var.`);
    }
    const gorulmemis = karistir(
      uygun.filter((s) => !p.gorulen.has(s.id)),
      p.rastgele
    );
    const gorulmus = karistir(
      uygun.filter((s) => p.gorulen.has(s.id)),
      p.rastgele
    );
    for (const s of [...gorulmemis, ...gorulmus].slice(0, satir.soruSayisi)) secilen.set(s.id, s);
  }

  return konuyaGoreDiz([...secilen.values()], p.rastgele);
}

/** Ders sırası → konu sırası (eşitlikte kimlik); konu içi rastgele. */
export function konuyaGoreDiz(sorular: HavuzSorusu[], rastgele: Rastgele): HavuzSorusu[] {
  const gruplar = new Map<number, HavuzSorusu[]>();
  for (const s of sorular) {
    const g = gruplar.get(s.konuId);
    if (g) g.push(s);
    else gruplar.set(s.konuId, [s]);
  }
  const anahtarlar = [...gruplar.values()].map((g) => g[0]!);
  anahtarlar.sort((a, b) => a.dersSira - b.dersSira || a.dersId - b.dersId || a.konuSira - b.konuSira || a.konuId - b.konuId);
  return anahtarlar.flatMap((k) => karistir(gruplar.get(k.konuId)!, rastgele));
}
