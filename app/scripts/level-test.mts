import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { grantEntitlement } from "../lib/entitlements";
import { saveAnswer, submitCheckup, getStudentSession } from "../lib/checkup";
import {
  seviyeliSinavBaslat,
  asamaDegerlendir,
  asamaAc,
  aktifKosu,
  telafiyiAc,
} from "../lib/level-run";
import { ayarGetir } from "../lib/levels";

/**
 * Seviyeli check-up — uçtan uca akış testi.
 *
 *   npm run test:levels
 *
 * Neden ayrı test: kapı mantığının saf hâli smoke'ta sınanıyor, ama asıl
 * risk orada değil. Asıl risk telafi turunda AYNI SORUNUN tekrar gelmesi —
 * o olursa öğrenci soruyu hatırlar, doğru yapar, sistem kazanımın
 * oturduğunu sanır ve ölçüm sessizce çöker. Bu test onu denetliyor.
 */

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const EMAIL_A = "level-test-a@kocum.local";
const EMAIL_B = "level-test-b@kocum.local";
const SINAV = "TYT" as const;

async function kullanici(email: string) {
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Seviye Testi",
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: SINAV,
      onboardedAt: new Date(),
    },
    update: {},
    select: { id: true },
  });

  const paket = await prisma.package.findFirstOrThrow({
    where: { kind: "LEVEL", examScope: SINAV },
    select: { id: true },
  });
  await prisma.entitlement.deleteMany({ where: { userId: u.id } });
  await grantEntitlement({
    userId: u.id,
    packageId: paket.id,
    expiresAt: new Date(Date.now() + 86_400_000),
    source: "level-test",
  });
  return u.id;
}

/** Oturumun sorularını, doğru şık kimlikleriyle birlikte getirir. */
async function cevapAnahtari(sessionId: string) {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: {
      questionId: true,
      question: {
        select: {
          objectiveId: true,
          choices: { select: { id: true, isCorrect: true } },
        },
      },
    },
  });
  return items.map((i) => ({
    questionId: i.questionId,
    objectiveId: i.question.objectiveId,
    dogruChoiceId: i.question.choices.find((c) => c.isCorrect)?.id ?? null,
    yanlisChoiceId: i.question.choices.find((c) => !c.isCorrect)?.id ?? null,
  }));
}

/** İlk `dogruAdet` soruyu doğru, kalanını yanlış işaretler. */
async function cevapla(sessionId: string, userId: string, dogruAdet: number) {
  const anahtar = await cevapAnahtari(sessionId);
  for (const [i, s] of anahtar.entries()) {
    const choiceId = i < dogruAdet ? s.dogruChoiceId : s.yanlisChoiceId;
    if (!choiceId) continue;
    await saveAnswer({ sessionId, userId, questionId: s.questionId, choiceId, timeSpentMs: 5000 });
  }
  return anahtar;
}

async function main() {
  console.log("\nSeviyeli check-up — uçtan uca\n");

  const ayar = ayarGetir(SINAV);
  const userA = await kullanici(EMAIL_A);
  await prisma.levelRun.deleteMany({ where: { userId: userA } });

  // ── Seviye 1 ana tur ─────────────────────────────────────
  console.log("Seviye 1 ana tur:");
  const { runId, sessionId: s1 } = await seviyeliSinavBaslat(userA, SINAV);
  const oturum1 = await getStudentSession(s1, userA);
  check("Seviye 1 oturumu açıldı", oturum1.questions.length > 0, `${oturum1.questions.length} soru`);

  const anahtar1 = await cevapAnahtari(s1);
  const kazanimlar1 = anahtar1.map((a) => a.objectiveId).filter(Boolean);
  check(
    "her soru bir kazanıma bağlı",
    kazanimlar1.length === anahtar1.length,
    `${kazanimlar1.length}/${anahtar1.length}`
  );
  check(
    "aynı kazanımdan iki soru YOK",
    new Set(kazanimlar1).size === kazanimlar1.length,
    `${new Set(kazanimlar1).size} farklı kazanım`
  );

  // Telafi turunu tetiklemek için barajın hemen altında bırakıyoruz.
  const toplam1 = anahtar1.length;
  const hedefDogru = Math.floor(toplam1 * ayar.seviye1.gecmeOrani) - 1;
  await cevapla(s1, userA, hedefDogru);
  await submitCheckup(s1, userA);
  const karar1 = await asamaDegerlendir(s1, userA);
  check(
    `${hedefDogru}/${toplam1} telafi turunu açtı`,
    karar1.tur === "TELAFI",
    karar1.tur
  );

  // ── Telafi turu ──────────────────────────────────────────
  console.log("");
  console.log("Telafi turu:");
  const bekleyen = await aktifKosu(userA);
  check(
    "telafi HEMEN açılmıyor, bekliyor",
    (bekleyen?.pendingRemedialIds.length ?? 0) > 0 &&
      !bekleyen?.stages.some((s) => s.status === "IN_PROGRESS"),
    `${bekleyen?.pendingRemedialIds.length ?? 0} kazanım bekliyor`
  );

  // Öğrenci uyarıyı okuyup "devam" dedi.
  const telafiId = await telafiyiAc(runId, userA);
  const kosu = await aktifKosu(userA);
  const telafi = kosu?.stages.find((s) => s.id === telafiId);
  check("devam deyince telafi açıldı", Boolean(telafi));
  check("bekleyen liste temizlendi", (kosu?.pendingRemedialIds.length ?? 0) === 0);

  if (telafi) {
    const anahtarT = await cevapAnahtari(telafi.id);
    const eksikler = new Set(
      anahtar1.filter((a, i) => i >= hedefDogru).map((a) => a.objectiveId)
    );

    check(
      "telafi soru sayısı eksik kazanım sayısına eşit",
      anahtarT.length === eksikler.size,
      `${anahtarT.length} soru / ${eksikler.size} eksik kazanım`
    );
    check(
      "telafi YALNIZCA eksik kazanımlardan",
      anahtarT.every((a) => a.objectiveId && eksikler.has(a.objectiveId))
    );

    // EN KRİTİK DENETİM
    const ilkTurSorulari = new Set(anahtar1.map((a) => a.questionId));
    const tekrarEden = anahtarT.filter((a) => ilkTurSorulari.has(a.questionId));
    check(
      "telafide ilk turun sorusu TEKRAR GELMİYOR",
      tekrarEden.length === 0,
      tekrarEden.length === 0 ? "0 tekrar" : `${tekrarEden.length} SORU TEKRARLANDI`
    );

    // Birleşik oranı barajın üstüne çıkar: (hedefDogru + x) / (toplam1 + T) >= 0.55
    const gereken = Math.ceil(
      ayar.telafiSonrasiOran * (toplam1 + anahtarT.length) - hedefDogru
    );
    await cevapla(telafi.id, userA, Math.min(gereken, anahtarT.length));
    await submitCheckup(telafi.id, userA);
    const kararT = await asamaDegerlendir(telafi.id, userA);
    check(
      `birleşik oran barajı aştı → Seviye 2`,
      kararT.tur === "SONRAKI_SEVIYE",
      `${hedefDogru}+${Math.min(gereken, anahtarT.length)} / ${toplam1}+${anahtarT.length}`
    );
  }

  // ── Seviye 2 ─────────────────────────────────────────────
  console.log("");
  console.log("Seviye 2:");
  const { sessionId: s2 } = await asamaAc(runId, 2, "MAIN");
  const anahtar2 = await cevapAnahtari(s2);
  check("Seviye 2 oturumu açıldı", anahtar2.length > 0, `${anahtar2.length} soru`);

  const l1Sorular = new Set([...anahtar1.map((a) => a.questionId)]);
  check(
    "Seviye 2'de Seviye 1'in sorusu yok",
    anahtar2.every((a) => !l1Sorular.has(a.questionId))
  );

  const seviye2Sorular = await prisma.question.findMany({
    where: { id: { in: anahtar2.map((a) => a.questionId) } },
    select: { level: true },
  });
  check(
    "Seviye 2 soruları L2_ORTA",
    seviye2Sorular.every((q) => q.level === "L2_ORTA")
  );

  await cevapla(s2, userA, Math.ceil(anahtar2.length * ayar.seviye2.gecmeOrani));
  await submitCheckup(s2, userA);
  const karar2 = await asamaDegerlendir(s2, userA);
  check("Seviye 2 geçildi → Seviye 3", karar2.tur === "SONRAKI_SEVIYE", karar2.tur);

  // ── Seviye 3 ─────────────────────────────────────────────
  console.log("");
  console.log("Seviye 3:");
  const { sessionId: s3 } = await asamaAc(runId, 3, "MAIN");
  const anahtar3 = await cevapAnahtari(s3);
  check("Seviye 3 oturumu açıldı", anahtar3.length > 0, `${anahtar3.length} soru`);
  await cevapla(s3, userA, Math.floor(anahtar3.length / 2));
  await submitCheckup(s3, userA);
  const karar3 = await asamaDegerlendir(s3, userA);
  check("Seviye 3'te baraj yok, sınav bitti", karar3.tur === "BITTI", karar3.tur);

  const bitmis = await prisma.levelRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true, reachedLevel: true, stoppedAtLevel: true, gateLog: true },
  });
  check("deneme COMPLETED", bitmis.status === "COMPLETED", bitmis.status);
  check("ulaşılan seviye 3", bitmis.reachedLevel === 3, String(bitmis.reachedLevel));
  check(
    "kapı günlüğü dolu",
    Array.isArray(bitmis.gateLog) && (bitmis.gateLog as unknown[]).length === 4,
    `${Array.isArray(bitmis.gateLog) ? (bitmis.gateLog as unknown[]).length : 0} kayıt`
  );

  // ── Durma yolu ───────────────────────────────────────────
  console.log("");
  console.log("Durma yolu (baraj altı):");
  const userB = await kullanici(EMAIL_B);
  await prisma.levelRun.deleteMany({ where: { userId: userB } });
  const b = await seviyeliSinavBaslat(userB, SINAV);
  const anahtarB = await cevapAnahtari(b.sessionId);
  // Telafi turuyla bile barajı aşamayacak kadar düşük.
  await cevapla(b.sessionId, userB, 2);
  await submitCheckup(b.sessionId, userB);
  const kararB = await asamaDegerlendir(b.sessionId, userB);
  check(
    `2/${anahtarB.length} → telafiye sokulmadan durdu`,
    kararB.tur === "DUR",
    kararB.tur
  );

  const durmus = await prisma.levelRun.findUniqueOrThrow({
    where: { id: b.runId },
    select: { status: true, stoppedAtLevel: true, unlockedLevel: true },
  });
  check("deneme STOPPED", durmus.status === "STOPPED", durmus.status);
  check("Seviye 1'de durdu", durmus.stoppedAtLevel === 1);
  check("Seviye 2 KİLİTLİ kaldı", durmus.unlockedLevel === 1, String(durmus.unlockedLevel));

  let kilitCalisti = false;
  try {
    await asamaAc(b.runId, 2, "MAIN");
  } catch {
    kilitCalisti = true;
  }
  check("kilitli seviye açılamıyor", kilitCalisti);

  // ── Temizlik ─────────────────────────────────────────────
  const ids = [userA, userB];
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B] } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
