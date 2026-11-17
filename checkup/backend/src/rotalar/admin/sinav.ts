import { Router } from "express";
import { z } from "zod";
import type { Baglam } from "../../http/baglam.js";
import { yoneticiRoluGerekli } from "../../http/ara-katmanlar.js";
import { dogrula, kimlik, prismaIle } from "../../http/yardimcilar.js";
import { ApiHata, bulunamadi } from "../../lib/hatalar.js";
import { ayarDurumlari, type Db } from "../../servisler/ayarlar.js";

// ─── Şemalar ──────────────────────────────────────────────────

const adSemasi = (ne: string) =>
  z.string({ error: `${ne} adı yazın.` }).trim().min(1, { error: `${ne} adı boş olamaz.` }).max(80, { error: `${ne} adı en fazla 80 karakter olabilir.` });

const aciklamaSemasi = z
  .string({ error: "Açıklama metin olmalı." })
  .trim()
  .max(1000, { error: "Açıklama en fazla 1000 karakter olabilir." })
  .nullable()
  .transform((v) => (v ? v : null));

const siraSemasi = z.number({ error: "Sıra sayı olmalı." }).int({ error: "Sıra tamsayı olmalı." }).min(0).max(100_000);

const sinavAlanlari = {
  ad: adSemasi("Sınav"),
  aciklama: aciklamaSemasi.optional(),
  ucretKurus: z
    .number({ error: "Ücret kuruş cinsinden sayı olmalı." })
    .int({ error: "Ücret kuruş cinsinden tamsayı olmalı (29900 = 299,00 TL)." })
    .min(0, { error: "Ücret eksi olamaz." })
    .max(100_000_000, { error: "Ücret çok büyük." })
    .optional(),
  yanlisGoturme: z
    .number({ error: "Yanlış götürme sayı olmalı." })
    .int({ error: "Yanlış götürme tamsayı olmalı." })
    .min(0, { error: "Yanlış götürme 0 ile 10 arasında olmalı (0 = götürmez)." })
    .max(10, { error: "Yanlış götürme 0 ile 10 arasında olmalı (0 = götürmez)." })
    .optional(),
  aktif: z.boolean({ error: "aktif true ya da false olmalı." }).optional(),
  sira: siraSemasi.optional(),
};

const turAlanlari = {
  ad: adSemasi("Tür"),
  aciklama: aciklamaSemasi.optional(),
  soruSayisi: z
    .number({ error: "Soru sayısı sayı olmalı." })
    .int({ error: "Soru sayısı tamsayı olmalı." })
    .min(1, { error: "Soru sayısı 1 ile 300 arasında olmalı." })
    .max(300, { error: "Soru sayısı 1 ile 300 arasında olmalı." }),
  sureDakika: z
    .number({ error: "Süre dakika cinsinden sayı olmalı." })
    .int({ error: "Süre tamsayı dakika olmalı." })
    .min(1, { error: "Süre 1 ile 600 dakika arasında olmalı." })
    .max(600, { error: "Süre 1 ile 600 dakika arasında olmalı." }),
  aktif: z.boolean({ error: "aktif true ya da false olmalı." }).optional(),
  sira: siraSemasi.optional(),
};

// ─── Nesneler ─────────────────────────────────────────────────

async function sinavNesneleri(db: Db, idler?: number[]) {
  const sinavlar = await db.sinav.findMany({
    where: idler ? { id: { in: idler } } : {},
    orderBy: [{ sira: "asc" }, { id: "asc" }],
    select: {
      id: true,
      ad: true,
      aciklama: true,
      ucretKurus: true,
      yanlisGoturme: true,
      aktif: true,
      sira: true,
      _count: { select: { dersler: true, sorular: true, checkuplar: true } },
    },
  });
  const aktifler = await db.soru.groupBy({ by: ["sinavId"], where: { aktif: true, sinavId: { in: sinavlar.map((s) => s.id) } }, _count: { _all: true } });
  const aktifHarita = new Map(aktifler.map((a) => [a.sinavId, a._count._all]));
  return sinavlar.map((s) => ({
    id: s.id,
    ad: s.ad,
    aciklama: s.aciklama,
    ucretKurus: s.ucretKurus,
    yanlisGoturme: s.yanlisGoturme,
    aktif: s.aktif,
    sira: s.sira,
    dersSayisi: s._count.dersler,
    soruSayisi: s._count.sorular,
    aktifSoruSayisi: aktifHarita.get(s.id) ?? 0,
    checkupSayisi: s._count.checkuplar,
    silinebilir: s._count.dersler === 0 && s._count.checkuplar === 0,
  }));
}

async function sinavNesnesi(db: Db, id: number) {
  const [s] = await sinavNesneleri(db, [id]);
  if (!s) throw bulunamadi("Sınav bulunamadı.");
  return s;
}

const turSecimi = {
  id: true,
  ad: true,
  aciklama: true,
  soruSayisi: true,
  sureDakika: true,
  aktif: true,
  sira: true,
  _count: { select: { checkuplar: true } },
} as const;

function turNesnesi(t: {
  id: number;
  ad: string;
  aciklama: string | null;
  soruSayisi: number;
  sureDakika: number;
  aktif: boolean;
  sira: number;
  _count: { checkuplar: number };
}) {
  return {
    id: t.id,
    ad: t.ad,
    aciklama: t.aciklama,
    soruSayisi: t.soruSayisi,
    sureDakika: t.sureDakika,
    aktif: t.aktif,
    sira: t.sira,
    checkupSayisi: t._count.checkuplar,
    silinebilir: t._count.checkuplar === 0,
  };
}

const sinavCakisma = "Bu adla bir sınav zaten var.";
const turCakisma = "Bu adla bir check-up türü zaten var.";

export function adminSinavRotalari(b: Baglam): Router {
  const r = Router();

  // ─── Pano ───────────────────────────────────────────────────

  r.get("/pano", async (_req, res) => {
    const yediGunOnce = new Date(b.saat.simdi().getTime() - 7 * 24 * 60 * 60 * 1000);
    const [sinavlar, ogrenciSayisi, checkupSayisi, bitenCheckupSayisi, son7GunKayit, son7GunCheckup] = await Promise.all([
      sinavNesneleri(b.db),
      b.db.ogrenci.count(),
      b.db.checkup.count(),
      b.db.checkup.count({ where: { durum: "BITTI" } }),
      b.db.ogrenci.count({ where: { olusturuldu: { gte: yediGunOnce } } }),
      b.db.checkup.count({ where: { baslangic: { gte: yediGunOnce } } }),
    ]);
    const durumlar = await ayarDurumlari(b.db, sinavlar.map((s) => s.id));
    res.json({
      sinavlar: sinavlar.map((s) => ({
        id: s.id,
        ad: s.ad,
        aktif: s.aktif,
        soruSayisi: s.soruSayisi,
        aktifSoruSayisi: s.aktifSoruSayisi,
        // Yalnızca aktif türler: pano "öğrenci şu an neyi başlatabilir" sorusunu yanıtlar.
        turler: (durumlar.get(s.id) ?? []).filter((d) => d.tur.aktif).map((d) => ({ turId: d.tur.id, ad: d.tur.ad, secim: d.secim, hazir: d.hazirlik.hazir })),
      })),
      ogrenciSayisi,
      checkupSayisi,
      bitenCheckupSayisi,
      son7GunKayit,
      son7GunCheckup,
    });
  });

  // ─── Sınavlar ───────────────────────────────────────────────

  r.get("/sinavlar", async (_req, res) => {
    res.json(await sinavNesneleri(b.db));
  });

  r.get("/sinavlar/:id", async (req, res) => {
    res.json(await sinavNesnesi(b.db, kimlik(req.params.id, "Sınav bulunamadı.")));
  });

  r.post("/sinavlar", yoneticiRoluGerekli, async (req, res) => {
    const g = dogrula(z.object(sinavAlanlari), req.body);
    const sira = g.sira ?? ((await b.db.sinav.aggregate({ _max: { sira: true } }))._max.sira ?? -1) + 1;
    const s = await prismaIle(
      () =>
        b.db.sinav.create({
          data: {
            ad: g.ad,
            aciklama: g.aciklama ?? null,
            ucretKurus: g.ucretKurus ?? 0,
            yanlisGoturme: g.yanlisGoturme ?? 4,
            aktif: g.aktif ?? false, // yeni sınav varsayılan olarak pasif
            sira,
          },
          select: { id: true },
        }),
      { cakisma: sinavCakisma }
    );
    res.status(201).json(await sinavNesnesi(b.db, s.id));
  });

  r.patch("/sinavlar/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Sınav bulunamadı.");
    const g = dogrula(z.object(sinavAlanlari).partial(), req.body);
    await prismaIle(() => b.db.sinav.update({ where: { id }, data: g, select: { id: true } }), { cakisma: sinavCakisma, bulunamadi: "Sınav bulunamadı." });
    res.json(await sinavNesnesi(b.db, id));
  });

  r.delete("/sinavlar/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Sınav bulunamadı.");
    const s = await sinavNesnesi(b.db, id);
    const mesaj = "Bu sınavın konu ağacı ya da check-up'ları var; silinemez. Pasif yapın.";
    if (!s.silinebilir) throw new ApiHata("KULLANIMDA", mesaj);
    await prismaIle(
      () =>
        b.db.$transaction([
          // Dersi kalmamış sınavın içe aktarma kayıtları (soruları yok) sınavla gider.
          b.db.iceAktarma.deleteMany({ where: { sinavId: id } }),
          b.db.sinav.delete({ where: { id } }),
        ]),
      { kullanimda: mesaj, bulunamadi: "Sınav bulunamadı." }
    );
    res.status(204).end();
  });

  // ─── Check-up türleri ───────────────────────────────────────

  r.get("/turler", async (_req, res) => {
    const turler = await b.db.checkupTuru.findMany({ orderBy: [{ sira: "asc" }, { id: "asc" }], select: turSecimi });
    res.json(turler.map(turNesnesi));
  });

  r.post("/turler", yoneticiRoluGerekli, async (req, res) => {
    const g = dogrula(z.object(turAlanlari), req.body);
    const sira = g.sira ?? ((await b.db.checkupTuru.aggregate({ _max: { sira: true } }))._max.sira ?? -1) + 1;
    const t = await prismaIle(
      () =>
        b.db.checkupTuru.create({
          data: { ad: g.ad, aciklama: g.aciklama ?? null, soruSayisi: g.soruSayisi, sureDakika: g.sureDakika, aktif: g.aktif ?? true, sira },
          select: turSecimi,
        }),
      { cakisma: turCakisma }
    );
    res.status(201).json(turNesnesi(t));
  });

  r.patch("/turler/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Tür bulunamadı.");
    const g = dogrula(z.object(turAlanlari).partial(), req.body);
    const t = await prismaIle(() => b.db.checkupTuru.update({ where: { id }, data: g, select: turSecimi }), {
      cakisma: turCakisma,
      bulunamadi: "Tür bulunamadı.",
    });
    res.json(turNesnesi(t));
  });

  r.delete("/turler/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Tür bulunamadı.");
    const t = await b.db.checkupTuru.findUnique({ where: { id }, select: turSecimi });
    if (!t) throw bulunamadi("Tür bulunamadı.");
    const mesaj = "Bu türle çözülmüş check-up'lar var; silinemez. Pasif yapın.";
    if (t._count.checkuplar > 0) throw new ApiHata("KULLANIMDA", mesaj);
    // Ayarları (reçete, sabit liste) zincirleme silinir.
    await prismaIle(() => b.db.checkupTuru.delete({ where: { id } }), { kullanimda: mesaj, bulunamadi: "Tür bulunamadı." });
    res.status(204).end();
  });

  return r;
}
