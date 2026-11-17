/**
 * Puanlama ve rapor (checkup/API.md "Rapor"). Saf modül.
 *
 *   net = dogru − yanlis / yanlisGoturme; yanlisGoturme = 0 ise net = dogru.
 *   İki ondalığa yuvarlanır.
 *   basari = round(dogru / soru * 100)
 *   zayiflar: kazanım ve alt kazanımlardan en az 2 sorusu olup başarısı
 *   %50'nin altında kalanlar; başarı artan, eşitlikte soru sayısı azalan;
 *   en fazla 5. Tek sorudan zayıflık çıkarılmaz.
 */

export type Sonuc = "dogru" | "yanlis" | "bos";

export interface SoruSonucu {
  dersId: number;
  konuId: number;
  kazanimId: number;
  altKazanimId: number;
  sonuc: Sonuc;
}

export interface AgacDugumu {
  ad: string;
  sira: number;
  kod?: string | null;
  ustId?: number;
}

export interface AgacBilgisi {
  dersler: Map<number, AgacDugumu>;
  konular: Map<number, AgacDugumu>; // ustId = dersId
  kazanimlar: Map<number, AgacDugumu>; // ustId = konuId
  altKazanimlar: Map<number, AgacDugumu>; // ustId = kazanimId
}

export interface Grup {
  id: number;
  ad: string;
  soru: number;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  basari: number;
}

export interface Zayif {
  seviye: "kazanim" | "altKazanim";
  id: number;
  kod: string | null;
  ad: string;
  ustAd: string;
  soru: number;
  dogru: number;
  basari: number;
}

export interface RaporHesabi {
  ozet: { soruSayisi: number; dogru: number; yanlis: number; bos: number; net: number; yanlisGoturme: number; basari: number };
  dersler: Grup[];
  konular: (Grup & { dersAd: string })[];
  kazanimlar: (Grup & { kod: string | null; konuAd: string })[];
  altKazanimlar: (Grup & { kod: string | null; kazanimAd: string })[];
  zayiflar: Zayif[];
}

export const ZAYIF_ESIK = 50;
export const ZAYIF_EN_AZ_SORU = 2;
export const ZAYIF_EN_FAZLA = 5;

/** Kayan nokta hatası olmadan: (dogru·k − yanlis) / k, iki ondalık. */
export function netHesapla(dogru: number, yanlis: number, yanlisGoturme: number): number {
  if (yanlisGoturme <= 0) return dogru;
  return Math.round(((dogru * yanlisGoturme - yanlis) * 100) / yanlisGoturme) / 100;
}

export function basariHesapla(dogru: number, soru: number): number {
  return soru > 0 ? Math.round((dogru / soru) * 100) : 0;
}

interface Sayac {
  soru: number;
  dogru: number;
  yanlis: number;
  bos: number;
}

const bosSayac = (): Sayac => ({ soru: 0, dogru: 0, yanlis: 0, bos: 0 });

function ekle(harita: Map<number, Sayac>, id: number, sonuc: Sonuc) {
  let s = harita.get(id);
  if (!s) harita.set(id, (s = bosSayac()));
  s.soru += 1;
  s[sonuc] += 1;
}

export function raporHesapla(p: { sonuclar: SoruSonucu[]; agac: AgacBilgisi; yanlisGoturme: number }): RaporHesabi {
  const { agac, yanlisGoturme } = p;
  const toplam = bosSayac();
  const ders = new Map<number, Sayac>();
  const konu = new Map<number, Sayac>();
  const kazanim = new Map<number, Sayac>();
  const alt = new Map<number, Sayac>();

  for (const s of p.sonuclar) {
    toplam.soru += 1;
    toplam[s.sonuc] += 1;
    ekle(ders, s.dersId, s.sonuc);
    ekle(konu, s.konuId, s.sonuc);
    ekle(kazanim, s.kazanimId, s.sonuc);
    ekle(alt, s.altKazanimId, s.sonuc);
  }

  const grup = (id: number, ad: string, s: Sayac): Grup => ({
    id,
    ad,
    soru: s.soru,
    dogru: s.dogru,
    yanlis: s.yanlis,
    bos: s.bos,
    net: netHesapla(s.dogru, s.yanlis, yanlisGoturme),
    basari: basariHesapla(s.dogru, s.soru),
  });

  const dugum = (m: Map<number, AgacDugumu>, id: number): AgacDugumu => m.get(id) ?? { ad: `#${id}`, sira: Number.MAX_SAFE_INTEGER };

  // Ağaç sırası için yol anahtarları: [ders.sira, ders.id, konu.sira, konu.id, ...]
  const dersYolu = (id: number) => [dugum(agac.dersler, id).sira, id];
  const konuYolu = (id: number) => {
    const k = dugum(agac.konular, id);
    return [...dersYolu(k.ustId ?? 0), k.sira, id];
  };
  const kazanimYolu = (id: number) => {
    const k = dugum(agac.kazanimlar, id);
    return [...konuYolu(k.ustId ?? 0), k.sira, id];
  };
  const altYolu = (id: number) => {
    const k = dugum(agac.altKazanimlar, id);
    return [...kazanimYolu(k.ustId ?? 0), k.sira, id];
  };
  const yolSirala = <T extends { id: number }>(dizi: T[], yol: (id: number) => number[]) => {
    const anahtar = new Map(dizi.map((x) => [x.id, yol(x.id)]));
    return dizi.sort((a, b) => {
      const ya = anahtar.get(a.id)!;
      const yb = anahtar.get(b.id)!;
      for (let i = 0; i < Math.max(ya.length, yb.length); i++) {
        const fark = (ya[i] ?? 0) - (yb[i] ?? 0);
        if (fark) return fark;
      }
      return 0;
    });
  };

  const dersler = yolSirala(
    [...ders].map(([id, s]) => grup(id, dugum(agac.dersler, id).ad, s)),
    dersYolu
  );
  const konular = yolSirala(
    [...konu].map(([id, s]) => {
      const k = dugum(agac.konular, id);
      return { ...grup(id, k.ad, s), dersAd: dugum(agac.dersler, k.ustId ?? 0).ad };
    }),
    konuYolu
  );
  const kazanimlar = yolSirala(
    [...kazanim].map(([id, s]) => {
      const k = dugum(agac.kazanimlar, id);
      return { ...grup(id, k.ad, s), kod: k.kod ?? null, konuAd: dugum(agac.konular, k.ustId ?? 0).ad };
    }),
    kazanimYolu
  );
  const altKazanimlar = yolSirala(
    [...alt].map(([id, s]) => {
      const k = dugum(agac.altKazanimlar, id);
      return { ...grup(id, k.ad, s), kod: k.kod ?? null, kazanimAd: dugum(agac.kazanimlar, k.ustId ?? 0).ad };
    }),
    altYolu
  );

  const adaylar: Zayif[] = [
    ...kazanimlar.map((g) => ({ seviye: "kazanim" as const, id: g.id, kod: g.kod, ad: g.ad, ustAd: g.konuAd, soru: g.soru, dogru: g.dogru, basari: g.basari })),
    ...altKazanimlar.map((g) => ({ seviye: "altKazanim" as const, id: g.id, kod: g.kod, ad: g.ad, ustAd: g.kazanimAd, soru: g.soru, dogru: g.dogru, basari: g.basari })),
  ];
  const zayiflar = adaylar
    .filter((z) => z.soru >= ZAYIF_EN_AZ_SORU && z.basari < ZAYIF_ESIK)
    // Kararlı sıralama: eşitlikte ağaç sırası korunur (kazanımlar alt kazanımlardan önce).
    .sort((a, b) => a.basari - b.basari || b.soru - a.soru)
    .slice(0, ZAYIF_EN_FAZLA);

  return {
    ozet: {
      soruSayisi: toplam.soru,
      dogru: toplam.dogru,
      yanlis: toplam.yanlis,
      bos: toplam.bos,
      net: netHesapla(toplam.dogru, toplam.yanlis, yanlisGoturme),
      yanlisGoturme,
      basari: basariHesapla(toplam.dogru, toplam.soru),
    },
    dersler,
    konular,
    kazanimlar,
    altKazanimlar,
    zayiflar,
  };
}

/** Seçilen şık ve doğruluk bilgisinden sonuç. */
export function sonucBelirle(secilenSikId: number | null, dogruMu: boolean | null): Sonuc {
  if (secilenSikId == null) return "bos";
  return dogruMu ? "dogru" : "yanlis";
}
