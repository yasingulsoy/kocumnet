import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { anahtarlariTopla, basariBekle, benzersiz, hataBekle, type Istemci, type Kurucu } from "../yardimci/istemci.js";
import type { TestOrtami } from "../yardimci/ortam.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Kurulum {
  sinavId: number;
  turId: number;
  bosTurId: number;
  sorular: number[];
  konu1: number;
  konu2: number;
  k1: number;
}

/**
 * Sınav: iki ders (Sayısal sıra 0, Sözel sıra 1).
 *   Sayısal/Konu1: K1 (4 soru), K2 (4 soru)   Sözel/Konu2: K3 (4 soru)
 * Tür: 6 soru, 30 dk. Reçete: K1 kazanım 2 + Konu1 konu 2 + Konu2 konu 2.
 */
async function kur(k: Kurucu): Promise<Kurulum> {
  const sinav = await k.sinav();
  const d1 = await k.dugum("dersler", sinav.id, "Sayısal");
  const d2 = await k.dugum("dersler", sinav.id, "Sözel");
  const konu1 = await k.dugum("konular", d1, "Konu Bir");
  const konu2 = await k.dugum("konular", d2, "Konu İki");
  const k1 = await k.dugum("kazanimlar", konu1, "Kazanım Bir", "K1");
  const k2 = await k.dugum("kazanimlar", konu1, "Kazanım İki", "K2");
  const k3 = await k.dugum("kazanimlar", konu2, "Kazanım Üç", "K3");
  const a1 = await k.dugum("alt-kazanimlar", k1, "Alt Bir", "K1.1");
  const a2 = await k.dugum("alt-kazanimlar", k2, "Alt İki", "K2.1");
  const a3 = await k.dugum("alt-kazanimlar", k3, "Alt Üç", "K3.1");
  const sorular: number[] = [];
  for (const [dersId, konuId, kazanimId, altKazanimId] of [
    [d1, konu1, k1, a1],
    [d1, konu1, k2, a2],
    [d2, konu2, k3, a3],
  ] as const) {
    for (let i = 0; i < 4; i++) sorular.push((await k.soru({ sinavId: sinav.id, dersId, konuId, kazanimId, altKazanimId })).id);
  }
  const tur = await k.tur(6);
  const bosTur = await k.tur(5);
  const ayar = await k.ayar(sinav.id, tur.id, {
    secim: "KARMA",
    recete: [
      { kazanimId: k1, soruSayisi: 2 },
      { konuId: konu1, soruSayisi: 2 },
      { konuId: konu2, soruSayisi: 2 },
    ],
  });
  assert.equal(ayar.hazirlik.hazir, true, JSON.stringify(ayar.hazirlik));
  return { sinavId: sinav.id, turId: tur.id, bosTurId: bosTur.id, sorular, konu1, konu2, k1 };
}

async function siklar(o: () => TestOrtami, checkupId: number) {
  const satirlar = await o().db.checkupSorusu.findMany({
    where: { checkupId },
    orderBy: { sira: "asc" },
    select: { sira: true, soruId: true, soru: { select: { siklar: { orderBy: { sira: "asc" }, select: { id: true, dogru: true } } } } },
  });
  return satirlar.map((s) => ({
    sira: s.sira,
    soruId: s.soruId,
    dogru: s.soru.siklar.find((x) => x.dogru)!.id,
    yanlis: s.soru.siklar.find((x) => !x.dogru)!.id,
  }));
}

export function checkupTestleri(o: () => TestOrtami, h: Istemci, k: Kurucu) {
  let t: Kurulum;
  before(async () => {
    t = await kur(k);
  });

  describe("katalog", () => {
    it("yalnızca aktif sınavlar ve aktif türler; hazir bayrağı ve yanlisGoturme", async () => {
      const pasifSinav = await k.sinav({ aktif: false });
      const pasifTur = await k.tur(3, { aktif: false });
      const ogr = await k.ogrenci();
      const y = await h.get("/api/ogrenci/sinavlar", { jeton: ogr.jeton });
      basariBekle(y);
      const sinav = y.govde.find((s: any) => s.id === t.sinavId);
      assert.ok(sinav, "aktif sınav listede olmalı");
      assert.equal(sinav.yanlisGoturme, 4);
      assert.equal(typeof sinav.ucretKurus, "number");
      assert.ok(!y.govde.some((s: any) => s.id === pasifSinav.id), "pasif sınav listede olmamalı");
      assert.ok(!sinav.turler.some((x: any) => x.id === pasifTur.id), "pasif tür listede olmamalı");
      assert.equal(sinav.turler.find((x: any) => x.id === t.turId).hazir, true);
      assert.equal(sinav.turler.find((x: any) => x.id === t.bosTurId).hazir, false);
      assert.deepEqual(Object.keys(sinav.turler[0]).sort(), ["aciklama", "ad", "hazir", "id", "soruSayisi", "sureDakika"]);
      // Oturumsuz da açılır (tanıtım sayfası)
      const acik = await h.get("/api/ogrenci/sinavlar");
      basariBekle(acik);
      assert.deepEqual(acik.govde, y.govde);
    });
  });

  describe("check-up akışı", () => {
    it("başlatma kuralları: hazır değil, pasif sınav, açık check-up", async () => {
      const ogr = await k.ogrenci();
      hataBekle(await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.bosTurId }, { jeton: ogr.jeton }), 409, "HAZIR_DEGIL");
      const pasif = await k.sinav({ aktif: false });
      hataBekle(await h.post("/api/ogrenci/checkuplar", { sinavId: pasif.id, turId: t.turId }, { jeton: ogr.jeton }), 404, "BULUNAMADI");
      hataBekle(await h.post("/api/ogrenci/checkuplar", { sinavId: 999999, turId: t.turId }, { jeton: ogr.jeton }), 404, "BULUNAMADI");
      const y = await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton });
      basariBekle(y, 201);
      const ikinci = await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton });
      hataBekle(ikinci, 409, "ACIK_CHECKUP_VAR");
      assert.equal(ikinci.govde.hata.ek.checkupId, y.govde.id);
    });

    it("aynı anda iki başlatma isteği tek check-up açar", async () => {
      const ogr = await k.ogrenci();
      const [a, b] = await Promise.all([
        h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton }),
        h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton }),
      ]);
      assert.deepEqual([a.durum, b.durum].sort(), [201, 409]);
      assert.equal(await o().db.checkup.count({ where: { ogrenciId: ogr.id } }), 1);
    });

    it("test ekranı: şekil, ders sırası, CEVAP ANAHTARI SIZMAZ", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const y = await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton });
      basariBekle(y);
      const e = y.govde;
      assert.equal(e.durum, "DEVAM");
      assert.equal(e.soruSayisi, 6);
      assert.equal(e.sureDakika, 30);
      assert.equal(e.yanlisGoturme, 4);
      assert.ok(e.baslangic && e.bitisSiniri && e.simdi);
      assert.equal(new Date(e.bitisSiniri).getTime() - new Date(e.baslangic).getTime(), 30 * 60_000);
      assert.equal(e.sorular.length, 6);
      assert.deepEqual(
        e.sorular.map((s: any) => s.sira),
        [1, 2, 3, 4, 5, 6]
      );
      assert.deepEqual(
        e.sorular.map((s: any) => s.ders),
        ["Sayısal", "Sayısal", "Sayısal", "Sayısal", "Sözel", "Sözel"]
      );
      for (const s of e.sorular) {
        assert.deepEqual(Object.keys(s).sort(), ["ders", "gorselId", "metinHtml", "secilenSikId", "sira", "siklar"].sort());
        assert.deepEqual(
          s.siklar.map((x: any) => x.harf),
          ["A", "B", "C", "D", "E"]
        );
        for (const sik of s.siklar) assert.deepEqual(Object.keys(sik).sort(), ["harf", "id", "metinHtml"]);
      }

      // Sızıntı denetimi: anahtar adları derinlemesine
      const anahtarlar = anahtarlariTopla(e);
      for (const yasak of ["dogru", "dogruMu", "cozum", "cozumHtml", "aciklama", "aciklamaHtml", "rapor"]) {
        assert.ok(!anahtarlar.has(yasak), `test ekranında "${yasak}" anahtarı olmamalı`);
      }
      for (const a of anahtarlar) assert.ok(!/^cozum/i.test(a) && !/^dogru/i.test(a), `şüpheli anahtar: ${a}`);
      const metin = JSON.stringify(e);
      assert.ok(!metin.includes("Doğru cevap."), "şık açıklaması metni sızmamalı");
      assert.ok(!metin.includes("x = "), "çözüm metni sızmamalı");
    });

    it("cevap kaydet, boş bırak, başka sorunun şıkkı reddedilir", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const s = await siklar(o, id);
      const y = await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: s[0]!.yanlis }, { jeton: ogr.jeton });
      basariBekle(y);
      assert.deepEqual(y.govde, { kaydedildi: true });
      let ekran = (await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde;
      assert.equal(ekran.sorular[0].secilenSikId, s[0]!.yanlis);
      basariBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: null }, { jeton: ogr.jeton }));
      ekran = (await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde;
      assert.equal(ekran.sorular[0].secilenSikId, null);

      const yabanci = await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: s[1]!.dogru }, { jeton: ogr.jeton });
      hataBekle(yabanci, 400, "DOGRULAMA");
      hataBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, {}, { jeton: ogr.jeton }), 400, "DOGRULAMA");
      hataBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/99`, { sikId: null }, { jeton: ogr.jeton }), 404, "BULUNAMADI");
      hataBekle(await h.get(`/api/ogrenci/checkuplar/${id}/rapor`, { jeton: ogr.jeton }), 409, "HAZIR_DEGIL");

      const liste = await h.get("/api/ogrenci/checkuplar", { jeton: ogr.jeton });
      basariBekle(liste);
      assert.equal(liste.govde[0].id, id);
      assert.equal(liste.govde[0].durum, "DEVAM");
      assert.equal(liste.govde[0].net, null);
      assert.equal(liste.govde[0].cevaplanan, 0);
    });

    it("öğrenci başkasının check-up'ını göremez (BULUNAMADI)", async () => {
      const a = await k.ogrenci();
      const b = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: a.jeton })).govde;
      const s = await siklar(o, id);
      hataBekle(await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: b.jeton }), 404, "BULUNAMADI");
      hataBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: s[0]!.dogru }, { jeton: b.jeton }), 404, "BULUNAMADI");
      hataBekle(await h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: b.jeton }), 404, "BULUNAMADI");
      hataBekle(await h.get(`/api/ogrenci/checkuplar/${id}/rapor`, { jeton: b.jeton }), 404, "BULUNAMADI");
      assert.equal((await h.get("/api/ogrenci/checkuplar", { jeton: b.jeton })).govde.length, 0);
      // A'nın check-up'ı dokunulmadan duruyor
      const ekran = (await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: a.jeton })).govde;
      assert.equal(ekran.durum, "DEVAM");
      assert.equal(ekran.sorular[0].secilenSikId, null);
    });

    it("şık yerinde güncellenir: öğrencinin cevabı ve şık kimlikleri korunur", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const s = (await siklar(o, id))[1]!;
      basariBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/2`, { sikId: s.yanlis }, { jeton: ogr.jeton }));
      const onceki = await o().db.sik.findMany({ where: { soruId: s.soruId }, orderBy: { sira: "asc" }, select: { id: true } });

      const yon = await k.yonetici();
      const p = await h.patch(
        `/api/admin/sorular/${s.soruId}`,
        { siklar: [{ metin: "on" }, { metin: "yirmi" }, { metin: "otuz" }, { metin: "kırk" }, { metin: "elli" }], dogruSik: "D" },
        { jeton: yon }
      );
      basariBekle(p);
      assert.deepEqual(
        p.govde.siklar.map((x: any) => [x.harf, x.metin, x.dogru]),
        [
          ["A", "on", false],
          ["B", "yirmi", false],
          ["C", "otuz", false],
          ["D", "kırk", true],
          ["E", "elli", false],
        ]
      );
      const sonraki = await o().db.sik.findMany({ where: { soruId: s.soruId }, orderBy: { sira: "asc" }, select: { id: true } });
      assert.deepEqual(sonraki, onceki, "şık kimlikleri değişmemeli");
      const ekran = (await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde;
      assert.equal(ekran.sorular[1].secilenSikId, s.yanlis);
      assert.ok(ekran.sorular[1].siklar.some((x: any) => x.id === s.yanlis));
      // Yalnızca doğru şık değişimi de yerinde
      basariBekle(await h.patch(`/api/admin/sorular/${s.soruId}`, { dogruSik: "B" }, { jeton: yon }));
      const d = await h.get(`/api/admin/sorular/${s.soruId}`, { jeton: yon });
      assert.deepEqual(
        d.govde.siklar.map((x: any) => x.dogru),
        [false, true, false, false, false]
      );
    });

    it("bitir: puanlama, rapor sayıları ve net; bitir idempotent", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const s = await siklar(o, id);
      // 3 doğru (1,2,5), 2 yanlış (3,6), 1 boş (4)
      const cevap = (sira: number, sikId: number) => h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/${sira}`, { sikId }, { jeton: ogr.jeton });
      for (const [sira, tur] of [
        [1, "dogru"],
        [2, "dogru"],
        [3, "yanlis"],
        [5, "dogru"],
        [6, "yanlis"],
      ] as const) {
        basariBekle(await cevap(sira, s[sira - 1]![tur]));
      }

      const b1 = await h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: ogr.jeton });
      basariBekle(b1);
      assert.deepEqual(b1.govde, { id, durum: "BITTI" });
      const b2 = await h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: ogr.jeton });
      basariBekle(b2);
      assert.deepEqual(b2.govde, { id, durum: "BITTI" });
      hataBekle(await cevap(4, s[3]!.dogru), 409, "KAPANDI");
      assert.deepEqual((await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde, { id, durum: "BITTI" });

      const r = await h.get(`/api/ogrenci/checkuplar/${id}/rapor`, { jeton: ogr.jeton });
      basariBekle(r);
      const rapor = r.govde;
      assert.deepEqual(rapor.ozet, { soruSayisi: 6, dogru: 3, yanlis: 2, bos: 1, net: 2.5, yanlisGoturme: 4, basari: 50 });
      assert.equal(rapor.id, id);
      assert.ok(rapor.sinav.ad && rapor.tur.ad && rapor.baslangic && rapor.bitis);
      assert.equal(typeof rapor.sureSaniye, "number");
      // Dersler ağaç sırasında, toplamlar tutarlı
      assert.deepEqual(
        rapor.dersler.map((d: any) => d.ad),
        ["Sayısal", "Sözel"]
      );
      const toplam = (dizi: any[], alan: string) => dizi.reduce((a, x) => a + x[alan], 0);
      for (const liste of [rapor.dersler, rapor.konular, rapor.kazanimlar, rapor.altKazanimlar]) {
        assert.equal(toplam(liste, "soru"), 6);
        assert.equal(toplam(liste, "dogru"), 3);
        assert.equal(toplam(liste, "yanlis"), 2);
        assert.equal(toplam(liste, "bos"), 1);
        for (const g of liste) {
          assert.equal(g.basari, Math.round((g.dogru / g.soru) * 100));
          assert.equal(g.net, Math.round((g.dogru - g.yanlis / 4) * 100) / 100);
        }
      }
      assert.ok(rapor.konular.every((x: any) => typeof x.dersAd === "string"));
      assert.ok(rapor.kazanimlar.every((x: any) => "kod" in x && typeof x.konuAd === "string"));
      assert.ok(rapor.altKazanimlar.every((x: any) => "kod" in x && typeof x.kazanimAd === "string"));
      // Sözel: 1 doğru (5), 1 yanlış (6) → %50, zayıf DEĞİL; zayıflar yalnızca ≥2 soru ve <%50
      for (const z of rapor.zayiflar) {
        assert.ok(z.soru >= 2 && z.basari < 50);
        assert.ok(["kazanim", "altKazanim"].includes(z.seviye));
      }

      // İnceleme: güncel içerikten, anahtar ve çözüm burada var
      assert.equal(rapor.inceleme.length, 6);
      assert.deepEqual(
        rapor.inceleme.map((x: any) => x.sonuc),
        ["dogru", "dogru", "yanlis", "bos", "dogru", "yanlis"]
      );
      const ilk = rapor.inceleme[0];
      assert.ok(ilk.cozumHtml && ilk.ders && ilk.konu && ilk.kazanim && ilk.altKazanim);
      assert.equal(ilk.siklar.length, 5);
      assert.equal(ilk.siklar.filter((x: any) => x.dogru).length, 1);
      assert.ok(ilk.siklar.some((x: any) => x.aciklama === "Doğru cevap."));

      // Veritabanında da tutarlı
      const c = await o().db.checkup.findUniqueOrThrow({ where: { id } });
      assert.equal(c.durum, "BITTI");
      assert.equal(c.dogru, 3);
      assert.equal(c.net, 2.5);
      assert.ok(c.rapor && !("inceleme" in (c.rapor as object)));
      const liste = (await h.get("/api/ogrenci/checkuplar", { jeton: ogr.jeton })).govde;
      assert.equal(liste[0].net, 2.5);
      assert.equal(liste[0].cevaplanan, 5);
    });

    it("eşzamanlı iki bitir çağrısı çift puanlamaz", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const s = await siklar(o, id);
      basariBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: s[0]!.dogru }, { jeton: ogr.jeton }));
      const sonuclar = await Promise.all([1, 2, 3].map(() => h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: ogr.jeton })));
      for (const y of sonuclar) {
        basariBekle(y);
        assert.equal(y.govde.durum, "BITTI");
      }
      const c = await o().db.checkup.findUniqueOrThrow({ where: { id } });
      assert.equal(c.dogru, 1);
      assert.equal(c.yanlis, 0);
      assert.equal(c.bos, 5);
      assert.equal(await o().db.checkupSorusu.count({ where: { checkupId: id, dogruMu: true } }), 1);
    });

    it("süre: 15 saniye tolerans, sonra SURE_DOLDU ve check-up kapanır", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const s = await siklar(o, id);
      try {
        o().saat.kaydir(30 * 60_000 + 10_000); // sınırdan 10 sn sonra: kabul
        basariBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/1`, { sikId: s[0]!.dogru }, { jeton: ogr.jeton }));
        assert.equal((await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde.durum, "DEVAM");
        o().saat.kaydir(6_000); // sınırdan 16 sn sonra: red
        hataBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/2`, { sikId: s[1]!.dogru }, { jeton: ogr.jeton }), 409, "SURE_DOLDU");
        assert.deepEqual((await h.get(`/api/ogrenci/checkuplar/${id}`, { jeton: ogr.jeton })).govde, { id, durum: "BITTI" });
        hataBekle(await h.put(`/api/ogrenci/checkuplar/${id}/cevaplar/2`, { sikId: s[1]!.dogru }, { jeton: ogr.jeton }), 409, "KAPANDI");
        const r = (await h.get(`/api/ogrenci/checkuplar/${id}/rapor`, { jeton: ogr.jeton })).govde;
        assert.equal(r.ozet.dogru, 1);
        assert.equal(r.sureSaniye, 30 * 60, "süresi dolan check-up sınırda bitmiş sayılır");
      } finally {
        o().saat.sifirla();
      }
    });

    it("süresi geçmiş açık check-up listeye gelen ilk istekte kendiliğinden biter; yeni check-up başlatılabilir", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      try {
        o().saat.kaydir(31 * 60_000);
        const liste = await h.get("/api/ogrenci/checkuplar", { jeton: ogr.jeton });
        assert.equal(liste.govde[0].id, id);
        assert.equal(liste.govde[0].durum, "BITTI");
        assert.equal(liste.govde[0].bos, 6);
        assert.equal(liste.govde[0].net, 0);
        basariBekle(await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton }), 201);
      } finally {
        o().saat.sifirla();
      }
    });
  });

  describe("soru seçimi", () => {
    it("KARMA: kazanım ve konu satırları aynı soruyu iki kez almaz; konu satırı kendi konusundan seçer", async () => {
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const satirlar = await o().db.checkupSorusu.findMany({ where: { checkupId: id }, select: { soruId: true, konuId: true, kazanimId: true } });
      assert.equal(new Set(satirlar.map((s) => s.soruId)).size, 6);
      assert.ok(satirlar.filter((s) => s.kazanimId === t.k1).length >= 2, "kazanım satırı K1'den en az 2 soru");
      assert.equal(satirlar.filter((s) => s.konuId === t.konu1).length, 4);
      assert.equal(satirlar.filter((s) => s.konuId === t.konu2).length, 2);
    });

    it("KARMA: daha önce görülen sorular havuz yetiyorsa gelmez", async () => {
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      for (let i = 0; i < 6; i++) await k.soru(z);
      const tur = await k.tur(3);
      await k.ayar(sinav.id, tur.id, { secim: "KARMA", recete: [{ kazanimId: z.kazanimId, soruSayisi: 3 }] });
      const ogr = await k.ogrenci();
      const coz = async () => {
        const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: sinav.id, turId: tur.id }, { jeton: ogr.jeton })).govde;
        const idler = (await o().db.checkupSorusu.findMany({ where: { checkupId: id }, select: { soruId: true } })).map((s) => s.soruId);
        basariBekle(await h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: ogr.jeton }));
        return idler;
      };
      const ilk = await coz();
      const ikinci = await coz();
      assert.equal(new Set([...ilk, ...ikinci]).size, 6, "ikinci check-up ilkinde görülmeyenlerden seçmeli");
      const ucuncu = await coz(); // hepsi görüldü: yine de başlar
      assert.equal(new Set(ucuncu).size, 3);
    });

    it("SABIT: liste sırası korunur; pasif soru hazırlığı bozar", async () => {
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      const q1 = (await k.soru(z)).id;
      const q2 = (await k.soru(z)).id;
      const q3 = (await k.soru(z)).id;
      const tur = await k.tur(3);
      const ayar = await k.ayar(sinav.id, tur.id, { secim: "SABIT", sabitSoruIdleri: [q3, q1, q2] });
      assert.equal(ayar.hazirlik.hazir, true);
      assert.deepEqual(
        ayar.sabitSorular.map((s: any) => s.soruId),
        [q3, q1, q2]
      );
      const ogr = await k.ogrenci();
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: sinav.id, turId: tur.id }, { jeton: ogr.jeton })).govde;
      const sira = await o().db.checkupSorusu.findMany({ where: { checkupId: id }, orderBy: { sira: "asc" }, select: { soruId: true } });
      assert.deepEqual(
        sira.map((s) => s.soruId),
        [q3, q1, q2]
      );
      const yon = await k.yonetici();
      basariBekle(await h.patch(`/api/admin/sorular/${q1}`, { aktif: false }, { jeton: yon }));
      const ayarlar = (await h.get(`/api/admin/sinavlar/${sinav.id}/ayarlar`, { jeton: yon })).govde;
      const bu = ayarlar.find((a: any) => a.tur.id === tur.id);
      assert.equal(bu.hazirlik.hazir, false);
      assert.ok(bu.hazirlik.sorunlar.some((s: string) => s.includes(`#${q1}`)));
    });
  });

  describe("admin: öğrenciler ve rapor (YONETICI)", () => {
    it("öğrenci listesi, ayrıntı ve admin raporu", async () => {
      const ogr = await k.ogrenci({ adSoyad: "Rapor Öğrencisi", kaynak: "blog" });
      const { id } = (await h.post("/api/ogrenci/checkuplar", { sinavId: t.sinavId, turId: t.turId }, { jeton: ogr.jeton })).govde;
      const yon = await k.yonetici();
      hataBekle(await h.get(`/api/admin/checkuplar/${id}/rapor`, { jeton: yon }), 409, "HAZIR_DEGIL");
      basariBekle(await h.post(`/api/ogrenci/checkuplar/${id}/bitir`, undefined, { jeton: ogr.jeton }));

      const liste = await h.get(`/api/admin/ogrenciler?ara=${encodeURIComponent(ogr.eposta)}&boyut=10`, { jeton: yon });
      basariBekle(liste);
      assert.equal(liste.govde.toplam, 1);
      assert.equal(liste.govde.boyut, 10);
      assert.equal(liste.govde.sayfa, 1);
      const kayit = liste.govde.kayitlar[0];
      assert.equal(kayit.kaynak, "blog");
      assert.equal(kayit.checkupSayisi, 1);
      assert.ok(kayit.sonCheckup);

      const ayrinti = await h.get(`/api/admin/ogrenciler/${ogr.id}`, { jeton: yon });
      basariBekle(ayrinti);
      assert.equal(ayrinti.govde.ogrenci.kaynak, "blog");
      assert.equal(ayrinti.govde.checkuplar[0].durum, "BITTI");

      const r = await h.get(`/api/admin/checkuplar/${id}/rapor`, { jeton: yon });
      basariBekle(r);
      assert.deepEqual(r.govde.ogrenci, { id: ogr.id, adSoyad: "Rapor Öğrencisi" });
      assert.equal(r.govde.inceleme.length, 6);
    });

    it("sayfalı liste boyutu en fazla 200", async () => {
      const yon = await k.yonetici();
      const y = await h.get(`/api/admin/ogrenciler?boyut=5000&sayfa=0`, { jeton: yon });
      basariBekle(y);
      assert.equal(y.govde.boyut, 200);
      assert.equal(y.govde.sayfa, 1);
      void benzersiz;
    });
  });
}
