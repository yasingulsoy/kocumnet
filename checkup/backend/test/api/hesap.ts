import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basariBekle, benzersiz, hataBekle, type Istemci, type Kurucu } from "../yardimci/istemci.js";
import type { TestOrtami } from "../yardimci/ortam.js";

export function hesapTestleri(o: () => TestOrtami, h: Istemci, k: Kurucu) {
  describe("servis anahtarı", () => {
    it("sağlık ucu anahtar istemez", async () => {
      const y = await h.get("/api/saglik", { anahtar: null });
      basariBekle(y);
      assert.deepEqual(y.govde, { durum: "ok" });
    });

    it("anahtar yoksa ya da yanlışsa 401 SERVIS_ANAHTARI", async () => {
      hataBekle(await h.get("/api/ogrenci/sinavlar", { anahtar: null }), 401, "SERVIS_ANAHTARI");
      hataBekle(await h.get("/api/ogrenci/sinavlar", { anahtar: "yanlis-anahtar-yanlis-anahtar-yanlis-anahtar" }), 401, "SERVIS_ANAHTARI");
      hataBekle(await h.post("/api/admin/giris", { eposta: "a@b.c", parola: "x" }, { anahtar: "" }), 401, "SERVIS_ANAHTARI");
    });

    it("bilinmeyen uç BULUNAMADI", async () => {
      hataBekle(await h.get("/api/yok-boyle-bir-uc"), 404, "BULUNAMADI");
    });

    it("bozuk JSON gövdesi DOGRULAMA döner", async () => {
      const r = await fetch(o().url + "/api/ogrenci/giris", {
        method: "POST",
        headers: { "x-servis-anahtari": o().anahtar, "content-type": "application/json" },
        body: "{bozuk",
      });
      assert.equal(r.status, 400);
      assert.equal(((await r.json()) as { hata: { kod: string } }).hata.kod, "DOGRULAMA");
    });
  });

  describe("öğrenci hesabı", () => {
    it("kayıt: e-posta küçük harfe çevrilir, kaynak listedeyse saklanır, değilse yok sayılır", async () => {
      const eposta = `${benzersiz("Buyuk")}@Test.Local`;
      const y = await h.post("/api/ogrenci/kayit", { adSoyad: "Ali Veli", eposta, parola: "parola-123", kvkkOnay: true, kaynak: "hero" });
      basariBekle(y, 201);
      assert.equal(y.govde.ogrenci.eposta, eposta.toLowerCase());
      assert.ok(y.govde.jeton && y.govde.bitis);
      assert.deepEqual(Object.keys(y.govde.ogrenci).sort(), ["adSoyad", "eposta", "id", "olusturuldu"]);
      const kayit = await o().db.ogrenci.findUniqueOrThrow({ where: { id: y.govde.ogrenci.id } });
      assert.equal(kayit.kaynak, "hero");

      const y2 = await h.post("/api/ogrenci/kayit", { adSoyad: "Ali Veli", eposta: `${benzersiz("x")}@test.local`, parola: "parola-123", kvkkOnay: true, kaynak: "uydurma" });
      basariBekle(y2, 201);
      assert.equal((await o().db.ogrenci.findUniqueOrThrow({ where: { id: y2.govde.ogrenci.id } })).kaynak, null);
      // Jeton 30 gün
      const gun = (new Date(y.govde.bitis).getTime() - Date.now()) / 86_400_000;
      assert.ok(gun > 29.9 && gun < 30.1);
    });

    it("kayıt kuralları: KVKK onayı, ad soyad, parola, aynı e-posta", async () => {
      const temel = { adSoyad: "Ali Veli", eposta: `${benzersiz("k")}@test.local`, parola: "parola-123", kvkkOnay: true };
      const y1 = await h.post("/api/ogrenci/kayit", { ...temel, kvkkOnay: false });
      hataBekle(y1, 400, "DOGRULAMA");
      assert.ok(y1.govde.hata.alanlar.kvkkOnay);
      const y2 = await h.post("/api/ogrenci/kayit", { ...temel, adSoyad: "A", parola: "kisa" });
      hataBekle(y2, 400, "DOGRULAMA");
      assert.ok(y2.govde.hata.alanlar.adSoyad && y2.govde.hata.alanlar.parola);
      const y3 = await h.post("/api/ogrenci/kayit", { ...temel, eposta: "gecersiz" });
      hataBekle(y3, 400, "DOGRULAMA");
      assert.ok(y3.govde.hata.alanlar.eposta);
      basariBekle(await h.post("/api/ogrenci/kayit", temel), 201);
      hataBekle(await h.post("/api/ogrenci/kayit", { ...temel, eposta: temel.eposta.toUpperCase() }), 409, "CAKISMA");
    });

    it("giriş, ben, ad değiştirme, çıkış", async () => {
      const ogr = await k.ogrenci();
      const yanlis = await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: "yanlis-parola" });
      hataBekle(yanlis, 400, "DOGRULAMA");
      assert.equal(yanlis.govde.hata.mesaj, "E-posta ya da parola yanlış.");
      const olmayan = await h.post("/api/ogrenci/giris", { eposta: "olmayan@test.local", parola: "yanlis-parola" });
      hataBekle(olmayan, 400, "DOGRULAMA");
      assert.equal(olmayan.govde.hata.mesaj, "E-posta ya da parola yanlış.");
      const g = await h.post("/api/ogrenci/giris", { eposta: ogr.eposta.toUpperCase(), parola: ogr.parola });
      basariBekle(g);
      const jeton = g.govde.jeton as string;
      const ben = await h.get("/api/ogrenci/ben", { jeton });
      basariBekle(ben);
      assert.equal(ben.govde.ogrenci.id, ogr.id);
      const p = await h.patch("/api/ogrenci/ben", { adSoyad: "  Yeni Ad  " }, { jeton });
      basariBekle(p);
      assert.equal(p.govde.ogrenci.adSoyad, "Yeni Ad");
      basariBekle(await h.post("/api/ogrenci/cikis", undefined, { jeton }), 204);
      hataBekle(await h.get("/api/ogrenci/ben", { jeton }), 401, "OTURUM_YOK");
      // Öteki oturum açık kalır
      basariBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }));
    });

    it("oturum türü ayrımı: öğrenci jetonu admin'de, yönetici jetonu öğrencide geçmez", async () => {
      const ogr = await k.ogrenci();
      const yon = await k.yonetici();
      hataBekle(await h.get("/api/admin/ben", { jeton: ogr.jeton }), 401, "OTURUM_YOK");
      hataBekle(await h.get("/api/ogrenci/ben", { jeton: yon }), 401, "OTURUM_YOK");
      hataBekle(await h.get("/api/ogrenci/ben"), 401, "OTURUM_YOK");
      hataBekle(await h.get("/api/ogrenci/ben", { jeton: "uydurma-jeton" }), 401, "OTURUM_YOK");
    });

    it("süresi dolan oturum geçmez", async () => {
      const ogr = await k.ogrenci();
      o().saat.kaydir(31 * 24 * 60 * 60 * 1000);
      try {
        hataBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }), 401, "OTURUM_YOK");
      } finally {
        o().saat.sifirla();
      }
    });

    it("parola değiştirme: mevcut parola denetlenir, öteki oturumlar kapanır", async () => {
      const ogr = await k.ogrenci();
      const ikinci = (await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: ogr.parola })).govde.jeton as string;
      const yanlis = await h.put("/api/ogrenci/ben/parola", { mevcutParola: "yanlis", yeniParola: "yeni-parola-1" }, { jeton: ogr.jeton });
      hataBekle(yanlis, 400, "DOGRULAMA");
      assert.ok(yanlis.govde.hata.alanlar.mevcutParola);
      basariBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }), 200); // yanlış parola oturumu kapatmaz
      basariBekle(await h.put("/api/ogrenci/ben/parola", { mevcutParola: ogr.parola, yeniParola: "yeni-parola-1" }, { jeton: ogr.jeton }), 204);
      basariBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }));
      hataBekle(await h.get("/api/ogrenci/ben", { jeton: ikinci }), 401, "OTURUM_YOK");
      basariBekle(await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: "yeni-parola-1" }));
    });

    it("giriş hız sınırı: IP + e-posta başına 15 dakikada 10", async () => {
      const ip = "203.0.113.77";
      const eposta = `${benzersiz("sinir")}@test.local`;
      for (let i = 0; i < 10; i++) hataBekle(await h.post("/api/ogrenci/giris", { eposta, parola: "yanlis" }, { ip }), 400, "DOGRULAMA");
      const y = await h.post("/api/ogrenci/giris", { eposta, parola: "yanlis" }, { ip });
      hataBekle(y, 429, "COK_FAZLA_ISTEK");
      assert.ok(Number(y.basliklar.get("retry-after")) > 0);
      // Başka IP etkilenmez
      hataBekle(await h.post("/api/ogrenci/giris", { eposta, parola: "yanlis" }, { ip: "203.0.113.78" }), 400, "DOGRULAMA");
    });
  });

  describe("parola sıfırlama", () => {
    it("hesap olsa da olmasa da 204; bağlantı tek kullanımlık, bütün oturumlar silinir", async () => {
      const ogr = await k.ogrenci();
      const once = o().iletiler.length;
      basariBekle(await h.post("/api/ogrenci/parola-sifirla/istek", { eposta: "olmayan-hesap@test.local" }), 204);
      assert.equal(o().iletiler.length, once, "olmayan hesaba ileti gitmemeli");

      basariBekle(await h.post("/api/ogrenci/parola-sifirla/istek", { eposta: ogr.eposta.toUpperCase() }), 204);
      const ileti = o().iletiler.at(-1)!;
      assert.equal(ileti.kime, ogr.eposta);
      const m = /http:\/\/frontend\.test\/parola-sifirla\/([A-Za-z0-9_-]+)/.exec(ileti.metin);
      assert.ok(m, "iletide sıfırlama bağlantısı olmalı");
      const jeton = m[1]!;

      hataBekle(await h.post("/api/ogrenci/parola-sifirla", { jeton: "uydurma", yeniParola: "yepyeni-parola" }), 400, "DOGRULAMA");
      hataBekle(await h.post("/api/ogrenci/parola-sifirla", { jeton, yeniParola: "kisa" }), 400, "DOGRULAMA");
      basariBekle(await h.post("/api/ogrenci/parola-sifirla", { jeton, yeniParola: "yepyeni-parola" }), 204);
      hataBekle(await h.post("/api/ogrenci/parola-sifirla", { jeton, yeniParola: "baska-parola-1" }), 400, "DOGRULAMA");

      hataBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }), 401, "OTURUM_YOK");
      hataBekle(await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: ogr.parola }), 400, "DOGRULAMA");
      basariBekle(await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: "yepyeni-parola" }));
    });

    it("süresi dolan bağlantı geçmez (1 saat)", async () => {
      const ogr = await k.ogrenci();
      basariBekle(await h.post("/api/ogrenci/parola-sifirla/istek", { eposta: ogr.eposta }), 204);
      const jeton = /parola-sifirla\/([A-Za-z0-9_-]+)/.exec(o().iletiler.at(-1)!.metin)![1]!;
      o().saat.kaydir(61 * 60 * 1000);
      try {
        hataBekle(await h.post("/api/ogrenci/parola-sifirla", { jeton, yeniParola: "yepyeni-parola" }), 400, "DOGRULAMA");
      } finally {
        o().saat.sifirla();
      }
    });

    it("sıfırlama isteği hız sınırı: IP başına saatte 5", async () => {
      const ip = "198.51.100.9";
      for (let i = 0; i < 5; i++) basariBekle(await h.post("/api/ogrenci/parola-sifirla/istek", { eposta: "kimse@test.local" }, { ip }), 204);
      hataBekle(await h.post("/api/ogrenci/parola-sifirla/istek", { eposta: "kimse@test.local" }, { ip }), 429, "COK_FAZLA_ISTEK");
    });
  });

  describe("hesap silme", () => {
    it("parola ister; hesap, oturumlar ve check-up'lar silinir", async () => {
      const ogr = await k.ogrenci();
      const yanlis = await h.del("/api/ogrenci/ben", { parola: "yanlis" }, { jeton: ogr.jeton });
      hataBekle(yanlis, 400, "DOGRULAMA");
      assert.ok(yanlis.govde.hata.alanlar.parola);
      basariBekle(await h.del("/api/ogrenci/ben", { parola: ogr.parola }, { jeton: ogr.jeton }), 204);
      hataBekle(await h.get("/api/ogrenci/ben", { jeton: ogr.jeton }), 401, "OTURUM_YOK");
      hataBekle(await h.post("/api/ogrenci/giris", { eposta: ogr.eposta, parola: ogr.parola }), 400, "DOGRULAMA");
      assert.equal(await o().db.ogrenci.count({ where: { id: ogr.id } }), 0);
      assert.equal(await o().db.oturum.count({ where: { ogrenciId: ogr.id } }), 0);
    });
  });
}
