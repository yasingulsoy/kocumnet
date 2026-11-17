import type { Veritabani } from "../db.js";
import { adNormalize, excelOku, ExcelHatasi, ORNEK_SORU_METNI, type ExcelSatiri } from "../lib/excel.js";
import { ApiHata, bulunamadi, dogrulama } from "../lib/hatalar.js";
import { icerikHtml } from "../lib/icerik.js";
import { metinAnahtari, metinDenetle, siklariDenetle, siklariHazirla, type HazirSik } from "./soru.js";

/**
 * Excel'den soru içe aktarma (checkup/API.md "Excel'den içe aktarma").
 *   - Ağaç düğümleri adıyla eşleşir (büyük-küçük harf ve fazla boşluk farkı
 *     sayılmaz); kazanım ve alt kazanım koduyla da eşleşebilir.
 *   - İçe aktarma ağaca düğüm EKLEMEZ.
 *   - Tekrar denetimi hem veritabanına hem dosyanın kendisine yapılır.
 *   - Kayıt tek işlemde: hatalı satır varsa hiçbir şey yazılmaz.
 */

export interface DenetimSatiri {
  satir: number;
  durum: "gecerli" | "hatali";
  hatalar: string[];
  ozet: string;
}

export interface DenetimRaporu {
  toplam: number;
  gecerli: number;
  hatali: number;
  satirlar: DenetimSatiri[];
}

interface HazirSoru {
  dersId: number;
  konuId: number;
  kazanimId: number;
  altKazanimId: number;
  metin: string;
  metinHtml: string;
  cozum: string;
  cozumHtml: string;
  zorluk: number | null;
  siklar: HazirSik[];
}

interface Dugum {
  id: number;
  ad: string;
  kod?: string | null;
}

/** Ad, sonra kod ile eşleme. Birden fazla eşleşme belirsizliktir. */
function eslestir<T extends Dugum>(adaylar: T[], aranan: string, kodIle: boolean): { bulunan?: T; belirsiz?: boolean } {
  const anahtar = adNormalize(aranan);
  const adla = adaylar.filter((d) => adNormalize(d.ad) === anahtar);
  if (adla.length === 1) return { bulunan: adla[0] };
  if (adla.length > 1) return { belirsiz: true };
  if (kodIle) {
    const kodla = adaylar.filter((d) => d.kod && adNormalize(d.kod) === anahtar);
    if (kodla.length === 1) return { bulunan: kodla[0] };
    if (kodla.length > 1) return { belirsiz: true };
  }
  return {};
}

export async function iceAktarDenetle(db: Veritabani, sinavId: number, dosya: Buffer): Promise<{ rapor: DenetimRaporu; hazir: HazirSoru[] }> {
  const sinav = await db.sinav.findUnique({ where: { id: sinavId }, select: { id: true } });
  if (!sinav) throw bulunamadi("Sınav bulunamadı.");

  let satirlar: ExcelSatiri[];
  try {
    satirlar = await excelOku(dosya);
  } catch (e) {
    if (e instanceof ExcelHatasi) throw dogrulama(e.message, { dosya: e.message });
    throw e;
  }

  const [dersler, mevcut] = await Promise.all([
    db.ders.findMany({
      where: { sinavId },
      select: {
        id: true,
        ad: true,
        konular: {
          select: {
            id: true,
            ad: true,
            kazanimlar: { select: { id: true, ad: true, kod: true, altKazanimlar: { select: { id: true, ad: true, kod: true } } } },
          },
        },
      },
    }),
    db.soru.findMany({ where: { sinavId }, select: { id: true, metin: true } }),
  ]);

  const mevcutMetinler = new Map<string, number>();
  for (const s of mevcut) if (!mevcutMetinler.has(metinAnahtari(s.metin))) mevcutMetinler.set(metinAnahtari(s.metin), s.id);

  // Dosya içi tekrar: metin → satır numaraları
  const dosyaIci = new Map<string, number[]>();
  for (const s of satirlar) {
    const metin = s.degerler.soru;
    if (!metin.trim()) continue;
    const anahtar = metinAnahtari(metin);
    dosyaIci.set(anahtar, [...(dosyaIci.get(anahtar) ?? []), s.satir]);
  }

  const raporSatirlari: DenetimSatiri[] = [];
  const hazir: HazirSoru[] = [];

  for (const { satir, degerler: d } of satirlar) {
    const hatalar: string[] = [];

    // Ağaç
    let yol: { dersId: number; konuId: number; kazanimId: number; altKazanimId: number } | null = null;
    const zorunlu = (deger: string, ad: string) => {
      if (!deger.trim()) hatalar.push(`${ad} boş.`);
      return deger.trim();
    };
    const dersAd = zorunlu(d.ders, "Ders");
    const konuAd = zorunlu(d.konu, "Konu");
    const kazanimAd = zorunlu(d.kazanim, "Kazanım");
    const altAd = zorunlu(d.altKazanim, "Alt kazanım");
    if (dersAd && konuAd && kazanimAd && altAd) {
      const ders = eslestir(dersler, dersAd, false);
      if (!ders.bulunan) hatalar.push(ders.belirsiz ? `"${dersAd}" birden fazla dersle eşleşiyor.` : `"${dersAd}" adlı ders bu sınavda yok.`);
      const konu = ders.bulunan ? eslestir(ders.bulunan.konular, konuAd, false) : {};
      if (ders.bulunan && !konu.bulunan) hatalar.push(konu.belirsiz ? `"${konuAd}" birden fazla konuyla eşleşiyor.` : `"${konuAd}" adlı konu "${ders.bulunan.ad}" dersinde yok.`);
      const kazanim = konu.bulunan ? eslestir(konu.bulunan.kazanimlar, kazanimAd, true) : {};
      if (konu.bulunan && !kazanim.bulunan) {
        hatalar.push(kazanim.belirsiz ? `"${kazanimAd}" birden fazla kazanımla eşleşiyor.` : `"${kazanimAd}" adlı ya da kodlu kazanım "${konu.bulunan.ad}" konusunda yok.`);
      }
      const alt = kazanim.bulunan ? eslestir(kazanim.bulunan.altKazanimlar, altAd, true) : {};
      if (kazanim.bulunan && !alt.bulunan) {
        hatalar.push(alt.belirsiz ? `"${altAd}" birden fazla alt kazanımla eşleşiyor.` : `"${altAd}" adlı ya da kodlu alt kazanım "${kazanim.bulunan.ad}" kazanımında yok.`);
      }
      if (ders.bulunan && konu.bulunan && kazanim.bulunan && alt.bulunan) {
        yol = { dersId: ders.bulunan.id, konuId: konu.bulunan.id, kazanimId: kazanim.bulunan.id, altKazanimId: alt.bulunan.id };
      }
    }

    // İçerik (elle girilen soruyla aynı kurallar)
    const alanHatalari: Record<string, string> = {};
    metinDenetle("metin", d.soru, alanHatalari);
    metinDenetle("cozum", d.cozum, alanHatalari);
    const siklar = [d.a, d.b, d.c, d.d, d.e].map((metin) => ({ metin }));
    Object.assign(alanHatalari, siklariDenetle(siklar, d.dogru));
    hatalar.push(...Object.values(alanHatalari));

    let zorluk: number | null = null;
    if (d.zorluk.trim()) {
      const z = Number(d.zorluk.trim().replace(",", "."));
      if (!Number.isInteger(z) || z < 1 || z > 5) hatalar.push("Zorluk boş ya da 1–5 arası bir tamsayı olmalı.");
      else zorluk = z;
    }

    if (d.soru.trim() === ORNEK_SORU_METNI) hatalar.push("Bu, şablondaki örnek satır. Silin ya da kendi sorunuzla değiştirin.");

    // Tekrar denetimi
    if (d.soru.trim()) {
      const anahtar = metinAnahtari(d.soru);
      const var_ = mevcutMetinler.get(anahtar);
      if (var_ !== undefined) hatalar.push(`Aynı soru zaten var: #${var_}`);
      const diger = (dosyaIci.get(anahtar) ?? []).filter((n) => n !== satir);
      if (diger.length) hatalar.push(`Aynı soru dosyada ${diger.join(", ")}. satırda da var.`);
    }

    const ozet = d.soru.trim().replace(/\s+/g, " ").slice(0, 80);
    raporSatirlari.push({ satir, durum: hatalar.length ? "hatali" : "gecerli", hatalar, ozet });

    if (!hatalar.length && yol) {
      hazir.push({
        ...yol,
        metin: d.soru,
        metinHtml: icerikHtml(d.soru),
        cozum: d.cozum,
        cozumHtml: icerikHtml(d.cozum),
        zorluk,
        siklar: siklariHazirla(siklar, d.dogru),
      });
    }
  }

  const hatali = raporSatirlari.filter((s) => s.durum === "hatali").length;
  return { rapor: { toplam: raporSatirlari.length, gecerli: raporSatirlari.length - hatali, hatali, satirlar: raporSatirlari }, hazir };
}

export async function iceAktarKaydet(
  db: Veritabani,
  p: { sinavId: number; dosya: Buffer; dosyaAdi: string; yoneticiId: number }
): Promise<{ iceAktarmaId: number; eklenen: number }> {
  const { rapor, hazir } = await iceAktarDenetle(db, p.sinavId, p.dosya);
  if (rapor.hatali > 0 || hazir.length !== rapor.toplam) {
    throw new ApiHata("DOGRULAMA", `Dosyada ${rapor.hatali} hatalı satır var; hiçbir soru kaydedilmedi. Hataları düzeltip yeniden yükleyin.`, {
      ek: rapor as unknown as Record<string, unknown>,
    });
  }

  return db.$transaction(
    async (tx) => {
      const kayit = await tx.iceAktarma.create({
        data: { sinavId: p.sinavId, dosyaAdi: p.dosyaAdi.slice(0, 255), soruSayisi: hazir.length, yoneticiId: p.yoneticiId },
        select: { id: true },
      });
      for (const s of hazir) {
        await tx.soru.create({
          data: {
            sinavId: p.sinavId,
            dersId: s.dersId,
            konuId: s.konuId,
            kazanimId: s.kazanimId,
            altKazanimId: s.altKazanimId,
            metin: s.metin,
            metinHtml: s.metinHtml,
            cozum: s.cozum,
            cozumHtml: s.cozumHtml,
            zorluk: s.zorluk,
            aktif: true,
            iceAktarmaId: kayit.id,
            siklar: { createMany: { data: s.siklar } },
          },
          select: { id: true },
        });
      }
      return { iceAktarmaId: kayit.id, eklenen: hazir.length };
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}
