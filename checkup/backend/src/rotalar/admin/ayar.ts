import { Router } from "express";
import { z } from "zod";
import type { Baglam } from "../../http/baglam.js";
import { dogrula, kimlik, kimlikSemasi } from "../../http/yardimcilar.js";
import { alanHatasi, bulunamadi } from "../../lib/hatalar.js";
import { ayarDurumlari, ayarDurumu, ayarYaniti } from "../../servisler/ayarlar.js";

/**
 * Check-up ayarları: her "sınav + tür" çifti için reçete (KARMA) ve sabit
 * liste (SABIT). İkisi de saklanır; biçim değişince öteki kaybolmaz. Eksik
 * ayar da kaydedilir, hazırlık sorunları Türkçe cümlelerle döner.
 */

const ayarSemasi = z.object({
  secim: z.enum(["KARMA", "SABIT"], { error: 'secim "KARMA" ya da "SABIT" olmalı.' }),
  recete: z
    .array(
      z.object({
        konuId: kimlikSemasi("Konu").nullable().optional(),
        kazanimId: kimlikSemasi("Kazanım").nullable().optional(),
        soruSayisi: z
          .number({ error: "Soru sayısı sayı olmalı." })
          .int({ error: "Soru sayısı tamsayı olmalı." })
          .min(1, { error: "Soru sayısı en az 1 olmalı." })
          .max(300, { error: "Soru sayısı en fazla 300 olabilir." }),
      }),
      { error: "recete bir dizi olmalı." }
    )
    .max(500, { error: "Reçetede en fazla 500 satır olabilir." }),
  sabitSoruIdleri: z.array(kimlikSemasi("Soru"), { error: "sabitSoruIdleri bir soru kimliği dizisi olmalı." }).max(300, { error: "Sabit listede en fazla 300 soru olabilir." }),
});

export function adminAyarRotalari(b: Baglam): Router {
  const r = Router();

  r.get("/sinavlar/:sinavId/ayarlar", async (req, res) => {
    const sinavId = kimlik(req.params.sinavId, "Sınav bulunamadı.");
    const sinav = await b.db.sinav.findUnique({ where: { id: sinavId }, select: { id: true } });
    if (!sinav) throw bulunamadi("Sınav bulunamadı.");
    const liste = (await ayarDurumlari(b.db, [sinavId])).get(sinavId) ?? [];
    res.json(liste.map(ayarYaniti));
  });

  r.put("/sinavlar/:sinavId/ayarlar/:turId", async (req, res) => {
    const sinavId = kimlik(req.params.sinavId, "Sınav bulunamadı.");
    const turId = kimlik(req.params.turId, "Tür bulunamadı.");
    const g = dogrula(ayarSemasi, req.body);

    const [sinav, tur] = await Promise.all([
      b.db.sinav.findUnique({ where: { id: sinavId }, select: { id: true } }),
      b.db.checkupTuru.findUnique({ where: { id: turId }, select: { id: true } }),
    ]);
    if (!sinav) throw bulunamadi("Sınav bulunamadı.");
    if (!tur) throw bulunamadi("Tür bulunamadı.");

    // Satır kuralları: tam biri dolu, o sınava ait, tekrar yok.
    const h: Record<string, string> = {};
    const konuIdler = g.recete.flatMap((s) => (s.konuId != null ? [s.konuId] : []));
    const kazanimIdler = g.recete.flatMap((s) => (s.kazanimId != null ? [s.kazanimId] : []));
    const [konular, kazanimlar, sorular] = await Promise.all([
      b.db.konu.findMany({ where: { id: { in: konuIdler }, ders: { sinavId } }, select: { id: true } }),
      b.db.kazanim.findMany({ where: { id: { in: kazanimIdler }, konu: { ders: { sinavId } } }, select: { id: true } }),
      b.db.soru.findMany({ where: { id: { in: g.sabitSoruIdleri }, sinavId }, select: { id: true } }),
    ]);
    const gecerliKonu = new Set(konular.map((k) => k.id));
    const gecerliKazanim = new Set(kazanimlar.map((k) => k.id));
    const gecerliSoru = new Set(sorular.map((s) => s.id));
    const gorulenKonu = new Set<number>();
    const gorulenKazanim = new Set<number>();

    g.recete.forEach((s, i) => {
      const konuVar = s.konuId != null;
      const kazanimVar = s.kazanimId != null;
      if (konuVar === kazanimVar) {
        h[`recete.${i}`] = `${i + 1}. satırda konu ya da kazanımdan tam biri seçilmeli.`;
      } else if (konuVar) {
        if (!gecerliKonu.has(s.konuId!)) h[`recete.${i}.konuId`] = `${i + 1}. satırdaki konu bu sınava ait değil.`;
        else if (gorulenKonu.has(s.konuId!)) h[`recete.${i}.konuId`] = `${i + 1}. satırdaki konu reçetede iki kez geçiyor.`;
        gorulenKonu.add(s.konuId!);
      } else {
        if (!gecerliKazanim.has(s.kazanimId!)) h[`recete.${i}.kazanimId`] = `${i + 1}. satırdaki kazanım bu sınava ait değil.`;
        else if (gorulenKazanim.has(s.kazanimId!)) h[`recete.${i}.kazanimId`] = `${i + 1}. satırdaki kazanım reçetede iki kez geçiyor.`;
        gorulenKazanim.add(s.kazanimId!);
      }
    });

    const gorulenSoru = new Set<number>();
    g.sabitSoruIdleri.forEach((id, i) => {
      if (!gecerliSoru.has(id)) h[`sabitSoruIdleri.${i}`] = `#${id} sorusu bu sınava ait değil ya da yok.`;
      else if (gorulenSoru.has(id)) h[`sabitSoruIdleri.${i}`] = `#${id} sorusu listede iki kez geçiyor.`;
      gorulenSoru.add(id);
    });
    if (Object.keys(h).length) throw alanHatasi(h);

    await b.db.$transaction(async (tx) => {
      const ayar = await tx.checkupAyari.upsert({
        where: { sinavId_turId: { sinavId, turId } },
        create: { sinavId, turId, secim: g.secim },
        update: { secim: g.secim },
        select: { id: true },
      });
      await tx.receteSatiri.deleteMany({ where: { ayarId: ayar.id } });
      if (g.recete.length) {
        await tx.receteSatiri.createMany({
          data: g.recete.map((s, i) => ({ ayarId: ayar.id, konuId: s.konuId ?? null, kazanimId: s.kazanimId ?? null, soruSayisi: s.soruSayisi, sira: i })),
        });
      }
      await tx.sabitSoru.deleteMany({ where: { ayarId: ayar.id } });
      if (g.sabitSoruIdleri.length) {
        await tx.sabitSoru.createMany({ data: g.sabitSoruIdleri.map((soruId, i) => ({ ayarId: ayar.id, soruId, sira: i + 1 })) });
      }
    });

    const d = await ayarDurumu(b.db, sinavId, turId);
    res.json(ayarYaniti(d!));
  });

  return r;
}
