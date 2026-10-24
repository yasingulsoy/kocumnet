import "./_koruma.mjs";
/**
 * Haftalık plan — veritabanına dokunan kurallar.
 *
 *   npx tsx scripts/plan-test.mts
 *
 * Saf kurallar (karar cümlesinin plan bağı, haftalık konu sınırı, koç notu,
 * hafta başı anı, ürün süzgeci) smoke.mts'te. Burada planın veritabanıyla
 * birlikte doğru çalıştığı denetleniyor:
 *  - Geçen hafta yarısı bitmediyse plan GERÇEKTEN tek konuyla kurulur; koç
 *    notu "tek konu" yalnızca plan kısaldıysa der.
 *  - Plandaki ürün önerisi planın sınavına uygun (ALES adayına TYT kitabı yok).
 *  - Kontrol testi planın sınavıyla açılır; açılamayan iş "açılamaz" işaretli.
 *  - "Planı oluştur" yalnızca paket testinden, işaretli ve hedef sınavdan
 *    bir sonuçtan kurulur.
 *  - Pazartesi postası için geçen haftanın bitmemiş işleri.
 *
 * Kendi öğrencilerini, konularını ve paketlerini açar, sonunda siler: tohum
 * gerekmez, tohumlu veritabanında da çalışır.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { haftaBasi } from "../lib/coaching";
import type { TopicBreakdown, TopicBreakdownEntry } from "../lib/scoring";
import {
  aktifPlan,
  gecenHaftaninKalanlari,
  kontrolTestiSinavi,
  planKaynagi,
  planOlustur,
} from "../lib/plan";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const ON = "plantest";
const GUN = 86_400_000;
const SAAT = 3_600_000;
const EPOSTALAR = ["kisa", "tekzayif", "yeni", "kaynak", "retest", "kalan"].map((a) => `${ON}-${a}@kocum.local`);

async function temizle() {
  const kullanicilar = await prisma.user.findMany({ where: { email: { in: EPOSTALAR } }, select: { id: true } });
  const ids = kullanicilar.map((k) => k.id);
  await prisma.studyPlan.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.package.deleteMany({ where: { slug: { startsWith: `${ON}-` } } });
  await prisma.topic.deleteMany({ where: { slug: { startsWith: `${ON}-` } } });
}

function zayif(id: string, ad: string, oran: number): TopicBreakdownEntry {
  const asked = 4;
  const correct = Math.round(asked * oran);
  return {
    topicId: id,
    slug: id,
    name: ad,
    asked,
    correct,
    wrong: asked - correct,
    blank: 0,
    ratio: correct / asked,
    avgTimeMs: 0,
    level: "WEAK",
    confidence: "HIGH",
    slow: false,
  };
}

async function main() {
  await temizle();
  const now = new Date();
  const hafta = haftaBasi(now);
  const gecenHafta = new Date(hafta.getTime() - 7 * GUN);

  const kullanici = (eposta: string, hedef: "TYT" | "ALES") =>
    prisma.user.create({
      data: { email: eposta, name: "Plan Testi", passwordHash: "x", grade: "GRADUATE", targetExam: hedef, onboardedAt: now },
      select: { id: true },
    });
  const [uKisa, uTek, uYeni, uKaynak, uRetest, uKalan] = await Promise.all([
    kullanici(EPOSTALAR[0], "TYT"),
    kullanici(EPOSTALAR[1], "TYT"),
    kullanici(EPOSTALAR[2], "ALES"),
    kullanici(EPOSTALAR[3], "TYT"),
    kullanici(EPOSTALAR[4], "ALES"),
    kullanici(EPOSTALAR[5], "TYT"),
  ]);

  const konu = (slug: string, ad: string, sinavlar: ("TYT" | "ALES")[], urunler: string[]) =>
    prisma.topic.create({
      data: {
        slug: `${ON}-${slug}`,
        name: ad,
        examScope: sinavlar[0],
        examScopes: sinavlar,
        recommendedProductIds: urunler,
      },
      select: { id: true, name: true },
    });
  const [kA, kB, kC, kAles] = await Promise.all([
    // TYT ve ALES'te ortak; ilk ürün yalnızca TYT, ikincisi ALES'i de kapsıyor.
    konu("a", "Plan Testi A", ["TYT", "ALES"], ["tyt-matematik-ilk-15", "sanki-osym-problemleri"]),
    konu("b", "Plan Testi B", ["TYT", "ALES"], ["problemler-soru-paketi"]),
    konu("c", "Plan Testi C", ["TYT"], []),
    konu("ales", "Plan Testi ALES", ["ALES"], []),
  ]);

  const ucZayif: TopicBreakdown = {
    topics: [zayif(kA.id, kA.name, 0.25), zayif(kB.id, kB.name, 0.25), zayif(kC.id, kC.name, 0.5)],
    groups: [],
  };

  /** Geçen haftanın planı: `biten` iş bitmiş, gerisi açık. */
  const gecenPlan = (userId: string, toplam: number, biten: number) =>
    prisma.studyPlan.create({
      data: {
        userId,
        examScope: "TYT",
        weekStart: gecenHafta,
        items: {
          create: Array.from({ length: toplam }, (_, i) => ({
            kind: i % 2 === 0 ? ("STUDY" as const) : ("RETEST" as const),
            title: `Geçen hafta işi ${i + 1}`,
            topicId: kA.id,
            estimatedMinutes: 10 + i,
            sortOrder: i,
            ...(i < biten ? (i % 2 === 0 ? { doneAt: now } : { verifiedBySessionId: "x", doneAt: now }) : {}),
          })),
        },
      },
    });

  // ── C4: kısalan plan ─────────────────────────────────────
  console.log("Plan — geçen haftaya göre kısalma:");
  await gecenPlan(uKisa.id, 4, 1); // %25
  const kisa = await planOlustur({ userId: uKisa.id, sessionId: "s-kisa", examScope: "TYT", breakdown: ucZayif, now });
  const kisaPlan = await prisma.studyPlan.findUnique({
    where: { id: kisa.planId ?? "" },
    select: { coachNote: true, items: { select: { topicId: true } } },
  });
  const kisaKonular = new Set(kisaPlan?.items.map((i) => i.topicId));
  check("geçen hafta %25 → plan tek konu", kisaKonular.size === 1, `${kisaKonular.size} konu`);
  check("tek konu en zayıf konu", kisaKonular.has(kA.id) || kisaKonular.has(kB.id));
  check("koç notu kısaldığını söylüyor", (kisaPlan?.coachNote ?? "").includes("tek konu"), kisaPlan?.coachNote ?? "");

  await gecenPlan(uTek.id, 4, 1);
  const tekZayif: TopicBreakdown = { topics: [zayif(kA.id, kA.name, 0.25)], groups: [] };
  const tek = await planOlustur({ userId: uTek.id, sessionId: "s-tek", examScope: "TYT", breakdown: tekZayif, now });
  const tekPlan = await prisma.studyPlan.findUnique({ where: { id: tek.planId ?? "" }, select: { coachNote: true } });
  check(
    "zaten tek zayıf konu varsa 'tek konu' denmiyor (plan kısalmadı)",
    tek.olusturuldu && !(tekPlan?.coachNote ?? "").includes("tek konu"),
    tekPlan?.coachNote ?? ""
  );

  // ── E6: plan ürünü planın sınavına göre ──────────────────
  console.log("");
  console.log("Plan — tam sınır ve ürün süzgeci:");
  const yeni = await planOlustur({ userId: uYeni.id, sessionId: "s-yeni", examScope: "ALES", breakdown: ucZayif, now });
  const yeniPlan = await prisma.studyPlan.findUnique({
    where: { id: yeni.planId ?? "" },
    select: { coachNote: true, items: { select: { topicId: true, productId: true, kind: true } } },
  });
  check("geçen hafta plan yoksa iki konu", new Set(yeniPlan?.items.map((i) => i.topicId)).size === 2);
  const aUrunu = yeniPlan?.items.find((i) => i.topicId === kA.id && i.kind === "STUDY")?.productId;
  check("ALES planında TYT kitabı yok, ALES'e uygun ürün var", aUrunu === "sanki-osym-problemleri", String(aUrunu));
  const bUrunu = yeniPlan?.items.find((i) => i.topicId === kB.id && i.kind === "STUDY")?.productId;
  check("ALES'e uygun ürünü olmayan konuda ürün boş", bUrunu === null, String(bUrunu));

  // ── C2: kontrol testi planın sınavıyla ───────────────────
  console.log("");
  console.log("Plan — kontrol testi sınavı:");
  // Plan TYT; öğrencinin hedefi artık ALES. C konusu ALES'te yok.
  await prisma.studyPlan.create({
    data: {
      userId: uRetest.id,
      examScope: "TYT",
      weekStart: hafta,
      items: {
        create: [
          { kind: "RETEST", title: "C kontrol testi", topicId: kC.id, estimatedMinutes: 8, sortOrder: 0 },
          { kind: "RETEST", title: "ALES kontrol testi", topicId: kAles.id, estimatedMinutes: 8, sortOrder: 1 },
          { kind: "STUDY", title: "C konu tekrarı", topicId: kC.id, estimatedMinutes: 60, sortOrder: 2 },
        ],
      },
    },
  });
  check("plandaki iş planın sınavıyla açılır", (await kontrolTestiSinavi(uRetest.id, kC.id, now, "ALES")) === "TYT");
  check("planda olmayan konu güncel hedefle açılır", (await kontrolTestiSinavi(uRetest.id, kB.id, now, "ALES")) === "ALES");
  check("hedef yoksa ve planda değilse null", (await kontrolTestiSinavi(uRetest.id, kB.id, now, null)) === null);

  // "Açılabilir": tekrar paketi yayında olmalı. Tohumsuz veritabanında yoksa geçici bir tane.
  const tekrarPaketi = await prisma.package.findFirst({
    where: { kind: "RETEST", examScope: "TYT", status: "PUBLISHED" },
    select: { id: true },
  });
  if (!tekrarPaketi) {
    await prisma.package.create({
      data: { slug: `${ON}-tekrar`, name: "Plan testi tekrar", kind: "RETEST", examScope: "TYT", questionCount: 5, durationMinutes: 8, status: "PUBLISHED" },
    });
  }
  const gorunum = await aktifPlan(uRetest.id, now);
  const isi = (baslik: string) => gorunum?.items.find((i) => i.title === baslik);
  check("görünümde planın sınavı var", gorunum?.examScope === "TYT");
  check("planın sınavındaki konunun kontrol testi açılabilir", isi("C kontrol testi")?.acilabilir === true);
  check("planın sınavında olmayan konunun kontrol testi açılamaz", isi("ALES kontrol testi")?.acilabilir === false);
  check("kontrol testi dışındaki iş her zaman 'açılabilir'", isi("C konu tekrarı")?.acilabilir === true);

  // ── C7: "Planı oluştur"un kaynağı ────────────────────────
  console.log("");
  console.log("Plan — 'Planı oluştur' kaynağı:");
  const paket = (slug: string, kind: "STANDARD" | "RETEST", sinav: "TYT" | "ALES") =>
    prisma.package.create({
      data: { slug: `${ON}-${slug}`, name: `Plan testi ${slug}`, kind, examScope: sinav, questionCount: 5, durationMinutes: 10, status: "DRAFT" },
      select: { id: true },
    });
  const [pTyt, pAles, pTekrar] = await Promise.all([
    paket("tyt", "STANDARD", "TYT"),
    paket("ales", "STANDARD", "ALES"),
    paket("tekrar-taslak", "RETEST", "TYT"),
  ]);
  let dakika = 0;
  const oturum = (o: {
    packageId: string;
    kind: "PACKAGE" | "TOPIC_RETEST";
    sinav: "TYT" | "ALES" | null;
    dogru: number;
    yanlis: number;
  }) => {
    // Her biri bir öncekinden yeni: sıra submittedAt ile.
    const bitis = new Date(now.getTime() - 5 * SAAT + ++dakika * 60_000);
    return prisma.checkupSession.create({
      data: {
        userId: uKaynak.id,
        packageId: o.packageId,
        kind: o.kind,
        status: "SUBMITTED",
        durationMinutes: 10,
        penaltyRatio: 0.25,
        startedAt: new Date(bitis.getTime() - SAAT),
        expiresAt: new Date(bitis.getTime() + SAAT),
        submittedAt: bitis,
        result: {
          create: {
            correctCount: o.dogru,
            wrongCount: o.yanlis,
            blankCount: 5 - o.dogru - o.yanlis,
            netScore: o.dogru,
            totalTimeMs: 60_000,
            topicBreakdown: ucZayif as never,
            examScope: o.sinav,
          },
        },
      },
      select: { id: true },
    });
  };
  // Eskiden yeniye: geçerli TYT, sınavı boş eski kayıt değil (ondan da yeni olanlar var),
  // sonra ALES (başka sınav), işaretsiz TYT, kontrol testi.
  const gecerli = await oturum({ packageId: pTyt.id, kind: "PACKAGE", sinav: "TYT", dogru: 2, yanlis: 2 });
  await oturum({ packageId: pAles.id, kind: "PACKAGE", sinav: "ALES", dogru: 3, yanlis: 1 });
  await oturum({ packageId: pTyt.id, kind: "PACKAGE", sinav: "TYT", dogru: 0, yanlis: 0 });
  await oturum({ packageId: pTekrar.id, kind: "TOPIC_RETEST", sinav: "TYT", dogru: 1, yanlis: 4 });

  const kaynak = await planKaynagi(uKaynak.id, "TYT");
  check("kontrol testi, işaretsiz test ve başka sınav atlanıyor", kaynak?.sessionId === gecerli.id);
  check("kaynağın sınavı sonucun sınavı", kaynak?.examScope === "TYT");
  const alesKaynak = await planKaynagi(uKaynak.id, "ALES");
  check("hedef ALES ise ALES sonucu seçiliyor", alesKaynak?.examScope === "ALES");

  // Sınavı yazmayan eski kayıt: sınavı paketten okunur (plan o sınavla kurulur).
  const eski = await oturum({ packageId: pTyt.id, kind: "PACKAGE", sinav: null, dogru: 1, yanlis: 1 });
  const eskiKaynak = await planKaynagi(uKaynak.id, "TYT");
  check(
    "sınavı boş kayıt, paketi hedef sınavdansa seçiliyor",
    eskiKaynak?.sessionId === eski.id && eskiKaynak.examScope === "TYT"
  );
  check(
    "sınavı boş kayıt, paketi başka sınavdansa atlanıyor",
    (await planKaynagi(uKaynak.id, "ALES"))?.examScope === "ALES"
  );
  check("hiç ölçümü olmayan öğrenciye kaynak yok", (await planKaynagi(uRetest.id, "ALES")) === null);

  // ── C5: pazartesi postası için geçen haftanın kalanları ──
  console.log("");
  console.log("Plan — geçen haftanın bitmemiş işleri:");
  await gecenPlan(uKalan.id, 6, 1);
  const kalan = await gecenHaftaninKalanlari(uKalan.id, now, 3);
  check("toplam bitmemiş iş sayısı", kalan.toplam === 5, String(kalan.toplam));
  check("en fazla üç iş, plan sırasıyla", kalan.isler.length === 3 && kalan.isler[0].estimatedMinutes === 11);
  check("bu hafta için 'geçen hafta' yoksa boş", (await gecenHaftaninKalanlari(uYeni.id, now)).toplam === 0);
}

try {
  await main();
} finally {
  await temizle();
  await prisma.$disconnect();
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
