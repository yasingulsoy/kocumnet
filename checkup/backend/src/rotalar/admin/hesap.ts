import { Router } from "express";
import { z } from "zod";
import type { Baglam, YoneticiKimligi } from "../../http/baglam.js";
import { sinirDenetle, yoneticiRoluGerekli } from "../../http/ara-katmanlar.js";
import { adSoyadSemasi, dogrula, epostaSemasi, kimlik, parolaSemasi, prismaIle } from "../../http/yardimcilar.js";
import { ApiHata, bulunamadi, dogrulama } from "../../lib/hatalar.js";
import { SINIRLAR } from "../../lib/hiz-siniri.js";
import { parolaDogrula, parolaOzetle, sahteDogrulama } from "../../lib/parola.js";
import { oturumAc, oturumKapat } from "../../servisler/oturum.js";

const KILIT_YONETICILER = 41002;

export const yoneticiSecimi = { id: true, adSoyad: true, eposta: true, rol: true, aktif: true } as const;
export const yoneticiNesnesi = (y: YoneticiKimligi) => ({ id: y.id, adSoyad: y.adSoyad, eposta: y.eposta, rol: y.rol, aktif: y.aktif });

const rolSemasi = z.enum(["YONETICI", "EDITOR"], { error: 'Rol "YONETICI" ya da "EDITOR" olmalı.' });
const cakisma = "Bu e-posta ile bir yönetici zaten var.";

/** Giriş gerektirmeyen uçlar: giriş ve çıkış. */
export function adminAcikRotalar(b: Baglam): Router {
  const r = Router();

  r.post("/giris", async (req, res) => {
    const g = dogrula(
      z.object({
        eposta: z.string({ error: "E-posta yazın." }).trim().toLowerCase().min(1, { error: "E-posta yazın." }).max(254),
        parola: z.string({ error: "Parola yazın." }).min(1, { error: "Parola yazın." }).max(200),
      }),
      req.body
    );
    const sinirAnahtari = `giris-yonetici:${req.istemciIp}:${g.eposta}`;
    sinirDenetle(b, sinirAnahtari, SINIRLAR.giris, res);
    const y = await b.db.yonetici.findUnique({ where: { eposta: g.eposta }, select: { ...yoneticiSecimi, parolaHash: true } });
    const dogru = y ? await parolaDogrula(g.parola, y.parolaHash) : await sahteDogrulama(g.parola);
    if (!y || !dogru) throw dogrulama("E-posta ya da parola yanlış.");
    // Giriş formu yalnızca DOGRULAMA mesajını gösterir; pasif hesap da 400 döner (OTURUM_YOK değil).
    if (!y.aktif) throw dogrulama("Hesabınız pasif. Bir yöneticiye başvurun.");
    b.hizSiniri.sifirla(sinirAnahtari);
    const oturum = await oturumAc(b, { yoneticiId: y.id });
    res.json({ jeton: oturum.jeton, bitis: oturum.bitis, yonetici: yoneticiNesnesi(y) });
  });

  r.post("/cikis", async (req, res) => {
    await oturumKapat(b, req.get("authorization"), "yonetici");
    res.status(204).end();
  });

  return r;
}

/** Oturumlu uçlar: ben, parola, yöneticiler (YONETICI). */
export function adminHesapRotalari(b: Baglam): Router {
  const r = Router();

  r.get("/ben", (req, res) => {
    res.json({ yonetici: yoneticiNesnesi(req.yonetici!) });
  });

  r.put("/ben/parola", async (req, res) => {
    const g = dogrula(
      z.object({
        mevcutParola: z.string({ error: "Mevcut parolanızı yazın." }).min(1, { error: "Mevcut parolanızı yazın." }).max(200),
        yeniParola: parolaSemasi,
      }),
      req.body
    );
    const y = await b.db.yonetici.findUniqueOrThrow({ where: { id: req.yonetici!.id }, select: { parolaHash: true } });
    if (!(await parolaDogrula(g.mevcutParola, y.parolaHash))) throw dogrulama("Mevcut parola yanlış.", { mevcutParola: "Mevcut parola yanlış." });
    const parolaHash = await parolaOzetle(g.yeniParola);
    await b.db.$transaction([
      b.db.yonetici.update({ where: { id: req.yonetici!.id }, data: { parolaHash } }),
      b.db.oturum.deleteMany({ where: { yoneticiId: req.yonetici!.id, id: { not: req.oturumId! } } }),
    ]);
    res.status(204).end();
  });

  // ─── Yöneticiler (YONETICI) ─────────────────────────────────

  r.get("/yoneticiler", yoneticiRoluGerekli, async (_req, res) => {
    const liste = await b.db.yonetici.findMany({ orderBy: { id: "asc" }, select: yoneticiSecimi });
    res.json(liste.map(yoneticiNesnesi));
  });

  r.post("/yoneticiler", yoneticiRoluGerekli, async (req, res) => {
    const g = dogrula(z.object({ adSoyad: adSoyadSemasi, eposta: epostaSemasi, parola: parolaSemasi, rol: rolSemasi }), req.body);
    if (await b.db.yonetici.findUnique({ where: { eposta: g.eposta }, select: { id: true } })) {
      throw new ApiHata("CAKISMA", cakisma, { alanlar: { eposta: cakisma } });
    }
    const parolaHash = await parolaOzetle(g.parola);
    const y = await prismaIle(
      () => b.db.yonetici.create({ data: { adSoyad: g.adSoyad, eposta: g.eposta, parolaHash, rol: g.rol, aktif: true }, select: yoneticiSecimi }),
      { cakisma }
    );
    res.status(201).json(yoneticiNesnesi(y));
  });

  r.patch("/yoneticiler/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Yönetici bulunamadı.");
    const g = dogrula(
      z.object({
        adSoyad: adSoyadSemasi.optional(),
        rol: rolSemasi.optional(),
        aktif: z.boolean({ error: "aktif true ya da false olmalı." }).optional(),
        parola: parolaSemasi.optional(),
      }),
      req.body
    );
    const parolaHash = g.parola ? await parolaOzetle(g.parola) : undefined;

    const y = await b.db.$transaction(async (tx) => {
      // Son aktif YONETICI denetimi yarışmasın: yönetici değişiklikleri sıraya girer.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KILIT_YONETICILER}::int, 0)`;
      const mevcut = await tx.yonetici.findUnique({ where: { id }, select: yoneticiSecimi });
      if (!mevcut) throw bulunamadi("Yönetici bulunamadı.");
      const yeniRol = g.rol ?? mevcut.rol;
      const yeniAktif = g.aktif ?? mevcut.aktif;
      if (mevcut.rol === "YONETICI" && mevcut.aktif && (yeniRol !== "YONETICI" || !yeniAktif)) {
        const diger = await tx.yonetici.count({ where: { rol: "YONETICI", aktif: true, id: { not: id } } });
        if (diger === 0) {
          const mesaj = "Son aktif YONETICI pasif yapılamaz ya da EDITOR'e düşürülemez. Önce başka bir YONETICI ekleyin.";
          throw dogrulama(mesaj, g.rol !== undefined && yeniRol !== "YONETICI" ? { rol: mesaj } : { aktif: mesaj });
        }
      }
      const guncel = await tx.yonetici.update({
        where: { id },
        data: { adSoyad: g.adSoyad, rol: g.rol, aktif: g.aktif, parolaHash },
        select: yoneticiSecimi,
      });
      // Pasif yapılan ya da parolası değişen kişinin oturumları kapanır (kendi parolasını
      // değiştiren yöneticinin bu oturumu açık kalır).
      if (!yeniAktif || parolaHash) {
        await tx.oturum.deleteMany({ where: { yoneticiId: id, ...(id === req.yonetici!.id && yeniAktif ? { id: { not: req.oturumId! } } : {}) } });
      }
      return guncel;
    });
    res.json(yoneticiNesnesi(y));
  });

  r.delete("/yoneticiler/:id", yoneticiRoluGerekli, async (req, res) => {
    const id = kimlik(req.params.id, "Yönetici bulunamadı.");
    if (id === req.yonetici!.id) throw dogrulama("Kendi hesabınızı silemezsiniz.");
    await b.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KILIT_YONETICILER}::int, 0)`;
      const mevcut = await tx.yonetici.findUnique({ where: { id }, select: { rol: true, aktif: true } });
      if (!mevcut) throw bulunamadi("Yönetici bulunamadı.");
      if (mevcut.rol === "YONETICI") {
        const diger = await tx.yonetici.count({ where: { rol: "YONETICI", aktif: true, id: { not: id } } });
        if (diger === 0) throw dogrulama("Son YONETICI silinemez. Önce başka bir YONETICI ekleyin.");
      }
      // Oturumlar zincirleme silinir; içe aktarma kayıtlarında yönetici boşaltılır.
      await tx.yonetici.delete({ where: { id } });
    });
    res.status(204).end();
  });

  return r;
}
