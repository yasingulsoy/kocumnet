import { Router } from "express";
import { z } from "zod";
import type { Baglam } from "../http/baglam.js";
import { ogrenciOturumu, sinirDenetle } from "../http/ara-katmanlar.js";
import {
  adSoyadSemasi,
  dogrula,
  epostaSemasi,
  kimlik,
  kimlikSemasi,
  parolaSemasi,
  prismaIle,
} from "../http/yardimcilar.js";
import { ApiHata, dogrulama } from "../lib/hatalar.js";
import { SINIRLAR } from "../lib/hiz-siniri.js";
import { jetonOzeti, jetonUret } from "../lib/jeton.js";
import { parolaDogrula, parolaOzetle, sahteDogrulama } from "../lib/parola.js";
import { sifirlamaIletisi } from "../lib/posta.js";
import { ayarDurumlari } from "../servisler/ayarlar.js";
import { cevapKaydet, checkupBaslat, checkupListesi, ogrenciBitir, raporGetir, testEkrani } from "../servisler/checkup.js";
import { oturumAc, oturumKapat } from "../servisler/oturum.js";

/** kocum.net'teki bağlantı etiketleri (?k=). Listede olmayan yok sayılır. */
export const KAYNAKLAR = new Set(["ust", "hero", "bolum", "altbilgi", "blog", "iletisim", "whatsapp", "instagram", "diger"]);
const SIFIRLAMA_DAKIKA = 60;

const ogrenciNesnesi = (o: { id: number; adSoyad: string; eposta: string; olusturuldu: Date }) => ({
  id: o.id,
  adSoyad: o.adSoyad,
  eposta: o.eposta,
  olusturuldu: o.olusturuldu,
});

const kayitSemasi = z.object({
  adSoyad: adSoyadSemasi,
  eposta: epostaSemasi,
  parola: parolaSemasi,
  kvkkOnay: z.literal(true, { error: "Devam etmek için KVKK aydınlatma metnini onaylayın." }),
  kaynak: z.unknown().optional(),
});

const girisSemasi = z.object({
  eposta: z.string({ error: "E-posta yazın." }).trim().toLowerCase().min(1, { error: "E-posta yazın." }).max(254),
  parola: z.string({ error: "Parola yazın." }).min(1, { error: "Parola yazın." }).max(200),
});

const parolaDegistirSemasi = z.object({
  mevcutParola: z.string({ error: "Mevcut parolanızı yazın." }).min(1, { error: "Mevcut parolanızı yazın." }).max(200),
  yeniParola: parolaSemasi,
});

export function ogrenciRotalari(b: Baglam): Router {
  const r = Router();

  // ─── Giriş gerektirmeyenler ─────────────────────────────────

  r.post("/kayit", async (req, res) => {
    sinirDenetle(b, `kayit:${req.istemciIp}`, SINIRLAR.kayit, res);
    const g = dogrula(kayitSemasi, req.body);
    const cakisma = "Bu e-posta ile açılmış bir hesap var. Giriş yapın ya da parolanızı sıfırlayın.";
    if (await b.db.ogrenci.findUnique({ where: { eposta: g.eposta }, select: { id: true } })) {
      throw new ApiHata("CAKISMA", cakisma, { alanlar: { eposta: cakisma } });
    }
    const parolaHash = await parolaOzetle(g.parola);
    const kaynak = typeof g.kaynak === "string" && KAYNAKLAR.has(g.kaynak) ? g.kaynak : null;
    const ogrenci = await prismaIle(
      () =>
        b.db.ogrenci.create({
          data: { adSoyad: g.adSoyad, eposta: g.eposta, parolaHash, kvkkOnay: b.saat.simdi(), kaynak },
          select: { id: true, adSoyad: true, eposta: true, olusturuldu: true },
        }),
      { cakisma }
    );
    const oturum = await oturumAc(b, { ogrenciId: ogrenci.id });
    res.status(201).json({ jeton: oturum.jeton, bitis: oturum.bitis, ogrenci: ogrenciNesnesi(ogrenci) });
  });

  r.post("/giris", async (req, res) => {
    const g = dogrula(girisSemasi, req.body);
    const sinirAnahtari = `giris-ogrenci:${req.istemciIp}:${g.eposta}`;
    sinirDenetle(b, sinirAnahtari, SINIRLAR.giris, res);
    const o = await b.db.ogrenci.findUnique({
      where: { eposta: g.eposta },
      select: { id: true, adSoyad: true, eposta: true, olusturuldu: true, parolaHash: true },
    });
    const dogru = o ? await parolaDogrula(g.parola, o.parolaHash) : await sahteDogrulama(g.parola);
    if (!o || !dogru) throw dogrulama("E-posta ya da parola yanlış.");
    b.hizSiniri.sifirla(sinirAnahtari);
    const oturum = await oturumAc(b, { ogrenciId: o.id });
    res.json({ jeton: oturum.jeton, bitis: oturum.bitis, ogrenci: ogrenciNesnesi(o) });
  });

  r.post("/cikis", async (req, res) => {
    await oturumKapat(b, req.get("authorization"), "ogrenci");
    res.status(204).end();
  });

  r.post("/parola-sifirla/istek", async (req, res) => {
    sinirDenetle(b, `sifirlama:${req.istemciIp}`, SINIRLAR.sifirlamaIstegi, res);
    const g = dogrula(z.object({ eposta: epostaSemasi }), req.body);
    const o = await b.db.ogrenci.findUnique({ where: { eposta: g.eposta }, select: { id: true, adSoyad: true, eposta: true } });
    if (o) {
      const jeton = jetonUret();
      const bitis = new Date(b.saat.simdi().getTime() + SIFIRLAMA_DAKIKA * 60_000);
      await b.db.parolaSifirlama.create({ data: { ogrenciId: o.id, jetonHash: jetonOzeti(jeton), bitis } });
      const ileti = sifirlamaIletisi({
        kime: o.eposta,
        adSoyad: o.adSoyad,
        baglanti: `${b.frontendUrl}/parola-sifirla/${jeton}`,
        dakika: SIFIRLAMA_DAKIKA,
      });
      // Beklenmez: yanıt süresi hesabın varlığını ele vermesin. Hata günlüğe yazılır.
      b.posta.gonder(ileti).catch((e: unknown) => console.error("[posta] Parola sıfırlama iletisi gönderilemedi:", (e as Error).message));
    }
    res.status(204).end();
  });

  r.post("/parola-sifirla", async (req, res) => {
    const g = dogrula(
      z.object({ jeton: z.string({ error: "Bağlantı geçersiz." }).min(1, { error: "Bağlantı geçersiz." }).max(200), yeniParola: parolaSemasi }),
      req.body
    );
    const gecersiz = () => dogrulama("Bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.", { jeton: "Bağlantı geçersiz ya da süresi dolmuş." });
    const kayit = await b.db.parolaSifirlama.findUnique({ where: { jetonHash: jetonOzeti(g.jeton) }, select: { id: true, ogrenciId: true, bitis: true, kullanildi: true } });
    const simdi = b.saat.simdi();
    if (!kayit || kayit.kullanildi || kayit.bitis <= simdi) throw gecersiz();
    const parolaHash = await parolaOzetle(g.yeniParola);
    await b.db.$transaction(async (tx) => {
      // Tek kullanımlık: koşullu güncelleme, eşzamanlı ikinci kullanım 0 satır görür.
      const kullan = await tx.parolaSifirlama.updateMany({ where: { id: kayit.id, kullanildi: null }, data: { kullanildi: simdi } });
      if (kullan.count === 0) throw gecersiz();
      await tx.ogrenci.update({ where: { id: kayit.ogrenciId }, data: { parolaHash } });
      // Bekleyen öteki bağlantılar da geçersiz olsun; bütün oturumlar kapanır.
      await tx.parolaSifirlama.updateMany({ where: { ogrenciId: kayit.ogrenciId, kullanildi: null }, data: { kullanildi: simdi } });
      await tx.oturum.deleteMany({ where: { ogrenciId: kayit.ogrenciId } });
    });
    res.status(204).end();
  });

  // ─── Katalog ────────────────────────────────────────────────
  // Oturum istemez (tanıtım sayfası da kullanabilsin); jetonla da çalışır.

  r.get("/sinavlar", async (_req, res) => {
    const sinavlar = await b.db.sinav.findMany({
      where: { aktif: true },
      orderBy: [{ sira: "asc" }, { id: "asc" }],
      select: { id: true, ad: true, aciklama: true, ucretKurus: true, yanlisGoturme: true },
    });
    const durumlar = await ayarDurumlari(b.db, sinavlar.map((s) => s.id));
    res.json(
      sinavlar.map((s) => ({
        id: s.id,
        ad: s.ad,
        aciklama: s.aciklama,
        ucretKurus: s.ucretKurus,
        yanlisGoturme: s.yanlisGoturme,
        turler: (durumlar.get(s.id) ?? [])
          .filter((d) => d.tur.aktif)
          .map((d) => ({
            id: d.tur.id,
            ad: d.tur.ad,
            aciklama: d.tur.aciklama,
            soruSayisi: d.tur.soruSayisi,
            sureDakika: d.tur.sureDakika,
            hazir: d.hazirlik.hazir,
          })),
      }))
    );
  });

  // ─── Giriş gerektirenler ────────────────────────────────────

  r.use(ogrenciOturumu(b));

  r.get("/ben", (req, res) => {
    res.json({ ogrenci: ogrenciNesnesi(req.ogrenci!) });
  });

  r.patch("/ben", async (req, res) => {
    const g = dogrula(z.object({ adSoyad: adSoyadSemasi }), req.body);
    const o = await b.db.ogrenci.update({
      where: { id: req.ogrenci!.id },
      data: { adSoyad: g.adSoyad },
      select: { id: true, adSoyad: true, eposta: true, olusturuldu: true },
    });
    res.json({ ogrenci: ogrenciNesnesi(o) });
  });

  r.put("/ben/parola", async (req, res) => {
    const g = dogrula(parolaDegistirSemasi, req.body);
    const o = await b.db.ogrenci.findUniqueOrThrow({ where: { id: req.ogrenci!.id }, select: { parolaHash: true } });
    if (!(await parolaDogrula(g.mevcutParola, o.parolaHash))) {
      throw dogrulama("Mevcut parola yanlış.", { mevcutParola: "Mevcut parola yanlış." });
    }
    const parolaHash = await parolaOzetle(g.yeniParola);
    await b.db.$transaction([
      b.db.ogrenci.update({ where: { id: req.ogrenci!.id }, data: { parolaHash } }),
      b.db.oturum.deleteMany({ where: { ogrenciId: req.ogrenci!.id, id: { not: req.oturumId! } } }),
    ]);
    res.status(204).end();
  });

  r.delete("/ben", async (req, res) => {
    const g = dogrula(z.object({ parola: z.string({ error: "Parolanızı yazın." }).min(1, { error: "Parolanızı yazın." }).max(200) }), req.body);
    const o = await b.db.ogrenci.findUniqueOrThrow({ where: { id: req.ogrenci!.id }, select: { parolaHash: true } });
    if (!(await parolaDogrula(g.parola, o.parolaHash))) throw dogrulama("Parola yanlış.", { parola: "Parola yanlış." });
    // Oturumlar, sıfırlama kayıtları, check-up'lar ve cevaplar zincirleme silinir (onDelete: Cascade).
    await b.db.ogrenci.delete({ where: { id: req.ogrenci!.id } });
    res.status(204).end();
  });

  // ─── Check-up ───────────────────────────────────────────────

  r.post("/checkuplar", async (req, res) => {
    const g = dogrula(z.object({ sinavId: kimlikSemasi("Sınav"), turId: kimlikSemasi("Tür") }), req.body);
    const sonuc = await checkupBaslat(b, req.ogrenci!.id, g.sinavId, g.turId);
    res.status(201).json(sonuc);
  });

  r.get("/checkuplar", async (req, res) => {
    res.json(await checkupListesi(b, req.ogrenci!.id));
  });

  r.get("/checkuplar/:id", async (req, res) => {
    res.json(await testEkrani(b, req.ogrenci!.id, kimlik(req.params.id, "Check-up bulunamadı.")));
  });

  r.put("/checkuplar/:id/cevaplar/:sira", async (req, res) => {
    const id = kimlik(req.params.id, "Check-up bulunamadı.");
    const sira = kimlik(req.params.sira, "Bu sırada soru yok.");
    const g = dogrula(
      z.object({
        sikId: z.union([kimlikSemasi("Şık"), z.null()], { error: "sikId bir şık kimliği ya da null olmalı." }),
      }),
      req.body
    );
    await cevapKaydet(b, req.ogrenci!.id, id, sira, g.sikId);
    res.json({ kaydedildi: true });
  });

  r.post("/checkuplar/:id/bitir", async (req, res) => {
    res.json(await ogrenciBitir(b, req.ogrenci!.id, kimlik(req.params.id, "Check-up bulunamadı.")));
  });

  r.get("/checkuplar/:id/rapor", async (req, res) => {
    const { yanit } = await raporGetir(b, kimlik(req.params.id, "Check-up bulunamadı."), req.ogrenci!.id);
    res.json(yanit);
  });

  return r;
}
