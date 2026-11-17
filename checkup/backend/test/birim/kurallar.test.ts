import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hazirlikHesapla, type HazirlikGirdisi } from "../../src/lib/hazirlik.js";
import { HizSiniri } from "../../src/lib/hiz-siniri.js";
import { guvenliEsit, jetonOzeti, jetonUret } from "../../src/lib/jeton.js";
import { parolaDogrula, parolaOzetle } from "../../src/lib/parola.js";
import { basariHesapla, netHesapla, raporHesapla, type AgacBilgisi, type SoruSonucu } from "../../src/lib/puanlama.js";
import { karmaSec, konuyaGoreDiz, SecimHatasi, type HavuzSorusu } from "../../src/lib/secim.js";
import { siklariDenetle } from "../../src/lib/siklar.js";
import { bitisAni, bitisSiniriHesapla, sureSaniye, suresiDoldu, TOLERANS_MS } from "../../src/lib/sure.js";

/** Tekrarlanabilir rastgele sayı üreteci (mulberry32). */
function tohumlu(tohum: number) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("şık doğrulaması", () => {
  const siklar = (...m: string[]) => m.map((metin) => ({ metin }));

  it("geçerli 5 şık ve tek doğru", () => {
    assert.deepEqual(siklariDenetle(siklar("1", "2", "3", "4", "5"), "c"), {});
  });

  it("boş şık, eksik şık, geçersiz doğru", () => {
    assert.ok(siklariDenetle(siklar("1", " ", "3", "4", "5"), "A")["siklar.1.metin"]);
    assert.ok(siklariDenetle(siklar("1", "2", "3", "4"), "A")["siklar"]);
    assert.ok(siklariDenetle(siklar("1", "2", "3", "4", "5"), "F")["dogruSik"]);
    assert.ok(siklariDenetle(siklar("1", "2", "3", "4", "5"), "")["dogruSik"]);
  });

  it("boşluk ve büyük-küçük harf farkı yok sayıldığında da ayrık olmalı", () => {
    const h = siklariDenetle(siklar("İki Kat", "üç", "ikikat", "dört", "beş"), "A");
    assert.match(h["siklar.2.metin"]!, /C şıkkı A şıkkıyla aynı/);
    assert.ok(siklariDenetle(siklar("$x+1$", "$x + 1$", "a", "b", "c"), "A")["siklar.1.metin"]);
  });

  it("şık metnindeki ve açıklamasındaki hatalı formül alan hatası verir", () => {
    const h = siklariDenetle([{ metin: "$\\frac{$" }, { metin: "2" }, { metin: "3" }, { metin: "4" }, { metin: "5", aciklama: "$x" }], "B");
    assert.ok(h["siklar.0.metin"]);
    assert.ok(h["siklar.4.aciklama"]);
  });
});

describe("hazırlık", () => {
  const temel = (ek: Partial<HazirlikGirdisi>): HazirlikGirdisi => ({
    turSoruSayisi: 10,
    secim: "KARMA",
    recete: [],
    kazanimAktif: new Map(),
    konuAktif: new Map(),
    sabit: [],
    ...ek,
  });

  it("KARMA: boş reçete ve toplam farkı", () => {
    assert.match(hazirlikHesapla(temel({})).sorunlar[0]!, /Reçete boş/);
    const h = hazirlikHesapla(temel({ recete: [{ konuId: 1, kazanimId: null, soruSayisi: 4, ad: "Konu" }], konuAktif: new Map([[1, 20]]) }));
    assert.equal(h.hazir, false);
    assert.deepEqual(h.sorunlar, ["Reçete toplamı 4 soru; türün soru sayısı 10. İkisi eşit olmalı."]);
  });

  it("KARMA: kazanım havuzu ve konu satırından kazanım satırlarının düşülmesi", () => {
    const g = temel({
      recete: [
        { konuId: null, kazanimId: 5, soruSayisi: 6, ad: "Türev", kazanimKonuId: 1 },
        { konuId: 1, kazanimId: null, soruSayisi: 4, ad: "Analiz" },
      ],
      kazanimAktif: new Map([[5, 6]]),
      konuAktif: new Map([[1, 9]]),
    });
    const h = hazirlikHesapla(g);
    assert.equal(h.hazir, false);
    assert.equal(h.sorunlar.length, 1);
    assert.match(h.sorunlar[0]!, /"Analiz" konusunda 9 aktif soru var; .*6 soru ayrıldıktan sonra 3 soru kalıyor, konu satırı 4 soru istiyor/);
    g.konuAktif.set(1, 10);
    assert.deepEqual(hazirlikHesapla(g), { hazir: true, sorunlar: [] });
    g.kazanimAktif.set(5, 5);
    assert.match(hazirlikHesapla(g).sorunlar[0]!, /"Türev" kazanımında 5 aktif soru var; reçete 6 soru istiyor/);
  });

  it("SABIT: sayı, pasif ve başka sınavın sorusu", () => {
    const sabit = Array.from({ length: 10 }, (_, i) => ({ soruId: i + 1, aktif: i !== 3, sinavUygun: i !== 7 }));
    const h = hazirlikHesapla(temel({ secim: "SABIT", sabit }));
    assert.equal(h.hazir, false);
    assert.equal(h.sorunlar.length, 2);
    assert.match(h.sorunlar[0]!, /1 pasif soru var: #4/);
    assert.match(h.sorunlar[1]!, /ait olmayan 1 soru var: #8/);
    assert.match(hazirlikHesapla(temel({ secim: "SABIT", sabit: sabit.slice(0, 2).map((s) => ({ ...s, aktif: true, sinavUygun: true })) })).sorunlar[0]!, /Sabit listede 2 soru var; türün soru sayısı 10/);
  });
});

describe("soru seçimi", () => {
  // Ders 1 (sıra 1): konu 10 (sıra 0) → kazanım 100 (4 soru), 101 (4 soru); Ders 2 (sıra 0): konu 20 → kazanım 200 (5 soru)
  const havuz: HavuzSorusu[] = [
    ...[1, 2, 3, 4].map((id) => ({ id, dersId: 1, dersSira: 1, konuId: 10, konuSira: 0, kazanimId: 100 })),
    ...[5, 6, 7, 8].map((id) => ({ id, dersId: 1, dersSira: 1, konuId: 10, konuSira: 0, kazanimId: 101 })),
    ...[9, 10, 11, 12, 13].map((id) => ({ id, dersId: 2, dersSira: 0, konuId: 20, konuSira: 0, kazanimId: 200 })),
  ];

  it("kazanım satırları önce; konu satırı seçilmişi tekrar almaz; ders sırasına göre dizer", () => {
    for (let tohum = 1; tohum <= 50; tohum++) {
      const sonuc = karmaSec({
        satirlar: [
          { konuId: 10, kazanimId: null, soruSayisi: 4 },
          { konuId: null, kazanimId: 100, soruSayisi: 4 },
          { konuId: 20, kazanimId: null, soruSayisi: 2 },
        ],
        havuz,
        gorulen: new Set(),
        rastgele: tohumlu(tohum),
      });
      const idler = sonuc.map((s) => s.id);
      assert.equal(new Set(idler).size, 10, "tekrar soru olmamalı");
      // Kazanım 100'ün dört sorusu da kazanım satırına gitti; konu satırı 101'den aldı
      assert.deepEqual(idler.filter((i) => i <= 4).sort((a, b) => a - b), [1, 2, 3, 4]);
      assert.deepEqual(idler.filter((i) => i >= 5 && i <= 8).sort((a, b) => a - b), [5, 6, 7, 8]);
      // Ders 2 (sıra 0) önce
      assert.deepEqual(
        sonuc.map((s) => s.dersId),
        [2, 2, 1, 1, 1, 1, 1, 1, 1, 1]
      );
    }
  });

  it("görülenler havuz yetiyorsa gelmez; yetmiyorsa görülmemişlerin hepsi + eksik görülmüşlerden", () => {
    const gorulen = new Set([9, 10, 11]);
    for (let tohum = 1; tohum <= 30; tohum++) {
      const iki = karmaSec({ satirlar: [{ konuId: 20, kazanimId: null, soruSayisi: 2 }], havuz, gorulen, rastgele: tohumlu(tohum) }).map((s) => s.id);
      assert.deepEqual(iki.sort((a, b) => a - b), [12, 13]);
      const dort = karmaSec({ satirlar: [{ konuId: 20, kazanimId: null, soruSayisi: 4 }], havuz, gorulen, rastgele: tohumlu(tohum) }).map((s) => s.id);
      assert.ok(dort.includes(12) && dort.includes(13));
      assert.equal(new Set(dort).size, 4);
    }
  });

  it("havuz yetmezse SecimHatasi", () => {
    assert.throws(
      () => karmaSec({ satirlar: [{ konuId: null, kazanimId: 100, soruSayisi: 5 }], havuz, gorulen: new Set(), rastgele: Math.random }),
      SecimHatasi
    );
  });

  it("konu içi sıra rastgele, konular sırayla", () => {
    const sorular = [...havuz].reverse();
    const gorulenSiralar = new Set<string>();
    for (let tohum = 1; tohum <= 20; tohum++) {
      const d = konuyaGoreDiz(sorular, tohumlu(tohum));
      assert.deepEqual(
        d.map((s) => s.konuId),
        [20, 20, 20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10]
      );
      gorulenSiralar.add(d.map((s) => s.id).join(","));
    }
    assert.ok(gorulenSiralar.size > 1, "konu içi sıra rastgele olmalı");
  });
});

describe("puanlama ve rapor", () => {
  it("net: yanlış götürme, 0 ise götürmez, iki ondalık", () => {
    assert.equal(netHesapla(30, 12, 4), 27);
    assert.equal(netHesapla(30, 13, 3), 25.67);
    assert.equal(netHesapla(10, 1, 3), 9.67);
    assert.equal(netHesapla(10, 2, 3), 9.33);
    assert.equal(netHesapla(5, 7, 0), 5);
    assert.equal(netHesapla(0, 3, 4), -0.75);
    assert.equal(basariHesapla(1, 3), 33);
    assert.equal(basariHesapla(2, 3), 67);
    assert.equal(basariHesapla(0, 0), 0);
  });

  const agac: AgacBilgisi = {
    dersler: new Map([
      [1, { ad: "Sayısal", sira: 0 }],
      [2, { ad: "Sözel", sira: 1 }],
    ]),
    konular: new Map([
      [10, { ad: "Problemler", sira: 1, ustId: 1 }],
      [11, { ad: "Sayılar", sira: 0, ustId: 1 }],
      [20, { ad: "Paragraf", sira: 0, ustId: 2 }],
    ]),
    kazanimlar: new Map([
      [100, { ad: "Yüzde", sira: 0, kod: "P.1", ustId: 10 }],
      [110, { ad: "Bölünebilme", sira: 0, kod: "S.1", ustId: 11 }],
      [200, { ad: "Ana fikir", sira: 0, kod: null, ustId: 20 }],
    ]),
    altKazanimlar: new Map([
      [1000, { ad: "Art arda yüzde", sira: 0, kod: "P.1.1", ustId: 100 }],
      [1100, { ad: "9 ile", sira: 0, kod: "S.1.1", ustId: 110 }],
      [2000, { ad: "Paragrafta ana fikir", sira: 0, kod: null, ustId: 200 }],
    ]),
  };
  const s = (dersId: number, konuId: number, kazanimId: number, altKazanimId: number, sonuc: SoruSonucu["sonuc"]): SoruSonucu => ({ dersId, konuId, kazanimId, altKazanimId, sonuc });

  it("özet, ağaç sırası, grup netleri, zayıflar kuralı", () => {
    const sonuclar: SoruSonucu[] = [
      // Yüzde: 3 soru, 1 doğru → %33 (zayıf)
      s(1, 10, 100, 1000, "dogru"),
      s(1, 10, 100, 1000, "yanlis"),
      s(1, 10, 100, 1000, "bos"),
      // Bölünebilme: 2 soru, 2 doğru → %100
      s(1, 11, 110, 1100, "dogru"),
      s(1, 11, 110, 1100, "dogru"),
      // Ana fikir: 1 soru yanlış → tek sorudan zayıflık çıkmaz
      s(2, 20, 200, 2000, "yanlis"),
    ];
    const r = raporHesapla({ sonuclar, agac, yanlisGoturme: 4 });
    assert.deepEqual(r.ozet, { soruSayisi: 6, dogru: 3, yanlis: 2, bos: 1, net: 2.5, yanlisGoturme: 4, basari: 50 });
    assert.deepEqual(
      r.dersler.map((d) => [d.ad, d.soru, d.net]),
      [
        ["Sayısal", 5, 2.75],
        ["Sözel", 1, -0.25],
      ]
    );
    // Konular ağaç sırasında: Sayılar (sıra 0) Problemler'den önce
    assert.deepEqual(
      r.konular.map((k) => [k.ad, k.dersAd]),
      [
        ["Sayılar", "Sayısal"],
        ["Problemler", "Sayısal"],
        ["Paragraf", "Sözel"],
      ]
    );
    assert.deepEqual(
      r.kazanimlar.map((k) => [k.kod, k.konuAd, k.basari]),
      [
        ["S.1", "Sayılar", 100],
        ["P.1", "Problemler", 33],
        [null, "Paragraf", 0],
      ]
    );
    assert.deepEqual(r.altKazanimlar[1]!.kazanimAd, "Yüzde");
    assert.deepEqual(
      r.zayiflar.map((z) => [z.seviye, z.ad, z.ustAd, z.soru, z.dogru, z.basari]),
      [
        ["kazanim", "Yüzde", "Problemler", 3, 1, 33],
        ["altKazanim", "Art arda yüzde", "Yüzde", 3, 1, 33],
      ]
    );
  });

  it("zayıflar: başarı artan, eşitlikte soru sayısı azalan, en fazla 5", () => {
    const kaz = new Map<number, { ad: string; sira: number; kod: string; ustId: number }>();
    const alt = new Map<number, { ad: string; sira: number; kod: string; ustId: number }>();
    const sonuclar: SoruSonucu[] = [];
    // 7 kazanım: i. kazanımda (i+2) soru, hepsi yanlış ya da birkaç doğru
    for (let i = 0; i < 7; i++) {
      kaz.set(i + 1, { ad: `K${i}`, sira: i, kod: `K${i}`, ustId: 10 });
      alt.set(i + 101, { ad: `A${i}`, sira: 0, kod: `A${i}`, ustId: i + 1 });
      const soru = i + 2;
      const dogru = i % 2; // %0 ya da düşük
      for (let j = 0; j < soru; j++) sonuclar.push(s(1, 10, i + 1, i + 101, j < dogru ? "dogru" : "yanlis"));
    }
    const r = raporHesapla({ sonuclar, agac: { ...agac, kazanimlar: kaz, altKazanimlar: alt }, yanlisGoturme: 0 });
    assert.equal(r.zayiflar.length, 5);
    for (let i = 1; i < r.zayiflar.length; i++) {
      const a = r.zayiflar[i - 1]!;
      const b = r.zayiflar[i]!;
      assert.ok(a.basari < b.basari || (a.basari === b.basari && a.soru >= b.soru));
    }
    assert.equal(r.ozet.net, r.ozet.dogru, "yanlış götürme 0 ise net = doğru");
  });
});

describe("süre", () => {
  it("bitiş sınırı ve 15 saniye tolerans", () => {
    const bas = new Date("2026-11-17T10:00:00Z");
    const sinir = bitisSiniriHesapla(bas, 75);
    assert.equal(sinir.toISOString(), "2026-11-17T11:15:00.000Z");
    assert.equal(suresiDoldu(new Date(sinir.getTime() + TOLERANS_MS), sinir), false);
    assert.equal(suresiDoldu(new Date(sinir.getTime() + TOLERANS_MS + 1), sinir), true);
    assert.equal(bitisAni(new Date(sinir.getTime() + 60_000), sinir).getTime(), sinir.getTime());
    assert.equal(sureSaniye(bas, new Date(bas.getTime() + 3_120_400)), 3120);
  });
});

describe("parola, jeton, hız sınırı", () => {
  it("scrypt özeti doğrular, yanlış parolayı reddeder", async () => {
    const ozet = await parolaOzetle("gizli-parola");
    assert.match(ozet, /^scrypt\$65536\$8\$1\$/);
    assert.equal(await parolaDogrula("gizli-parola", ozet), true);
    assert.equal(await parolaDogrula("Gizli-parola", ozet), false);
    assert.equal(await parolaDogrula("x", "bozuk"), false);
  });

  it("jeton 32 bayt base64url, özet SHA-256; sabit süreli karşılaştırma", () => {
    const j = jetonUret();
    assert.match(j, /^[A-Za-z0-9_-]{43}$/);
    assert.match(jetonOzeti(j), /^[0-9a-f]{64}$/);
    assert.equal(guvenliEsit("abc", "abc"), true);
    assert.equal(guvenliEsit("abc", "abcd"), false);
  });

  it("hız sınırı pencere sonunda sıfırlanır", () => {
    let simdi = 0;
    const s = new HizSiniri(() => simdi);
    const kural = { limit: 2, pencereMs: 1000 };
    assert.equal(s.say("a", kural), null);
    assert.equal(s.say("a", kural), null);
    assert.equal(s.say("a", kural), 1);
    assert.equal(s.say("b", kural), null);
    simdi = 1001;
    assert.equal(s.say("a", kural), null);
    s.sifirla("a");
    s.kapat();
  });
});
