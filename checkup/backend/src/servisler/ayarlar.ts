import type { Veritabani } from "../db.js";
import type { Prisma } from "../generated/prisma/client.js";
import { hazirlikHesapla, type Hazirlik } from "../lib/hazirlik.js";

/**
 * Check-up ayarlarının (reçete ve sabit liste) veritabanından okunması ve
 * hazırlığın hesaplanması. Katalog, pano, ayarlar ekranı ve başlatma aynı
 * fonksiyonu kullanır: "hazır" kararı tek yerde.
 */

export type Db = Veritabani | Prisma.TransactionClient;

export interface AyarDurumu {
  sinavId: number;
  tur: { id: number; ad: string; aciklama: string | null; soruSayisi: number; sureDakika: number; aktif: boolean };
  secim: "KARMA" | "SABIT";
  recete: { id: number; konuId: number | null; kazanimId: number | null; ad: string; ustAd: string; soruSayisi: number; havuz: number }[];
  sabitSorular: { soruId: number; sira: number; metin: string; konu: string; aktif: boolean }[];
  hazirlik: Hazirlik;
  /** Seçim için: sabit listedeki soru kimlikleri sırasıyla. */
  sabitIdler: number[];
}

const kisalt = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/** Her sınav için bütün türlerin (pasifler dahil) ayar durumu, tür sırasıyla. */
export async function ayarDurumlari(db: Db, sinavIdler: number[]): Promise<Map<number, AyarDurumu[]>> {
  const sonuc = new Map<number, AyarDurumu[]>();
  if (!sinavIdler.length) return sonuc;

  // Sorgular sırayla: bu fonksiyon işlem (transaction) içinde de çağrılır ve
  // işlem tek bağlantıdır; aynı bağlantıda eşzamanlı sorgu pg 9'da kalkıyor.
  const turler = await db.checkupTuru.findMany({
      orderBy: [{ sira: "asc" }, { id: "asc" }],
      select: { id: true, ad: true, aciklama: true, soruSayisi: true, sureDakika: true, aktif: true },
    });
  const ayarlar = await db.checkupAyari.findMany({
      where: { sinavId: { in: sinavIdler } },
      select: {
        sinavId: true,
        turId: true,
        secim: true,
        recete: {
          orderBy: [{ sira: "asc" }, { id: "asc" }],
          select: {
            id: true,
            konuId: true,
            kazanimId: true,
            soruSayisi: true,
            konu: { select: { ad: true, ders: { select: { ad: true } } } },
            kazanim: { select: { ad: true, kod: true, konuId: true, konu: { select: { ad: true } } } },
          },
        },
        sabitSorular: {
          orderBy: { sira: "asc" },
          select: { sira: true, soru: { select: { id: true, metin: true, aktif: true, sinavId: true, konu: { select: { ad: true } } } } },
        },
      },
    });
  const kazanimSayilari = await db.soru.groupBy({ by: ["kazanimId"], where: { sinavId: { in: sinavIdler }, aktif: true }, _count: { _all: true } });
  const konuSayilari = await db.soru.groupBy({ by: ["konuId"], where: { sinavId: { in: sinavIdler }, aktif: true }, _count: { _all: true } });

  const kazanimAktif = new Map(kazanimSayilari.map((s) => [s.kazanimId, s._count._all]));
  const konuAktif = new Map(konuSayilari.map((s) => [s.konuId, s._count._all]));
  const ayarHaritasi = new Map(ayarlar.map((a) => [`${a.sinavId}:${a.turId}`, a]));

  for (const sinavId of sinavIdler) {
    const liste: AyarDurumu[] = [];
    for (const tur of turler) {
      const ayar = ayarHaritasi.get(`${sinavId}:${tur.id}`);
      const secim = ayar?.secim ?? "KARMA";
      const receteSatirlari = ayar?.recete ?? [];
      const sabit = ayar?.sabitSorular ?? [];

      const recete = receteSatirlari.map((r) =>
        r.kazanimId != null
          ? {
              id: r.id,
              konuId: null,
              kazanimId: r.kazanimId,
              ad: r.kazanim ? (r.kazanim.kod ? `${r.kazanim.kod} ${r.kazanim.ad}` : r.kazanim.ad) : `#${r.kazanimId}`,
              ustAd: r.kazanim?.konu.ad ?? "",
              soruSayisi: r.soruSayisi,
              havuz: kazanimAktif.get(r.kazanimId) ?? 0,
            }
          : {
              id: r.id,
              konuId: r.konuId,
              kazanimId: null,
              ad: r.konu?.ad ?? `#${r.konuId}`,
              ustAd: r.konu?.ders.ad ?? "",
              soruSayisi: r.soruSayisi,
              havuz: r.konuId != null ? (konuAktif.get(r.konuId) ?? 0) : 0,
            }
      );

      const hazirlik = hazirlikHesapla({
        turSoruSayisi: tur.soruSayisi,
        secim,
        recete: receteSatirlari.map((r) => ({
          konuId: r.kazanimId != null ? null : r.konuId,
          kazanimId: r.kazanimId,
          soruSayisi: r.soruSayisi,
          ad: r.kazanimId != null ? (r.kazanim?.ad ?? `#${r.kazanimId}`) : (r.konu?.ad ?? `#${r.konuId}`),
          kazanimKonuId: r.kazanim?.konuId ?? null,
        })),
        kazanimAktif,
        konuAktif,
        sabit: sabit.map((s) => ({ soruId: s.soru.id, aktif: s.soru.aktif, sinavUygun: s.soru.sinavId === sinavId })),
      });

      liste.push({
        sinavId,
        tur,
        secim,
        recete,
        sabitSorular: sabit.map((s) => ({
          soruId: s.soru.id,
          sira: s.sira,
          metin: kisalt(s.soru.metin, 120),
          konu: s.soru.konu.ad,
          aktif: s.soru.aktif,
        })),
        hazirlik,
        sabitIdler: sabit.map((s) => s.soru.id),
      });
    }
    sonuc.set(sinavId, liste);
  }
  return sonuc;
}

export async function ayarDurumu(db: Db, sinavId: number, turId: number): Promise<AyarDurumu | null> {
  const liste = (await ayarDurumlari(db, [sinavId])).get(sinavId) ?? [];
  return liste.find((d) => d.tur.id === turId) ?? null;
}

/** API yanıtı (checkup/API.md "Check-up ayarları"). */
export function ayarYaniti(d: AyarDurumu) {
  return {
    tur: { id: d.tur.id, ad: d.tur.ad, soruSayisi: d.tur.soruSayisi, sureDakika: d.tur.sureDakika, aktif: d.tur.aktif },
    secim: d.secim,
    recete: d.recete,
    sabitSorular: d.sabitSorular,
    hazirlik: d.hazirlik,
  };
}
