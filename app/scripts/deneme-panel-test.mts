import "./_koruma.mjs";
/**
 * Paneldeki deneme oluşturucunun kuralları (admin/src/lib/checkup/mock-rules.ts):
 * en büyük kalan dağıtımı, "Dağılıma göre doldur", "Benzeriyle değiştir" ve
 * yayın engelleri. Veritabanı istemez.
 *   npx tsx scripts/deneme-panel-test.mts
 *
 * Modül panelde duruyor (öğrenci uygulaması kullanmıyor) ama testler burada
 * toplanıyor. Statik import YOK, bilerek: app ayrı derleniyor (Dokploy yalnızca
 * app/ klasörünü görür) ve `next build` tip denetimi scripts/'i de kapsıyor;
 * admin'e statik import derlemeyi kırardı. Dosya yoksa test atlanır.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

interface Aday {
  id: string;
  topicId: string;
  difficulty: number;
  digerDeneme: number;
  shownCount: number;
}
interface Kurallar {
  hamiltonDagit<K>(a: readonly { key: K; agirlik: number }[], toplam: number): Map<K, number>;
  hedefDagilim(h: readonly { topicId: string; ad: string; agirlik: number }[], n: number): Map<string, number>;
  zorlukHedefi(n: number): Map<number, number>;
  dagilimaGoreDoldur(g: {
    soruSayisi: number;
    mevcut: readonly { id: string; topicId: string; difficulty: number }[];
    hedefler: readonly { topicId: string; ad: string; agirlik: number }[];
    adaylar: ReadonlyMap<string, readonly Aday[]>;
  }): { eklenen: Aday[]; eksikler: string[]; notlar: string[] };
  benzerSec(k: { topicId: string; difficulty: number }, a: readonly Aday[]): Aday | null;
  denemeEngelleri(d: { soruSayisi: number; listede: number; yayindaOlmayan: Record<string, number>; sinavDisi: number }): string[];
  listeDurumu(n: number, l: readonly { status: string; sinavda: boolean }[]): {
    soruSayisi: number;
    listede: number;
    yayindaOlmayan: Record<string, number>;
    sinavDisi: number;
  };
}

const YOL = resolve(dirname(fileURLToPath(import.meta.url)), "../../admin/src/lib/checkup/mock-rules.ts");
if (!existsSync(YOL)) {
  console.log("admin/ yok (ayrı derleme ortamı): deneme kuralları testi atlandı.");
  process.exit(0);
}
const k = (await import(pathToFileURL(YOL).href)) as Kurallar;

/** t konusunda, verilen zorluklarda adaylar. */
const adaylar = (t: string, zorluklar: number[], ek: Partial<Aday> = {}) =>
  zorluklar.map((d, i) => ({ id: `${t}-${d}-${i}`, topicId: t, difficulty: d, digerDeneme: 0, shownCount: 0, ...ek }));
const harita = (...l: Aday[][]) => {
  const m = new Map<string, Aday[]>();
  for (const a of l.flat()) m.set(a.topicId, [...(m.get(a.topicId) ?? []), a]);
  return m;
};
const H = (t: string, agirlik: number) => ({ topicId: t, ad: "Konu " + t.toUpperCase(), agirlik });
const say = (l: Aday[], t: string) => l.filter((a) => a.topicId === t).length;

console.log("\nEn büyük kalan:");
{
  const d = k.hamiltonDagit(
    [
      { key: "a", agirlik: 3 },
      { key: "b", agirlik: 2 },
      { key: "c", agirlik: 2 },
    ],
    10
  );
  check("3:2:2 → 10 = 4,3,3", [d.get("a"), d.get("b"), d.get("c")].join(",") === "4,3,3", [...d.values()].join(","));
  const z = k.zorlukHedefi(12);
  check("zorluk 12 soru → 3,3,2,2,2 (eşitlikte sıra)", [1, 2, 3, 4, 5].map((x) => z.get(x)).join(",") === "3,3,2,2,2");
  check("zorluk 40 soru → 8'er", [1, 2, 3, 4, 5].every((x) => k.zorlukHedefi(40).get(x) === 8));
  let tutar = true;
  for (const toplam of [1, 7, 23, 40, 60]) {
    const w = [5, 1, 1, 3, 2, 8, 1].map((agirlik, i) => ({ key: i, agirlik }));
    const s = [...k.hamiltonDagit(w, toplam).values()].reduce((t, x) => t + x, 0);
    if (s !== toplam) tutar = false;
  }
  check("toplam her zaman birebir tutar", tutar);
  const sifir = k.hedefDagilim([H("a", 0), H("b", 2), H("c", -1)], 6);
  check("sıfır/negatif ağırlık pay almaz", sifir.get("a") === 0 && sifir.get("c") === 0 && sifir.get("b") === 6);
}

console.log("\nDağılıma göre doldur:");
{
  const agirliksiz = k.dagilimaGoreDoldur({ soruSayisi: 10, mevcut: [], hedefler: [], adaylar: new Map() });
  check("ağırlık yoksa doldurmaz, açıkça söyler", agirliksiz.eklenen.length === 0 && agirliksiz.eksikler[0]?.includes("examWeights"));

  const temel = k.dagilimaGoreDoldur({
    soruSayisi: 4,
    mevcut: [],
    hedefler: [H("a", 1), H("b", 1)],
    adaylar: harita(adaylar("a", [1, 2, 3, 4, 5]), adaylar("b", [1, 2, 3, 4, 5])),
  });
  check("1:1 ağırlık, 4 soru → 2+2", say(temel.eklenen, "a") === 2 && say(temel.eklenen, "b") === 2 && temel.eksikler.length === 0);

  const elle = k.dagilimaGoreDoldur({
    soruSayisi: 4,
    mevcut: [{ id: "elle-a", topicId: "a", difficulty: 3 }],
    hedefler: [H("a", 1), H("b", 1)],
    adaylar: harita(adaylar("a", [1, 2, 4]), adaylar("b", [1, 2, 4, 5])),
  });
  check("elle eklenen hedefe sayılır: +1 A, +2 B", say(elle.eklenen, "a") === 1 && say(elle.eklenen, "b") === 2, elle.eklenen.map((a) => a.id).join(","));

  const kit = k.dagilimaGoreDoldur({
    soruSayisi: 6,
    mevcut: [],
    hedefler: [H("a", 1), H("b", 1)],
    adaylar: harita(adaylar("a", [1, 2, 3, 4, 5]), adaylar("b", [3])),
  });
  check("havuz yetmeyen konu başka konudan DOLDURULMAZ", say(kit.eklenen, "a") === 3 && say(kit.eklenen, "b") === 1, kit.eklenen.length + " eklendi");
  check("eksik açıkça raporlanır", kit.eksikler.length === 1 && kit.eksikler[0].includes("Konu B") && kit.eksikler[0].includes("2 eksik"), kit.eksikler.join(" | "));

  const kullanilmamis = k.dagilimaGoreDoldur({
    soruSayisi: 2,
    mevcut: [],
    hedefler: [H("a", 1)],
    adaylar: harita([...adaylar("a", [1, 2], { digerDeneme: 1 }), ...adaylar("a", [3, 4]).map((a) => ({ ...a, id: "yeni-" + a.id }))]),
  });
  check("başka denemede olmayan önce", kullanilmamis.eklenen.every((a) => a.digerDeneme === 0), kullanilmamis.eklenen.map((a) => a.id).join(","));

  const tekrar = k.dagilimaGoreDoldur({
    soruSayisi: 2,
    mevcut: [],
    hedefler: [H("a", 1)],
    adaylar: harita([...adaylar("a", [3], { digerDeneme: 2 }), ...adaylar("a", [2])]),
  });
  check("kullanılmamış yetmezse tekrar eden alınır ve not düşülür", tekrar.eklenen.length === 2 && tekrar.notlar.some((n) => n.includes("başka bir denemede")));

  const denge = k.dagilimaGoreDoldur({
    soruSayisi: 5,
    mevcut: [],
    hedefler: [H("a", 1)],
    adaylar: harita(adaylar("a", [3, 3, 3, 3, 1, 2, 4, 5])),
  });
  check(
    "zorluk 1-5'e dengeli (orta yığılmaz)",
    [...denge.eklenen.map((a) => a.difficulty)].sort().join(",") === "1,2,3,4,5",
    denge.eklenen.map((a) => a.difficulty).join(",")
  );

  const az = k.dagilimaGoreDoldur({
    soruSayisi: 1,
    mevcut: [],
    hedefler: [H("a", 1)],
    adaylar: harita([
      { id: "a-cok", topicId: "a", difficulty: 1, digerDeneme: 0, shownCount: 50 },
      { id: "a-az", topicId: "a", difficulty: 1, digerDeneme: 0, shownCount: 3 },
    ]),
  });
  check("eşitlikte az gösterilen önce", az.eklenen[0]?.id === "a-az");

  const fazla = k.dagilimaGoreDoldur({
    soruSayisi: 4,
    mevcut: [
      { id: "x1", topicId: "x", difficulty: 3 },
      { id: "x2", topicId: "x", difficulty: 3 },
    ],
    hedefler: [H("a", 1), H("b", 1)],
    adaylar: harita(adaylar("a", [1, 2, 3]), adaylar("b", [1, 2, 3])),
  });
  check("hedef dışı elle eklenen varsa kalan yer kırpılır, toplam aşılmaz", fazla.eklenen.length === 2 && fazla.notlar.some((n) => n.includes("fazla")), fazla.eklenen.length + "");

  const dolu = k.dagilimaGoreDoldur({
    soruSayisi: 2,
    mevcut: [
      { id: "1", topicId: "a", difficulty: 1 },
      { id: "2", topicId: "a", difficulty: 2 },
    ],
    hedefler: [H("a", 1)],
    adaylar: harita(adaylar("a", [3])),
  });
  check("dolu liste: ekleme yok, not var", dolu.eklenen.length === 0 && dolu.notlar[0]?.includes("dolu"));

  const g = {
    soruSayisi: 10,
    mevcut: [],
    hedefler: [H("a", 3), H("b", 2), H("c", 1)],
    adaylar: harita(adaylar("a", [1, 2, 3, 4, 5, 1, 2]), adaylar("b", [5, 4, 3, 2]), adaylar("c", [2, 3, 4])),
  };
  const ilk = k.dagilimaGoreDoldur(g).eklenen.map((a) => a.id).join(",");
  const ikinci = k.dagilimaGoreDoldur(g).eklenen.map((a) => a.id).join(",");
  check("aynı girdi aynı liste (belirlenimci)", ilk === ikinci && ilk.length > 0);
}

console.log("\nBenzeriyle değiştir:");
{
  const havuz = [
    { id: "b-3", topicId: "b", difficulty: 3, digerDeneme: 0, shownCount: 0 },
    { id: "a-5", topicId: "a", difficulty: 5, digerDeneme: 0, shownCount: 0 },
    { id: "a-4-kullanilmis", topicId: "a", difficulty: 4, digerDeneme: 1, shownCount: 0 },
    { id: "a-2", topicId: "a", difficulty: 2, digerDeneme: 0, shownCount: 0 },
    { id: "a-4", topicId: "a", difficulty: 4, digerDeneme: 0, shownCount: 9 },
  ];
  check("aynı konu, en yakın zorluk, kullanılmamış önce", k.benzerSec({ topicId: "a", difficulty: 4 }, havuz)?.id === "a-4");
  check("başka konudan aday gelmez", k.benzerSec({ topicId: "c", difficulty: 3 }, havuz) === null);
}

console.log("\nYayın kuralı:");
{
  const tam = k.listeDurumu(3, [
    { status: "PUBLISHED", sinavda: true },
    { status: "PUBLISHED", sinavda: true },
    { status: "PUBLISHED", sinavda: true },
  ]);
  check("tam ve yayında: engel yok", k.denemeEngelleri(tam).length === 0);
  const eksik = k.denemeEngelleri(k.listeDurumu(40, [{ status: "PUBLISHED", sinavda: true }]));
  check("eksik liste", eksik.length === 1 && eksik[0].includes("39 eksik"), eksik.join(" | "));
  const fazla = k.denemeEngelleri(k.listeDurumu(1, [{ status: "PUBLISHED", sinavda: true }, { status: "PUBLISHED", sinavda: true }]));
  check("fazla liste", fazla[0]?.includes("1 fazla"), fazla.join(" | "));
  const durum = k.denemeEngelleri(
    k.listeDurumu(3, [
      { status: "ARCHIVED", sinavda: true },
      { status: "ARCHIVED", sinavda: true },
      { status: "DRAFT", sinavda: false },
    ])
  );
  check("yayında olmayanlar duruma göre", durum.some((e) => e.startsWith("3 soru yayında değil") && e.includes("2 arşivde") && e.includes("1 taslak")), durum.join(" | "));
  check("sınav dışı soru ayrı neden", durum.some((e) => e.includes("1 soru bu denemenin sınavında sorulamıyor")));
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
