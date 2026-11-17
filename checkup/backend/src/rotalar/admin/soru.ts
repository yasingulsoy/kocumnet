import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { Baglam } from "../../http/baglam.js";
import { dogrula, kimlik, kimlikSemasi, prismaIle, sayfalama, sayfaliYanit, sorguKimligi, sorguMetni } from "../../http/yardimcilar.js";
import { sablonUret } from "../../lib/excel.js";
import { GORSEL_EN_FAZLA_BAYT, gorselIsle, GorselHatasi } from "../../lib/gorsel.js";
import { alanHatasi, ApiHata, bulunamadi, dogrulama } from "../../lib/hatalar.js";
import { icerikHtml, IcerikHatasi } from "../../lib/icerik.js";
import { HARFLER, harfSirasi } from "../../lib/siklar.js";
import { iceAktarDenetle, iceAktarKaydet } from "../../servisler/ice-aktar.js";
import { metinDenetle, siklariDenetle, siklariHazirla, soruAyrintisi, zincirDenetle, zorlukDenetle } from "../../servisler/soru.js";

const yukleyici = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: GORSEL_EN_FAZLA_BAYT, files: 1, fields: 10 },
  defParamCharset: "utf8", // Türkçe dosya adları bozulmasın
});

const sikSemasi = z.object({
  metin: z.string({ error: "Şık metni yazın." }).max(2000, { error: "Şık metni en fazla 2000 karakter olabilir." }),
  aciklama: z.string({ error: "Açıklama metin olmalı." }).max(2000, { error: "Açıklama en fazla 2000 karakter olabilir." }).nullable().optional(),
});

const soruAlanlari = {
  sinavId: kimlikSemasi("Sınav"),
  dersId: kimlikSemasi("Ders"),
  konuId: kimlikSemasi("Konu"),
  kazanimId: kimlikSemasi("Kazanım"),
  altKazanimId: kimlikSemasi("Alt kazanım"),
  metin: z.string({ error: "Soru metni yazın." }).max(10_000, { error: "Soru metni en fazla 10.000 karakter olabilir." }),
  gorselId: z.string({ error: "Görsel kimliği metin olmalı." }).max(100).nullable().optional(),
  cozum: z.string({ error: "Çözüm yazın." }).max(20_000, { error: "Çözüm en fazla 20.000 karakter olabilir." }),
  zorluk: z.number({ error: "Zorluk sayı olmalı." }).nullable().optional(),
  aktif: z.boolean({ error: "aktif true ya da false olmalı." }).optional(),
  siklar: z.array(sikSemasi, { error: "siklar 5 şıklık bir dizi olmalı." }),
  dogruSik: z.string({ error: "Doğru şıkkı seçin (A–E)." }),
};

async function gorselDenetle(b: Baglam, gorselId: string | null | undefined, h: Record<string, string>) {
  if (!gorselId) return;
  const g = await b.db.gorsel.findUnique({ where: { id: gorselId }, select: { id: true } });
  if (!g) h.gorselId = "Görsel bulunamadı. Önce görseli yükleyin.";
}

function dosyaAl(req: Request): Express.Multer.File {
  if (!req.file) throw dogrulama("Bir dosya seçin.", { dosya: "Bir dosya seçin." });
  return req.file;
}

function sinavIdAl(deger: unknown): number {
  const id = sorguKimligi(deger, "sinavId");
  if (id === undefined) throw dogrulama("Sınav seçin.", { sinavId: "Sınav seçin." });
  return id;
}

export function adminSoruRotalari(b: Baglam): Router {
  const r = Router();

  // ─── Liste ve ayrıntı ───────────────────────────────────────

  r.get("/sorular", async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const sinavId = sinavIdAl(q.sinavId);
    const s = sayfalama(q);
    const aktifMetin = sorguMetni(q.aktif);
    if (aktifMetin !== undefined && aktifMetin !== "true" && aktifMetin !== "false") throw alanHatasi({ aktif: "aktif true ya da false olmalı." });
    const ara = sorguMetni(q.ara);
    const kimlikArama = ara && /^#?\d{1,10}$/.test(ara) ? Number(ara.replace("#", "")) : null;

    const where: Prisma.SoruWhereInput = {
      sinavId,
      ...(sorguKimligi(q.dersId, "dersId") ? { dersId: sorguKimligi(q.dersId, "dersId") } : {}),
      ...(sorguKimligi(q.konuId, "konuId") ? { konuId: sorguKimligi(q.konuId, "konuId") } : {}),
      ...(sorguKimligi(q.kazanimId, "kazanimId") ? { kazanimId: sorguKimligi(q.kazanimId, "kazanimId") } : {}),
      ...(sorguKimligi(q.altKazanimId, "altKazanimId") ? { altKazanimId: sorguKimligi(q.altKazanimId, "altKazanimId") } : {}),
      ...(aktifMetin !== undefined ? { aktif: aktifMetin === "true" } : {}),
      ...(ara
        ? {
            OR: [
              { metin: { contains: ara, mode: "insensitive" as const } },
              ...(kimlikArama && kimlikArama <= 2_147_483_647 ? [{ id: kimlikArama }] : []),
            ],
          }
        : {}),
    };

    const [toplam, kayitlar] = await Promise.all([
      b.db.soru.count({ where }),
      b.db.soru.findMany({
        where,
        orderBy: { id: "desc" },
        skip: s.atla,
        take: s.boyut,
        select: {
          id: true,
          metin: true,
          zorluk: true,
          aktif: true,
          gorselId: true,
          olusturuldu: true,
          ders: { select: { ad: true } },
          konu: { select: { ad: true } },
          kazanim: { select: { ad: true } },
          altKazanim: { select: { ad: true } },
          _count: { select: { checkupSorulari: true } },
        },
      }),
    ]);

    res.json(
      sayfaliYanit(
        kayitlar.map((k) => ({
          id: k.id,
          metin: k.metin.slice(0, 160),
          ders: k.ders.ad,
          konu: k.konu.ad,
          kazanim: k.kazanim.ad,
          altKazanim: k.altKazanim.ad,
          zorluk: k.zorluk,
          aktif: k.aktif,
          gorselVar: k.gorselId !== null,
          kullanimSayisi: k._count.checkupSorulari,
          olusturuldu: k.olusturuldu,
        })),
        toplam,
        s
      )
    );
  });

  r.get("/sorular/:id", async (req, res) => {
    const s = await soruAyrintisi(b.db, kimlik(req.params.id, "Soru bulunamadı."));
    if (!s) throw bulunamadi("Soru bulunamadı.");
    res.json(s);
  });

  // ─── Ekleme ─────────────────────────────────────────────────

  r.post("/sorular", async (req, res) => {
    const g = dogrula(z.object(soruAlanlari), req.body);
    const h: Record<string, string> = {};
    metinDenetle("metin", g.metin, h);
    metinDenetle("cozum", g.cozum, h);
    zorlukDenetle(g.zorluk, h);
    Object.assign(h, siklariDenetle(g.siklar, g.dogruSik));
    Object.assign(h, await zincirDenetle(b.db, g));
    await gorselDenetle(b, g.gorselId, h);
    if (Object.keys(h).length) throw alanHatasi(h);

    const yeni = await b.db.soru.create({
      data: {
        sinavId: g.sinavId,
        dersId: g.dersId,
        konuId: g.konuId,
        kazanimId: g.kazanimId,
        altKazanimId: g.altKazanimId,
        metin: g.metin,
        metinHtml: icerikHtml(g.metin),
        gorselId: g.gorselId ?? null,
        cozum: g.cozum,
        cozumHtml: icerikHtml(g.cozum),
        zorluk: g.zorluk ?? null,
        aktif: g.aktif ?? true,
        siklar: { createMany: { data: siklariHazirla(g.siklar, g.dogruSik) } },
      },
      select: { id: true },
    });
    res.status(201).json(await soruAyrintisi(b.db, yeni.id));
  });

  // ─── Düzenleme ──────────────────────────────────────────────

  r.patch("/sorular/:id", async (req, res) => {
    const id = kimlik(req.params.id, "Soru bulunamadı.");
    const g = dogrula(z.object(soruAlanlari).partial(), req.body);
    const mevcut = await b.db.soru.findUnique({
      where: { id },
      select: {
        sinavId: true,
        dersId: true,
        konuId: true,
        kazanimId: true,
        altKazanimId: true,
        siklar: { orderBy: { sira: "asc" }, select: { sira: true, metin: true, aciklama: true, dogru: true } },
      },
    });
    if (!mevcut) throw bulunamadi("Soru bulunamadı.");

    const h: Record<string, string> = {};
    metinDenetle("metin", g.metin, h);
    metinDenetle("cozum", g.cozum, h);
    zorlukDenetle(g.zorluk, h);

    const zincirDegisti = [g.sinavId, g.dersId, g.konuId, g.kazanimId, g.altKazanimId].some((v) => v !== undefined);
    const zincir = {
      sinavId: g.sinavId ?? mevcut.sinavId,
      dersId: g.dersId ?? mevcut.dersId,
      konuId: g.konuId ?? mevcut.konuId,
      kazanimId: g.kazanimId ?? mevcut.kazanimId,
      altKazanimId: g.altKazanimId ?? mevcut.altKazanimId,
    };
    if (zincirDegisti) Object.assign(h, await zincirDenetle(b.db, zincir));
    await gorselDenetle(b, g.gorselId, h);

    // Şıklar: gelirse tam 5 olmalı; doğru şık gelmezse mevcut doğru korunur.
    const mevcutDogru = mevcut.siklar.find((s) => s.dogru);
    const dogruSik = g.dogruSik ?? (mevcutDogru ? HARFLER[mevcutDogru.sira] : undefined);
    let yeniSiklar: ReturnType<typeof siklariHazirla> | null = null;
    if (g.siklar !== undefined) {
      Object.assign(h, siklariDenetle(g.siklar, dogruSik));
      if (!Object.keys(h).length) {
        // Şıkta `aciklama` hiç gönderilmediyse mevcut açıklama kalır; null gönderilirse silinir.
        yeniSiklar = siklariHazirla(g.siklar, dogruSik!).map((s, i) =>
          g.siklar![i]!.aciklama === undefined ? { ...s, aciklama: mevcut.siklar.find((m) => m.sira === s.sira)?.aciklama ?? null } : s
        );
      }
    } else if (g.dogruSik !== undefined && harfSirasi(g.dogruSik) < 0) {
      h.dogruSik = "Doğru şık A, B, C, D ya da E olmalı.";
    }
    if (Object.keys(h).length) throw alanHatasi(h);

    await prismaIle(() =>
      b.db.$transaction(async (tx) => {
        await tx.soru.update({
          where: { id },
          data: {
            ...(zincirDegisti ? zincir : {}),
            ...(g.metin !== undefined ? { metin: g.metin, metinHtml: icerikHtml(g.metin) } : {}),
            ...(g.cozum !== undefined ? { cozum: g.cozum, cozumHtml: icerikHtml(g.cozum) } : {}),
            ...(g.gorselId !== undefined ? { gorselId: g.gorselId } : {}),
            ...(g.zorluk !== undefined ? { zorluk: g.zorluk } : {}),
            ...(g.aktif !== undefined ? { aktif: g.aktif } : {}),
          },
        });
        // Şıklar sırasına göre YERİNDE güncellenir: öğrenci cevapları şık kimliğine bağlı.
        if (yeniSiklar) {
          for (const s of yeniSiklar) {
            await tx.sik.upsert({
              where: { soruId_sira: { soruId: id, sira: s.sira } },
              update: { metin: s.metin, metinHtml: s.metinHtml, aciklama: s.aciklama, dogru: s.dogru },
              create: { soruId: id, ...s },
            });
          }
        } else if (g.dogruSik !== undefined) {
          const dogruSira = harfSirasi(g.dogruSik);
          await tx.sik.updateMany({ where: { soruId: id, sira: { not: dogruSira } }, data: { dogru: false } });
          await tx.sik.updateMany({ where: { soruId: id, sira: dogruSira }, data: { dogru: true } });
        }
      })
    );
    res.json(await soruAyrintisi(b.db, id));
  });

  // ─── Silme ──────────────────────────────────────────────────

  r.delete("/sorular/:id", async (req, res) => {
    const id = kimlik(req.params.id, "Soru bulunamadı.");
    const s = await b.db.soru.findUnique({ where: { id }, select: { _count: { select: { checkupSorulari: true, sabitListeler: true } } } });
    if (!s) throw bulunamadi("Soru bulunamadı.");
    const mesaj = "Bu soru bir check-up'ta ya da sabit listede geçiyor; silinemez. Pasif yapın.";
    if (s._count.checkupSorulari > 0 || s._count.sabitListeler > 0) throw new ApiHata("KULLANIMDA", mesaj);
    await prismaIle(() => b.db.soru.delete({ where: { id } }), { kullanimda: mesaj, bulunamadi: "Soru bulunamadı." });
    res.status(204).end();
  });

  // ─── Önizleme ───────────────────────────────────────────────

  r.post("/onizleme", (req, res) => {
    const g = dogrula(z.object({ metin: z.string({ error: "metin yazın." }).max(20_000, { error: "Metin en fazla 20.000 karakter olabilir." }) }), req.body);
    try {
      res.json({ html: icerikHtml(g.metin) });
    } catch (e) {
      if (e instanceof IcerikHatasi) throw dogrulama(e.message, { metin: e.message });
      throw e;
    }
  });

  // ─── Görsel ─────────────────────────────────────────────────

  r.post("/gorseller", yukleyici.single("dosya"), async (req, res) => {
    const dosya = dosyaAl(req);
    try {
      const g = await gorselIsle(dosya.buffer);
      const kayit = await b.db.gorsel.create({
        data: { veri: g.veri, mime: g.mime, genislik: g.genislik, yukseklik: g.yukseklik, boyut: g.boyut },
        select: { id: true, genislik: true, yukseklik: true },
      });
      res.status(201).json(kayit);
    } catch (e) {
      if (e instanceof GorselHatasi) throw dogrulama(e.message, { dosya: e.message });
      throw e;
    }
  });

  // ─── Excel ──────────────────────────────────────────────────

  r.get("/ice-aktar/sablon", async (req, res) => {
    const sinavId = sinavIdAl((req.query as Record<string, unknown>).sinavId);
    const sinav = await b.db.sinav.findUnique({ where: { id: sinavId }, select: { ad: true } });
    if (!sinav) throw bulunamadi("Sınav bulunamadı.");
    const sirala = [{ sira: "asc" as const }, { id: "asc" as const }];
    const dersler = await b.db.ders.findMany({
      where: { sinavId },
      orderBy: sirala,
      select: {
        ad: true,
        konular: {
          orderBy: sirala,
          select: {
            ad: true,
            kazanimlar: { orderBy: sirala, select: { ad: true, kod: true, altKazanimlar: { orderBy: sirala, select: { ad: true, kod: true } } } },
          },
        },
      },
    });
    const yollar = dersler.flatMap((d) =>
      d.konular.flatMap((k) =>
        k.kazanimlar.flatMap((z) =>
          z.altKazanimlar.map((a) => ({ ders: d.ad, konu: k.ad, kazanimKod: z.kod, kazanim: z.ad, altKazanimKod: a.kod, altKazanim: a.ad }))
        )
      )
    );
    const dosya = await sablonUret({ sinavAd: sinav.ad, yollar });
    const ad = `soru-sablonu-${sinav.ad}.xlsx`;
    const asciiAd = ad.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "soru-sablonu.xlsx";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(ad)}`);
    res.send(dosya);
  });

  r.post("/ice-aktar/denetle", yukleyici.single("dosya"), async (req, res) => {
    const dosya = dosyaAl(req);
    const sinavId = sinavIdAl(req.body?.sinavId);
    const { rapor } = await iceAktarDenetle(b.db, sinavId, dosya.buffer);
    res.json(rapor);
  });

  r.post("/ice-aktar/kaydet", yukleyici.single("dosya"), async (req, res) => {
    const dosya = dosyaAl(req);
    const sinavId = sinavIdAl(req.body?.sinavId);
    const sonuc = await iceAktarKaydet(b.db, { sinavId, dosya: dosya.buffer, dosyaAdi: dosya.originalname || "dosya.xlsx", yoneticiId: req.yonetici!.id });
    res.status(201).json(sonuc);
  });

  return r;
}
