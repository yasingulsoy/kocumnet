import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { adNormalize, baslikNormalize, excelOku, ExcelHatasi, hucreMetni, sablonUret, SUTUNLAR } from "../../src/lib/excel.js";
import { ALES_AGACI, ALES_SORULARI, DGS_SORULARI } from "../../scripts/ornek-veri.js";
import { icerikHtml } from "../../src/lib/icerik.js";
import { HARFLER, siklariDenetle } from "../../src/lib/siklar.js";

async function kitap(basliklar: unknown[], satirlar: unknown[][], sayfaAdi = "Sorular"): Promise<Buffer> {
  const k = new ExcelJS.Workbook();
  k.addWorksheet("Önce");
  const s = k.addWorksheet(sayfaAdi);
  s.addRow(basliklar);
  for (const r of satirlar) s.addRow(r);
  return Buffer.from((await k.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("Excel: başlık eşleme ve okuma", () => {
  it("başlıklar büyük-küçük harf ve Türkçe karakter farkı gözetmeden eşleşir", () => {
    for (const [a, b] of [
      ["Alt Kazanım", "ALT KAZANIM"],
      ["Alt Kazanım", "alt kazanim"],
      ["Alt Kazanım", "AltKazanım"],
      ["Doğru", "DOGRU"],
      ["Çözüm", "cozum"],
      ["Çözüm", "ÇÖZÜM"],
      ["Kazanım", "KAZANIM"],
    ]) {
      assert.equal(baslikNormalize(a!), baslikNormalize(b!), `${a} = ${b}`);
    }
    assert.notEqual(baslikNormalize("Kazanım"), baslikNormalize("Alt Kazanım"));
    assert.equal(adNormalize("  Sayısal   Mantık "), "sayısal mantık");
    assert.equal(adNormalize("SAYISAL"), "sayısal");
  });

  it("hücre değerleri metne çevrilir", () => {
    assert.equal(hucreMetni(null), "");
    assert.equal(hucreMetni(3.5), "3,5");
    assert.equal(hucreMetni({ richText: [{ text: "a" }, { text: "b" }] } as ExcelJS.CellValue), "ab");
    assert.equal(hucreMetni({ formula: "1+1", result: 2 } as ExcelJS.CellValue), "2");
    assert.equal(hucreMetni("a\r\nb"), "a\nb");
  });

  it('"Sorular" sayfası bulunur, boş satır atlanır, satır numarası korunur', async () => {
    const basliklar = ["DERS", "konu", "Kazanim", "alt kazanım", "SORU", "a", "b", "c", "d", "e", "doğru", "çözüm"];
    const dosya = await kitap(basliklar, [["Sayısal", "K", "Z", "A", "Soru 1", 1, 2, 3, 4, 5, "B", "Ç"], [], ["Sayısal", "K", "Z", "A", "Soru 2", 1, 2, 3, 4, 5, "C", "Ç"]]);
    const satirlar = await excelOku(dosya);
    assert.deepEqual(
      satirlar.map((s) => [s.satir, s.degerler.soru, s.degerler.dogru, s.degerler.zorluk]),
      [
        [2, "Soru 1", "B", ""],
        [4, "Soru 2", "C", ""],
      ]
    );
  });

  it("eksik sütun ve bozuk dosya ExcelHatasi", async () => {
    await assert.rejects(excelOku(await kitap(["Ders", "Konu"], [["a", "b"]])), (e: unknown) => e instanceof ExcelHatasi && /Kazanım/.test(e.message));
    await assert.rejects(excelOku(Buffer.from("excel değil")), ExcelHatasi);
  });

  it("şablon: iki sayfa, başlıklar ve ağaç yolları", async () => {
    const dosya = await sablonUret({
      sinavAd: "ALES",
      yollar: [{ ders: "Sayısal", konu: "Denklemler", kazanimKod: "M.1", kazanim: "Birinci derece", altKazanimKod: null, altKazanim: "Tek bilinmeyen" }],
    });
    const k = new ExcelJS.Workbook();
    await k.xlsx.load(dosya as unknown as ArrayBuffer);
    assert.deepEqual(
      k.worksheets.map((s) => s.name),
      ["Sorular", "Konu Ağacı"]
    );
    assert.deepEqual((k.getWorksheet("Sorular")!.getRow(1).values as unknown[]).slice(1), SUTUNLAR.map((s) => s.baslik));
    // Şablonu olduğu gibi okumak örnek satırı verir (içe aktarma onu reddeder)
    const satirlar = await excelOku(dosya);
    assert.equal(satirlar.length, 1);
    assert.equal(satirlar[0]!.degerler.kazanim, "M.1");
  });
});

describe("örnek tohum verisi", () => {
  it("her demo soru geçerli: 5 ayrık şık, tek doğru, formüller derleniyor, çözüm var", () => {
    for (const s of [...ALES_SORULARI, ...DGS_SORULARI]) {
      assert.ok(s.dogru >= 0 && s.dogru < 5, s.metin);
      assert.deepEqual(siklariDenetle(s.siklar.map((metin) => ({ metin })), HARFLER[s.dogru]), {}, s.metin);
      assert.ok(s.cozum.trim(), s.metin);
      icerikHtml(s.metin);
      icerikHtml(s.cozum);
    }
  });

  it("ALES Hızlı reçetesinin havuzu yetiyor (56 soru)", () => {
    assert.equal(ALES_SORULARI.length, 56);
    const say = (onek: string) => ALES_SORULARI.filter((s) => s.alt.startsWith(onek)).length;
    assert.ok(say("MAT.1.") >= 7 && say("MAT.2.") >= 7 && say("MAT.5.") >= 7);
    assert.ok(say("MAT.3.") + say("MAT.4.") >= 14); // Denklemler
    assert.ok(say("MAT.5.") + say("MAT.6.") - 7 >= 6); // Problemler, Yüzde satırından sonra
    assert.ok(say("TUR.") >= 9);
    const altKodlar = new Set(ALES_AGACI.flatMap((d) => d.konular.flatMap((k) => k.kazanimlar.flatMap((z) => z.altlar.map((a) => a.kod)))));
    assert.ok(ALES_SORULARI.every((s) => altKodlar.has(s.alt)));
  });

  it("sayısal demo soruların doğru şıkkı hesapla tutuyor (örnekler)", () => {
    const bul = (parca: string) => ALES_SORULARI.find((s) => s.metin.includes(parca))!;
    const dogru = (parca: string) => bul(parca).siklar[bul(parca).dogru];
    assert.equal(dogru("\\overline{4A7}"), "$7$");
    assert.equal(dogru("$47285$"), "$8$");
    assert.equal(dogru("$3x + 5 = 20$"), "$5$");
    assert.equal(dogru("son fiyatı 180 TL"), "$200$");
    assert.equal(dogru("Aralarında 420 km"), "$3$");
  });
});
