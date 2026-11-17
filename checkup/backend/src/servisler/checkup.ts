import type { Prisma } from "../generated/prisma/client.js";
import type { Baglam } from "../http/baglam.js";
import { ApiHata, bulunamadi, dogrulama } from "../lib/hatalar.js";
import { icerikHtml, htmlKacisla } from "../lib/icerik.js";
import { raporHesapla, sonucBelirle, type AgacBilgisi, type AgacDugumu, type RaporHesabi } from "../lib/puanlama.js";
import { karmaSec, SecimHatasi, type HavuzSorusu } from "../lib/secim.js";
import { HARFLER } from "../lib/siklar.js";
import { bitisAni, bitisSiniriHesapla, sureSaniye, suresiDoldu } from "../lib/sure.js";
import { ayarDurumu, type Db } from "./ayarlar.js";

/**
 * Öğrencinin check-up'ı: başlatma, test ekranı, cevap, bitirme, rapor.
 *
 * Eşzamanlılık:
 *   - Başlatma öğrenci başına danışma kilidiyle (pg_advisory_xact_lock)
 *     sıraya girer: aynı anda iki istek iki açık check-up açamaz.
 *   - Bitirme durum geçişini koşullu güncellemeyle yapar
 *     (UPDATE … WHERE durum = 'DEVAM'); aynı anda gelen iki bitir çağrısından
 *     yalnızca biri puanlar, öteki satır kilidinin bırakılmasını bekleyip 0
 *     satır günceller.
 *   - Cevap kaydı check-up satırını kilitler (SELECT … FOR UPDATE): cevap ile
 *     bitirme iç içe geçemez, puanlanan cevap kaydedilen cevaptır.
 */

type Tx = Prisma.TransactionClient;

const KILIT_CHECKUP_BASLAT = 41001;

// ─── Bitirme ──────────────────────────────────────────────────

export interface SaklananRapor extends RaporHesabi {
  sinav: { id: number; ad: string };
  tur: { id: number; ad: string };
  baslangic: string;
  bitis: string;
  sureSaniye: number;
}

async function agacBilgisiYukle(tx: Db, ids: { ders: number[]; konu: number[]; kazanim: number[]; alt: number[] }): Promise<AgacBilgisi> {
  // Sırayla: işlem içinde tek bağlantı var.
  const dersler = await tx.ders.findMany({ where: { id: { in: ids.ders } }, select: { id: true, ad: true, sira: true } });
  const konular = await tx.konu.findMany({ where: { id: { in: ids.konu } }, select: { id: true, ad: true, sira: true, dersId: true } });
  const kazanimlar = await tx.kazanim.findMany({ where: { id: { in: ids.kazanim } }, select: { id: true, ad: true, sira: true, kod: true, konuId: true } });
  const altlar = await tx.altKazanim.findMany({ where: { id: { in: ids.alt } }, select: { id: true, ad: true, sira: true, kod: true, kazanimId: true } });
  const harita = <T extends { id: number }>(dizi: T[], f: (x: T) => AgacDugumu) => new Map(dizi.map((x) => [x.id, f(x)]));
  return {
    dersler: harita(dersler, (d) => ({ ad: d.ad, sira: d.sira })),
    konular: harita(konular, (k) => ({ ad: k.ad, sira: k.sira, ustId: k.dersId })),
    kazanimlar: harita(kazanimlar, (k) => ({ ad: k.ad, sira: k.sira, kod: k.kod, ustId: k.konuId })),
    altKazanimlar: harita(altlar, (k) => ({ ad: k.ad, sira: k.sira, kod: k.kod, ustId: k.kazanimId })),
  };
}

/**
 * Check-up'ı bitirir ve puanlar (işlem içinde çağrılır). Bu çağrı bitirdiyse
 * true; zaten bitmişse (ya da eşzamanlı başka bir çağrı bitirdiyse) false.
 */
export async function checkupBitirIslem(tx: Tx, checkupId: number, simdi: Date): Promise<boolean> {
  const c = await tx.checkup.findUnique({
    where: { id: checkupId },
    select: { baslangic: true, bitisSiniri: true, yanlisGoturme: true, sinav: { select: { id: true, ad: true } }, tur: { select: { id: true, ad: true } } },
  });
  if (!c) return false;
  const bitis = bitisAni(simdi, c.bitisSiniri);

  // Durum geçişi koşullu: satır kilidini alır; eşzamanlı ikinci çağrı burada bekler, sonra 0 satır günceller.
  const gecis = await tx.checkup.updateMany({ where: { id: checkupId, durum: "DEVAM" }, data: { durum: "BITTI", bitis } });
  if (gecis.count === 0) return false;

  const sorular = await tx.checkupSorusu.findMany({
    where: { checkupId },
    orderBy: { sira: "asc" },
    select: {
      sira: true,
      soruId: true,
      dersId: true,
      konuId: true,
      kazanimId: true,
      altKazanimId: true,
      secilenSikId: true,
      secilenSik: { select: { dogru: true, soruId: true } },
    },
  });

  const dogrular: number[] = [];
  const yanlislar: number[] = [];
  const sonuclar = sorular.map((s) => {
    let dogruMu: boolean | null = null;
    if (s.secilenSikId != null) {
      dogruMu = Boolean(s.secilenSik?.dogru) && s.secilenSik?.soruId === s.soruId;
      (dogruMu ? dogrular : yanlislar).push(s.sira);
    }
    return { dersId: s.dersId, konuId: s.konuId, kazanimId: s.kazanimId, altKazanimId: s.altKazanimId, sonuc: sonucBelirle(s.secilenSikId, dogruMu) };
  });
  if (dogrular.length) await tx.checkupSorusu.updateMany({ where: { checkupId, sira: { in: dogrular } }, data: { dogruMu: true } });
  if (yanlislar.length) await tx.checkupSorusu.updateMany({ where: { checkupId, sira: { in: yanlislar } }, data: { dogruMu: false } });

  const tekil = (f: (s: (typeof sorular)[number]) => number) => [...new Set(sorular.map(f))];
  const agac = await agacBilgisiYukle(tx, {
    ders: tekil((s) => s.dersId),
    konu: tekil((s) => s.konuId),
    kazanim: tekil((s) => s.kazanimId),
    alt: tekil((s) => s.altKazanimId),
  });
  const hesap = raporHesapla({ sonuclar, agac, yanlisGoturme: c.yanlisGoturme });
  const rapor: SaklananRapor = {
    sinav: c.sinav,
    tur: c.tur,
    baslangic: c.baslangic.toISOString(),
    bitis: bitis.toISOString(),
    sureSaniye: sureSaniye(c.baslangic, bitis),
    ...hesap,
  };

  await tx.checkup.update({
    where: { id: checkupId },
    data: {
      dogru: hesap.ozet.dogru,
      yanlis: hesap.ozet.yanlis,
      bos: hesap.ozet.bos,
      net: hesap.ozet.net,
      rapor: rapor as unknown as Prisma.InputJsonValue,
    },
  });
  return true;
}

export async function checkupBitir(b: Baglam, checkupId: number): Promise<boolean> {
  return b.db.$transaction((tx) => checkupBitirIslem(tx, checkupId, b.saat.simdi()), { timeout: 30_000 });
}

/** Süresi (toleransıyla) geçmiş açık check-up'ları bitirir. ogrenciId verilmezse yalnızca checkupId'ye bakar. */
export async function suresiDolanlariBitir(b: Baglam, filtre: { ogrenciId?: number; checkupId?: number }): Promise<void> {
  const simdi = b.saat.simdi();
  const acik = await b.db.checkup.findMany({
    where: { durum: "DEVAM", ...(filtre.ogrenciId ? { ogrenciId: filtre.ogrenciId } : {}), ...(filtre.checkupId ? { id: filtre.checkupId } : {}) },
    select: { id: true, bitisSiniri: true },
  });
  for (const c of acik) {
    if (suresiDoldu(simdi, c.bitisSiniri)) await checkupBitir(b, c.id);
  }
}

// ─── Özet ─────────────────────────────────────────────────────

export const ozetSecimi = {
  id: true,
  durum: true,
  soruSayisi: true,
  baslangic: true,
  bitisSiniri: true,
  bitis: true,
  dogru: true,
  yanlis: true,
  bos: true,
  net: true,
  sinav: { select: { id: true, ad: true } },
  tur: { select: { id: true, ad: true } },
  _count: { select: { sorular: { where: { secilenSikId: { not: null } } } } },
} satisfies Prisma.CheckupSelect;

type OzetSatiri = Prisma.CheckupGetPayload<{ select: typeof ozetSecimi }>;

/** CheckupOzeti (checkup/API.md "Nesneler"). Devam edende sonuç alanları null. */
export function checkupOzeti(c: OzetSatiri) {
  const bitti = c.durum === "BITTI";
  return {
    id: c.id,
    durum: c.durum,
    sinav: { id: c.sinav.id, ad: c.sinav.ad },
    tur: { id: c.tur.id, ad: c.tur.ad },
    soruSayisi: c.soruSayisi,
    cevaplanan: c._count.sorular,
    baslangic: c.baslangic,
    bitisSiniri: c.bitisSiniri,
    bitis: bitti ? c.bitis : null,
    dogru: bitti ? c.dogru : null,
    yanlis: bitti ? c.yanlis : null,
    bos: bitti ? c.bos : null,
    net: bitti ? c.net : null,
  };
}

export async function checkupListesi(b: Baglam, ogrenciId: number) {
  await suresiDolanlariBitir(b, { ogrenciId });
  const liste = await b.db.checkup.findMany({
    where: { ogrenciId },
    orderBy: [{ baslangic: "desc" }, { id: "desc" }],
    select: ozetSecimi,
  });
  return liste.map(checkupOzeti);
}

// ─── Başlatma ─────────────────────────────────────────────────

export async function checkupBaslat(b: Baglam, ogrenciId: number, sinavId: number, turId: number): Promise<{ id: number }> {
  return b.db.$transaction(
    async (tx) => {
      const simdi = b.saat.simdi();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KILIT_CHECKUP_BASLAT}::int, ${ogrenciId}::int)`;

      const acik = await tx.checkup.findMany({ where: { ogrenciId, durum: "DEVAM" }, select: { id: true, bitisSiniri: true } });
      for (const c of acik) {
        if (suresiDoldu(simdi, c.bitisSiniri)) {
          await checkupBitirIslem(tx, c.id, simdi);
        } else {
          throw new ApiHata("ACIK_CHECKUP_VAR", "Bitmemiş bir check-up'ınız var. Önce onu tamamlayın ya da bitirin.", { ek: { checkupId: c.id } });
        }
      }

      const sinav = await tx.sinav.findFirst({ where: { id: sinavId, aktif: true }, select: { id: true, yanlisGoturme: true } });
      if (!sinav) throw bulunamadi("Sınav bulunamadı ya da şu an açık değil.");
      const tur = await tx.checkupTuru.findFirst({ where: { id: turId, aktif: true }, select: { id: true, soruSayisi: true, sureDakika: true } });
      if (!tur) throw bulunamadi("Check-up türü bulunamadı ya da şu an açık değil.");

      const ayar = await ayarDurumu(tx, sinav.id, tur.id);
      if (!ayar || !ayar.hazirlik.hazir) {
        throw new ApiHata("HAZIR_DEGIL", "Bu check-up henüz hazırlanıyor; şu an başlatılamaz.");
      }

      const secilen = ayar.secim === "SABIT" ? await sabitSorulariAl(tx, ayar.sabitIdler) : await karmaSorulariAl(b, tx, ogrenciId, sinav.id, ayar);
      if (secilen.length !== tur.soruSayisi) {
        throw new ApiHata("HAZIR_DEGIL", "Bu check-up için yeterli soru yok; şu an başlatılamaz.");
      }

      const checkup = await tx.checkup.create({
        data: {
          ogrenciId,
          sinavId: sinav.id,
          turId: tur.id,
          durum: "DEVAM",
          soruSayisi: tur.soruSayisi,
          sureDakika: tur.sureDakika,
          yanlisGoturme: sinav.yanlisGoturme,
          secim: ayar.secim,
          baslangic: simdi,
          bitisSiniri: bitisSiniriHesapla(simdi, tur.sureDakika),
          sorular: {
            createMany: {
              data: secilen.map((s, i) => ({
                sira: i + 1,
                soruId: s.id,
                dersId: s.dersId,
                konuId: s.konuId,
                kazanimId: s.kazanimId,
                altKazanimId: s.altKazanimId,
              })),
            },
          },
        },
        select: { id: true },
      });
      return { id: checkup.id };
    },
    { timeout: 30_000 }
  );
}

interface SecilenSoru extends HavuzSorusu {
  altKazanimId: number;
}

async function sabitSorulariAl(tx: Tx, idler: number[]): Promise<SecilenSoru[]> {
  const sorular = await tx.soru.findMany({
    where: { id: { in: idler }, aktif: true },
    select: { id: true, dersId: true, konuId: true, kazanimId: true, altKazanimId: true, ders: { select: { sira: true } }, konu: { select: { sira: true } } },
  });
  const harita = new Map(sorular.map((s) => [s.id, s]));
  return idler.flatMap((id) => {
    const s = harita.get(id);
    return s ? [{ id: s.id, dersId: s.dersId, dersSira: s.ders.sira, konuId: s.konuId, konuSira: s.konu.sira, kazanimId: s.kazanimId, altKazanimId: s.altKazanimId }] : [];
  });
}

async function karmaSorulariAl(
  b: Baglam,
  tx: Tx,
  ogrenciId: number,
  sinavId: number,
  ayar: NonNullable<Awaited<ReturnType<typeof ayarDurumu>>>
): Promise<SecilenSoru[]> {
  const kazanimIdler = ayar.recete.flatMap((r) => (r.kazanimId != null ? [r.kazanimId] : []));
  const konuIdler = ayar.recete.flatMap((r) => (r.kazanimId == null && r.konuId != null ? [r.konuId] : []));

  const havuz = await tx.soru.findMany({
    where: { sinavId, aktif: true, OR: [{ kazanimId: { in: kazanimIdler } }, { konuId: { in: konuIdler } }] },
    select: { id: true, dersId: true, konuId: true, kazanimId: true, altKazanimId: true, ders: { select: { sira: true } }, konu: { select: { sira: true } } },
  });
  const gorulen = await tx.checkupSorusu.findMany({ where: { checkup: { ogrenciId, sinavId } }, select: { soruId: true }, distinct: ["soruId"] });

  const altHaritasi = new Map(havuz.map((s) => [s.id, s.altKazanimId]));
  try {
    const secilen = karmaSec({
      satirlar: ayar.recete.map((r) => ({ konuId: r.konuId, kazanimId: r.kazanimId, soruSayisi: r.soruSayisi })),
      havuz: havuz.map((s) => ({ id: s.id, dersId: s.dersId, dersSira: s.ders.sira, konuId: s.konuId, konuSira: s.konu.sira, kazanimId: s.kazanimId })),
      gorulen: new Set(gorulen.map((g) => g.soruId)),
      rastgele: b.rastgele,
    });
    return secilen.map((s) => ({ ...s, altKazanimId: altHaritasi.get(s.id)! }));
  } catch (e) {
    if (e instanceof SecimHatasi) throw new ApiHata("HAZIR_DEGIL", "Bu check-up için yeterli soru yok; şu an başlatılamaz.");
    throw e;
  }
}

// ─── Test ekranı ──────────────────────────────────────────────

/**
 * Test ekranı. CEVAP ANAHTARI SIZMAZ: doğru şık, çözüm ve şık açıklaması bu
 * yanıtta yoktur. Prisma satırı asla yayılmaz; alanlar tek tek seçilir.
 */
export async function testEkrani(b: Baglam, ogrenciId: number, checkupId: number) {
  const bul = () =>
    b.db.checkup.findFirst({
      where: { id: checkupId, ogrenciId },
      select: {
        id: true,
        durum: true,
        soruSayisi: true,
        sureDakika: true,
        yanlisGoturme: true,
        baslangic: true,
        bitisSiniri: true,
        sinav: { select: { id: true, ad: true } },
        tur: { select: { id: true, ad: true } },
      },
    });
  let c = await bul();
  if (!c) throw bulunamadi("Check-up bulunamadı.");
  if (c.durum === "DEVAM" && suresiDoldu(b.saat.simdi(), c.bitisSiniri)) {
    await checkupBitir(b, c.id);
    c = await bul();
    if (!c) throw bulunamadi("Check-up bulunamadı.");
  }
  if (c.durum === "BITTI") return { id: c.id, durum: "BITTI" as const };

  const sorular = await b.db.checkupSorusu.findMany({
    where: { checkupId: c.id },
    orderBy: { sira: "asc" },
    select: {
      sira: true,
      secilenSikId: true,
      ders: { select: { ad: true } },
      soru: { select: { metinHtml: true, gorselId: true, siklar: { orderBy: { sira: "asc" }, select: { id: true, sira: true, metinHtml: true } } } },
    },
  });

  return {
    id: c.id,
    durum: "DEVAM" as const,
    sinav: { id: c.sinav.id, ad: c.sinav.ad },
    tur: { id: c.tur.id, ad: c.tur.ad },
    soruSayisi: c.soruSayisi,
    sureDakika: c.sureDakika,
    yanlisGoturme: c.yanlisGoturme,
    baslangic: c.baslangic,
    bitisSiniri: c.bitisSiniri,
    simdi: b.saat.simdi(),
    sorular: sorular.map((s) => ({
      sira: s.sira,
      ders: s.ders.ad,
      metinHtml: s.soru.metinHtml,
      gorselId: s.soru.gorselId,
      siklar: s.soru.siklar.map((k) => ({ id: k.id, harf: HARFLER[k.sira] ?? "?", metinHtml: k.metinHtml })),
      secilenSikId: s.secilenSikId,
    })),
  };
}

// ─── Cevap ────────────────────────────────────────────────────

export async function cevapKaydet(b: Baglam, ogrenciId: number, checkupId: number, sira: number, sikId: number | null): Promise<void> {
  const simdi = b.saat.simdi();
  const sonuc = await b.db.$transaction(
    async (tx) => {
      // Satır kilidi: bitirme ile iç içe geçmesin.
      const satir = await tx.$queryRaw<{ durum: string; bitisSiniri: Date }[]>`
        SELECT "durum"::text AS "durum", "bitisSiniri" FROM "checkuplar"
        WHERE "id" = ${checkupId}::int AND "ogrenciId" = ${ogrenciId}::int
        FOR UPDATE`;
      const c = satir[0];
      if (!c) throw bulunamadi("Check-up bulunamadı.");
      if (c.durum !== "DEVAM") throw new ApiHata("KAPANDI", "Bu check-up bitti; cevap değiştirilemez.");
      if (suresiDoldu(simdi, new Date(c.bitisSiniri))) {
        await checkupBitirIslem(tx, checkupId, simdi);
        return "SURE_DOLDU" as const;
      }

      const cs = await tx.checkupSorusu.findUnique({ where: { checkupId_sira: { checkupId, sira } }, select: { soruId: true } });
      if (!cs) throw bulunamadi("Bu sırada soru yok.");
      if (sikId !== null) {
        const sik = await tx.sik.findUnique({ where: { id: sikId }, select: { soruId: true } });
        if (!sik || sik.soruId !== cs.soruId) throw dogrulama("Bu şık bu soruya ait değil.", { sikId: "Bu şık bu soruya ait değil." });
      }
      await tx.checkupSorusu.update({
        where: { checkupId_sira: { checkupId, sira } },
        data: { secilenSikId: sikId, cevapZamani: sikId === null ? null : simdi },
      });
      return "TAMAM" as const;
    },
    { timeout: 30_000 }
  );
  if (sonuc === "SURE_DOLDU") throw new ApiHata("SURE_DOLDU", "Süre doldu; check-up kapatıldı. Raporunuza bakabilirsiniz.");
}

// ─── Bitir (öğrenci) ──────────────────────────────────────────

export async function ogrenciBitir(b: Baglam, ogrenciId: number, checkupId: number) {
  const c = await b.db.checkup.findFirst({ where: { id: checkupId, ogrenciId }, select: { id: true, durum: true } });
  if (!c) throw bulunamadi("Check-up bulunamadı.");
  if (c.durum === "DEVAM") await checkupBitir(b, c.id);
  return { id: c.id, durum: "BITTI" as const };
}

// ─── Rapor ────────────────────────────────────────────────────

function aciklamaHtml(aciklama: string | null): string | null {
  if (!aciklama) return null;
  try {
    return icerikHtml(aciklama);
  } catch {
    return htmlKacisla(aciklama);
  }
}

/** Rapor + inceleme. ogrenciId verilirse yalnızca o öğrencinin check-up'ı (admin vermez). */
export async function raporGetir(b: Baglam, checkupId: number, ogrenciId?: number) {
  const where = { id: checkupId, ...(ogrenciId !== undefined ? { ogrenciId } : {}) };
  const ilk = await b.db.checkup.findFirst({ where, select: { id: true, durum: true, bitisSiniri: true } });
  if (!ilk) throw bulunamadi("Check-up bulunamadı.");
  if (ilk.durum === "DEVAM" && suresiDoldu(b.saat.simdi(), ilk.bitisSiniri)) await checkupBitir(b, ilk.id);

  const c = await b.db.checkup.findFirst({
    where,
    select: { id: true, durum: true, rapor: true, ogrenci: { select: { id: true, adSoyad: true } } },
  });
  if (!c) throw bulunamadi("Check-up bulunamadı.");
  if (c.durum !== "BITTI" || !c.rapor) throw new ApiHata("HAZIR_DEGIL", "Check-up henüz bitmedi; rapor bitince hazırlanır.");
  const rapor = c.rapor as unknown as SaklananRapor;

  const sorular = await b.db.checkupSorusu.findMany({
    where: { checkupId: c.id },
    orderBy: { sira: "asc" },
    select: {
      sira: true,
      secilenSikId: true,
      dogruMu: true,
      ders: { select: { ad: true } },
      konu: { select: { ad: true } },
      kazanim: { select: { ad: true } },
      altKazanim: { select: { ad: true } },
      soru: {
        select: {
          metinHtml: true,
          gorselId: true,
          cozumHtml: true,
          siklar: { orderBy: { sira: "asc" }, select: { id: true, sira: true, metinHtml: true, dogru: true, aciklama: true } },
        },
      },
    },
  });

  return {
    yanit: {
      id: c.id,
      sinav: rapor.sinav,
      tur: rapor.tur,
      baslangic: rapor.baslangic,
      bitis: rapor.bitis,
      sureSaniye: rapor.sureSaniye,
      ozet: rapor.ozet,
      dersler: rapor.dersler,
      konular: rapor.konular,
      kazanimlar: rapor.kazanimlar,
      altKazanimlar: rapor.altKazanimlar,
      zayiflar: rapor.zayiflar,
      inceleme: sorular.map((s) => ({
        sira: s.sira,
        metinHtml: s.soru.metinHtml,
        gorselId: s.soru.gorselId,
        ders: s.ders.ad,
        konu: s.konu.ad,
        kazanim: s.kazanim.ad,
        altKazanim: s.altKazanim.ad,
        siklar: s.soru.siklar.map((k) => ({
          id: k.id,
          harf: HARFLER[k.sira] ?? "?",
          metinHtml: k.metinHtml,
          dogru: k.dogru,
          aciklama: k.aciklama,
          aciklamaHtml: aciklamaHtml(k.aciklama),
        })),
        secilenSikId: s.secilenSikId,
        sonuc: sonucBelirle(s.secilenSikId, s.dogruMu),
        cozumHtml: s.soru.cozumHtml,
      })),
    },
    ogrenci: c.ogrenci,
  };
}
