/**
 * Alıştırma ve yanlış defteri — uçtan uca akış + CEVAP ANAHTARI KAPISI.
 *
 *   npm run test:practice
 *
 * Neden ayrı test: alıştırma, sınavın tersine, cevabı ve çözümü HEMEN
 * gösteriyor. Tek bir yanlış kapı (sınav oturumuna alıştırma yolundan cevap
 * yazmak, cevaplanmamış sorunun anahtarını okumak, açık bir sınavdaki soruyu
 * alıştırmada açmak) sınavın cevap anahtarını test sürerken sızdırır. Bu
 * test o kapıları ve "alıştırma ölçümü kirletmez" kuralını denetliyor.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import {
  CheckupError,
  expireStaleSessions,
  getCheckupReview,
  getSessionState,
  getStudentSession,
  saveAnswer,
  startCheckup,
  submitCheckup,
} from "../lib/checkup";
import {
  alistirmaHakki,
  answerPractice,
  benzerDurumlari,
  benzeriniCozBaslat,
  bugunkuTekrarDurumu,
  getPracticeSession,
  konuCalismasiBaslat,
  tekrarBaslat,
} from "../lib/practice";
import { defteriGuncelle, tekrarIsle } from "../lib/notebook";
import { loadCatalog } from "../lib/catalog";
import {
  BENZER_ZORLUK_FARKI,
  GUNLUK_ALISTIRMA_SORU,
  GUNLUK_TEKRAR_SORU,
  KONU_CALISMA_SORU,
  TEKRAR_ARALIKLARI_GUN,
  benzerMi,
  vade,
} from "../lib/review";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const EMAIL = "practice-test@kocum.local";
const OTHER_EMAIL = "practice-test-other@kocum.local";
const PAKET = "tyt-ilk-15";

/** Öğrenciye giden veride cevap anahtarının izi. */
const ANAHTAR_IZLERI = [
  "isCorrect",
  "is_correct",
  "errorType",
  "error_type",
  "errorLabel",
  "errorAdvice",
  "correctChoiceId",
  "solution",
  "answerKey",
];

/** Bu testin kendi yazımı, seçim kodundan BAĞIMSIZ: kapsam kuralı (lib/exam-scope.ts). */
function soruSinavda(
  q: { examScopes: string[]; topic: { examScope: string; examScopes: string[] } },
  sinav: string
): boolean {
  if (q.examScopes.length > 0) return q.examScopes.includes(sinav);
  return q.topic.examScopes.length > 0 ? q.topic.examScopes.includes(sinav) : q.topic.examScope === sinav;
}

/**
 * Beklenen ret mesajı; ret yoksa null. Adla eşleştiriyoruz: tsx, `@/lib/...`
 * ile `../lib/...` yollarını ayrı modül olarak yüklüyor ve lib/practice.ts'in
 * fırlattığı CheckupError bu dosyadakiyle `instanceof` eşleşmiyor.
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

/** Beklenen bir CheckupError ile reddedildi mi (başka türlü bir hata reddetmek sayılmaz). */
async function reddeder(fn: () => Promise<unknown>): Promise<boolean> {
  const m = await hataVerir(fn);
  return m !== null && !m.startsWith("BEKLENMEYEN");
}

async function kullanici(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Alıştırma Testi",
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: "TYT",
      onboardedAt: new Date(),
    },
    update: {},
    select: { id: true },
  });
}

async function temizle(ids: string[]) {
  await prisma.notebookItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
}

/**
 * Elle bitmiş bir ölçüm oturumu kurar (yeniden puanlama ve geç puanlama
 * senaryoları için): verilen sorular YANLIŞ cevaplanmış, SUBMITTED.
 */
async function elleOlcum(userId: string, packageId: string, sorular: string[], bitis: Date) {
  const yanlis = await prisma.choice.findMany({
    where: { questionId: { in: sorular }, isCorrect: false },
    distinct: ["questionId"],
    select: { id: true, questionId: true },
  });
  const sikMap = new Map(yanlis.map((c) => [c.questionId, c.id]));
  return prisma.checkupSession.create({
    data: {
      userId,
      packageId,
      kind: "PACKAGE",
      status: "SUBMITTED",
      durationMinutes: 30,
      penaltyRatio: 0.25,
      startedAt: new Date(bitis.getTime() - 20 * 60_000),
      expiresAt: new Date(bitis.getTime() + 10 * 60_000),
      submittedAt: bitis,
      items: {
        create: sorular.map((q, i) => ({
          questionId: q,
          sortOrder: i,
          questionVersion: 1,
          answer: { create: { choiceId: sikMap.get(q)!, isCorrect: false } },
        })),
      },
    },
    select: { id: true },
  });
}

async function sayaclar() {
  const [q, c] = await Promise.all([
    prisma.question.aggregate({ _sum: { shownCount: true, correctCount: true } }),
    prisma.choice.aggregate({ _sum: { chosenCount: true } }),
  ]);
  return {
    shown: q._sum.shownCount ?? 0,
    correct: q._sum.correctCount ?? 0,
    chosen: c._sum.chosenCount ?? 0,
  };
}

async function main() {
  const user = await kullanici(EMAIL);
  const other = await kullanici(OTHER_EMAIL);
  await temizle([user.id, other.id]);

  // ── 1. Ölçüm: yanlışı ve boşu olan bir test ────────────────
  console.log("\nKaynak test:");
  const examId = await startCheckup(user.id, PAKET);
  const exam = await getStudentSession(examId, user.id);
  const examIds = exam.questions.map((q) => q.id);
  const anahtar = new Map(
    (
      await prisma.choice.findMany({
        where: { questionId: { in: examIds }, isCorrect: true },
        select: { questionId: true, id: true },
      })
    ).map((c) => [c.questionId, c.id])
  );
  // 5 doğru, 6 yanlış, gerisi boş.
  for (const [i, q] of exam.questions.entries()) {
    if (i < 5) {
      await saveAnswer({ sessionId: examId, userId: user.id, questionId: q.id, choiceId: anahtar.get(q.id)!, timeSpentMs: 30_000 });
    } else if (i < 11) {
      const yanlis = q.choices.find((c) => c.id !== anahtar.get(q.id))!;
      await saveAnswer({ sessionId: examId, userId: user.id, questionId: q.id, choiceId: yanlis.id, timeSpentMs: 30_000 });
    }
  }
  await submitCheckup(examId, user.id);
  const dogrular = new Set(exam.questions.slice(0, 5).map((q) => q.id));
  const yanlisVeBos = exam.questions.slice(5).map((q) => q.id);
  check("kaynak test bitti", (await prisma.checkupSession.findUniqueOrThrow({ where: { id: examId } })).status === "SUBMITTED");

  // ── 2. Benzer var mı (sonuç ekranının sorusu) ──────────────
  console.log("\nBenzer durumu:");
  const durumlar = await benzerDurumlari(user.id, examId);
  check(
    "yalnızca yanlış ve boşlar için durum var",
    durumlar.size === yanlisVeBos.length && [...durumlar.keys()].every((id) => !dogrular.has(id)),
    `${durumlar.size} soru`
  );
  const benzeriOlan = yanlisVeBos.filter((id) => durumlar.get(id));
  check("en az bir yanlışın benzeri var (demo havuz)", benzeriOlan.length > 0, `${benzeriOlan.length}/${yanlisVeBos.length}`);
  check(
    "başka öğrenci bu testin benzer durumunu okuyamıyor",
    (await reddeder(() => benzerDurumlari(other.id, examId)))
  );
  check(
    "doğru yapılan soruya benzer açılmıyor",
    (await reddeder(() => benzeriniCozBaslat(user.id, examId, [...dogrular][0])))
  );

  const sayacOnce = await sayaclar();

  // ── 3. "Benzerini çöz" ─────────────────────────────────────
  console.log("\nBenzerini çöz:");
  const kaynakId = benzeriOlan[0];
  const p1 = await benzeriniCozBaslat(user.id, examId, kaynakId);
  const p1Satir = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: p1 },
    select: {
      kind: true,
      practiceMode: true,
      sourceSessionId: true,
      status: true,
      package: { select: { kind: true, examScope: true } },
      items: { select: { questionId: true, sourceQuestionId: true } },
    },
  });
  check("oturum PRACTICE / SIMILAR", p1Satir.kind === "PRACTICE" && p1Satir.practiceMode === "SIMILAR");
  check("gizli alıştırma paketine bağlı", p1Satir.package.kind === "PRACTICE" && p1Satir.package.examScope === "TYT");
  check("kaynak test saklanıyor", p1Satir.sourceSessionId === examId);
  check("tek soru, kaynağı işaretli", p1Satir.items.length === 1 && p1Satir.items[0].sourceQuestionId === kaynakId);
  const benzerId = p1Satir.items[0].questionId;
  check("asla aynı soru değil", benzerId !== kaynakId);
  check("kaynak testin hiçbir sorusu değil (çözümleri ekranda)", !examIds.includes(benzerId));

  const [kSoru, bSoru] = await Promise.all(
    [kaynakId, benzerId].map((id) =>
      prisma.question.findUniqueOrThrow({
        where: { id },
        select: {
          topicId: true,
          objectiveId: true,
          level: true,
          difficulty: true,
          status: true,
          examScopes: true,
          topic: { select: { examScope: true, examScopes: true } },
        },
      })
    )
  );
  check(
    kSoru.objectiveId ? "aynı kazanım" : "aynı konu",
    kSoru.objectiveId ? bSoru.objectiveId === kSoru.objectiveId : bSoru.topicId === kSoru.topicId
  );
  check("aynı seviye", (bSoru.level ?? null) === (kSoru.level ?? null), `${kSoru.level} / ${bSoru.level}`);
  check(
    `zorluk farkı en fazla ${BENZER_ZORLUK_FARKI}`,
    Math.abs(bSoru.difficulty - kSoru.difficulty) <= BENZER_ZORLUK_FARKI,
    `${kSoru.difficulty} → ${bSoru.difficulty}`
  );
  check("yayında ve TYT kapsamında", bSoru.status === "PUBLISHED" && soruSinavda(bSoru, "TYT"));
  const gosterim = await prisma.questionExposure.findUnique({
    where: { userId_questionId: { userId: user.id, questionId: benzerId } },
    select: { lastShownAt: true },
  });
  check("alıştırma sorusu tekrar engeline yazıldı (30 gün sınava gelmez)", Boolean(gosterim));
  check("açık alıştırma ikinci kez açılmıyor", (await benzeriniCozBaslat(user.id, examId, kaynakId)) === p1);
  const alistirmaPaketSlug = (
    await prisma.package.findFirstOrThrow({ where: { kind: "PRACTICE", examScope: "TYT" }, select: { slug: true } })
  ).slug;
  check(
    "alıştırma paketi katalogda yok",
    !(await loadCatalog(user.id, new Date(), { scope: "TYT" })).some((p) => p.slug === alistirmaPaketSlug)
  );
  check(
    "alıştırma paketi paket akışıyla başlatılamıyor",
    await reddeder(() => startCheckup(user.id, alistirmaPaketSlug))
  );

  // ── 4. Sızıntı: cevaplanmadan ÖNCE ─────────────────────────
  console.log("\nCevap anahtarı (cevaplanmadan önce):");
  const v1 = await getPracticeSession(p1, user.id);
  const v1Json = JSON.stringify(v1);
  for (const iz of ANAHTAR_IZLERI) check(`"${iz}" öğrenciye giden veride YOK`, !v1Json.includes(iz));
  check("geri bildirim yok", v1.questions.every((q) => q.feedback === null));
  const sikAlanlari = new Set(v1.questions.flatMap((q) => q.choices.flatMap((c) => Object.keys(c))));
  check("şık alanları yalnızca id/label/content", [...sikAlanlari].sort().join(",") === "content,id,label");
  check("başka öğrenci alıştırmayı okuyamıyor", (await reddeder(() => getPracticeSession(p1, other.id))));

  // ── 5. Sınav kapıları alıştırmayı reddediyor ───────────────
  console.log("\nSınav yolları alıştırmaya kapalı:");
  const p1Soru = v1.questions[0];
  check(
    "sınavın cevap kaydı (saveAnswer) alıştırmaya yazamıyor",
    (await reddeder(() =>
      saveAnswer({ sessionId: p1, userId: user.id, questionId: p1Soru.id, choiceId: p1Soru.choices[0].id, timeSpentMs: 1 })
    )) && (await prisma.answer.count({ where: { sessionItem: { sessionId: p1 } } })) === 0
  );
  check(
    "sınav bitirme (submitCheckup) alıştırmayı puanlamıyor",
    (await reddeder(() => submitCheckup(p1, user.id)))
  );
  check(
    "süre birleştirme yoluyla da boş cevap satırı açılamıyor",
    (await reddeder(() => submitCheckup(p1, user.id, { [p1Soru.id]: 60_000 }))) &&
      (await prisma.answer.count({ where: { sessionItem: { sessionId: p1 } } })) === 0
  );
  check("sınav incelemesi (getCheckupReview) alıştırmada kapalı", (await reddeder(() => getCheckupReview(p1, user.id))));
  check("eşitleme alıştırmayı kendi ekranına yönlendiriyor", (await getSessionState(p1, user.id)).target === `/alistirma/${p1}`);

  // ── 6. Alıştırma kapıları sınavı reddediyor ────────────────
  console.log("\nAlıştırma yolları sınava kapalı:");
  const acikSinav = await startCheckup(user.id, PAKET);
  const acik = await getStudentSession(acikSinav, user.id);
  const acikIds = new Set(acik.questions.map((q) => q.id));
  const aq = acik.questions[0];
  check(
    "alıştırma cevabı sınav oturumuna yazılamıyor",
    (await reddeder(() =>
      answerPractice({ sessionId: acikSinav, userId: user.id, questionId: aq.id, choiceId: aq.choices[0].id, timeSpentMs: 1 })
    )) && (await prisma.answer.count({ where: { sessionItem: { sessionId: acikSinav } } })) === 0
  );
  check("alıştırma okuması sınav oturumunda kapalı", (await reddeder(() => getPracticeSession(acikSinav, user.id))));

  // Açık sınavın sorusu bir alıştırmaya düşmüşse (elle kuruyoruz) anahtar açılmamalı.
  const elle = await prisma.checkupSession.create({
    data: {
      userId: user.id,
      packageId: (await prisma.checkupSession.findUniqueOrThrow({ where: { id: p1 }, select: { packageId: true } })).packageId,
      kind: "PRACTICE",
      practiceMode: "TOPIC",
      status: "IN_PROGRESS",
      durationMinutes: 60,
      penaltyRatio: 0,
      expiresAt: new Date(Date.now() + 3600_000),
      items: { create: [{ questionId: aq.id, sortOrder: 0, questionVersion: 1 }] },
    },
    select: { id: true },
  });
  const kilit = await hataVerir(() =>
    answerPractice({ sessionId: elle.id, userId: user.id, questionId: aq.id, choiceId: aq.choices[0].id, timeSpentMs: 1 })
  );
  check("açık sınavdaki soru alıştırmada açılmıyor", kilit !== null && kilit.includes("açık bir testinde"), kilit ?? "");
  const elleView = await getPracticeSession(elle.id, user.id);
  check(
    "o sorunun geri bildirimi ve anahtarı yok",
    elleView.questions[0].feedback === null && !ANAHTAR_IZLERI.some((iz) => JSON.stringify(elleView).includes(iz))
  );
  await prisma.checkupSession.delete({ where: { id: elle.id } });

  // ── 7. Cevapla: geri bildirim yalnızca cevaplanana ─────────
  console.log("\nCevap ve geri bildirim:");
  const p1Anahtar = await prisma.choice.findMany({
    where: { questionId: p1Soru.id },
    select: { id: true, isCorrect: true, errorType: true },
  });
  const dogruSik = p1Anahtar.find((c) => c.isCorrect)!;
  const yanlis = p1Anahtar.find((c) => !c.isCorrect && c.errorType && c.errorType !== "DIGER") ?? p1Anahtar.find((c) => !c.isCorrect)!;
  const ilkCevap = await answerPractice({ sessionId: p1, userId: user.id, questionId: p1Soru.id, choiceId: yanlis.id, timeSpentMs: 40_000 });
  check("cevap kaydedildi", ilkCevap.yeni);
  const v2 = await getPracticeSession(p1, user.id);
  const fb = v2.questions[0].feedback;
  check("geri bildirim geldi", fb !== null);
  check("yanlış olarak işaretli", fb?.isCorrect === false && fb.selectedChoiceId === yanlis.id);
  check("doğru şık gösteriliyor", fb?.correctChoiceId === dogruSik.id);
  check(
    "yanlış şıkkın hata tipi ve reçetesi",
    yanlis.errorType && yanlis.errorType !== "DIGER" ? Boolean(fb?.errorLabel && fb.errorAdvice) : fb?.errorLabel === null,
    `${yanlis.errorType ?? "etiketsiz"} → ${fb?.errorLabel ?? "yok"}`
  );
  const p1Kapali = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: p1 },
    select: { status: true, submittedAt: true, result: { select: { id: true } } },
  });
  check("son soru cevaplanınca alıştırma kapandı, SONUÇ SATIRI YOK", p1Kapali.status === "SUBMITTED" && !p1Kapali.result);

  const ikinciCevap = await answerPractice({ sessionId: p1, userId: user.id, questionId: p1Soru.id, choiceId: dogruSik.id, timeSpentMs: 1 });
  const kayit = await prisma.answer.findFirstOrThrow({ where: { sessionItem: { sessionId: p1 } }, select: { choiceId: true, isCorrect: true } });
  check("cevap KİLİTLİ: ikinci gönderim hiçbir şeyi değiştirmiyor", !ikinciCevap.yeni && kayit.choiceId === yanlis.id && kayit.isCorrect === false);

  // ── 8. "Bu konuda çalış" ───────────────────────────────────
  console.log("\nBu konuda çalış:");
  const konuId = kSoru.topicId;
  const p2 = await konuCalismasiBaslat(user.id, konuId, examId);
  const p2Satir = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: p2 },
    select: {
      kind: true,
      practiceMode: true,
      focusTopicId: true,
      items: { select: { questionId: true, question: { select: { topicId: true } } } },
    },
  });
  const p2Ids = p2Satir.items.map((i) => i.questionId);
  check("PRACTICE / TOPIC, odak konu saklanıyor", p2Satir.kind === "PRACTICE" && p2Satir.practiceMode === "TOPIC" && p2Satir.focusTopicId === konuId);
  check(`1-${KONU_CALISMA_SORU} soru, hepsi o konudan`, p2Ids.length >= 1 && p2Ids.length <= KONU_CALISMA_SORU && p2Satir.items.every((i) => i.question.topicId === konuId), `${p2Ids.length} soru`);
  check("kaynak testin sorusu yok", p2Ids.every((id) => !examIds.includes(id)));
  check("açık sınavın sorusu yok", p2Ids.every((id) => !acikIds.has(id)));
  check("az önce çözülen benzer soru yok", !p2Ids.includes(benzerId));
  check("yarım alıştırma ikinci kez açılmıyor", (await konuCalismasiBaslat(user.id, konuId, examId)) === p2);
  const testinKonulari = (
    await prisma.question.findMany({ where: { id: { in: examIds } }, select: { topicId: true } })
  ).map((q) => q.topicId);
  const olculmemis = await prisma.topic.findFirst({
    where: { id: { notIn: testinKonulari }, questions: { some: { status: "PUBLISHED" } } },
    select: { id: true },
  });
  if (olculmemis) {
    check("testte ölçülmemiş konuda açılmıyor", (await reddeder(() => konuCalismasiBaslat(user.id, olculmemis.id, examId))));
  }

  const v3 = await getPracticeSession(p2, user.id);
  const ilk = v3.questions[0];
  await answerPractice({ sessionId: p2, userId: user.id, questionId: ilk.id, choiceId: null, timeSpentMs: 5_000 });
  const v4 = await getPracticeSession(p2, user.id);
  check("\"Bilmiyorum\" boş sayılıyor ve çözüm açılıyor", v4.questions[0].feedback?.isCorrect === null && v4.questions[0].feedback?.correctChoiceId !== null);
  const digerleri = v4.questions.slice(1);
  check(
    "cevaplanmayan sorularda geri bildirim de anahtar da YOK",
    digerleri.every((q) => q.feedback === null && !ANAHTAR_IZLERI.some((iz) => JSON.stringify(q).includes(iz))),
    `${digerleri.length} soru`
  );

  // ── 9. Ölçüm kirlenmiyor ───────────────────────────────────
  console.log("\nÖlçüm temiz:");
  const sayacSonra = await sayaclar();
  check(
    "soru ve şık sayaçları alıştırmadan etkilenmedi",
    sayacSonra.shown === sayacOnce.shown && sayacSonra.correct === sayacOnce.correct && sayacSonra.chosen === sayacOnce.chosen,
    `gösterim ${sayacOnce.shown}→${sayacSonra.shown}, doğru ${sayacOnce.correct}→${sayacSonra.correct}, şık ${sayacOnce.chosen}→${sayacSonra.chosen}`
  );
  check(
    "alıştırmanın sonuç satırı yok",
    (await prisma.checkupResult.count({ where: { session: { userId: user.id, kind: "PRACTICE" } } })) === 0
  );

  // ── 10. Süre dolunca: kapanır, puanlanmaz, açılmaz ─────────
  console.log("\nSüre dolunca:");
  await prisma.checkupSession.update({ where: { id: p2 }, data: { expiresAt: new Date(Date.now() - 3600_000) } });
  await expireStaleSessions();
  const p2Son = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: p2 },
    select: { status: true, result: { select: { id: true } } },
  });
  check("süresi dolan alıştırma kapandı (EXPIRED), sonuç yok", p2Son.status === "EXPIRED" && !p2Son.result);
  const v5 = await getPracticeSession(p2, user.id);
  check(
    "kapanınca da cevaplanmayanların anahtarı açılmıyor",
    v5.questions.slice(1).every((q) => q.feedback === null && !ANAHTAR_IZLERI.some((iz) => JSON.stringify(q).includes(iz)))
  );
  check(
    "kapanan alıştırmaya cevap yazılamıyor",
    (await reddeder(() =>
      answerPractice({ sessionId: p2, userId: user.id, questionId: v5.questions[1]?.id ?? ilk.id, choiceId: null, timeSpentMs: 1 })
    )) || v5.questions.length === 1
  );
  const sayacKapanis = await sayaclar();
  check("cron kapanışı sayaçlara dokunmadı", sayacKapanis.shown === sayacOnce.shown && sayacKapanis.chosen === sayacOnce.chosen);

  // ── 11. Teyit turu bekleyen kazanım korunuyor ──────────────
  console.log("\nSeviyeli check-up teyit turu:");
  // Kazanımı olan ve ŞU AN benzeri bulunan bir yanlış: koruma devreye girince "yok" olmalı.
  const simdiki = await benzerDurumlari(user.id, examId);
  const kazanimlilar = await prisma.question.findMany({
    where: { id: { in: yanlisVeBos }, objectiveId: { not: null } },
    select: { id: true, objectiveId: true },
  });
  const kazanimliKaynak = kazanimlilar.find((q) => simdiki.get(q.id) === true);
  if (kazanimliKaynak?.objectiveId) {
    const kosu = await prisma.levelRun.create({
      data: { userId: user.id, examScope: "TYT", pendingRemedialIds: [kazanimliKaynak.objectiveId] },
      select: { id: true },
    });
    const korunmus = await benzerDurumlari(user.id, examId);
    check("teyit turu bekleyen kazanımdan benzer soru verilmiyor", korunmus.get(kazanimliKaynak.id) === false);
    await prisma.levelRun.delete({ where: { id: kosu.id } });
    const sonra = await benzerDurumlari(user.id, examId);
    check("teyit turu bitince benzer yine var", sonra.get(kazanimliKaynak.id) === true);
  } else {
    check("benzeri olan kazanımlı yanlış bulundu (teyit turu denetimi için)", false, `${kazanimlilar.length} kazanımlı`);
  }

  // ── 12. Günlük sınır ───────────────────────────────────────
  console.log("\nGünlük sınır:");
  const doldurucu = await prisma.question.findMany({
    where: { status: "PUBLISHED" },
    take: GUNLUK_ALISTIRMA_SORU,
    select: { id: true },
  });
  const sahte = await prisma.checkupSession.create({
    data: {
      userId: user.id,
      packageId: (await prisma.checkupSession.findUniqueOrThrow({ where: { id: p1 }, select: { packageId: true } })).packageId,
      kind: "PRACTICE",
      practiceMode: "TOPIC",
      status: "EXPIRED",
      durationMinutes: 60,
      penaltyRatio: 0,
      expiresAt: new Date(),
      items: { create: doldurucu.map((q, i) => ({ questionId: q.id, sortOrder: i, questionVersion: 1 })) },
    },
    select: { id: true },
  });
  check("hak bitti", (await alistirmaHakki(user.id)) === 0);
  const sinir = await hataVerir(() => benzeriniCozBaslat(user.id, examId, benzeriOlan[1] ?? kaynakId));
  check("hak bitince benzer soru açılmıyor", sinir !== null && sinir.includes("hakkın doldu"), sinir ?? "");
  check(
    "hak bitince konu çalışması açılmıyor",
    ((await hataVerir(() => konuCalismasiBaslat(user.id, konuId, examId))) ?? "").includes("hakkın doldu")
  );
  await prisma.checkupSession.delete({ where: { id: sahte.id } });

  // ── 13. Sınav akışı aynen çalışıyor ────────────────────────
  console.log("\nSınav akışı:");
  const acikPuan = await submitCheckup(acikSinav, user.id);
  check(
    "alıştırmalar açıkken başlayan sınav normal puanlanıyor",
    acikPuan.correctCount + acikPuan.wrongCount + acikPuan.blankCount === acik.questions.length
  );
  const sayacSinav = await sayaclar();
  check("sayaçlar yalnızca sınavla arttı", sayacSinav.shown - sayacOnce.shown === acik.questions.length, `+${sayacSinav.shown - sayacOnce.shown}`);

  // ══ YANLIŞ DEFTERİ ══════════════════════════════════════════
  const simdi = () => new Date();

  // ── 14. Puanlanan ölçüm deftere yazar ──────────────────────
  console.log("\nYanlış defteri — ölçümden madde:");
  const examSatir = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: examId },
    select: { submittedAt: true, expiresAt: true, packageId: true },
  });
  const examBitis =
    examSatir.submittedAt! < examSatir.expiresAt ? examSatir.submittedAt! : examSatir.expiresAt;
  const examMaddeleri = await prisma.notebookItem.findMany({
    where: { userId: user.id, lastSessionId: examId },
    select: {
      questionId: true,
      stage: true,
      dueAt: true,
      resolvedAt: true,
      examScope: true,
      topicId: true,
      lastReviewedAt: true,
      question: { select: { topicId: true } },
    },
  });
  check(
    "yanlış ve boşların hepsi deftere girdi, doğrular girmedi",
    examMaddeleri.length === yanlisVeBos.length &&
      examMaddeleri.every((m) => yanlisVeBos.includes(m.questionId)),
    `${examMaddeleri.length}/${yanlisVeBos.length}`
  );
  check(
    `yeni madde ilk aşamada, ${TEKRAR_ARALIKLARI_GUN[0]} gün sonra (gün başı)`,
    examMaddeleri.every(
      (m) =>
        m.stage === 0 &&
        m.resolvedAt === null &&
        m.dueAt.getTime() === vade(examBitis, TEKRAR_ARALIKLARI_GUN[0]).getTime()
    )
  );
  check("madde sınavı ve konuyu taşıyor", examMaddeleri.every((m) => m.examScope === "TYT" && m.topicId === m.question.topicId));
  const benzerKaynakMaddesi = examMaddeleri.find((m) => m.questionId === kaynakId);
  check(
    "\"Benzerini çöz\" cevabı defteri ilerletmedi (aralıklı tekrar değil)",
    benzerKaynakMaddesi?.stage === 0 && benzerKaynakMaddesi.lastReviewedAt === null
  );
  const alistirmaSorulari = (
    await prisma.sessionItem.findMany({
      where: { session: { userId: user.id, kind: "PRACTICE" } },
      select: { questionId: true },
    })
  ).map((i) => i.questionId);
  check(
    "alıştırmada yanlış yapılan soru deftere girmedi",
    (await prisma.notebookItem.count({ where: { userId: user.id, questionId: { in: alistirmaSorulari } } })) === 0
  );
  check(
    "açıkken başlayan ikinci sınavın boşları da girdi",
    (await prisma.notebookItem.count({ where: { userId: user.id, lastSessionId: acikSinav } })) === acik.questions.length
  );

  // ── 15. İdempotent: yeniden puanlama madde çoğaltmaz, ilerlemeyi silmez
  console.log("\nYanlış defteri — yeniden puanlama:");
  const fotograf = async () =>
    JSON.stringify(
      await prisma.notebookItem.findMany({
        where: { userId: user.id },
        orderBy: { questionId: "asc" },
        select: { questionId: true, stage: true, dueAt: true, resolvedAt: true, wrongCount: true, lastSessionId: true, updatedAt: true },
      })
    );
  const once = await fotograf();
  const tekrarYazim = await defteriGuncelle(examId);
  await submitCheckup(examId, user.id);
  check(
    "aynı ölçüm ikinci kez işlenince hiçbir madde değişmedi",
    tekrarYazim.yeni === 0 && tekrarYazim.sifirlanan === 0 && (await fotograf()) === once
  );

  // Bir maddeyi tekrarda ilerlemiş say; eski ölçümün yeniden işlenmesi onu silmemeli.
  const ilerleyen = examMaddeleri[0].questionId;
  const tekrarAni = simdi();
  await prisma.notebookItem.update({
    where: { userId_questionId: { userId: user.id, questionId: ilerleyen } },
    data: { stage: 1, lastReviewedAt: tekrarAni, dueAt: vade(tekrarAni, TEKRAR_ARALIKLARI_GUN[1]) },
  });
  await defteriGuncelle(examId);
  const ilerlemis = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ilerleyen } },
    select: { stage: true },
  });
  check("yeniden puanlama tekrar ilerlemesini silmedi", ilerlemis.stage === 1);

  // Geç puanlanan ESKİ bir ölçüm (bitişi tekrardan önce) de silmemeli.
  const eskiOlcum = await elleOlcum(user.id, examSatir.packageId, [ilerleyen], new Date(tekrarAni.getTime() - 3600_000));
  const eskiSonuc = await defteriGuncelle(eskiOlcum.id);
  const eskidenSonra = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ilerleyen } },
    select: { stage: true, lastSessionId: true },
  });
  check(
    "geç puanlanan eski ölçüm ilerlemeyi silmedi",
    eskiSonuc.sifirlanan === 0 && eskidenSonra.stage === 1 && eskidenSonra.lastSessionId !== eskiOlcum.id
  );

  // Daha YENİ bir ölçümde aynı soru yine yanlış: başa döner, sayaç artar.
  const yeniOlcum = await elleOlcum(user.id, examSatir.packageId, [ilerleyen], new Date(tekrarAni.getTime() + 60_000));
  await defteriGuncelle(yeniOlcum.id);
  const basaDonen = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ilerleyen } },
    select: { stage: true, wrongCount: true, lastSessionId: true },
  });
  check(
    "yeni ölçümdeki yanlış maddeyi başa aldı (madde çoğalmadı)",
    basaDonen.stage === 0 && basaDonen.wrongCount === 2 && basaDonen.lastSessionId === yeniOlcum.id &&
      (await prisma.notebookItem.count({ where: { userId: user.id, questionId: ilerleyen } })) === 1
  );

  // Defterden çıkmış madde yeni yanlışta yeniden açılır.
  const cikan = examMaddeleri[1].questionId;
  await prisma.notebookItem.update({
    where: { userId_questionId: { userId: user.id, questionId: cikan } },
    data: { stage: 2, resolvedAt: simdi(), lastReviewedAt: simdi() },
  });
  const sonrakiOlcum = await elleOlcum(user.id, examSatir.packageId, [cikan], new Date(Date.now() + 120_000));
  await defteriGuncelle(sonrakiOlcum.id);
  const acilan = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: cikan } },
    select: { stage: true, resolvedAt: true },
  });
  check("çıkmış madde yeni yanlışta yeniden açıldı", acilan.resolvedAt === null && acilan.stage === 0);

  // ── 16. Cron: süresi dolan test puanlanınca da yazar ───────
  console.log("\nYanlış defteri — süresi dolan test (cron):");
  const cronSinav = await startCheckup(user.id, PAKET);
  const cronOturum = await getStudentSession(cronSinav, user.id);
  const cronSoru = cronOturum.questions[0];
  const cronYanlis = (
    await prisma.choice.findFirstOrThrow({ where: { questionId: cronSoru.id, isCorrect: false }, select: { id: true } })
  ).id;
  await saveAnswer({ sessionId: cronSinav, userId: user.id, questionId: cronSoru.id, choiceId: cronYanlis, timeSpentMs: 5_000 });
  const cronBitis = new Date(Date.now() - 2 * 60_000);
  await prisma.checkupSession.update({ where: { id: cronSinav }, data: { expiresAt: cronBitis } });
  await expireStaleSessions();
  const cronMaddeleri = await prisma.notebookItem.findMany({
    where: { userId: user.id, questionId: { in: cronOturum.questions.map((q) => q.id) } },
    select: { lastSessionId: true, lastWrongAt: true },
  });
  check(
    "cron'un puanladığı testin yanlış ve boşlarının hepsi defterde",
    cronMaddeleri.length === cronOturum.questions.length,
    `${cronMaddeleri.length}/${cronOturum.questions.length}`
  );
  // Havuz dar: tekrar engeli gevşeyince bir soru önceki testten de gelmiş
  // olabilir. O madde daha YENİ yanlışını (önceki testin bitişi) korur.
  const cronunYazdiklari = cronMaddeleri.filter((m) => m.lastSessionId === cronSinav);
  check(
    "yanlışın zamanı testin süresinin bittiği an (puanlandığı an değil)",
    cronunYazdiklari.length > 0 && cronunYazdiklari.every((m) => m.lastWrongAt.getTime() === cronBitis.getTime()),
    `${cronunYazdiklari.length} madde`
  );
  check(
    "cron'un yazmadığı madde daha yeni bir yanlışı taşıyor",
    cronMaddeleri
      .filter((m) => m.lastSessionId !== cronSinav)
      .every((m) => m.lastWrongAt.getTime() >= cronBitis.getTime())
  );

  // ── 17. Bugünkü tekrar ─────────────────────────────────────
  console.log("\nBugünkü tekrar:");
  // Defterin hepsini bugüne çek (vadesi gelmiş say).
  await prisma.notebookItem.updateMany({
    where: { userId: user.id, resolvedAt: null },
    data: { dueAt: new Date(Date.now() - 3600_000) },
  });
  const durum1 = await bugunkuTekrarDurumu(user.id);
  check(
    `vadesi gelen var, bugün en fazla ${GUNLUK_TEKRAR_SORU} soru`,
    durum1.vadesiGelen > 0 && durum1.hazir > 0 && durum1.hazir <= GUNLUK_TEKRAR_SORU && durum1.acik === null,
    `${durum1.vadesiGelen} vadeli, ${durum1.hazir} hazır, ${durum1.benzeriYok} benzersiz`
  );
  const t1 = await tekrarBaslat(user.id, "TYT");
  const t1Satir = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: t1 },
    select: {
      kind: true,
      practiceMode: true,
      startedAt: true,
      items: { orderBy: { sortOrder: "asc" }, select: { questionId: true, sourceQuestionId: true } },
    },
  });
  check("oturum PRACTICE / REVIEW", t1Satir.kind === "PRACTICE" && t1Satir.practiceMode === "REVIEW");
  check("soru sayısı bugünkü hazır sayısı kadar", t1Satir.items.length === durum1.hazir, `${t1Satir.items.length}`);
  const defterSorulari = new Set(
    (await prisma.notebookItem.findMany({ where: { userId: user.id, resolvedAt: null }, select: { questionId: true } })).map(
      (m) => m.questionId
    )
  );
  check(
    "her soru bir defter maddesinin benzeri, asla kendisi; aynı soru iki kez yok",
    t1Satir.items.every((i) => i.sourceQuestionId && defterSorulari.has(i.sourceQuestionId) && i.questionId !== i.sourceQuestionId) &&
      new Set(t1Satir.items.map((i) => i.questionId)).size === t1Satir.items.length &&
      t1Satir.items.every((i) => !defterSorulari.has(i.questionId))
  );
  const iliskiler = await Promise.all(
    t1Satir.items.map(async (i) => {
      const [k, b] = await Promise.all(
        [i.sourceQuestionId!, i.questionId].map((id) =>
          prisma.question.findUniqueOrThrow({
            where: { id },
            select: { id: true, topicId: true, objectiveId: true, level: true, difficulty: true },
          })
        )
      );
      return benzerMi(
        { questionId: k.id, topicId: k.topicId, objectiveId: k.objectiveId, level: k.level, difficulty: k.difficulty },
        { questionId: b.id, topicId: b.topicId, objectiveId: b.objectiveId, level: b.level, difficulty: b.difficulty }
      );
    })
  );
  check("benzerlik kuralı (kazanım/konu, seviye, zorluk ±1) her soruda tutuyor", iliskiler.every(Boolean));
  check("yarım tekrar ikinci kez açılmıyor", (await tekrarBaslat(user.id, "TYT")) === t1);
  const durumAcik = await bugunkuTekrarDurumu(user.id);
  check("panoda yarım tekrar görünüyor", durumAcik.acik?.id === t1 && durumAcik.hazir === 0);

  const tv1 = await getPracticeSession(t1, user.id);
  check(
    "tekrarda da cevaplanmadan anahtar YOK",
    tv1.questions.every((q) => q.feedback === null) && !ANAHTAR_IZLERI.some((iz) => JSON.stringify(tv1).includes(iz))
  );

  // Doğru → sonraki aralık; yanlış → başa; "Bilmiyorum" → başa.
  const anahtarOf = async (qid: string) =>
    (await prisma.choice.findFirstOrThrow({ where: { questionId: qid, isCorrect: true }, select: { id: true } })).id;
  const yanlisOf = async (qid: string) =>
    (await prisma.choice.findFirstOrThrow({ where: { questionId: qid, isCorrect: false }, select: { id: true } })).id;
  const madde = (qid: string) =>
    prisma.notebookItem.findUniqueOrThrow({
      where: { userId_questionId: { userId: user.id, questionId: qid } },
      select: { stage: true, dueAt: true, resolvedAt: true, lastReviewedAt: true },
    });

  const [ia, ib, ic] = t1Satir.items;
  const sayacTekrarOnce = await sayaclar();
  const once_a = await madde(ia.sourceQuestionId!);
  await answerPractice({ sessionId: t1, userId: user.id, questionId: ia.questionId, choiceId: await anahtarOf(ia.questionId), timeSpentMs: 9_000 });
  const sonra_a = await madde(ia.sourceQuestionId!);
  check(
    `doğru tekrar maddeyi ilerletti (+${TEKRAR_ARALIKLARI_GUN[once_a.stage + 1] ?? "çıkış"} gün)`,
    sonra_a.stage === once_a.stage + 1 &&
      sonra_a.dueAt.getTime() === vade(sonra_a.lastReviewedAt!, TEKRAR_ARALIKLARI_GUN[once_a.stage + 1]).getTime(),
    `aşama ${once_a.stage}→${sonra_a.stage}`
  );
  const tv2 = await getPracticeSession(t1, user.id);
  const notA = tv2.questions.find((q) => q.id === ia.questionId)?.feedback?.defterNotu ?? "";
  check("geri bildirimde defter notu", notA.includes("sıradaki tekrar"), notA);

  if (ib) {
    await answerPractice({ sessionId: t1, userId: user.id, questionId: ib.questionId, choiceId: await yanlisOf(ib.questionId), timeSpentMs: 9_000 });
    const sonra_b = await madde(ib.sourceQuestionId!);
    check(
      `yanlış tekrar maddeyi başa aldı (${TEKRAR_ARALIKLARI_GUN[0]} gün)`,
      sonra_b.stage === 0 && sonra_b.dueAt.getTime() === vade(sonra_b.lastReviewedAt!, TEKRAR_ARALIKLARI_GUN[0]).getTime()
    );
  }
  if (ic) {
    await answerPractice({ sessionId: t1, userId: user.id, questionId: ic.questionId, choiceId: null, timeSpentMs: 3_000 });
    const sonra_c = await madde(ic.sourceQuestionId!);
    check("\"Bilmiyorum\" da başa alıyor", sonra_c.stage === 0 && sonra_c.lastReviewedAt !== null);
  }

  // Aynı oturumun cevabı maddeyi ikinci kez ilerletmez (iki açık tekrar, çift dokunuş).
  const ikinciIslem = await tekrarIsle({
    userId: user.id,
    questionId: ia.sourceQuestionId!,
    dogru: true,
    oturumBasi: t1Satir.startedAt,
    now: simdi(),
  });
  check("aynı madde aynı oturumda iki kez ilerlemiyor", ikinciIslem === "ATLANDI" && (await madde(ia.sourceQuestionId!)).stage === sonra_a.stage);

  // Son aşamada doğru → defterden çıkar.
  const sonAsama = t1Satir.items[3] ?? null;
  if (sonAsama) {
    await prisma.notebookItem.update({
      where: { userId_questionId: { userId: user.id, questionId: sonAsama.sourceQuestionId! } },
      data: { stage: TEKRAR_ARALIKLARI_GUN.length - 1 },
    });
    await answerPractice({ sessionId: t1, userId: user.id, questionId: sonAsama.questionId, choiceId: await anahtarOf(sonAsama.questionId), timeSpentMs: 9_000 });
    const cikti = await madde(sonAsama.sourceQuestionId!);
    check("son aşamada doğru → defterden çıktı", cikti.resolvedAt !== null);
    const tv3 = await getPracticeSession(t1, user.id);
    const notD = tv3.questions.find((q) => q.id === sonAsama.questionId)?.feedback?.defterNotu ?? "";
    check("çıkış notu", notD.includes("defterden çıktı"), notD);
  }

  // Sayaçlar ve sonuç: tekrar da ölçüm değil.
  const sayacTekrar = await sayaclar();
  check(
    "tekrar cevapları soru/şık sayaçlarına dokunmadı",
    sayacTekrar.shown === sayacTekrarOnce.shown &&
      sayacTekrar.correct === sayacTekrarOnce.correct &&
      sayacTekrar.chosen === sayacTekrarOnce.chosen
  );
  check(
    "tekrarın sonuç satırı yok",
    (await prisma.checkupResult.count({ where: { sessionId: t1 } })) === 0
  );

  // ── 18. Günlük sınır ve teyit turu ─────────────────────────
  console.log("\nBugünkü tekrar — sınırlar:");
  // Yarım tekrarı kapat; bugünün kalan hakkını dolduran sahte bir tekrar ekle.
  await prisma.checkupSession.update({ where: { id: t1 }, data: { status: "EXPIRED" } });
  const doldur = GUNLUK_TEKRAR_SORU - t1Satir.items.length;
  if (doldur > 0) {
    const bos = await prisma.question.findMany({ where: { status: "PUBLISHED" }, take: doldur, select: { id: true } });
    await prisma.checkupSession.create({
      data: {
        userId: user.id,
        packageId: examSatir.packageId,
        kind: "PRACTICE",
        practiceMode: "REVIEW",
        status: "EXPIRED",
        durationMinutes: 60,
        penaltyRatio: 0,
        expiresAt: new Date(),
        items: { create: bos.map((q, i) => ({ questionId: q.id, sortOrder: i, questionVersion: 1 })) },
      },
    });
  }
  const durumDolu = await bugunkuTekrarDurumu(user.id);
  check("günlük sınır dolunca bugün hazır soru yok", durumDolu.hazir === 0 && durumDolu.bugunTekrarlanan >= GUNLUK_TEKRAR_SORU);
  const sinirMesaji = await hataVerir(() => tekrarBaslat(user.id, "TYT"));
  check("günlük sınır dolunca tekrar açılmıyor", (sinirMesaji ?? "").includes("bitirdin"), sinirMesaji ?? "");
  // Sınır testi bitti: bugünkü tekrar oturumlarını sil (sınır sıfırlansın).
  await prisma.checkupSession.deleteMany({ where: { userId: user.id, kind: "PRACTICE", practiceMode: "REVIEW" } });

  // Teyit turu bekleyen kazanımın maddesi bekletilir.
  const kazanimliMadde = await prisma.notebookItem.findFirst({
    where: { userId: user.id, resolvedAt: null, objectiveId: { not: null } },
    select: { questionId: true, objectiveId: true },
  });
  if (kazanimliMadde?.objectiveId) {
    await prisma.notebookItem.updateMany({ where: { userId: user.id, resolvedAt: null }, data: { dueAt: new Date(Date.now() - 3600_000) } });
    const kosu = await prisma.levelRun.create({
      data: { userId: user.id, examScope: "TYT", pendingRemedialIds: [kazanimliMadde.objectiveId] },
      select: { id: true },
    });
    const durumTeyit = await bugunkuTekrarDurumu(user.id);
    check("teyit turu bekleyen madde sayılıyor", durumTeyit.teyitBekleyen >= 1, `${durumTeyit.teyitBekleyen}`);
    let t2: string | null = null;
    const t2Hata = await hataVerir(async () => {
      t2 = await tekrarBaslat(user.id, "TYT");
    });
    if (t2) {
      const t2Items = await prisma.sessionItem.findMany({
        where: { sessionId: t2 },
        select: { sourceQuestionId: true, question: { select: { objectiveId: true } } },
      });
      check(
        "teyit turu bekleyen kazanımdan madde de soru da gelmiyor",
        t2Items.every(
          (i) => i.sourceQuestionId !== kazanimliMadde.questionId && i.question.objectiveId !== kazanimliMadde.objectiveId
        ),
        `${t2Items.length} soru`
      );
    } else {
      check("teyit turu varken tekrar açılabildi", false, t2Hata ?? "");
    }
    await prisma.levelRun.delete({ where: { id: kosu.id } });
  } else {
    check("kazanımlı madde bulundu (teyit turu denetimi için)", false);
  }

  await temizle([user.id, other.id]);
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
