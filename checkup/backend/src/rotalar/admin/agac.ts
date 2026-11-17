/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { z } from "zod";
import type { Veritabani } from "../../db.js";
import type { Baglam } from "../../http/baglam.js";
import { dogrula, kimlik, kimlikSemasi, prismaIle } from "../../http/yardimcilar.js";
import { adNormalize } from "../../lib/excel.js";
import { ApiHata, bulunamadi, dogrulama } from "../../lib/hatalar.js";

/**
 * Konu ağacı: Sınav → Ders → Konu → Kazanım → Alt kazanım
 * (checkup/API.md "Konu ağacı"). Dört seviye aynı kurallarla yönetilir;
 * seviyeye özgü olan yalnızca model adı, üst alan ve kod alanının varlığı.
 */

interface Seviye {
  model: "ders" | "konu" | "kazanim" | "altKazanim";
  ustAlan: "sinavId" | "dersId" | "konuId" | "kazanimId";
  ustModel: "sinav" | "ders" | "konu" | "kazanim";
  /** Alt seviyenin ilişki adı (silinebilirlik için); alt kazanımda yok. */
  altIliski: "konular" | "kazanimlar" | "altKazanimlar" | null;
  kodlu: boolean;
  ad: string; // "ders", "konu", "kazanım", "alt kazanım"
  ustAd: string;
}

const SEVIYELER: Record<string, Seviye> = {
  dersler: { model: "ders", ustAlan: "sinavId", ustModel: "sinav", altIliski: "konular", kodlu: false, ad: "ders", ustAd: "Sınav" },
  konular: { model: "konu", ustAlan: "dersId", ustModel: "ders", altIliski: "kazanimlar", kodlu: false, ad: "konu", ustAd: "Ders" },
  kazanimlar: { model: "kazanim", ustAlan: "konuId", ustModel: "konu", altIliski: "altKazanimlar", kodlu: true, ad: "kazanım", ustAd: "Konu" },
  "alt-kazanimlar": { model: "altKazanim", ustAlan: "kazanimId", ustModel: "kazanim", altIliski: null, kodlu: true, ad: "alt kazanım", ustAd: "Kazanım" },
};

const SORU_ALANI: Record<Seviye["model"], "dersId" | "konuId" | "kazanimId" | "altKazanimId"> = {
  ders: "dersId",
  konu: "konuId",
  kazanim: "kazanimId",
  altKazanim: "altKazanimId",
};

function seviyeAl(ham: unknown): Seviye {
  const s = SEVIYELER[String(ham)];
  if (!s) throw bulunamadi("Seviye dersler, konular, kazanimlar ya da alt-kazanimlar olmalı.");
  return s;
}

/** Prisma delegesi: dört model aynı biçimde kullanılır (alan adları seviyeden gelir). */
const delege = (db: Veritabani | any, model: string): any => (db as any)[model];

const adSemasi = z.string({ error: "Ad yazın." }).trim().min(1, { error: "Ad boş olamaz." }).max(300, { error: "Ad en fazla 300 karakter olabilir." });
const kodSemasi = z
  .string({ error: "Kod metin olmalı." })
  .trim()
  .max(40, { error: "Kod en fazla 40 karakter olabilir." })
  .nullable()
  .transform((v) => (v ? v : null));

interface DugumYaniti {
  id: number;
  ustId: number;
  ad: string;
  kod?: string | null;
  sira: number;
  soruSayisi: number;
  silinebilir: boolean;
}

async function dugumYaniti(db: Veritabani, s: Seviye, id: number): Promise<DugumYaniti> {
  const d = await delege(db, s.model).findUnique({
    where: { id },
    select: {
      id: true,
      ad: true,
      sira: true,
      [s.ustAlan]: true,
      ...(s.kodlu ? { kod: true } : {}),
      _count: { select: { ...(s.altIliski ? { [s.altIliski]: true } : {}), checkupSorulari: true } },
    },
  });
  if (!d) throw bulunamadi(`Böyle bir ${s.ad} yok.`);
  const alan = SORU_ALANI[s.model];
  const [toplam, aktif] = await Promise.all([
    db.soru.count({ where: { [alan]: id } }),
    db.soru.count({ where: { [alan]: id, aktif: true } }),
  ]);
  const altSayisi = s.altIliski ? (d._count[s.altIliski] as number) : 0;
  return {
    id: d.id,
    ustId: d[s.ustAlan],
    ad: d.ad,
    ...(s.kodlu ? { kod: d.kod ?? null } : {}),
    sira: d.sira,
    soruSayisi: aktif,
    silinebilir: altSayisi === 0 && toplam === 0 && d._count.checkupSorulari === 0,
  };
}

async function ustDenetle(db: Veritabani, s: Seviye, ustId: number) {
  const ust = await delege(db, s.ustModel).findUnique({ where: { id: ustId }, select: { id: true } });
  if (!ust) throw dogrulama(`${s.ustAd} bulunamadı.`, { ustId: `${s.ustAd} bulunamadı.` });
}

async function sonrakiSira(db: any, s: Seviye, ustId: number): Promise<number> {
  const r = await delege(db, s.model).aggregate({ where: { [s.ustAlan]: ustId }, _max: { sira: true } });
  return (r._max.sira ?? -1) + 1;
}

const cakismaMesaji = (s: Seviye) => `Bu adla bir ${s.ad} zaten var.`;

export function adminAgacRotalari(b: Baglam): Router {
  const r = Router();

  // ─── Ağacın tamamı ──────────────────────────────────────────

  r.get("/sinavlar/:id/agac", async (req, res) => {
    const sinavId = kimlik(req.params.id, "Sınav bulunamadı.");
    const sinav = await b.db.sinav.findUnique({ where: { id: sinavId }, select: { id: true, ad: true } });
    if (!sinav) throw bulunamadi("Sınav bulunamadı.");

    const sirala = [{ sira: "asc" as const }, { id: "asc" as const }];
    const [dersler, sorular] = await Promise.all([
      b.db.ders.findMany({
        where: { sinavId },
        orderBy: sirala,
        select: {
          id: true,
          ad: true,
          sira: true,
          _count: { select: { konular: true, checkupSorulari: true } },
          konular: {
            orderBy: sirala,
            select: {
              id: true,
              ad: true,
              sira: true,
              _count: { select: { kazanimlar: true, checkupSorulari: true } },
              kazanimlar: {
                orderBy: sirala,
                select: {
                  id: true,
                  kod: true,
                  ad: true,
                  sira: true,
                  _count: { select: { altKazanimlar: true, checkupSorulari: true } },
                  altKazanimlar: {
                    orderBy: sirala,
                    select: { id: true, kod: true, ad: true, sira: true, _count: { select: { checkupSorulari: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      b.db.soru.findMany({ where: { sinavId }, select: { dersId: true, konuId: true, kazanimId: true, altKazanimId: true, aktif: true } }),
    ]);

    const say = (alan: "dersId" | "konuId" | "kazanimId" | "altKazanimId") => {
      const toplam = new Map<number, number>();
      const aktif = new Map<number, number>();
      for (const s of sorular) {
        toplam.set(s[alan], (toplam.get(s[alan]) ?? 0) + 1);
        if (s.aktif) aktif.set(s[alan], (aktif.get(s[alan]) ?? 0) + 1);
      }
      return { toplam, aktif };
    };
    const ders = say("dersId");
    const konu = say("konuId");
    const kazanim = say("kazanimId");
    const alt = say("altKazanimId");
    const silinebilir = (sayac: { toplam: Map<number, number> }, id: number, altSayisi: number, sonuc: number) =>
      altSayisi === 0 && (sayac.toplam.get(id) ?? 0) === 0 && sonuc === 0;

    res.json({
      sinav,
      dersler: dersler.map((d) => ({
        id: d.id,
        ad: d.ad,
        sira: d.sira,
        soruSayisi: ders.aktif.get(d.id) ?? 0,
        silinebilir: silinebilir(ders, d.id, d._count.konular, d._count.checkupSorulari),
        konular: d.konular.map((k) => ({
          id: k.id,
          ad: k.ad,
          sira: k.sira,
          soruSayisi: konu.aktif.get(k.id) ?? 0,
          silinebilir: silinebilir(konu, k.id, k._count.kazanimlar, k._count.checkupSorulari),
          kazanimlar: k.kazanimlar.map((z) => ({
            id: z.id,
            kod: z.kod,
            ad: z.ad,
            sira: z.sira,
            soruSayisi: kazanim.aktif.get(z.id) ?? 0,
            silinebilir: silinebilir(kazanim, z.id, z._count.altKazanimlar, z._count.checkupSorulari),
            altKazanimlar: z.altKazanimlar.map((a) => ({
              id: a.id,
              kod: a.kod,
              ad: a.ad,
              sira: a.sira,
              soruSayisi: alt.aktif.get(a.id) ?? 0,
              silinebilir: silinebilir(alt, a.id, 0, a._count.checkupSorulari),
            })),
          })),
        })),
      })),
    });
  });

  // ─── Düğüm ekleme ───────────────────────────────────────────

  r.post("/agac/:seviye", async (req, res) => {
    const s = seviyeAl(req.params.seviye);
    const g = dogrula(z.object({ ustId: kimlikSemasi("Üst düğüm"), ad: adSemasi, kod: kodSemasi.optional() }), req.body);
    await ustDenetle(b.db, s, g.ustId);
    const yeni = await prismaIle(
      () =>
        b.db.$transaction(async (tx) => {
          const sira = await sonrakiSira(tx, s, g.ustId);
          return delege(tx, s.model).create({
            data: { [s.ustAlan]: g.ustId, ad: g.ad, sira, ...(s.kodlu ? { kod: g.kod ?? null } : {}) },
            select: { id: true },
          });
        }),
      { cakisma: cakismaMesaji(s) }
    );
    res.status(201).json(await dugumYaniti(b.db, s, yeni.id));
  });

  r.post("/agac/:seviye/toplu", async (req, res) => {
    const s = seviyeAl(req.params.seviye);
    const g = dogrula(
      z.object({
        ustId: kimlikSemasi("Üst düğüm"),
        satirlar: z.array(z.string({ error: "Her satır metin olmalı." }), { error: "satirlar bir metin dizisi olmalı." }).max(500, { error: "Bir seferde en fazla 500 satır eklenebilir." }),
      }),
      req.body
    );
    await ustDenetle(b.db, s, g.ustId);

    const eklenecek: { ad: string; kod: string | null }[] = [];
    const hatalar: Record<string, string> = {};
    g.satirlar.forEach((ham, i) => {
      let satir = ham.trim();
      if (!satir) return;
      let kod: string | null = null;
      if (s.kodlu && satir.includes("|")) {
        const ayrac = satir.indexOf("|");
        kod = satir.slice(0, ayrac).trim() || null;
        satir = satir.slice(ayrac + 1).trim();
      }
      if (!satir) return;
      if (satir.length > 300) hatalar[`satirlar.${i}`] = `${i + 1}. satır: ad en fazla 300 karakter olabilir.`;
      if (kod && kod.length > 40) hatalar[`satirlar.${i}`] = `${i + 1}. satır: kod en fazla 40 karakter olabilir.`;
      eklenecek.push({ ad: satir, kod });
    });
    if (Object.keys(hatalar).length) throw dogrulama(Object.values(hatalar)[0]!, hatalar);

    const eklenen = await prismaIle(
      () =>
        b.db.$transaction(async (tx) => {
          const mevcut = await delege(tx, s.model).findMany({ where: { [s.ustAlan]: g.ustId }, select: { ad: true } });
          const adlar = new Set<string>(mevcut.map((m: { ad: string }) => adNormalize(m.ad)));
          let sira = await sonrakiSira(tx, s, g.ustId);
          let sayi = 0;
          for (const e of eklenecek) {
            const anahtar = adNormalize(e.ad);
            if (adlar.has(anahtar)) continue; // aynı adlı satırlar atlanır
            adlar.add(anahtar);
            await delege(tx, s.model).create({ data: { [s.ustAlan]: g.ustId, ad: e.ad, sira: sira++, ...(s.kodlu ? { kod: e.kod } : {}) } });
            sayi++;
          }
          return sayi;
        }),
      { cakisma: cakismaMesaji(s) }
    );
    res.status(201).json({ eklenen });
  });

  // ─── Düzenleme, taşıma, silme ───────────────────────────────

  r.patch("/agac/:seviye/:id", async (req, res) => {
    const s = seviyeAl(req.params.seviye);
    const id = kimlik(req.params.id, `Böyle bir ${s.ad} yok.`);
    const g = dogrula(z.object({ ad: adSemasi.optional(), kod: kodSemasi.optional() }), req.body);
    const data: Record<string, unknown> = {};
    if (g.ad !== undefined) data.ad = g.ad;
    if (s.kodlu && g.kod !== undefined) data.kod = g.kod;
    if (Object.keys(data).length) {
      await prismaIle(() => delege(b.db, s.model).update({ where: { id }, data, select: { id: true } }), {
        cakisma: cakismaMesaji(s),
        bulunamadi: `Böyle bir ${s.ad} yok.`,
      });
    }
    res.json(await dugumYaniti(b.db, s, id));
  });

  r.post("/agac/:seviye/:id/tasi", async (req, res) => {
    const s = seviyeAl(req.params.seviye);
    const id = kimlik(req.params.id, `Böyle bir ${s.ad} yok.`);
    const g = dogrula(z.object({ yon: z.enum(["yukari", "asagi"], { error: 'yon "yukari" ya da "asagi" olmalı.' }) }), req.body);
    await b.db.$transaction(async (tx) => {
      const d = await delege(tx, s.model).findUnique({ where: { id }, select: { [s.ustAlan]: true } });
      if (!d) throw bulunamadi(`Böyle bir ${s.ad} yok.`);
      const kardesler: { id: number; sira: number }[] = await delege(tx, s.model).findMany({
        where: { [s.ustAlan]: d[s.ustAlan] },
        orderBy: [{ sira: "asc" }, { id: "asc" }],
        select: { id: true, sira: true },
      });
      const i = kardesler.findIndex((k) => k.id === id);
      const j = g.yon === "yukari" ? i - 1 : i + 1;
      if (j < 0 || j >= kardesler.length) return; // zaten başta ya da sonda
      [kardesler[i], kardesler[j]] = [kardesler[j]!, kardesler[i]!];
      // Sıralar 0..n-1 olarak yeniden yazılır (eşit sıralı kardeşler de düzelir).
      for (let n = 0; n < kardesler.length; n++) {
        if (kardesler[n]!.sira !== n) await delege(tx, s.model).update({ where: { id: kardesler[n]!.id }, data: { sira: n } });
      }
    });
    res.json(await dugumYaniti(b.db, s, id));
  });

  r.delete("/agac/:seviye/:id", async (req, res) => {
    const s = seviyeAl(req.params.seviye);
    const id = kimlik(req.params.id, `Böyle bir ${s.ad} yok.`);
    const d = await dugumYaniti(b.db, s, id);
    const mesaj = `Bu ${s.ad} silinemez: altında kayıt, soru (aktif ya da pasif) ya da öğrenci sonucu var.`;
    if (!d.silinebilir) throw new ApiHata("KULLANIMDA", mesaj);
    // Reçete satırları zincirleme silinir; soru ve öğrenci sonucu veritabanında Restrict ile korunur.
    await prismaIle(() => delege(b.db, s.model).delete({ where: { id } }), { kullanimda: mesaj, bulunamadi: `Böyle bir ${s.ad} yok.` });
    res.status(204).end();
  });

  return r;
}
