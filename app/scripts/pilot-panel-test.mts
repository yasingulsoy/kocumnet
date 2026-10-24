import "./_koruma.mjs";
/**
 * Paneldeki pilot ölçümünün saf hesapları (admin/src/lib/checkup/pilot-kurallari.ts
 * ve pilot-rapor.ts): küçük sayı kuralı, huni, testlerin kapanışı ve yarım
 * test, öğrenme kazancı eşleştirmesi (3 soru şartı, tekrar soru, 10 öğrenci
 * şartı), planına giren / girmeyen ayrımı, rapor. Veritabanı istemez.
 *   npx tsx scripts/pilot-panel-test.mts
 *
 * Statik import YOK, bilerek (deneme-panel-test.mts ile aynı gerekçe): app ayrı
 * derleniyor ve `next build` tip denetimi scripts/'i de kapsıyor. Dosya yoksa
 * test atlanır; CI'da bu bir HATADIR.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const PANEL = resolve(dirname(fileURLToPath(import.meta.url)), "../../admin/src/lib/checkup");
const KURAL_YOLU = resolve(PANEL, "pilot-kurallari.ts");
const RAPOR_YOLU = resolve(PANEL, "pilot-rapor.ts");
if (!existsSync(KURAL_YOLU) || !existsSync(RAPOR_YOLU)) {
  if (process.env.CI) {
    console.error("✗ admin/src/lib/checkup/pilot-kurallari.ts ya da pilot-rapor.ts bulunamadı: CI'da pilot testi atlanamaz.");
    console.error("  Dosya taşındıysa ya da adı değiştiyse bu betikteki yolları güncelle.");
    process.exit(1);
  }
  console.log("admin/ yok (ayrı derleme ortamı): pilot paneli testi atlandı.");
  process.exit(0);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- panel modülünün tipleri buraya taşınmıyor (yukarıdaki not) */
type Satir = Record<string, any>;
interface Kurallar {
  KUCUK_SAYI_SINIRI: number;
  KAZANC_EN_AZ_OGRENCI: number;
  ANLAMLI_ARTIS_PUAN: number;
  gizlenir(n: number): boolean;
  sayiMetni(n: number): string;
  oranMetni(pay: number, payda: number): string;
  puanMetni(p: number): string;
  pilotSuzgeci(sp: Record<string, string | undefined>, now: Date): Satir;
  huniHesapla(k: Satir[], o: Satir[], gozlemSonu: Date): Satir[];
  testDurumlari(o: Satir[]): Satir;
  birakmaYeri(k: Satir[]): { yer: number; toplam: number } | null;
  birakmaDagilimi(t: Satir[][]): { ceyrekler: number[]; hicIsaretsiz: number };
  odevOzeti(a: Satir[]): Satir;
  kazancEslestir(s: Satir[], p: Satir[], once?: Satir[]): Satir[];
  kazancOzeti(e: Satir[]): Satir;
  kontrolTestleri(s: Satir[]): { olculen: number; gecen: number; ogrenci: number };
  zorlukAlgisi(s: Satir[]): { paketler: Satir[]; gizlenen: number; ogrenci: number };
  kaynakDagilimi(s: Satir[]): Satir[];
  onceYazilacaklar(s: Satir[]): Satir[];
}
interface Rapor {
  RAPOR_NOTU: string;
  pilotRaporu(v: Satir, ek: { olusturma: Date; adres: string }): string;
}
const k = (await import(pathToFileURL(KURAL_YOLU).href)) as Kurallar;
const r = (await import(pathToFileURL(RAPOR_YOLU).href)) as Rapor;

const GUN = 86_400_000;
const SON = new Date("2026-10-24T09:00:00Z");
const once = (gun: number, saat = 0) => new Date(SON.getTime() - gun * GUN - saat * 3_600_000);
const sonuc = (d: number, y: number, b: number, an: Date) => ({ correctCount: d, wrongCount: y, blankCount: b, an });

console.log("\nKüçük sayı kuralı:");
{
  check("4 gizli, 5 görünür, 0 da gizli", k.gizlenir(4) && !k.gizlenir(5) && k.gizlenir(0));
  check("sayı metni", k.sayiMetni(3) === "<5" && k.sayiMetni(5) === "5" && k.sayiMetni(1234) === "1.234", k.sayiMetni(1234));
  check("oran: payda küçükse gizli", k.oranMetni(4, 4) === "—");
  check("oran: pay küçükse gizli (40 kişide %5 = 2 kişi ele verirdi)", k.oranMetni(2, 40) === "—");
  check("oran: ikisi de yeterli", k.oranMetni(10, 40) === "%25", k.oranMetni(10, 40));
  check("puan metni işaretli", k.puanMetni(12.4) === "+12 puan" && k.puanMetni(-3) === "−3 puan" && k.puanMetni(0.2) === "0 puan");
}

console.log("\nSüzgeç:");
{
  const v = k.pilotSuzgeci({}, SON);
  check("varsayılan: son 35 gün, bugün dahil", v.bas === "2026-09-20" && v.bit === "2026-10-24" && v.varsayilan, v.bas + " – " + v.bit);
  check("gözlem sonu şimdi (bugün bitmedi)", v.gozlemSonu.getTime() === SON.getTime());
  check("grup yok = hepsi", v.grupId === null && k.pilotSuzgeci({ grup: "hepsi" }, SON).grupId === null);
  const t = k.pilotSuzgeci({ bas: "2026-09-01", bit: "2026-09-30", grup: "cmabc12345xyz" }, SON);
  check("geçerli aralık ve grup", t.bas === "2026-09-01" && t.bit === "2026-09-30" && t.grupId === "cmabc12345xyz" && !t.varsayilan);
  check(
    "bitiş günü dahil, Türkiye saatiyle",
    t.basAn.toISOString() === "2026-08-31T21:00:00.000Z" && t.bitisAn.toISOString() === "2026-09-30T21:00:00.000Z"
  );
  check("ters tarih varsayılana döner", k.pilotSuzgeci({ bas: "2026-10-10", bit: "2026-10-01" }, SON).varsayilan);
  check("31 Şubat geçersiz", k.pilotSuzgeci({ bas: "2026-02-31", bit: "2026-03-05" }, SON).varsayilan);
  check("tuhaf grup kimliği süzgece girmez", k.pilotSuzgeci({ grup: "x'; drop" }, SON).grupId === null);
}

console.log("\nHuni:");
{
  // a: her şeyi yaptı; b: tanışma + ilk test yarım kaldı, sonra ölçüm; c: tanışma, yalnızca boş test;
  // d: ilk ölçüm ama 2. haftasında hiçbir şey; e: 10 gün önce kayıt (2. haftası dolmadı);
  // f: 2. haftada yalnızca son görülme; g: tanışma yok ama test var (tanışmayı geçmeden sayılmaz).
  const kullanicilar = [
    { id: "a", createdAt: once(30), onboardedAt: once(30), lastSeenAt: once(1) },
    { id: "b", createdAt: once(30), onboardedAt: once(30), lastSeenAt: null },
    { id: "c", createdAt: once(30), onboardedAt: once(30), lastSeenAt: null },
    { id: "d", createdAt: once(30), onboardedAt: once(30), lastSeenAt: null },
    { id: "e", createdAt: once(10), onboardedAt: once(10), lastSeenAt: null },
    { id: "f", createdAt: once(30), onboardedAt: once(30), lastSeenAt: once(20) },
    { id: "g", createdAt: once(30), onboardedAt: null, lastSeenAt: null },
  ];
  const oturum = (userId: string, kind: string, startedAt: Date, s: Satir | null, endedBy: string | null = "STUDENT") => ({
    userId,
    kind,
    status: s ? "SUBMITTED" : "IN_PROGRESS",
    endedBy,
    startedAt,
    sonuc: s,
  });
  const oturumlar = [
    oturum("a", "PACKAGE", once(29), sonuc(10, 5, 1, once(29))),
    oturum("a", "PRACTICE", once(21), null), // 2. hafta: alıştırma da etkinlik
    oturum("b", "PACKAGE", once(29), sonuc(2, 1, 21, once(29)), "TIMEOUT"), // yarım: ölçüm değil
    oturum("b", "PACKAGE", once(28), sonuc(12, 6, 2, once(28))),
    oturum("c", "PACKAGE", once(29), sonuc(0, 0, 20, once(29))), // boş: ölçüm değil
    oturum("d", "PACKAGE", once(29), sonuc(8, 8, 4, once(29))),
    oturum("e", "PACKAGE", once(9), sonuc(8, 8, 4, once(9))),
    oturum("f", "PACKAGE", once(29), sonuc(8, 8, 4, once(29))),
    oturum("g", "PACKAGE", once(29), sonuc(8, 8, 4, once(29))),
    oturum("a", "PACKAGE", once(-1), sonuc(8, 8, 4, once(-1))), // gözlem sonundan sonra: sayılmaz
  ];
  const h = k.huniHesapla(kullanicilar, oturumlar, SON);
  const adim = (a: string) => h.find((x) => x.anahtar === a) as Satir;
  check("kayıt 7", adim("kayit").sayi === 7);
  check("tanışma 6 (g tanışmadı)", adim("tanisma").sayi === 6 && adim("tanisma").taban === 7);
  check("ilk ölçüm 5: yarım ve boş test ölçüm değil (c düşer, b ikinci testiyle girer)", adim("ilkOlcum").sayi === 5 && adim("ilkOlcum").taban === 6);
  check(
    "2. hafta: e'nin haftası dolmadı → tabana girmez, 'erken'",
    adim("hafta2").taban === 4 && adim("hafta2").erken === 1,
    `taban ${adim("hafta2").taban}, erken ${adim("hafta2").erken}`
  );
  check("2. hafta etkin: a (alıştırma) ve f (son görülme); b ve d değil", adim("hafta2").sayi === 2, String(adim("hafta2").sayi));
  check("3. hafta+: a (son görülme dün); f'nin son görülmesi 2. haftada", adim("hafta3").sayi === 1 && adim("hafta3").taban === 2);
  check("kayda göre taban: haftası dolanlar", adim("hafta2").kayitTabani === 6 && adim("hafta3").kayitTabani === 6);
  const bos = k.huniHesapla([], [], SON);
  check("boş veride sıfırlar, hata yok", bos.length === 5 && bos.every((x) => x.sayi === 0));
}

console.log("\nTestler ve yarım test:");
{
  const t = (status: string, endedBy: string | null, s: Satir | null, kind = "PACKAGE") => ({ kind, status, endedBy, sonuc: s });
  const d = k.testDurumlari([
    t("SUBMITTED", "STUDENT", sonuc(10, 5, 5, SON)),
    t("SUBMITTED", null, sonuc(10, 5, 5, SON)), // eski kayıt: öğrenci bitirmiş sayılır
    t("SUBMITTED", "TIMEOUT", sonuc(2, 1, 17, SON)), // yarım
    t("SUBMITTED", "TIMEOUT", sonuc(9, 3, 8, SON)), // %60 işaretli: yarım değil
    t("SUBMITTED", "RESTART", sonuc(0, 0, 20, SON)), // hiç işaretsiz (yarım sayılmaz, çift sayım yok)
    t("SUBMITTED", "STUDENT", sonuc(1, 0, 19, SON)), // öğrenci bitirdi: boş olsa da ölçüm
    t("EXPIRED", null, null),
    t("IN_PROGRESS", null, null),
    t("ABANDONED", null, null, "LEVEL_STAGE"),
    t("SUBMITTED", null, null, "PRACTICE"), // alıştırma test değil
  ]);
  check("başlayan 9 (alıştırma yok)", d.baslayan === 9, String(d.baslayan));
  check("öğrencinin bitirdiği 3 (eski kayıt dahil)", d.ogrenciBitirdi === 3, String(d.ogrenciBitirdi));
  check("süresi dolan 3 (puanlanamayan EXPIRED dahil)", d.suresiDoldu === 3, String(d.suresiDoldu));
  check("yeniden başlatılan 1, süren 1, bırakılan 1", d.yenidenBaslatildi === 1 && d.suruyor === 1 && d.birakildi === 1);
  check("kapanışlar başlayanı tam böler", d.ogrenciBitirdi + d.suresiDoldu + d.yenidenBaslatildi + d.suruyor + d.birakildi === d.baslayan);
  check("yarım kalan 1, hiç işaretlenmeyen 1", d.yarimKaldi === 1 && d.isaretsiz === 1, `${d.yarimKaldi} / ${d.isaretsiz}`);
  check("ölçüm sayılan 4", d.olcumSayilan === 4, String(d.olcumSayilan));

  const kalem = (sira: number, isaretli: boolean, dk: number | null) => ({
    sira,
    isaretli,
    an: dk === null ? null : new Date(SON.getTime() + dk * 60_000),
  });
  const yer = k.birakmaYeri([kalem(3, true, 1), kalem(1, true, 2), kalem(2, false, null), kalem(4, false, null)]);
  check("bıraktığı yer: en son işaretlenen (zamana göre), sıradaki yeri", yer?.yer === 1 && yer?.toplam === 4, JSON.stringify(yer));
  const zamansiz = k.birakmaYeri([kalem(0, true, null), kalem(5, true, null), kalem(9, false, null)]);
  check("zaman yoksa en ileri işaretli sıra", zamansiz?.yer === 2 && zamansiz?.toplam === 3, JSON.stringify(zamansiz));
  const yirmi = (son: number) => Array.from({ length: 20 }, (_, i) => kalem(i, i < son, i < son ? i : null));
  const dag = k.birakmaDagilimi([yirmi(3), yirmi(5), yirmi(9), yirmi(15), Array.from({ length: 4 }, (_, i) => kalem(i, false, null))]);
  check("çeyrekler: 3/20 ve 5/20 ilk, 9/20 ikinci, 15/20 üçüncü", dag.ceyrekler.join(",") === "2,1,1,0", dag.ceyrekler.join(","));
  check("hiç işaretsiz yarım test çeyreğe girmez", dag.hicIsaretsiz === 1);
}

console.log("\nÖdev özeti:");
{
  const o = k.odevOzeti([
    { ogrenci: "a", tamamlandi: true },
    { ogrenci: "a", tamamlandi: false },
    { ogrenci: "b", tamamlandi: false },
  ]);
  check("öğrenci ve çift sayıları", o.odevli === 2 && o.tamamlayan === 1 && o.atama === 3 && o.tamamlanan === 1);
}

console.log("\nÖğrenme kazancı:");
const konu = (topicId: string, asked: number, correct: number) => ({ topicId, name: "Konu " + topicId, asked, correct });
const olc = (userId: string, gun: number, konular: Satir[], ek: Satir = {}) => ({
  userId,
  kind: "PACKAGE",
  endedBy: "STUDENT",
  correctCount: 10,
  wrongCount: 5,
  blankCount: 0,
  relaxedExposureCount: 0,
  packageId: "p1",
  packageKind: "STANDARD",
  an: once(gun),
  konular,
  ...ek,
});
{
  const e = k.kazancEslestir(
    [
      olc("u1", 20, [konu("t1", 4, 1), konu("t2", 2, 0)]),
      olc("u1", 10, [konu("t1", 3, 2), konu("t2", 4, 4)]),
      olc("u1", 5, [konu("t1", 4, 4)]),
    ],
    []
  );
  const t1 = e.find((x) => x.topicId === "t1");
  check("ilk ve SON ölçüm eşleşir (ortadaki atlanır)", !!t1 && Math.round(t1.fark) === 75, String(t1?.fark));
  check("3 soru şartı: 2 soruluk ölçüm sayılmaz, tek ölçüm kalan konu eşleşmez", !e.some((x) => x.topicId === "t2"));

  const tekrar = k.kazancEslestir(
    [olc("u1", 20, [konu("t1", 4, 1)]), olc("u1", 10, [konu("t1", 4, 4)], { relaxedExposureCount: 2 })],
    []
  );
  check("tekrar soru gelen ölçüm dışarıda (hafızayı ölçer)", tekrar.length === 0);

  const deneme = k.kazancEslestir(
    [
      olc("u1", 20, [konu("t1", 4, 1)], { packageId: "d1", packageKind: "MOCK" }),
      olc("u1", 10, [konu("t1", 4, 4)], { packageId: "d1", packageKind: "MOCK" }),
    ],
    []
  );
  check("aynı denemenin ikinci çözümü dışarıda", deneme.length === 0);
  const oncekiDeneme = k.kazancEslestir(
    [olc("u1", 20, [konu("t1", 4, 1)], { packageId: "d1", packageKind: "MOCK" }), olc("u1", 10, [konu("t1", 4, 4)])],
    [],
    [{ userId: "u1", packageId: "d1" }]
  );
  check("dönemden önce çözülmüş deneme de tekrar sayılır", oncekiDeneme.length === 0);

  const yarim = k.kazancEslestir(
    [olc("u1", 20, [konu("t1", 4, 1)]), olc("u1", 10, [konu("t1", 4, 4)], { endedBy: "TIMEOUT", correctCount: 2, wrongCount: 1, blankCount: 17 })],
    []
  );
  check("yarım kalan test ölçüm değil", yarim.length === 0);
  const seviyeli = k.kazancEslestir([olc("u1", 20, [konu("t1", 4, 1)]), olc("u1", 10, [konu("t1", 4, 4)], { kind: "LEVEL_STAGE" })], []);
  check("seviyeli aşama kazanca girmez", seviyeli.length === 0);
  const kontrol = k.kazancEslestir([olc("u1", 20, [konu("t1", 4, 1)]), olc("u1", 10, [konu("t1", 5, 5)], { kind: "TOPIC_RETEST" })], []);
  check("kontrol testi son ölçüm olabilir", kontrol.length === 1);
}

console.log("\nPlanına giren / girmeyen:");
{
  // Ölçümler pazartesi 01:00 Türkiye (pazar 22:00 UTC) ve iki hafta sonra.
  const ilk = new Date("2026-10-04T22:00:00Z"); // 5 Ekim pazartesi 01:00 TR
  const son = new Date("2026-10-19T12:00:00Z");
  const iki = (userId: string, topicId: string) => [
    { ...olc(userId, 0, [konu(topicId, 4, 1)]), an: ilk },
    { ...olc(userId, 0, [konu(topicId, 4, 3)]), an: son },
  ];
  const hafta = (gun: string) => new Date(gun + "T00:00:00.000Z"); // @db.Date
  const e = k.kazancEslestir(
    [...iki("u1", "t1"), ...iki("u1", "t2"), ...iki("u1", "t3"), ...iki("u2", "t1")],
    [
      { userId: "u1", topicId: "t1", weekStart: hafta("2026-10-05") }, // ilk ölçümün haftası (pazartesi gecesi)
      { userId: "u1", topicId: "t2", weekStart: hafta("2026-09-28") }, // ilk ölçümden önce bitti
      { userId: "u1", topicId: "t3", weekStart: hafta("2026-10-26") }, // son ölçümden sonra
    ]
  );
  const p = (u: string, t: string) => e.find((x) => x.userId === u && x.topicId === t)?.planda;
  check("ilk ölçümün haftasındaki plan (pazartesi 00:00-03:00 dahil) → planda", p("u1", "t1") === true);
  check("ilk ölçümden önce biten plan → plan dışı", p("u1", "t2") === false);
  check("son ölçümden sonra kurulan plan → plan dışı", p("u1", "t3") === false);
  check("başka öğrencinin planı sayılmaz", p("u2", "t1") === false);
}

console.log("\nÖzet ve 10 öğrenci şartı:");
{
  const eslesme = (u: number, fark: number, planda: boolean, topicId = "t1") => ({
    userId: "u" + u,
    topicId,
    name: "Konu " + topicId,
    ilkOran: 0.3,
    sonOran: 0.3 + fark / 100,
    fark,
    planda,
  });
  const dokuz = Array.from({ length: 9 }, (_, i) => eslesme(i, 20, true));
  const az = k.kazancOzeti(dokuz);
  check("9 öğrenci: ortalama yok (veri yetersiz)", az.planda.ortalama === null && !az.planda.yeterli && az.planda.ogrenci === 9);
  check("fark da yazılmaz", az.fark === null);
  const on = [...Array.from({ length: 10 }, (_, i) => eslesme(i, 20, true)), ...Array.from({ length: 10 }, (_, i) => eslesme(i + 10, 5, false))];
  const z = k.kazancOzeti(on);
  check("10 öğrenci: ortalama yazılır", z.planda.ortalama === 20 && z.planDisi.ortalama === 5);
  check("asıl kanıt: fark +15 puan", z.fark === 15, String(z.fark));
  check("anlamlı artış eşiği (" + k.ANLAMLI_ARTIS_PUAN + " puan)", z.planda.anlamliArtis === 10 && z.planDisi.anlamliArtis === 0);
  check("hepsi: 20 öğrenci, ortalama 12,5", z.hepsi.ogrenci === 20 && z.hepsi.ortalama === 12.5);
  const ayniOgrenci = k.kazancOzeti(Array.from({ length: 12 }, (_, i) => eslesme(1, 10, true, "t" + i)));
  check("öğrenci sayısı farklı öğrenciden (12 konu, 1 öğrenci → yetersiz)", ayniOgrenci.hepsi.ogrenci === 1 && ayniOgrenci.hepsi.ortalama === null);
  check("konu başına satır", ayniOgrenci.konular.length === 12);
}

console.log("\nEk göstergeler, zorluk algısı, kaynak, havuz:");
{
  const kt = (focus: string, level: string | null, ek: Satir = {}) => ({
    userId: "u" + focus,
    kind: "TOPIC_RETEST",
    endedBy: "STUDENT",
    correctCount: 4,
    wrongCount: 1,
    blankCount: 0,
    focusTopicId: focus,
    konular: [{ topicId: focus, name: "K", asked: 5, correct: 4, level }],
    ...ek,
  });
  const kont = k.kontrolTestleri([kt("a", "STRONG"), kt("b", "MEDIUM"), kt("c", "STRONG", { correctCount: 0, wrongCount: 0, blankCount: 5 })]);
  check("kontrol testi: güçlü = geçti, boş test sayılmaz", kont.olculen === 2 && kont.gecen === 1 && kont.ogrenci === 2, JSON.stringify(kont));

  const algi = (paket: string, a: number, d: number, ek: Satir = {}) => ({
    userId: "u" + Math.random(),
    packageId: paket,
    paketAdi: "Paket " + paket,
    kind: "PACKAGE",
    endedBy: "STUDENT",
    correctCount: d,
    wrongCount: 10 - d,
    blankCount: 0,
    algi: a,
    ...ek,
  });
  const z = k.zorlukAlgisi([
    ...[1, 1, 2, 3, 3].map((a, i) => algi("p", a, 5 + i)),
    algi("p", 2, 0, { endedBy: "TIMEOUT", correctCount: 1, wrongCount: 0, blankCount: 19 }), // yarım: sayılmaz
    ...[1, 2, 3, 2].map((a) => algi("q", a, 5)),
  ]);
  check("5 cevaplı paket görünür, 4 cevaplı gizli", z.paketler.length === 1 && z.paketler[0].packageId === "p" && z.gizlenen === 1);
  check("yarım testin cevabı sayılmaz", z.paketler[0].cevap === 5);
  check("kategori doğru oranı aynı testlerden", z.paketler[0].kategoriler[0].cevap === 2 && z.paketler[0].kategoriler[0].dogru === 11);

  const kay = k.kaynakDagilimi([
    { signupSource: "hero", ilkOlcum: true },
    { signupSource: "hero", ilkOlcum: false },
    { signupSource: null, ilkOlcum: true },
    { signupSource: "bilinmeyen-etiket", ilkOlcum: false },
    { signupSource: "blog", ilkOlcum: true },
  ]);
  const hero = kay.find((x) => x.kaynak === "hero");
  check("kaynak başına kayıt ve ilk ölçüm", hero?.kayit === 2 && hero?.olcum === 1);
  check("boş ve izin listesi dışı etiket 'bilinmiyor'", kay.find((x) => x.kaynak === "bilinmiyor")?.kayit === 2);

  const h = k.onceYazilacaklar([
    { topicId: "a", oturum: 10, tekrarli: 5, yayinda: 30 },
    { topicId: "b", oturum: 4, tekrarli: 4, yayinda: 3 }, // az oturum: gürültü
    { topicId: "c", oturum: 20, tekrarli: 10, yayinda: 12 },
    { topicId: "d", oturum: 30, tekrarli: 0, yayinda: 5 },
    { topicId: "e", oturum: 10, tekrarli: 8, yayinda: 40 },
  ]);
  check("önce yazılacaklar: oran sırası, eşitlikte az soru önde", h.map((x) => x.topicId).join(",") === "e,c,a", h.map((x) => x.topicId).join(","));
}

console.log("\nPilot sonu raporu:");
{
  const s = k.pilotSuzgeci({}, SON);
  const grup = { ogrenci: 3, eslesme: 3, yeterli: false, ortalama: null, anlamliArtis: 1 };
  const veri = {
    suzgec: s,
    grupAdi: null,
    huni: k.huniHesapla([], [], SON),
    testler: k.testDurumlari([]),
    birakma: k.birakmaDagilimi([]),
    ozellik: { etkin: 12, satirlar: [{ anahtar: "kocaSoru", sayi: 2 }], odev: k.odevOzeti([]) },
    kazanc: { hepsi: grup, planda: grup, planDisi: grup, fark: null, konular: [] },
    ek: { kontrol: { olculen: 0, gecen: 0, ogrenci: 0 }, defter: { toplam: 7, cikan: 6, ogrenci: 7 }, ipucu: { dogru: 0, ipucuyla: 0, ogrenci: 0 } },
    algi: { paketler: [], gizlenen: 0, ogrenci: 0 },
    kaynak: k.kaynakDagilimi([{ signupSource: "hero", ilkOlcum: true }]),
    testOgrenci: 0,
  };
  const md = r.pilotRaporu(veri, { olusturma: SON, adres: "/checkup/pilot/rapor.md" });
  check("başında 'kişisel veri içermez' notu", md.split("\n").slice(0, 4).join("\n").includes(r.RAPOR_NOTU) && r.RAPOR_NOTU.includes("kişisel veri içermez"));
  check("küçük sayı raporda da <5", md.includes("| Koça soru soran | <5 | — |"));
  check("az veride 'veri yetersiz'", md.includes("veri yetersiz (<5 öğrenci)"));
  check("bütün bölümler var", ["## 1. Huni", "## 2. Testler", "## 3. Özellik", "## 4. Öğrenme", "## 5. Öğrencinin", "## 6. Kayıt"].every((b) => md.includes(b)));
  check("e-posta biçiminde metin yok", !/@[a-z0-9-]+\./i.test(md));
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
