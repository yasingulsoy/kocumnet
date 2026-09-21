/**
 * Uçtan uca motor testi + CEVAP ANAHTARI SIZINTI DENETİMİ (PLAN §3).
 *
 *   npm run test:leak
 *
 * Bu test neden var: bir gün biri "kolaylık olsun" diye öğrenciye giden
 * sorguya isCorrect ekler ve bu gözden kaçar. Sızıntı sessizdir — arayüz
 * çalışmaya devam eder, sadece testin bir anlamı kalmaz.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import {
  startCheckup,
  getStudentSession,
  saveAnswer,
  submitCheckup,
  getCheckupReview,
  CheckupError,
} from "../lib/checkup";
import { calculateNet } from "../lib/scoring";
import { grantEntitlement } from "../lib/entitlements";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const TEST_EMAIL = "leak-test@kocum.local";
const OTHER_EMAIL = "leak-test-other@kocum.local";

async function ensureUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name: "Test Öğrenci", passwordHash: await hashPassword("test-1234"), grade: "GRADE_12" },
    update: {},
    select: { id: true },
  });
}

async function main() {
  const user = await ensureUser(TEST_EMAIL);
  const other = await ensureUser(OTHER_EMAIL);

  // Temiz başlangıç: önceki denemeler bu testi etkilemesin.
  await prisma.checkupSession.deleteMany({ where: { userId: { in: [user.id, other.id] } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: [user.id, other.id] } } });

  console.log("\nBaşlatma:");
  const sessionId = await startCheckup(user.id, "tyt-ilk-15");
  check("oturum açıldı", Boolean(sessionId));

  const session = await getStudentSession(sessionId, user.id);
  check("15 soru seçildi", session.questions.length === 15, `${session.questions.length} soru`);
  check("süre sunucudan geliyor", session.remainingMs > 0 && session.remainingMs <= 18 * 60_000);

  // Sabit bir eşik yazmıyoruz: paket tanımı değiştiğinde test yanlış yerden
  // patlar. Dağılımın paketteki tanımla BİREBİR tutup tutmadığına bakıyoruz.
  const pkgTopics = await prisma.packageTopic.findMany({
    where: { package: { slug: "tyt-ilk-15" } },
    select: { questionCount: true, topic: { select: { name: true } } },
  });
  const beklenen = new Map(pkgTopics.map((pt) => [pt.topic.name, pt.questionCount]));
  const gelen = new Map<string, number>();
  for (const q of session.questions) gelen.set(q.topicName, (gelen.get(q.topicName) ?? 0) + 1);

  const dagilimUyuyor =
    beklenen.size === gelen.size &&
    [...beklenen].every(([name, n]) => gelen.get(name) === n);
  check(
    "konu dağılımı paket tanımıyla birebir",
    dagilimUyuyor,
    [...gelen].map(([n, c]) => `${n}:${c}`).join(", ")
  );

  const orders = session.questions.map((q) => q.order);
  check("sıra numaraları benzersiz", new Set(orders).size === orders.length);

  // ── SIZINTI DENETİMİ ────────────────────────────────────────
  console.log("\nCevap anahtarı sızıntısı:");
  const payload = JSON.stringify(session);
  for (const leak of ["isCorrect", "is_correct", "errorType", "error_type", "answerKey", "correct"]) {
    check(`"${leak}" öğrenciye giden veride YOK`, !payload.includes(leak));
  }

  // Şıklarda yalnızca beklenen alanlar olmalı — yeni bir alan eklenirse burada yakalanır.
  const choiceKeys = new Set(session.questions.flatMap((q) => q.choices.flatMap((c) => Object.keys(c))));
  check("şık alanları yalnızca id/label/content", [...choiceKeys].sort().join(",") === "content,id,label",
    [...choiceKeys].join(", "));

  // İnceleme cevap anahtarını içerir; test sürerken ASLA açılmamalı.
  let incelemeKapali = false;
  try {
    await getCheckupReview(sessionId, user.id);
  } catch (e) {
    incelemeKapali = e instanceof CheckupError;
  }
  check("test SÜRERKEN inceleme kapalı", incelemeKapali);

  const q0 = session.questions[0];
  check("soru gövdesi çözümlenmiş blok dizisi", q0.stem.blocks.length > 0 && q0.stem.version === 1);
  check("5 şık var", q0.choices.length === 5);

  // ── YETKİ ───────────────────────────────────────────────────
  console.log("\nYetki:");
  let blocked = false;
  try {
    await getStudentSession(sessionId, other.id);
  } catch (e) {
    blocked = e instanceof CheckupError;
  }
  check("başka öğrenci oturumu okuyamıyor", blocked);

  // Başka bir sorunun şıkkı gönderilirse reddedilmeli.
  const foreignChoice = session.questions[1].choices[0].id;
  let rejected = false;
  try {
    await saveAnswer({ sessionId, userId: user.id, questionId: q0.id, choiceId: foreignChoice, timeSpentMs: 1000 });
  } catch (e) {
    rejected = e instanceof CheckupError;
  }
  check("başka soruya ait şık reddediliyor", rejected);

  // ── CEVAPLAMA ───────────────────────────────────────────────
  console.log("\nCevaplama:");
  // Test, cevap anahtarını veritabanından doğrudan okuyabilir (öğrenci okuyamaz).
  const keys = await prisma.choice.findMany({
    where: { questionId: { in: session.questions.map((q) => q.id) }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  const correctByQuestion = new Map(keys.map((k) => [k.questionId, k.id]));
  check("her sorunun tam bir doğru şıkkı var", keys.length === 15, `${keys.length} anahtar`);

  // 9 doğru, 4 yanlış, 2 boş bırakıyoruz.
  let d = 0, y = 0, b = 0;
  for (const [i, q] of session.questions.entries()) {
    const correctId = correctByQuestion.get(q.id)!;
    if (i < 9) {
      await saveAnswer({ sessionId, userId: user.id, questionId: q.id, choiceId: correctId, timeSpentMs: 45_000 });
      d += 1;
    } else if (i < 13) {
      const wrong = q.choices.find((c) => c.id !== correctId)!;
      await saveAnswer({ sessionId, userId: user.id, questionId: q.id, choiceId: wrong.id, timeSpentMs: 90_000 });
      y += 1;
    } else {
      b += 1; // hiç kaydetmiyoruz: boş
    }
  }
  check(`${d} doğru / ${y} yanlış / ${b} boş işaretlendi`, d === 9 && y === 4 && b === 2);

  const midway = await getStudentSession(sessionId, user.id);
  check("işaretler geri okunuyor", midway.questions.filter((q) => q.selectedChoiceId).length === 13);
  check("ara okumada da sızıntı yok", !JSON.stringify(midway).includes("isCorrect"));

  // Sayaçlar MUTLAK değil FARK olarak ölçülür: havuz taze değilse (testi ikinci
  // kez koşarsan) mutlak toplam önceki turları da içerir ve test yalancı
  // şekilde kırmızı yanar.
  const qIds = session.questions.map((q) => q.id);
  const oncesi = await prisma.question.aggregate({
    where: { id: { in: qIds } },
    _sum: { shownCount: true, correctCount: true },
  });
  const sikOncesi = await prisma.choice.aggregate({
    where: { questionId: { in: qIds } },
    _sum: { chosenCount: true },
  });

  // ── BİTİRME ─────────────────────────────────────────────────
  console.log("\nSonuç:");
  const score = await submitCheckup(sessionId, user.id);
  check("doğru sayısı", score.correctCount === 9, String(score.correctCount));
  check("yanlış sayısı", score.wrongCount === 4, String(score.wrongCount));
  check("boş sayısı", score.blankCount === 2, String(score.blankCount));

  const beklenenNet = calculateNet(9, 4, 0.25);
  check(`net = ${beklenenNet}`, score.netScore === beklenenNet, String(score.netScore));
  check("konu kırılımı üretildi", score.topicBreakdown.topics.length > 0,
    `${score.topicBreakdown.topics.length} konu, ${score.topicBreakdown.groups.length} grup`);

  const kapali = await prisma.checkupSession.findUnique({
    where: { id: sessionId }, select: { status: true, submittedAt: true },
  });
  check("oturum SUBMITTED", kapali?.status === "SUBMITTED" && kapali.submittedAt !== null);

  // Bitmiş teste cevap yazılamamalı.
  let kapaliRed = false;
  try {
    await saveAnswer({ sessionId, userId: user.id, questionId: q0.id, choiceId: correctByQuestion.get(q0.id)!, timeSpentMs: 1 });
  } catch (e) {
    kapaliRed = e instanceof CheckupError;
  }
  check("kapalı teste cevap yazılamıyor", kapaliRed);

  // Bittikten sonra inceleme açılmalı ve cevap anahtarını İÇERMELİ.
  const inceleme = await getCheckupReview(sessionId, user.id);
  check("bitince inceleme açılıyor", inceleme.length === 15, `${inceleme.length} soru`);
  check(
    "incelemede her sorunun doğru şıkkı işaretli",
    inceleme.every((i) => i.choices.some((c) => c.isCorrect))
  );
  check(
    "incelemede öğrencinin işareti duruyor",
    inceleme.filter((i) => i.selectedChoiceId).length === 13
  );
  check(
    "başka öğrenci incelemeyi göremiyor",
    await (async () => {
      try {
        await getCheckupReview(sessionId, other.id);
        return false;
      } catch (e) {
        return e instanceof CheckupError;
      }
    })()
  );

  // İkinci kez bitirme yeni sonuç üretmemeli.
  const tekrar = await submitCheckup(sessionId, user.id);
  const sonucSayisi = await prisma.checkupResult.count({ where: { sessionId } });
  check("tekrar bitirme aynı sonucu döndürüyor", tekrar.netScore === score.netScore && sonucSayisi === 1);

  // ── İSTATİSTİK ──────────────────────────────────────────────
  console.log("\nİstatistik:");
  const sonrasi = await prisma.question.aggregate({
    where: { id: { in: qIds } },
    _sum: { shownCount: true, correctCount: true },
  });
  const sikSonrasi = await prisma.choice.aggregate({
    where: { questionId: { in: qIds } },
    _sum: { chosenCount: true },
  });

  const dGosterim = (sonrasi._sum.shownCount ?? 0) - (oncesi._sum.shownCount ?? 0);
  const dDogru = (sonrasi._sum.correctCount ?? 0) - (oncesi._sum.correctCount ?? 0);
  const dSik = (sikSonrasi._sum.chosenCount ?? 0) - (sikOncesi._sum.chosenCount ?? 0);

  check("gösterim sayacı +15", dGosterim === 15, `+${dGosterim}`);
  check("doğru sayacı +9", dDogru === 9, `+${dDogru}`);
  check("şık sayacı +13 (boşlar sayılmadı)", dSik === 13, `+${dSik}`);

  // ── TEKRAR ENGELİ ───────────────────────────────────────────
  console.log("\nTekrar engeli:");
  const ikinci = await startCheckup(user.id, "tyt-ilk-15");
  const ikinciSession = await getStudentSession(ikinci, user.id);
  const ilkIds = new Set(session.questions.map((q) => q.id));
  const tekrarEden = ikinciSession.questions.filter((q) => ilkIds.has(q.id)).length;
  check("ikinci testte aynı sorular gelmiyor", tekrarEden === 0, `${tekrarEden} tekrar`);

  // ── ERİŞİM HAKKI ────────────────────────────────────────────
  console.log("\nErisim hakki:");

  const pkg = await prisma.package.findFirstOrThrow({
    where: { slug: "trigonometri" },
    select: { id: true, isFree: true },
  });

  // Paketi ücretliye çevir ve hakkı olmayan öğrenciyi dene.
  await prisma.package.update({ where: { id: pkg.id }, data: { isFree: false } });
  await prisma.entitlement.deleteMany({ where: { userId: user.id } });

  let kilitli = false;
  try {
    await startCheckup(user.id, "trigonometri");
  } catch (e) {
    kilitli = e instanceof CheckupError && e.message.includes("erişim hakkın yok");
  }
  check("ücretli pakete hakkı olmayan giremiyor", kilitli);

  // Tek pakete özel hak (tek seferlik alım) → açılmalı.
  await grantEntitlement({ userId: user.id, packageId: pkg.id, expiresAt: null, source: "test" });
  const acildi = await startCheckup(user.id, "trigonometri").then(() => true).catch(() => false);
  check("tek seferlik alım o paketi açıyor", acildi);

  // Süresi geçmiş abonelik → kapalı olmalı.
  await prisma.entitlement.deleteMany({ where: { userId: user.id } });
  await prisma.checkupSession.deleteMany({ where: { userId: user.id } });
  await grantEntitlement({
    userId: user.id,
    packageId: null,
    expiresAt: new Date(Date.now() - 86_400_000),
    source: "test",
  });
  let suresiGecti = false;
  try {
    await startCheckup(user.id, "trigonometri");
  } catch (e) {
    suresiGecti = e instanceof CheckupError && e.message.includes("erişim hakkın yok");
  }
  check("SÜRESİ GEÇMİŞ abonelik erişim vermiyor", suresiGecti);

  // Geçerli abonelik (tüm paketler) → açılmalı.
  await prisma.entitlement.deleteMany({ where: { userId: user.id } });
  await grantEntitlement({
    userId: user.id,
    packageId: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    source: "test",
  });
  const abonelikActi = await startCheckup(user.id, "trigonometri").then(() => true).catch(() => false);
  check("geçerli abonelik tüm paketleri açıyor", abonelikActi);

  // Paketi eski haline getir.
  await prisma.package.update({ where: { id: pkg.id }, data: { isFree: pkg.isFree } });
  await prisma.entitlement.deleteMany({ where: { userId: user.id } });

  // Temizlik
  await prisma.checkupSession.deleteMany({ where: { userId: { in: [user.id, other.id] } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: [user.id, other.id] } } });
  await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, OTHER_EMAIL] } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
