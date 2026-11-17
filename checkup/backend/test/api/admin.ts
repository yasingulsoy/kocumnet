import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { basariBekle, benzersiz, hataBekle, type Istemci, type Kurucu } from "../yardimci/istemci.js";
import type { TestOrtami } from "../yardimci/ortam.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

function dosyaFormu(alanlar: Record<string, string>, dosya?: { veri: Buffer; ad: string; tur: string }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(alanlar)) f.append(k, v);
  if (dosya) f.append("dosya", new Blob([new Uint8Array(dosya.veri)], { type: dosya.tur }), dosya.ad);
  return f;
}

async function excelDosyasi(basliklar: string[], satirlar: (string | number | null)[][]): Promise<Buffer> {
  const kitap = new ExcelJS.Workbook();
  const sayfa = kitap.addWorksheet("Sorular");
  sayfa.addRow(basliklar);
  for (const s of satirlar) sayfa.addRow(s);
  return Buffer.from((await kitap.xlsx.writeBuffer()) as ArrayBuffer);
}

export function adminTestleri(o: () => TestOrtami, h: Istemci, k: Kurucu) {
  describe("yöneticiler ve roller", () => {
    it("son aktif YONETICI pasif yapılamaz, EDITOR'e düşürülemez, silinemez; kişi kendini silemez", async () => {
      const yon = await k.yonetici();
      const ben = (await h.get("/api/admin/ben", { jeton: yon })).govde.yonetici;
      assert.equal(ben.rol, "YONETICI");
      assert.equal(await o().db.yonetici.count({ where: { rol: "YONETICI", aktif: true } }), 1, "ön koşul: tek aktif YONETICI");

      const d1 = await h.patch(`/api/admin/yoneticiler/${ben.id}`, { rol: "EDITOR" }, { jeton: yon });
      hataBekle(d1, 400, "DOGRULAMA");
      assert.ok(d1.govde.hata.alanlar.rol);
      hataBekle(await h.patch(`/api/admin/yoneticiler/${ben.id}`, { aktif: false }, { jeton: yon }), 400, "DOGRULAMA");
      hataBekle(await h.del(`/api/admin/yoneticiler/${ben.id}`, undefined, { jeton: yon }), 400, "DOGRULAMA");

      // İkinci YONETICI: artık ilki kendini düşürebilir değil ama ikinciyi silebilir
      const ikinci = await h.post("/api/admin/yoneticiler", { adSoyad: "İkinci Yönetici", eposta: `${benzersiz("y2")}@test.local`, parola: "ikinci-parola", rol: "YONETICI" }, { jeton: yon });
      basariBekle(ikinci, 201);
      assert.deepEqual(Object.keys(ikinci.govde).sort(), ["adSoyad", "aktif", "eposta", "id", "rol"]);
      hataBekle(
        await h.post("/api/admin/yoneticiler", { adSoyad: "Kopya", eposta: ikinci.govde.eposta, parola: "ikinci-parola", rol: "EDITOR" }, { jeton: yon }),
        409,
        "CAKISMA"
      );
      const ikinciJeton = (await h.post("/api/admin/giris", { eposta: ikinci.govde.eposta, parola: "ikinci-parola" })).govde.jeton as string;
      hataBekle(await h.del(`/api/admin/yoneticiler/${ikinci.govde.id}`, undefined, { jeton: ikinciJeton }), 400, "DOGRULAMA");

      // Pasif yapılan yöneticinin oturumu kapanır ve giremez (400, OTURUM_YOK değil)
      basariBekle(await h.patch(`/api/admin/yoneticiler/${ikinci.govde.id}`, { aktif: false }, { jeton: yon }));
      hataBekle(await h.get("/api/admin/ben", { jeton: ikinciJeton }), 401, "OTURUM_YOK");
      hataBekle(await h.post("/api/admin/giris", { eposta: ikinci.govde.eposta, parola: "ikinci-parola" }), 400, "DOGRULAMA");
      basariBekle(await h.del(`/api/admin/yoneticiler/${ikinci.govde.id}`, undefined, { jeton: yon }), 204);
      assert.equal(await o().db.oturum.count({ where: { yoneticiId: ikinci.govde.id } }), 0);
    });

    it("admin girişi: yanlış parola 400 DOGRULAMA; parola değiştirmede alanlar.mevcutParola", async () => {
      const y = await h.post("/api/admin/giris", { eposta: o().yonetici.eposta, parola: "yanlis-parola" });
      hataBekle(y, 400, "DOGRULAMA");
      assert.equal(y.govde.hata.mesaj, "E-posta ya da parola yanlış.");
      const p = await h.put("/api/admin/ben/parola", { mevcutParola: "yanlis", yeniParola: "yeni-parola-123" }, { jeton: await k.yonetici() });
      hataBekle(p, 400, "DOGRULAMA");
      assert.ok(p.govde.hata.alanlar.mevcutParola);
      const g = await h.post("/api/admin/giris", { eposta: o().yonetici.eposta, parola: o().yonetici.parola });
      const saat = (new Date(g.govde.bitis).getTime() - Date.now()) / 3_600_000;
      assert.ok(saat > 11.9 && saat < 12.1, "yönetici jetonu 12 saat");
    });

    it("EDITOR yalnızca içerik uçlarına erişir; YONETICI uçlarında YETKI_YOK", async () => {
      const yon = await k.yonetici();
      const eposta = `${benzersiz("editor")}@test.local`;
      basariBekle(await h.post("/api/admin/yoneticiler", { adSoyad: "Editör Kişi", eposta, parola: "editor-parola", rol: "EDITOR" }, { jeton: yon }), 201);
      const ed = (await h.post("/api/admin/giris", { eposta, parola: "editor-parola" })).govde.jeton as string;

      hataBekle(await h.post("/api/admin/sinavlar", { ad: benzersiz("E") }, { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.patch("/api/admin/sinavlar/1", { ad: "x" }, { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.del("/api/admin/sinavlar/1", undefined, { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.post("/api/admin/turler", { ad: benzersiz("T"), soruSayisi: 5, sureDakika: 5 }, { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.get("/api/admin/ogrenciler", { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.get("/api/admin/ogrenciler/1", { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.get("/api/admin/checkuplar/1/rapor", { jeton: ed }), 403, "YETKI_YOK");
      hataBekle(await h.get("/api/admin/yoneticiler", { jeton: ed }), 403, "YETKI_YOK");

      const sinav = await k.sinav();
      basariBekle(await h.get("/api/admin/pano", { jeton: ed }));
      basariBekle(await h.get("/api/admin/sinavlar", { jeton: ed }));
      basariBekle(await h.get("/api/admin/turler", { jeton: ed }));
      basariBekle(await h.get(`/api/admin/sinavlar/${sinav.id}/agac`, { jeton: ed }));
      basariBekle(await h.post("/api/admin/agac/dersler", { ustId: sinav.id, ad: "Editör Dersi" }, { jeton: ed }), 201);
      basariBekle(await h.get(`/api/admin/sorular?sinavId=${sinav.id}`, { jeton: ed }));
      basariBekle(await h.post("/api/admin/onizleme", { metin: "$x$" }, { jeton: ed }));
      basariBekle(await h.get(`/api/admin/sinavlar/${sinav.id}/ayarlar`, { jeton: ed }));
    });
  });

  describe("sınavlar, türler, pano", () => {
    it("yeni sınav varsayılan pasif; nesne şekli; PATCH null açıklamayı siler", async () => {
      const yon = await k.yonetici();
      const y = await h.post("/api/admin/sinavlar", { ad: benzersiz("YENİ"), aciklama: "Açıklama", ucretKurus: 29900 }, { jeton: yon });
      basariBekle(y, 201);
      assert.equal(y.govde.aktif, false);
      assert.equal(y.govde.yanlisGoturme, 4);
      assert.deepEqual(Object.keys(y.govde).sort(), [
        "aciklama", "ad", "aktif", "aktifSoruSayisi", "checkupSayisi", "dersSayisi", "id", "silinebilir", "sira", "soruSayisi", "ucretKurus", "yanlisGoturme",
      ]);
      assert.equal(y.govde.silinebilir, true);
      const p = await h.patch(`/api/admin/sinavlar/${y.govde.id}`, { aciklama: null, yanlisGoturme: 0 }, { jeton: yon });
      basariBekle(p);
      assert.equal(p.govde.aciklama, null);
      assert.equal(p.govde.yanlisGoturme, 0);
      assert.equal(p.govde.ucretKurus, 29900, "gövdede olmayan alan değişmez");
      hataBekle(await h.post("/api/admin/sinavlar", { ad: y.govde.ad }, { jeton: yon }), 409, "CAKISMA");
      const hatali = await h.post("/api/admin/sinavlar", { ad: benzersiz("X"), ucretKurus: -5, yanlisGoturme: 11 }, { jeton: yon });
      hataBekle(hatali, 400, "DOGRULAMA");
      assert.ok(hatali.govde.hata.alanlar.ucretKurus && hatali.govde.hata.alanlar.yanlisGoturme);
      basariBekle(await h.del(`/api/admin/sinavlar/${y.govde.id}`, undefined, { jeton: yon }), 204);
    });

    it("tür kuralları ve pano şekli", async () => {
      const yon = await k.yonetici();
      const hatali = await h.post("/api/admin/turler", { ad: benzersiz("T"), soruSayisi: 301, sureDakika: 0 }, { jeton: yon });
      hataBekle(hatali, 400, "DOGRULAMA");
      assert.ok(hatali.govde.hata.alanlar.soruSayisi && hatali.govde.hata.alanlar.sureDakika);
      const tur = await k.tur(10);
      const liste = (await h.get("/api/admin/turler", { jeton: yon })).govde;
      const bu = liste.find((t: any) => t.id === tur.id);
      assert.deepEqual(Object.keys(bu).sort(), ["aciklama", "ad", "aktif", "checkupSayisi", "id", "silinebilir", "sira", "soruSayisi", "sureDakika"]);
      const pano = (await h.get("/api/admin/pano", { jeton: yon })).govde;
      for (const alan of ["ogrenciSayisi", "checkupSayisi", "bitenCheckupSayisi", "son7GunKayit", "son7GunCheckup"]) assert.equal(typeof pano[alan], "number");
      assert.ok(Array.isArray(pano.sinavlar));
      const s = pano.sinavlar[0];
      assert.deepEqual(Object.keys(s).sort(), ["ad", "aktif", "aktifSoruSayisi", "id", "soruSayisi", "turler"]);
      assert.deepEqual(Object.keys(s.turler[0]).sort(), ["ad", "hazir", "secim", "turId"]);
    });
  });

  describe("silme kuralları (KULLANIMDA)", () => {
    it("ağacı olan sınav, check-up'ı olan tür, kullanımdaki soru ve düğüm silinemez", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      const q1 = (await k.soru(z)).id;
      const q2 = (await k.soru(z)).id;
      const tur = await k.tur(1);
      await k.ayar(sinav.id, tur.id, { secim: "SABIT", sabitSoruIdleri: [q1] });
      const ogr = await k.ogrenci();
      basariBekle(await h.post("/api/ogrenci/checkuplar", { sinavId: sinav.id, turId: tur.id }, { jeton: ogr.jeton }), 201);

      const s = await h.del(`/api/admin/sinavlar/${sinav.id}`, undefined, { jeton: yon });
      hataBekle(s, 409, "KULLANIMDA");
      assert.match(s.govde.hata.mesaj, /pasif/i);
      hataBekle(await h.del(`/api/admin/turler/${tur.id}`, undefined, { jeton: yon }), 409, "KULLANIMDA");
      hataBekle(await h.del(`/api/admin/sorular/${q1}`, undefined, { jeton: yon }), 409, "KULLANIMDA");
      for (const [seviye, id] of [
        ["dersler", z.dersId],
        ["konular", z.konuId],
        ["kazanimlar", z.kazanimId],
        ["alt-kazanimlar", z.altKazanimId],
      ] as const) {
        hataBekle(await h.del(`/api/admin/agac/${seviye}/${id}`, undefined, { jeton: yon }), 409, "KULLANIMDA");
      }

      // q2: check-up'ta yok ama sabit listeye eklenince silinemez
      await k.ayar(sinav.id, tur.id, { secim: "SABIT", sabitSoruIdleri: [q2] });
      hataBekle(await h.del(`/api/admin/sorular/${q2}`, undefined, { jeton: yon }), 409, "KULLANIMDA");
      await k.ayar(sinav.id, tur.id, { secim: "SABIT", sabitSoruIdleri: [] });
      basariBekle(await h.del(`/api/admin/sorular/${q2}`, undefined, { jeton: yon }), 204);

      // Ağaçta silinebilir bayrakları
      const agac = (await h.get(`/api/admin/sinavlar/${sinav.id}/agac`, { jeton: yon })).govde;
      assert.equal(agac.dersler[0].silinebilir, false);
      assert.equal(agac.dersler[0].konular[0].kazanimlar[0].altKazanimlar[0].silinebilir, false);
      // Boş düğüm silinir
      const bos = await k.dugum("konular", z.dersId, "Boş Konu");
      basariBekle(await h.del(`/api/admin/agac/konular/${bos}`, undefined, { jeton: yon }), 204);
      // Boş tür ve boş sınav silinir
      const bosTur = await k.tur(2);
      basariBekle(await h.del(`/api/admin/turler/${bosTur.id}`, undefined, { jeton: yon }), 204);
    });

    it("veritabanı da Restrict ile korur (soru varken düğüm silinemez)", async () => {
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      await k.soru(z);
      await assert.rejects(o().db.altKazanim.delete({ where: { id: z.altKazanimId } }));
      await assert.rejects(o().db.ders.delete({ where: { id: z.dersId } }));
    });
  });

  describe("konu ağacı", () => {
    it("ekleme sona, toplu ekleme (KOD | Ad, tekrar atlanır), taşıma, düzenleme, kod null", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const ders = await k.dugum("dersler", sinav.id, "Ders A");
      const konu = await k.dugum("konular", ders, "Konu A");
      const toplu = await h.post(
        "/api/admin/agac/kazanimlar/toplu",
        { ustId: konu, satirlar: ["K1 | Birinci", "", "K2 | İkinci", "  birinci  ", "Üçüncü", "K9 | İkinci"] },
        { jeton: yon }
      );
      basariBekle(toplu, 201);
      assert.deepEqual(toplu.govde, { eklenen: 3 });
      let agac = (await h.get(`/api/admin/sinavlar/${sinav.id}/agac`, { jeton: yon })).govde;
      let kazanimlar = agac.dersler[0].konular[0].kazanimlar;
      assert.deepEqual(
        kazanimlar.map((x: any) => [x.kod, x.ad]),
        [
          ["K1", "Birinci"],
          ["K2", "İkinci"],
          [null, "Üçüncü"],
        ]
      );
      const ucuncu = kazanimlar[2].id;
      basariBekle(await h.post(`/api/admin/agac/kazanimlar/${ucuncu}/tasi`, { yon: "yukari" }, { jeton: yon }));
      basariBekle(await h.post(`/api/admin/agac/kazanimlar/${ucuncu}/tasi`, { yon: "yukari" }, { jeton: yon }));
      basariBekle(await h.post(`/api/admin/agac/kazanimlar/${ucuncu}/tasi`, { yon: "yukari" }, { jeton: yon })); // zaten başta
      agac = (await h.get(`/api/admin/sinavlar/${sinav.id}/agac`, { jeton: yon })).govde;
      kazanimlar = agac.dersler[0].konular[0].kazanimlar;
      assert.deepEqual(
        kazanimlar.map((x: any) => x.ad),
        ["Üçüncü", "Birinci", "İkinci"]
      );
      const p = await h.patch(`/api/admin/agac/kazanimlar/${kazanimlar[1].id}`, { kod: null, ad: "Birinci (yeni)" }, { jeton: yon });
      basariBekle(p);
      assert.equal(p.govde.kod, null);
      assert.equal(p.govde.ad, "Birinci (yeni)");
      hataBekle(await h.post("/api/admin/agac/kazanimlar", { ustId: konu, ad: "İkinci" }, { jeton: yon }), 409, "CAKISMA");
      hataBekle(await h.post("/api/admin/agac/kazanimlar", { ustId: 999999, ad: "Yok" }, { jeton: yon }), 400, "DOGRULAMA");
      hataBekle(await h.post("/api/admin/agac/bilinmeyen", { ustId: konu, ad: "Yok" }, { jeton: yon }), 404, "BULUNAMADI");
    });
  });

  describe("sorular", () => {
    it("zincir tutarsızlığı API'de alan hatası, veritabanında yabancı anahtar hatası", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const a = await k.yol(sinav.id);
      const b = await k.yol(sinav.id);
      const temel = { metin: "Soru $x$", cozum: "Çözüm", siklar: ["1", "2", "3", "4", "5"].map((metin) => ({ metin })), dogruSik: "A" };
      const y1 = await h.post("/api/admin/sorular", { ...a, konuId: b.konuId, ...temel }, { jeton: yon });
      hataBekle(y1, 400, "DOGRULAMA");
      assert.ok(y1.govde.hata.alanlar.konuId);
      const y2 = await h.post("/api/admin/sorular", { ...a, altKazanimId: b.altKazanimId, ...temel }, { jeton: yon });
      hataBekle(y2, 400, "DOGRULAMA");
      assert.ok(y2.govde.hata.alanlar.altKazanimId);
      const baska = await k.sinav();
      const y3 = await h.post("/api/admin/sorular", { ...a, sinavId: baska.id, ...temel }, { jeton: yon });
      hataBekle(y3, 400, "DOGRULAMA");
      assert.ok(y3.govde.hata.alanlar.dersId);

      const veri = (z: typeof a) => ({ ...z, metin: "x", metinHtml: "x", cozum: "y", cozumHtml: "y" });
      await assert.rejects(o().db.soru.create({ data: { ...veri(a), konuId: b.konuId } }), "konu başka derste: veritabanı reddetmeli");
      await assert.rejects(o().db.soru.create({ data: { ...veri(a), kazanimId: b.kazanimId } }), "kazanım başka konuda: veritabanı reddetmeli");
      await assert.rejects(o().db.soru.create({ data: { ...veri(a), sinavId: baska.id } }), "ders başka sınavda: veritabanı reddetmeli");
      const dogru = await o().db.soru.create({ data: veri(a), select: { id: true } });
      await assert.rejects(o().db.soru.update({ where: { id: dogru.id }, data: { altKazanimId: b.altKazanimId } }));
    });

    it("içerik kuralları: alan anahtarları gövde yolunun noktalı yazımı", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      const y = await h.post(
        "/api/admin/sorular",
        {
          ...z,
          metin: "Bozuk $\\frac{1}{$ formül",
          cozum: "  ",
          zorluk: 6,
          siklar: [{ metin: "Bir" }, { metin: "İki" }, { metin: "" }, { metin: " bir " }, { metin: "Beş" }],
          dogruSik: "F",
        },
        { jeton: yon }
      );
      hataBekle(y, 400, "DOGRULAMA");
      const al = y.govde.hata.alanlar;
      assert.match(al.metin, /1\. formül hatalı/);
      assert.ok(al.cozum);
      assert.ok(al.zorluk);
      assert.ok(al["siklar.2.metin"], "boş şık C");
      assert.match(al["siklar.3.metin"], /A şıkkıyla aynı/);
      assert.ok(al.dogruSik);
      const az = await h.post("/api/admin/sorular", { ...z, metin: "a", cozum: "b", siklar: [{ metin: "1" }], dogruSik: "A" }, { jeton: yon });
      hataBekle(az, 400, "DOGRULAMA");
      assert.ok(az.govde.hata.alanlar.siklar);
      const tip = await h.post("/api/admin/sorular", { ...z, metin: 5, cozum: "b", siklar: [], dogruSik: "A" }, { jeton: yon });
      hataBekle(tip, 400, "DOGRULAMA");
      assert.ok(tip.govde.hata.alanlar.metin);
    });

    it("ayrıntı, liste, PATCH null ile boşaltma, şık açıklaması korunur", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#00ff00" } }).png().toBuffer();
      const g = await h.istek("POST", "/api/admin/gorseller", { jeton: yon, form: dosyaFormu({}, { veri: png, ad: "a.png", tur: "image/png" }) });
      basariBekle(g, 201);
      const soru = await k.soru(z, { gorselId: g.govde.id, zorluk: 3 });

      const d = await h.get(`/api/admin/sorular/${soru.id}`, { jeton: yon });
      basariBekle(d);
      assert.deepEqual(Object.keys(d.govde).sort(), [
        "aktif", "altKazanimId", "cozum", "cozumHtml", "dersId", "gorselId", "guncellendi", "id", "kazanimId", "konuId", "kullanimSayisi", "metin", "metinHtml", "olusturuldu", "sabitListeSayisi", "siklar", "sinavId", "zorluk",
      ]);
      assert.equal(typeof d.govde.gorselId, "string");
      assert.equal(d.govde.zorluk, 3);
      assert.deepEqual(Object.keys(d.govde.siklar[0]).sort(), ["aciklama", "dogru", "harf", "metin", "metinHtml", "sira"]);

      // null boşaltır; gönderilmeyen şık açıklaması korunur
      const p = await h.patch(
        `/api/admin/sorular/${soru.id}`,
        { zorluk: null, gorselId: null, siklar: [{ metin: "1" }, { metin: "2", aciklama: null }, { metin: "3" }, { metin: "4" }, { metin: "5" }] },
        { jeton: yon }
      );
      basariBekle(p);
      assert.equal(p.govde.zorluk, null);
      assert.equal(p.govde.gorselId, null);
      assert.equal(p.govde.siklar[1].aciklama, null, "null gönderilen açıklama silinir");
      assert.equal(p.govde.siklar[2].aciklama, "Bir fazlası.", "gönderilmeyen açıklama korunur");
      assert.equal(p.govde.siklar[1].dogru, true, "doğru şık gönderilmezse korunur");

      const liste = await h.get(`/api/admin/sorular?sinavId=${sinav.id}&konuId=${z.konuId}&aktif=true&boyut=1`, { jeton: yon });
      basariBekle(liste);
      assert.equal(liste.govde.toplam, 1);
      assert.deepEqual(Object.keys(liste.govde.kayitlar[0]).sort(), [
        "altKazanim", "aktif", "ders", "gorselVar", "id", "kazanim", "konu", "kullanimSayisi", "metin", "olusturuldu", "zorluk",
      ].sort());
      const ara = await h.get(`/api/admin/sorular?sinavId=${sinav.id}&ara=%23${soru.id}`, { jeton: yon });
      assert.equal(ara.govde.kayitlar[0].id, soru.id);
      hataBekle(await h.get(`/api/admin/sorular`, { jeton: yon }), 400, "DOGRULAMA");
      hataBekle(await h.patch(`/api/admin/sorular/${soru.id}`, { gorselId: "olmayan-gorsel" }, { jeton: yon }), 400, "DOGRULAMA");
    });

    it("önizleme", async () => {
      const yon = await k.yonetici();
      const y = await h.post("/api/admin/onizleme", { metin: "a\n\n$x^2$" }, { jeton: yon });
      basariBekle(y);
      assert.match(y.govde.html, /^<p>a<\/p><p><span class="katex">/);
      const hatali = await h.post("/api/admin/onizleme", { metin: "$\\frac{$" }, { jeton: yon });
      hataBekle(hatali, 400, "DOGRULAMA");
      assert.match(hatali.govde.hata.mesaj, /formül/);
    });
  });

  describe("görseller", () => {
    it("PNG küçültülüp WebP olur; medya ucu baytları ve önbellek başlığını verir; SVG ve bozuk dosya reddedilir", async () => {
      const yon = await k.yonetici();
      const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#ff0000" } }).png().toBuffer();
      const y = await h.istek("POST", "/api/admin/gorseller", { jeton: yon, form: dosyaFormu({}, { veri: png, ad: "büyük.png", tur: "image/png" }) });
      basariBekle(y, 201);
      assert.deepEqual(Object.keys(y.govde).sort(), ["genislik", "id", "yukseklik"]);
      assert.equal(y.govde.genislik, 1200);
      assert.equal(y.govde.yukseklik, 600);

      const m = await h.istek("GET", `/api/medya/${y.govde.id}`, { ikili: true });
      assert.equal(m.durum, 200);
      assert.equal(m.basliklar.get("content-type"), "image/webp");
      assert.equal(m.basliklar.get("cache-control"), "public, max-age=31536000, immutable");
      assert.equal((await sharp(m.baytlar!).metadata()).format, "webp");
      hataBekle(await h.get(`/api/medya/${y.govde.id}`, { anahtar: null }), 401, "SERVIS_ANAHTARI");
      hataBekle(await h.get("/api/medya/00000000-0000-0000-0000-000000000000"), 404, "BULUNAMADI");

      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
      const s = await h.istek("POST", "/api/admin/gorseller", { jeton: yon, form: dosyaFormu({}, { veri: svg, ad: "a.png", tur: "image/png" }) });
      hataBekle(s, 400, "DOGRULAMA");
      assert.match(s.govde.hata.mesaj, /SVG/);
      hataBekle(
        await h.istek("POST", "/api/admin/gorseller", { jeton: yon, form: dosyaFormu({}, { veri: Buffer.from("düz metin"), ad: "a.jpg", tur: "image/jpeg" }) }),
        400,
        "DOGRULAMA"
      );
      hataBekle(await h.istek("POST", "/api/admin/gorseller", { jeton: yon, form: dosyaFormu({ baska: "x" }) }), 400, "DOGRULAMA");
    });
  });

  describe("Excel içe aktarma", () => {
    it("şablon iki sayfalı", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      await k.yol(sinav.id, { ders: "Sayısal", konu: "Denklemler", kazanim: "Birinci derece", alt: "Tek bilinmeyen" });
      const y = await h.istek("GET", `/api/admin/ice-aktar/sablon?sinavId=${sinav.id}`, { jeton: yon, ikili: true });
      assert.equal(y.durum, 200);
      assert.match(y.basliklar.get("content-type")!, /spreadsheetml/);
      assert.match(y.basliklar.get("content-disposition")!, /attachment/);
      const kitap = new ExcelJS.Workbook();
      await kitap.xlsx.load(y.baytlar! as unknown as ArrayBuffer);
      assert.deepEqual(
        kitap.worksheets.map((s) => s.name),
        ["Sorular", "Konu Ağacı"]
      );
      const basliklar = (kitap.getWorksheet("Sorular")!.getRow(1).values as unknown[]).slice(1);
      assert.deepEqual(basliklar, ["Ders", "Konu", "Kazanım", "Alt Kazanım", "Soru", "A", "B", "C", "D", "E", "Doğru", "Çözüm", "Zorluk"]);
      assert.equal(kitap.getWorksheet("Sorular")!.rowCount, 2, "başlık + bir örnek satır");
      const agac = kitap.getWorksheet("Konu Ağacı")!;
      assert.equal(agac.getRow(2).getCell(1).value, "Sayısal");
      assert.equal(agac.getRow(2).getCell(6).value, "Tek bilinmeyen");
    });

    it("denetle/kaydet: hatalı satırda hiçbir şey yazılmaz; tekrar denetimi; başlık ve kod eşleme", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id, { ders: "Sayısal", konu: "Denklemler", kazanim: "Birinci derece", alt: "Tek bilinmeyen" });
      const mevcut = await k.soru(z);
      const mevcutMetin = (await o().db.soru.findUniqueOrThrow({ where: { id: mevcut.id } })).metin;

      // Başlıklar küçük harf ve Türkçe karaktersiz; kazanım ve alt kazanım KOD ile
      const basliklar = ["ders", "KONU", "kazanim", "alt kazanim", "soru", "a", "b", "c", "d", "e", "dogru", "cozum", "zorluk"];
      const satir = (metin: string, ek: Partial<Record<string, string | number | null>> = {}) => [
        ek.ders ?? "sayısal",
        ek.konu ?? "Denklemler",
        ek.kazanim ?? "K.1",
        ek.alt ?? "K.1.1",
        metin,
        "1",
        "2",
        "3",
        "4",
        "5",
        ek.dogru ?? "b",
        ek.cozum ?? "$x = 2$",
        ek.zorluk ?? null,
      ];
      const hatali = await excelDosyasi(basliklar, [
        satir("Excel sorusu 1: $x + 1 = 3$"),
        satir("Excel sorusu 2: $2x = 4$", { zorluk: 2 }),
        satir("Excel sorusu 3", { konu: "Olmayan Konu" }),
        satir("Excel sorusu 4", { dogru: "F" }),
        satir("Excel sorusu 1: $x + 1 = 3$"),
        satir(mevcutMetin),
        satir("Bozuk $\\frac{$"),
      ]);
      const once = await o().db.soru.count({ where: { sinavId: sinav.id } });

      const d = await h.istek("POST", "/api/admin/ice-aktar/denetle", {
        jeton: yon,
        form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: hatali, ad: "sorular.xlsx", tur: "application/octet-stream" }),
      });
      basariBekle(d);
      assert.equal(d.govde.toplam, 7);
      assert.deepEqual(
        d.govde.satirlar.map((s: any) => [s.satir, s.durum]),
        [
          [2, "hatali"], // dosyada 6. satırda da var
          [3, "gecerli"],
          [4, "hatali"],
          [5, "hatali"],
          [6, "hatali"],
          [7, "hatali"],
          [8, "hatali"],
        ]
      );
      assert.equal(d.govde.gecerli, 1);
      assert.equal(d.govde.hatali, 6);
      assert.ok(d.govde.satirlar[0].hatalar.some((x: string) => x.includes("6. satırda da var")));
      assert.ok(d.govde.satirlar[2].hatalar.some((x: string) => x.includes("Olmayan Konu")));
      assert.ok(d.govde.satirlar[5].hatalar.some((x: string) => x === `Aynı soru zaten var: #${mevcut.id}`));
      assert.ok(d.govde.satirlar[6].hatalar.some((x: string) => /formül/.test(x)));
      assert.equal(d.govde.satirlar[1].ozet, "Excel sorusu 2: $2x = 4$");

      const kh = await h.istek("POST", "/api/admin/ice-aktar/kaydet", {
        jeton: yon,
        form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: hatali, ad: "sorular.xlsx", tur: "application/octet-stream" }),
      });
      hataBekle(kh, 400, "DOGRULAMA");
      assert.equal(kh.govde.hata.ek.hatali, 6);
      assert.equal(await o().db.soru.count({ where: { sinavId: sinav.id } }), once, "hatalı dosyada hiçbir soru yazılmamalı");

      const temiz = await excelDosyasi(basliklar, [satir("Excel sorusu 1: $x + 1 = 3$"), satir("Excel sorusu 2: $2x = 4$", { zorluk: 2, kazanim: "Birinci derece" })]);
      const kaydet = await h.istek("POST", "/api/admin/ice-aktar/kaydet", {
        jeton: yon,
        form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: temiz, ad: "temiz-ü.xlsx", tur: "application/octet-stream" }),
      });
      basariBekle(kaydet, 201);
      assert.equal(kaydet.govde.eklenen, 2);
      assert.equal(await o().db.soru.count({ where: { sinavId: sinav.id } }), once + 2);
      const ia = await o().db.iceAktarma.findUniqueOrThrow({ where: { id: kaydet.govde.iceAktarmaId } });
      assert.equal(ia.soruSayisi, 2);
      assert.equal(ia.dosyaAdi, "temiz-ü.xlsx");
      const yeni = await o().db.soru.findFirstOrThrow({ where: { iceAktarmaId: ia.id, zorluk: 2 }, include: { siklar: { orderBy: { sira: "asc" } } } });
      assert.equal(yeni.siklar.find((s) => s.dogru)!.sira, 1);
      assert.equal(yeni.altKazanimId, z.altKazanimId);

      // Aynı dosya yeniden: hepsi "zaten var"
      const tekrar = await h.istek("POST", "/api/admin/ice-aktar/denetle", {
        jeton: yon,
        form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: temiz, ad: "temiz.xlsx", tur: "application/octet-stream" }),
      });
      assert.equal(tekrar.govde.hatali, 2);
      assert.ok(tekrar.govde.satirlar.every((s: any) => s.hatalar.some((x: string) => x.startsWith("Aynı soru zaten var"))));

      // Eksik sütun ve bozuk dosya
      const eksik = await excelDosyasi(["Ders", "Konu"], [["a", "b"]]);
      const e = await h.istek("POST", "/api/admin/ice-aktar/denetle", { jeton: yon, form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: eksik, ad: "e.xlsx", tur: "application/octet-stream" }) });
      hataBekle(e, 400, "DOGRULAMA");
      assert.match(e.govde.hata.mesaj, /Kazanım/);
      hataBekle(
        await h.istek("POST", "/api/admin/ice-aktar/denetle", {
          jeton: yon,
          form: dosyaFormu({ sinavId: String(sinav.id) }, { veri: Buffer.from("excel değil"), ad: "x.xlsx", tur: "application/octet-stream" }),
        }),
        400,
        "DOGRULAMA"
      );
    });
  });

  describe("check-up ayarları", () => {
    it("kaydetme kuralları ve hazırlık cümleleri (toplam, havuz, konu-kazanım çakışması)", async () => {
      const yon = await k.yonetici();
      const sinav = await k.sinav();
      const z = await k.yol(sinav.id);
      const k2 = await k.dugum("kazanimlar", z.konuId, "İkinci Kazanım");
      const a2 = await k.dugum("alt-kazanimlar", k2, "İkinci Alt");
      for (let i = 0; i < 5; i++) await k.soru(z); // ilk kazanım: 5
      for (let i = 0; i < 3; i++) await k.soru({ ...z, kazanimId: k2, altKazanimId: a2 }); // ikinci: 3 → konu: 8
      const tur = await k.tur(10);
      const baskaSinav = await k.sinav();
      const baska = await k.yol(baskaSinav.id);

      // Varsayılan: KARMA, boş reçete, hazır değil; bütün türler (pasifler dahil) listede
      const liste = (await h.get(`/api/admin/sinavlar/${sinav.id}/ayarlar`, { jeton: yon })).govde;
      const varsayilan = liste.find((a: any) => a.tur.id === tur.id);
      assert.equal(varsayilan.secim, "KARMA");
      assert.deepEqual(varsayilan.recete, []);
      assert.equal(varsayilan.hazirlik.hazir, false);
      assert.equal(liste.length, await o().db.checkupTuru.count());

      const yol = `/api/admin/sinavlar/${sinav.id}/ayarlar/${tur.id}`;
      const kural = async (govde: unknown, anahtar: string) => {
        const y = await h.put(yol, govde, { jeton: yon });
        hataBekle(y, 400, "DOGRULAMA");
        assert.ok(y.govde.hata.alanlar[anahtar], `${anahtar} beklenirdi: ${JSON.stringify(y.govde.hata.alanlar)}`);
      };
      await kural({ secim: "KARMA", recete: [{ konuId: z.konuId, kazanimId: z.kazanimId, soruSayisi: 1 }], sabitSoruIdleri: [] }, "recete.0");
      await kural({ secim: "KARMA", recete: [{ konuId: z.konuId, soruSayisi: 0 }], sabitSoruIdleri: [] }, "recete.0.soruSayisi");
      await kural({ secim: "KARMA", recete: [{ konuId: baska.konuId, soruSayisi: 1 }], sabitSoruIdleri: [] }, "recete.0.konuId");
      await kural(
        {
          secim: "KARMA",
          recete: [
            { kazanimId: z.kazanimId, soruSayisi: 1 },
            { kazanimId: z.kazanimId, soruSayisi: 1 },
          ],
          sabitSoruIdleri: [],
        },
        "recete.1.kazanimId"
      );
      const sorular = await o().db.soru.findMany({ where: { sinavId: sinav.id }, select: { id: true } });
      await kural({ secim: "SABIT", recete: [], sabitSoruIdleri: [sorular[0]!.id, sorular[0]!.id] }, "sabitSoruIdleri.1");

      // Toplam tutmuyor
      let a = (await h.put(yol, { secim: "KARMA", recete: [{ konuId: z.konuId, soruSayisi: 4 }], sabitSoruIdleri: [] }, { jeton: yon })).govde;
      assert.equal(a.hazirlik.hazir, false);
      assert.ok(a.hazirlik.sorunlar.some((s: string) => s.includes("toplamı 4") && s.includes("10")));
      assert.equal(a.recete[0].havuz, 8);
      assert.equal(a.recete[0].ustAd.length > 0, true);

      // Kazanım havuzu yetmiyor (5 var, 6 isteniyor)
      a = (await h.put(yol, { secim: "KARMA", recete: [{ kazanimId: z.kazanimId, soruSayisi: 6 }, { konuId: z.konuId, soruSayisi: 4 }], sabitSoruIdleri: [] }, { jeton: yon })).govde;
      assert.equal(a.hazirlik.hazir, false);
      assert.ok(a.hazirlik.sorunlar.some((s: string) => s.includes("5 aktif soru var") && s.includes("6 soru istiyor")));

      // Konu-kazanım çakışması: konu 8, kazanım satırları 5 + 3 = 8 ayırıyor, konu satırı 2 istiyor → 0 kalıyor
      a = (
        await h.put(
          yol,
          {
            secim: "KARMA",
            recete: [
              { kazanimId: z.kazanimId, soruSayisi: 5 },
              { kazanimId: k2, soruSayisi: 3 },
              { konuId: z.konuId, soruSayisi: 2 },
            ],
            sabitSoruIdleri: [],
          },
          { jeton: yon }
        )
      ).govde;
      assert.equal(a.hazirlik.hazir, false);
      assert.ok(a.hazirlik.sorunlar.some((s: string) => s.includes("0 soru kalıyor")));

      // Hazır: 4 + 3 + konu 1 (8 − 7 = 1 kalır)… toplam 10 için konu satırını kazanıma çevir
      a = (
        await h.put(
          yol,
          {
            secim: "KARMA",
            recete: [
              { kazanimId: z.kazanimId, soruSayisi: 4 },
              { kazanimId: k2, soruSayisi: 3 },
              { konuId: z.konuId, soruSayisi: 1 },
            ],
            sabitSoruIdleri: [],
          },
          { jeton: yon }
        )
      ).govde;
      assert.equal(a.hazirlik.hazir, false, "toplam 8 ≠ 10");
      basariBekle(await h.patch(`/api/admin/turler/${tur.id}`, { soruSayisi: 8 }, { jeton: yon }));
      const son = (await h.get(`/api/admin/sinavlar/${sinav.id}/ayarlar`, { jeton: yon })).govde.find((x: any) => x.tur.id === tur.id);
      assert.equal(son.hazirlik.hazir, true, JSON.stringify(son.hazirlik));
      assert.deepEqual(son.hazirlik.sorunlar, []);

      // Biçim SABIT'e geçince reçete kaybolmaz
      const sabit = (await h.put(yol, { secim: "SABIT", recete: son.recete.map((r: any) => ({ konuId: r.konuId, kazanimId: r.kazanimId, soruSayisi: r.soruSayisi })), sabitSoruIdleri: [sorular[0]!.id] }, { jeton: yon })).govde;
      assert.equal(sabit.secim, "SABIT");
      assert.equal(sabit.recete.length, 3);
      assert.equal(sabit.hazirlik.hazir, false);
      assert.ok(sabit.hazirlik.sorunlar.some((s: string) => s.includes("Sabit listede 1 soru var")));
    });
  });
}
