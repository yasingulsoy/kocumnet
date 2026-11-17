import { Router } from "express";
import type { Prisma } from "../../generated/prisma/client.js";
import type { Baglam } from "../../http/baglam.js";
import { yoneticiRoluGerekli } from "../../http/ara-katmanlar.js";
import { kimlik, sayfalama, sayfaliYanit, sorguMetni } from "../../http/yardimcilar.js";
import { bulunamadi } from "../../lib/hatalar.js";
import { checkupOzeti, ozetSecimi, raporGetir, suresiDolanlariBitir } from "../../servisler/checkup.js";

/** Öğrenciler ve öğrenci raporları: yalnızca YONETICI (KVKK). */
export function adminOgrenciRotalari(b: Baglam): Router {
  const r = Router();
  r.use(["/ogrenciler", "/checkuplar"], yoneticiRoluGerekli);

  r.get("/ogrenciler", async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const s = sayfalama(q);
    const ara = sorguMetni(q.ara);
    const where: Prisma.OgrenciWhereInput = ara
      ? { OR: [{ adSoyad: { contains: ara, mode: "insensitive" } }, { eposta: { contains: ara.toLocaleLowerCase("tr-TR"), mode: "insensitive" } }] }
      : {};
    const [toplam, kayitlar] = await Promise.all([
      b.db.ogrenci.count({ where }),
      b.db.ogrenci.findMany({
        where,
        orderBy: [{ olusturuldu: "desc" }, { id: "desc" }],
        skip: s.atla,
        take: s.boyut,
        select: {
          id: true,
          adSoyad: true,
          eposta: true,
          olusturuldu: true,
          kaynak: true,
          _count: { select: { checkuplar: true } },
          checkuplar: { orderBy: { baslangic: "desc" }, take: 1, select: { baslangic: true } },
        },
      }),
    ]);
    res.json(
      sayfaliYanit(
        kayitlar.map((o) => ({
          id: o.id,
          adSoyad: o.adSoyad,
          eposta: o.eposta,
          olusturuldu: o.olusturuldu,
          kaynak: o.kaynak,
          checkupSayisi: o._count.checkuplar,
          sonCheckup: o.checkuplar[0]?.baslangic ?? null,
        })),
        toplam,
        s
      )
    );
  });

  r.get("/ogrenciler/:id", async (req, res) => {
    const id = kimlik(req.params.id, "Öğrenci bulunamadı.");
    const o = await b.db.ogrenci.findUnique({ where: { id }, select: { id: true, adSoyad: true, eposta: true, olusturuldu: true, kaynak: true } });
    if (!o) throw bulunamadi("Öğrenci bulunamadı.");
    await suresiDolanlariBitir(b, { ogrenciId: id });
    const checkuplar = await b.db.checkup.findMany({ where: { ogrenciId: id }, orderBy: [{ baslangic: "desc" }, { id: "desc" }], select: ozetSecimi });
    res.json({ ogrenci: o, checkuplar: checkuplar.map(checkupOzeti) });
  });

  r.get("/checkuplar/:id/rapor", async (req, res) => {
    const { yanit, ogrenci } = await raporGetir(b, kimlik(req.params.id, "Check-up bulunamadı."));
    res.json({ ...yanit, ogrenci: { id: ogrenci.id, adSoyad: ogrenci.adSoyad } });
  });

  return r;
}
