import "./_koruma.mjs";
/**
 * Deneme sınavı, kâğıtta çözme ve süre analizi — saf kurallar + uçtan uca akış.
 *
 *   npx tsx scripts/deneme-test.mts
 *
 * Denetlenenler:
 *  - Deneme seçimi: sorular sabit listeden, (sortOrder, id) sırasıyla; 30 günlük
 *    tekrar engeli uygulanmıyor; liste eksik ya da taslak soru varsa "hazırlanıyor".
 *  - Yüzdelik dilim: havuz kişi başına İLK, EKRANDA, puanlanmış oturum; eşik 10;
 *    kâğıt ve tekrar havuza girmez; başkasının kimliği çıktıda yok.
 *  - Süre analizi (saf): takılma, çözüm sırası (sıralı / turlama / atlama),
 *    yarılar, son 10 dakika, uzun süre boş, eski satırda sıra atlanır.
 *  - Kâğıt akışı: 48 saat, süre 0 yazılır, ilk işaret tutulmaz, kitapçık sızıntısız
 *    ve yalnızca sahibine; süresi dolan kâğıt bakımda puanlanır.
 *  - Ekranda ilk işaret anı (firstAnsweredAt) yalnızca bir kez yazılır.
 *
 * Geçici bir veritabanında koşturulmalı (tohumlar: db:seed, db:seed:demo).
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import {
  CheckupError,
  denemeHavuzu,
  denemeKarsilastirmasi,
  expireStaleSessions,
  getKitapcik,
  getStudentSession,
  KAYIT_TOLERANSI_MS,
  saveAnswer,
  startCheckup,
  submitCheckup,
  sureAnaliziGetir,
} from "../lib/checkup";
import { groupCatalog, loadCatalog, siradakiPaketler } from "../lib/catalog";
import {
  DENEME_HAZIRLANIYOR,
  KAGIT_ISLEME_SURESI_SAAT,
  KARSILASTIRMA_ESIGI,
  aralikGenisligi,
  cezaKurali,
  denemeHazirMi,
  kagittaCozulebilir,
  karsilastir,
  yuzdeSinden,
} from "../lib/deneme";
import { sureAnalizi, type SureMaddesi } from "../lib/sure-analizi";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

/**
 * Ret mesajı; ret yoksa null. Adla eşleştiriyoruz: tsx `@/lib/...` ile
 * `../lib/...` yollarını ayrı modül yüklüyor, `instanceof` tutmayabiliyor.
 */
async function hataVerir(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const beklenen = e instanceof CheckupError || (e instanceof Error && e.name === "CheckupError");
    return beklenen ? (e as Error).message : `BEKLENMEYEN: ${String(e)}`;
  }
}

const ANAHTAR_IZLERI = [
  "isCorrect",
  "is_correct",
  "errorType",
  "error_type",
  "answerKey",
  "solution",
  "hints",
  "videoUrl",
  "correct",
];

const ONEK = "deneme-test";
const PAKET = "deneme-test-tyt";
const SORU = 12;

async function kullanici(email: string, name = "Deneme Testi") {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: "TYT",
      onboardedAt: new Date(),
    },
    update: {},
    select: { id: true, email: true, name: true },
  });
}

const saniye = (s: number) => s * 1000;

// ─────────────────────────────────────────────────────────────
// Saf kurallar
// ─────────────────────────────────────────────────────────────

function safDeneme() {
  console.log("\nDeneme kuralları (saf):");
  check("liste tam ve yayında → hazır", denemeHazirMi({ toplam: 40, yayinda: 40 }, 40));
  check("eksik liste → hazır değil", !denemeHazirMi({ toplam: 39, yayinda: 39 }, 40));
  check("fazla liste → hazır değil", !denemeHazirMi({ toplam: 41, yayinda: 40 }, 40));
  check("taslak soru → hazır değil", !denemeHazirMi({ toplam: 40, yayinda: 39 }, 40));
  check("listesi hiç yok → hazır değil", !denemeHazirMi(undefined, 40));
  check("ceza metni 0.25", cezaKurali(0.25) === "4 yanlış 1 doğruyu götürür", cezaKurali(0.25));
  check("ceza metni 1/3", cezaKurali(1 / 3) === "3 yanlış 1 doğruyu götürür", cezaKurali(1 / 3));
  check("ceza metni 0", cezaKurali(0) === "Yanlış doğruyu götürmez", cezaKurali(0));
  check("kâğıt: katalog türleri", ["STANDARD", "INTRO", "MOCK"].every(kagittaCozulebilir));
  check("kâğıt: seviyeli, kontrol, alıştırma değil", !["LEVEL", "RETEST", "PRACTICE"].some(kagittaCozulebilir));
  check("kâğıt süresi 48 saat", KAGIT_ISLEME_SURESI_SAAT === 48);

  const genislik = [20, 40, 60, 15, 100, 200].map(aralikGenisligi).join(",");
  check("net aralığı genişliği okunur ve ≤10 aralık", genislik === "2,5,10,2,10,20", genislik);

  const ekler: [number, string][] = [
    [0, "%0'ından"],
    [3, "%3'ünden"],
    [6, "%6'sından"],
    [9, "%9'undan"],
    [10, "%10'undan"],
    [25, "%25'inden"],
    [33, "%33'ünden"],
    [40, "%40'ından"],
    [50, "%50'sinden"],
    [70, "%70'inden"],
    [100, "%100'ünden"],
  ];
  const yanlisEk = ekler.filter(([n, b]) => yuzdeSinden(n) !== b).map(([n]) => `${n}→${yuzdeSinden(n)}`);
  check("yüzde ekleri okunuşa uyuyor", yanlisEk.length === 0, yanlisEk.join(" "));

  console.log("\nYüzdelik dilim (saf):");
  const havuz = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, net: i * 4 }));
  const dokuz = karsilastir({ benimNet: 20, benimUserId: "ben", havuz: havuz(9), soruSayisi: 40 });
  check("9 kişide kapalı", !dokuz.acik && dokuz.katilimci === 9 && dokuz.esik === KARSILASTIRMA_ESIGI);
  check("eşik 10", KARSILASTIRMA_ESIGI === 10);

  // Havuz: 0,4,8,…,36 (10 kişi). Net 20 → 0,4,8,12,16 altında = 5/10, 20 eşit.
  const on = karsilastir({ benimNet: 20, benimUserId: "ben", havuz: havuz(10), soruSayisi: 40 });
  check("10 kişide açık", on.acik);
  if (on.acik) {
    check("yüzdelik: altındakiler / diğerleri (aşağı)", on.yuzdelik === 50, `%${on.yuzdelik}`);
    check("eşitler ayrı sayılıyor", on.esitYuzde === 10, `%${on.esitYuzde}`);
    check("dağılım toplamı katılımcı", on.araliklar.reduce((s, a) => s + a.sayi, 0) === 10);
    check("8 aralık (40 soru, genişlik 5)", on.araliklar.length === 8);
    check("senin aralığın işaretli", on.araliklar.filter((a) => a.benim).length === 1 && on.araliklar[4].benim);
    check("son aralık tam nete kadar", on.araliklar[7].ust === 40);
  }

  // Öğrencinin kendi kaydı havuzda: kendisiyle kıyaslanmaz.
  const kendi = karsilastir({
    benimNet: 36,
    benimUserId: "u9",
    havuz: havuz(10),
    soruSayisi: 40,
  });
  check("kendi kaydı hariç: en yüksek net → %100", kendi.acik && kendi.yuzdelik === 100 && kendi.karsilastirilan === 9);
  const tam = karsilastir({ benimNet: 40, benimUserId: "ben", havuz: havuz(10), soruSayisi: 40 });
  check("tam net son aralıkta", tam.acik && tam.araliklar[tam.araliklar.length - 1].benim);
  check("çıktıda kimlik yok", !JSON.stringify(on).includes("u3"));
}

function m(
  sira: number,
  sureSn: number,
  durum: SureMaddesi["durum"],
  ilkDk: number | null,
  baslangic: Date,
  hedefSn = 60
): SureMaddesi {
  const t = ilkDk === null ? null : new Date(baslangic.getTime() + ilkDk * 60_000);
  return {
    sira,
    sureMs: saniye(sureSn),
    hedefSn,
    durum,
    ilkIsaret: durum === "bos" ? null : t,
    sonIsaret: durum === "bos" ? null : t,
  };
}

function safSure() {
  console.log("\nSüre analizi (saf):");
  const b = new Date("2026-10-21T10:00:00Z");

  check("süresi hiç yok → analiz yok", sureAnalizi({ baslangic: b, sureDk: 30, bitis: null, maddeler: [m(0, 0, "bos", null, b)] }) === null);

  // Sıralı, dengeli.
  const sirali = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: new Date(b.getTime() + 28 * 60_000),
    maddeler: Array.from({ length: 10 }, (_, i) => m(i, 60, "dogru", 2 + i * 2.5, b)),
  });
  check("sıralı çözüm", sirali?.sira?.tur === "SIRALI" && sirali.sira.donulen === 0);
  check("takılma yok", sirali?.takilinanlar.length === 0);
  check("ortalama / hedef", sirali?.ortalamaMs === 60_000 && sirali.hedefOrtalamaMs === 60_000);
  check("dengeli → tek olumlu tavsiye", sirali?.tavsiyeler.length === 1 && sirali.tavsiyeler[0].ton === "ok", sirali?.tavsiyeler[0]?.metin);

  // Turlama: 0,1,3,4,6,7,8,9 ilk turda; 2 ve 5 sonra.
  const sirasi = [0, 1, 3, 4, 6, 7, 8, 9, 2, 5];
  const turlama = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: null,
    maddeler: sirasi.map((s, k) => m(s, 60, "dogru", 1 + k * 2, b)),
  });
  check("turlama", turlama?.sira?.tur === "TURLAMA" && turlama.sira.donulen === 2, JSON.stringify(turlama?.sira));
  check("turlama olumlu tavsiye", turlama?.tavsiyeler.some((t) => t.ton === "ok" && t.metin.includes("Turlayarak")) ?? false);

  // Atlayıp dönme: yalnızca 4 → 3.
  const atlama = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: null,
    maddeler: [0, 1, 2, 4, 3, 5, 6, 7].map((s, k) => m(s, 60, "dogru", 1 + k * 3, b)),
  });
  check("atlayıp dönme", atlama?.sira?.tur === "ATLAMALI" && atlama.sira.donulen === 1, JSON.stringify(atlama?.sira));

  // Eski satır: işaretli maddede ilk işaret yok → sıra atlanır, ötekiler çalışır.
  const eski = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: null,
    maddeler: Array.from({ length: 8 }, (_, i) => {
      const x = m(i, i === 2 ? 200 : 60, "dogru", 1 + i * 3, b);
      return { ...x, ilkIsaret: null };
    }),
  });
  check("eski satırda sıra analizi atlandı", eski !== null && eski.sira === null);
  check("eski satırda takılma yine bulundu", eski?.takilinanlar.length === 1 && eski.takilinanlar[0].sira === 2);
  check("eski satırda yarılar son değişiklikten", eski?.yarilar !== null && (eski?.yarilar?.ilk ?? 0) + (eski?.yarilar?.son ?? 0) === 8);

  // Takılma + uzun boş + ulaşılmayan + son 10 dakika yığılması.
  const kotu = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: new Date(b.getTime() + 30 * 60_000),
    maddeler: [
      m(0, 300, "yanlis", 5, b), // 5 dk: takıldı
      m(1, 90, "bos", null, b), // 90 sn harcayıp boş
      m(2, 40, "dogru", 21, b),
      m(3, 40, "dogru", 22, b),
      m(4, 40, "yanlis", 24, b),
      m(5, 40, "dogru", 26, b),
      m(6, 30, "yanlis", 28, b),
      m(7, 0, "bos", null, b), // hiç ulaşılmadı
      m(8, 0, "bos", null, b),
      m(9, 0, "bos", null, b),
    ],
  });
  check("takılınan soru (2× hedef)", kotu?.takilinanlar.length === 1 && kotu.takilinanlar[0].sira === 0);
  check("uzun süre boş", kotu?.uzunBoslar.length === 1 && kotu.uzunBoslar[0].sira === 1);
  check("sondan ulaşılmayan 3 soru", kotu?.ulasilmayan === 3, String(kotu?.ulasilmayan));
  check("son 10 dakikada 5 soru, 2 yanlış", kotu?.sonDakika?.sayi === 5 && kotu.sonDakika.yanlis === 2, JSON.stringify(kotu?.sonDakika));
  check("yarılar: 1 · 5", kotu?.yarilar?.ilk === 1 && kotu.yarilar.son === 5, JSON.stringify(kotu?.yarilar));
  check("en fazla 3 tavsiye", (kotu?.tavsiyeler.length ?? 0) >= 1 && (kotu?.tavsiyeler.length ?? 0) <= 3);
  check("ilk tavsiye takılma (öncelik)", kotu?.tavsiyeler[0]?.metin.startsWith("1. soruda 5 dk kaldın") ?? false, kotu?.tavsiyeler[0]?.metin);
  check(
    "tavsiyelerde sayı var",
    kotu?.tavsiyeler.every((t) => /\d/.test(t.metin)) ?? false
  );

  // Kısa test (8 dk): son 10 dakika ölçülmez.
  const kisa = sureAnalizi({
    baslangic: b,
    sureDk: 8,
    bitis: null,
    maddeler: Array.from({ length: 5 }, (_, i) => m(i, 60, "dogru", 1 + i, b)),
  });
  check("kısa testte son 10 dakika yok", kisa !== null && kisa.sonDakika === null);

  // Erken bitirip çok yanlış: kontrol tavsiyesi.
  const erken = sureAnalizi({
    baslangic: b,
    sureDk: 30,
    bitis: new Date(b.getTime() + 10 * 60_000),
    maddeler: Array.from({ length: 8 }, (_, i) => m(i, 50, i % 2 ? "yanlis" : "dogru", 1 + i, b)),
  });
  check("erken bitirme tavsiyesi", erken?.tavsiyeler.some((t) => t.metin.includes("Kalan süre kontrol içindir")) ?? false);
}

// ─────────────────────────────────────────────────────────────
// Veritabanı
// ─────────────────────────────────────────────────────────────

async function temizle() {
  const kullanicilar = await prisma.user.findMany({
    where: { email: { startsWith: `${ONEK}-` } },
    select: { id: true },
  });
  const ids = kullanicilar.map((u) => u.id);
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notebookItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.studyPlan.deleteMany({ where: { userId: { in: ids } } });
  const paket = await prisma.package.findUnique({ where: { slug: PAKET }, select: { id: true } });
  if (paket) {
    await prisma.checkupSession.deleteMany({ where: { packageId: paket.id } });
    await prisma.package.delete({ where: { id: paket.id } });
  }
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** Havuza doğrudan bir oturum + sonuç yazar (gerçek akış ayrıca test ediliyor). */
async function havuzaYaz(args: {
  userId: string;
  packageId: string;
  net: number;
  mode?: "ONLINE" | "PAPER";
  dakikaOnce: number;
  dogru?: number;
}) {
  const startedAt = new Date(Date.now() - args.dakikaOnce * 60_000);
  const dogru = args.dogru ?? Math.ceil(args.net);
  await prisma.checkupSession.create({
    data: {
      userId: args.userId,
      packageId: args.packageId,
      mode: args.mode ?? "ONLINE",
      status: "SUBMITTED",
      durationMinutes: 20,
      penaltyRatio: 0.25,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 20 * 60_000),
      submittedAt: new Date(startedAt.getTime() + 19 * 60_000),
      result: {
        create: {
          correctCount: dogru,
          wrongCount: 0,
          blankCount: SORU - dogru,
          netScore: args.net.toFixed(2),
          totalTimeMs: 0,
          topicBreakdown: { topics: [], groups: [] },
          examScope: "TYT",
        },
      },
    },
  });
}

async function anahtar(questionIds: string[]) {
  const satirlar = await prisma.choice.findMany({
    where: { questionId: { in: questionIds }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  return new Map(satirlar.map((s) => [s.questionId, s.id]));
}

async function main() {
  safDeneme();
  safSure();

  await temizle();

  const ben = await kullanici(`${ONEK}-ben@kocum.local`, "Deneme Ben");
  const diger = await kullanici(`${ONEK}-diger@kocum.local`, "Gizli Ad Soyad");

  // ── Deneme paketi: 12 soru, sabit liste ────────────────────
  console.log("\nDeneme seçimi:");
  const sorular = await prisma.question.findMany({
    where: { status: "PUBLISHED", topic: { examScope: "TYT" } },
    orderBy: { id: "asc" },
    take: SORU + 1,
    select: { id: true },
  });
  check("tohumda yeterli soru var", sorular.length === SORU + 1, String(sorular.length));
  const liste = sorular.slice(0, SORU);
  const yedek = sorular[SORU];

  const paket = await prisma.package.create({
    data: {
      slug: PAKET,
      name: "Deneme Testi TYT",
      kind: "MOCK",
      examScope: "TYT",
      questionCount: SORU,
      durationMinutes: 20,
      penaltyRatio: 0.25,
      status: "PUBLISHED",
      isFree: true,
      // Sıra kasıtlı ters ve ilk ikisinde eşit sortOrder: sıra (sortOrder, id).
      questions: {
        create: liste.map((q, i) => ({ questionId: q.id, sortOrder: i < 2 ? 0 : SORU - i })),
      },
    },
    select: { id: true },
  });
  const beklenenSira = (
    await prisma.packageQuestion.findMany({
      where: { packageId: paket.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { questionId: true },
    })
  ).map((p) => p.questionId);

  // Başka öğrenci bu soruları az önce görmüş: tekrar engeli denemede uygulanmaz.
  await prisma.questionExposure.createMany({
    data: liste.map((q) => ({ userId: diger.id, questionId: q.id, lastShownAt: new Date() })),
  });

  const benId = await startCheckup(ben.id, PAKET);
  const benOturum = await getStudentSession(benId, ben.id);
  check(
    "sorular sabit listeden, (sortOrder, id) sırasıyla",
    benOturum.questions.map((q) => q.id).join() === beklenenSira.join()
  );
  const digerId = await startCheckup(diger.id, PAKET);
  const digerOturum = await getStudentSession(digerId, diger.id);
  check(
    "30 günlük tekrar engeli uygulanmıyor (aynı sorular, aynı sıra)",
    digerOturum.questions.map((q) => q.id).join() === beklenenSira.join()
  );
  const kopya = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: benId },
    select: { penaltyRatio: true, durationMinutes: true, mode: true, relaxedExposureCount: true },
  });
  check(
    "puanlama ayarı paketten kopyalandı",
    Number(kopya.penaltyRatio) === 0.25 && kopya.durationMinutes === 20 && kopya.mode === "ONLINE"
  );
  check("deneme oturumunda sızıntı yok", !ANAHTAR_IZLERI.some((k) => JSON.stringify(benOturum).includes(k)));

  // Katalog: denemeler yalnızca istenince, kendi bölümünde, öneri değil.
  const katalog = await loadCatalog(ben.id, new Date(), { scope: "TYT", denemeler: true });
  const kart = katalog.find((p) => p.slug === PAKET);
  check("katalogda deneme kartı (hazır, ceza oranı)", kart?.isMock === true && kart.hazir === true && kart.penaltyRatio === 0.25);
  check(
    "pano kataloğunda deneme yok",
    !(await loadCatalog(ben.id, new Date(), { scope: "TYT" })).some((p) => p.slug === PAKET)
  );
  check("deneme 'sıradaki adım' önerisi olmuyor", !siradakiPaketler(katalog, 50).some((p) => p.isMock));
  const kartAcikDegil = katalog.map((p) => (p.slug === PAKET ? { ...p, inProgress: false } : p));
  check(
    "deneme kendi bölümünde",
    groupCatalog(kartAcikDegil).find((g) => g.key === "deneme")?.items.some((p) => p.slug === PAKET) ?? false
  );

  // Hazır değilse başlamaz: eksik liste ve taslak soru.
  await prisma.checkupSession.deleteMany({ where: { packageId: paket.id } });
  const ilkSatir = await prisma.packageQuestion.findFirstOrThrow({
    where: { packageId: paket.id },
    orderBy: { id: "asc" },
    select: { id: true, questionId: true, sortOrder: true },
  });
  await prisma.packageQuestion.delete({ where: { id: ilkSatir.id } });
  const eksik = await hataVerir(() => startCheckup(ben.id, PAKET));
  check("eksik liste → 'hazırlanıyor' ile reddedildi", eksik === DENEME_HAZIRLANIYOR, String(eksik));
  const eksikKart = (await loadCatalog(ben.id, new Date(), { scope: "TYT", denemeler: true })).find((p) => p.slug === PAKET);
  check("katalogda 'hazırlanıyor'", eksikKart?.hazir === false);

  await prisma.packageQuestion.create({
    data: { packageId: paket.id, questionId: ilkSatir.questionId, sortOrder: ilkSatir.sortOrder },
  });
  await prisma.question.update({ where: { id: liste[5].id }, data: { status: "DRAFT" } });
  const taslak = await hataVerir(() => startCheckup(ben.id, PAKET));
  check("taslak soru → 'hazırlanıyor' ile reddedildi", taslak === DENEME_HAZIRLANIYOR, String(taslak));
  await prisma.question.update({ where: { id: liste[5].id }, data: { status: "PUBLISHED" } });

  await prisma.packageQuestion.create({ data: { packageId: paket.id, questionId: yedek.id, sortOrder: 99 } });
  const fazla = await hataVerir(() => startCheckup(ben.id, PAKET));
  check("fazla soru → 'hazırlanıyor' ile reddedildi", fazla === DENEME_HAZIRLANIYOR, String(fazla));
  await prisma.packageQuestion.deleteMany({ where: { packageId: paket.id, questionId: yedek.id } });

  // ── Yüzdelik eşiği ve havuz ────────────────────────────────
  console.log("\nKarşılaştırma havuzu:");
  const havuzKullanicilari = [];
  for (let i = 0; i < 9; i++) havuzKullanicilari.push(await kullanici(`${ONEK}-h${i}@kocum.local`, `Havuz Kişi ${i}`));
  // 8 kişi ekranda, ilk denemesi puanlanmış.
  for (let i = 0; i < 8; i++) {
    await havuzaYaz({ userId: havuzKullanicilari[i].id, packageId: paket.id, net: i + 1, dakikaOnce: 300 - i });
  }
  // İkinci denemesi olan biri: yalnızca ilki (net 1) sayılmalı.
  await havuzaYaz({ userId: havuzKullanicilari[0].id, packageId: paket.id, net: 11.75, dakikaOnce: 100 });
  // İlk oturumu kâğıt olan biri: sonraki ekran oturumu da sayılmaz.
  const kagitci = await kullanici(`${ONEK}-kagitci@kocum.local`);
  await havuzaYaz({ userId: kagitci.id, packageId: paket.id, net: 5, mode: "PAPER", dakikaOnce: 200 });
  await havuzaYaz({ userId: kagitci.id, packageId: paket.id, net: 9, dakikaOnce: 50 });
  // Boş gönderilen deneme ("cevaplara bakayım"): sayılmaz.
  const bosci = await kullanici(`${ONEK}-bosci@kocum.local`);
  await havuzaYaz({ userId: bosci.id, packageId: paket.id, net: 0, dogru: 0, dakikaOnce: 150 });

  check("havuz: kişi başına ilk, ekranda, işaretli", (await denemeHavuzu(paket.id)).length === 8);

  // Ben: gerçek akışla ekranda çözüp bitiriyorum → 9 kişi (eşik altı).
  const benIlk = await startCheckup(ben.id, PAKET);
  const benSorular = (await getStudentSession(benIlk, ben.id)).questions;
  const anahtarlar = await anahtar(benSorular.map((q) => q.id));
  for (const [i, q] of benSorular.entries()) {
    if (i >= 9) break; // 9 doğru, 3 boş → net 9
    await saveAnswer({ sessionId: benIlk, userId: ben.id, questionId: q.id, choiceId: anahtarlar.get(q.id)!, timeSpentMs: 40_000 });
  }
  await submitCheckup(benIlk, ben.id);
  const dokuzKisi = await denemeKarsilastirmasi(benIlk, ben.id);
  check(
    "9 kişide karşılaştırma kapalı, sayı söyleniyor",
    dokuzKisi !== null && !dokuzKisi.acik && dokuzKisi.katilimci === 9,
    JSON.stringify(dokuzKisi && { acik: dokuzKisi.acik, katilimci: dokuzKisi.katilimci })
  );

  await havuzaYaz({ userId: havuzKullanicilari[8].id, packageId: paket.id, net: 12, dakikaOnce: 30 });
  const onKisi = await denemeKarsilastirmasi(benIlk, ben.id);
  check("10 kişide açılıyor", onKisi?.acik === true && onKisi.katilimci === 10);
  if (onKisi?.acik) {
    // Diğerleri: 1..8 ve 12; net 9'dan düşük olan 8 kişi → 8/9 = %88.
    check("yüzdelik doğru (kendi kaydı hariç)", onKisi.yuzdelik === 88 && onKisi.karsilastirilan === 9, `%${onKisi.yuzdelik}`);
    check("ilk ekran denemesi havuzda", onKisi.havuzda && !onKisi.kagit);
    const json = JSON.stringify(onKisi);
    const izler = [...havuzKullanicilari.map((u) => u.id), ...havuzKullanicilari.map((u) => u.email), "Havuz Kişi", diger.id];
    check("çıktıda başkasının kimliği/adı yok", !izler.some((x) => json.includes(x)));
  }

  // Tekrar çözüm: havuza girmez, konumu gösterilir.
  const benIkinci = await startCheckup(ben.id, PAKET);
  await submitCheckup(benIkinci, ben.id);
  const ikinci = await denemeKarsilastirmasi(benIkinci, ben.id);
  check("ikinci deneme havuzda değil", ikinci !== null && !ikinci.havuzda && ikinci.katilimci === 10);

  // Kâğıt: havuza girmez, konumu gösterilir.
  const kagitOgrenci = await kullanici(`${ONEK}-kagit@kocum.local`);
  const kagitId = await startCheckup(kagitOgrenci.id, PAKET, { mode: "PAPER" });
  const kagitSorular = (await getStudentSession(kagitId, kagitOgrenci.id)).questions;
  for (const q of kagitSorular.slice(0, 6)) {
    await saveAnswer({ sessionId: kagitId, userId: kagitOgrenci.id, questionId: q.id, choiceId: anahtarlar.get(q.id)!, timeSpentMs: 0 });
  }
  await submitCheckup(kagitId, kagitOgrenci.id);
  const kagitKars = await denemeKarsilastirmasi(kagitId, kagitOgrenci.id);
  check(
    "kâğıt oturumu havuza girmiyor ama konumu var",
    kagitKars?.kagit === true && !kagitKars.havuzda && kagitKars.acik && kagitKars.katilimci === 10
  );
  check("başkasının oturumunda karşılaştırma yok", (await denemeKarsilastirmasi(kagitId, ben.id)) === null);

  // ── Kâğıt akışı uçtan uca ──────────────────────────────────
  console.log("\nKâğıt akışı:");
  await prisma.checkupSession.deleteMany({ where: { userId: ben.id, package: { slug: "tyt-ilk-15" } } });
  const once = Date.now();
  const kId = await startCheckup(ben.id, "tyt-ilk-15", { mode: "PAPER" });
  const kOturum = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: kId },
    select: { mode: true, expiresAt: true, durationMinutes: true },
  });
  const sapma = Math.abs(kOturum.expiresAt.getTime() - (once + KAGIT_ISLEME_SURESI_SAAT * 3_600_000));
  check("kâğıt oturumu açıldı, son an 48 saat sonra", kOturum.mode === "PAPER" && sapma < 60_000, `${Math.round(sapma / 1000)} sn sapma`);
  check(
    "açık kâğıt varken ekran isteği aynı oturuma döner",
    (await startCheckup(ben.id, "tyt-ilk-15", { mode: "ONLINE" })) === kId
  );

  const kSession = await getStudentSession(kId, ben.id);
  check("öğrenci verisinde biçim PAPER", kSession.mode === "PAPER");
  check("kâğıt oturumu verisinde sızıntı yok", !ANAHTAR_IZLERI.some((k) => JSON.stringify(kSession).includes(k)));

  const kitapcik = await getKitapcik(kId, ben.id);
  const kitapcikJson = JSON.stringify(kitapcik);
  check("kitapçıkta 15 soru, sıra oturumla aynı", kitapcik.questions.length === 15 && kitapcik.questions.every((q, i) => q.order === kSession.questions[i].order));
  check("kitapçıkta sızıntı yok", !ANAHTAR_IZLERI.some((k) => kitapcikJson.includes(k)));
  check("kitapçıkta şık kimliği yok", !kitapcik.questions.some((q) => q.choices.some((c) => "id" in c)));
  check("kitapçıkta öğrenci adı", kitapcik.studentName === ben.name);
  check("başkası kitapçığı açamıyor", (await hataVerir(() => getKitapcik(kId, diger.id))) !== null);
  check("ekran oturumunun kitapçığı yok", (await hataVerir(() => getKitapcik(benIlk, ben.id))) !== null);

  const kAnahtar = await anahtar(kSession.questions.map((q) => q.id));
  for (const [i, q] of kSession.questions.entries()) {
    if (i >= 10) break;
    const dogru = kAnahtar.get(q.id)!;
    const secim = i < 7 ? dogru : q.choices.find((c) => c.id !== dogru)!.id;
    // İstemci süre gönderse de kâğıtta 0 yazılır.
    await saveAnswer({ sessionId: kId, userId: ben.id, questionId: q.id, choiceId: secim, timeSpentMs: 90_000 });
  }
  const kCevaplar = await prisma.answer.findMany({
    where: { sessionItem: { sessionId: kId } },
    select: { timeSpentMs: true, firstAnsweredAt: true },
  });
  check("kâğıtta süre 0 yazıldı", kCevaplar.length === 10 && kCevaplar.every((c) => c.timeSpentMs === 0));
  check("kâğıtta ilk işaret anı tutulmadı", kCevaplar.every((c) => c.firstAnsweredAt === null));

  const kSkor = await submitCheckup(kId, ben.id, Object.fromEntries(kSession.questions.map((q) => [q.id, 120_000])));
  check("puanlandı: 7 doğru, 3 yanlış, 5 boş", kSkor.correctCount === 7 && kSkor.wrongCount === 3 && kSkor.blankCount === 5);
  check("bitirmedeki süre haritası yok sayıldı", kSkor.totalTimeMs === 0);
  check("konu kırılımında 'yavaş' yok", kSkor.topicBreakdown.topics.every((t) => !t.slow));
  check("kâğıtta süre analizi yok", (await sureAnaliziGetir(kId, ben.id)) === null);
  check("gönderilen kâğıdın kitapçığı hâlâ açılıyor (cevapsız)", (await getKitapcik(kId, ben.id)).status === "SUBMITTED");

  // Süresi dolan kâğıt: bakım işi işaretlenenlerle puanlar.
  await prisma.checkupSession.deleteMany({ where: { userId: diger.id } });
  const dId = await startCheckup(diger.id, "tyt-ilk-15", { mode: "PAPER" });
  const dSorular = (await getStudentSession(dId, diger.id)).questions;
  await saveAnswer({ sessionId: dId, userId: diger.id, questionId: dSorular[0].id, choiceId: dSorular[0].choices[0].id, timeSpentMs: 0 });
  await prisma.checkupSession.update({
    where: { id: dId },
    data: { expiresAt: new Date(Date.now() - KAYIT_TOLERANSI_MS - 5_000) },
  });
  await expireStaleSessions();
  const dSonuc = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: dId },
    select: { status: true, result: { select: { blankCount: true, correctCount: true, wrongCount: true } } },
  });
  check(
    "süresi dolan kâğıt bakımda puanlandı, boşlar boş",
    dSonuc.status === "SUBMITTED" && dSonuc.result?.blankCount === 14 && (dSonuc.result.correctCount + dSonuc.result.wrongCount) === 1,
    JSON.stringify(dSonuc)
  );
  check(
    "seviyeli check-up kâğıtta açılmıyor",
    (await hataVerir(() => startCheckup(ben.id, "tyt-seviyeli", { mode: "PAPER" }))) !== null
  );

  // ── Ekranda ilk işaret anı ─────────────────────────────────
  console.log("\nİlk işaret anı (ekranda):");
  await prisma.checkupSession.deleteMany({ where: { userId: ben.id, package: { slug: "tyt-ilk-15" } } });
  const oId = await startCheckup(ben.id, "tyt-ilk-15");
  const oSorular = (await getStudentSession(oId, ben.id)).questions;
  const [s0, s1] = oSorular;
  await saveAnswer({ sessionId: oId, userId: ben.id, questionId: s0.id, choiceId: s0.choices[0].id, timeSpentMs: 30_000 });
  const ilk = await prisma.answer.findFirstOrThrow({
    where: { sessionItem: { sessionId: oId, questionId: s0.id } },
    select: { firstAnsweredAt: true, answeredAt: true },
  });
  await new Promise((r) => setTimeout(r, 30));
  await saveAnswer({ sessionId: oId, userId: ben.id, questionId: s0.id, choiceId: s0.choices[1].id, timeSpentMs: 35_000 });
  await saveAnswer({ sessionId: oId, userId: ben.id, questionId: s0.id, choiceId: null, timeSpentMs: 36_000 });
  const sonra = await prisma.answer.findFirstOrThrow({
    where: { sessionItem: { sessionId: oId, questionId: s0.id } },
    select: { firstAnsweredAt: true, answeredAt: true, timeSpentMs: true },
  });
  check("ilk işarette dolduruldu", ilk.firstAnsweredAt !== null);
  check(
    "değişiklik ve silme ilk işaret anını oynatmadı",
    sonra.firstAnsweredAt?.getTime() === ilk.firstAnsweredAt?.getTime() && sonra.answeredAt > ilk.answeredAt
  );
  check("ekranda süre yazılıyor", sonra.timeSpentMs === 36_000);

  // İşaretsiz açılmış satır (eski / süre birleştirme): ilk işarette dolar.
  const item1 = await prisma.sessionItem.findFirstOrThrow({ where: { sessionId: oId, questionId: s1.id }, select: { id: true } });
  await prisma.answer.create({ data: { sessionItemId: item1.id, choiceId: null, isCorrect: null, timeSpentMs: 5_000 } });
  await saveAnswer({ sessionId: oId, userId: ben.id, questionId: s1.id, choiceId: s1.choices[0].id, timeSpentMs: 20_000 });
  const s1Cevap = await prisma.answer.findUniqueOrThrow({ where: { sessionItemId: item1.id }, select: { firstAnsweredAt: true } });
  check("işaretsiz satırda ilk işaret sonradan doldu", s1Cevap.firstAnsweredAt !== null);

  for (const q of oSorular.slice(2, 8)) {
    await saveAnswer({ sessionId: oId, userId: ben.id, questionId: q.id, choiceId: q.choices[0].id, timeSpentMs: 50_000 });
  }
  await submitCheckup(oId, ben.id);
  const analiz = await sureAnaliziGetir(oId, ben.id);
  check("ekran oturumunda süre analizi var", analiz !== null && analiz.soruSayisi === 15);
  check("çözüm sırası ölçüldü", analiz?.sira !== null, JSON.stringify(analiz?.sira));
  check("başkasının oturumunda süre analizi yok", (await sureAnaliziGetir(oId, diger.id)) === null);

  await temizle();
  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
    await temizle().catch(() => {});
  })
  .finally(() => prisma.$disconnect());
