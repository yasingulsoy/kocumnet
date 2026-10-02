/**
 * Geliştirme yardımcısı: seviyeli check-up'ı istenen noktaya kadar oynatır
 * ve ekranı tarayıcıda görebilmek için bir oturum çerezi üretir.
 *
 *   npx tsx scripts/demo-level.mts [e-posta] [durak]
 *
 * durak:
 *   telafi   → Seviye 1 barajın hemen altında biter, telafi ekranı açılır
 *   seviye2  → telafi geçilir, "Seviye 2'ye hazırsın" ekranı
 *   dur      → baraj çok altında kalır, kilit + karne ekranı
 *   bitti    → üç seviye de tamamlanır, nihai rapor
 *
 * ⚠️ YALNIZCA GELİŞTİRME. Oturum çerezi basıyor.
 */
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../lib/db";
import { saveAnswer, submitCheckup } from "../lib/checkup";
import { seviyeliSinavBaslat, asamaDegerlendir, asamaAc, telafiyiAc } from "../lib/level-run";
import { ayarGetir } from "../lib/levels";
import type { ExamScopeValue } from "../lib/exams";

const email = process.argv[2] ?? "test@kocum.local";
const durak = (process.argv[3] ?? "telafi") as "telafi" | "seviye2" | "dur" | "bitti";

if (process.env.NODE_ENV === "production") {
  throw new Error("Bu betik üretimde çalıştırılamaz.");
}

const user = await prisma.user.findUniqueOrThrow({
  where: { email },
  select: { id: true, targetExam: true },
});
const sinav = (user.targetExam ?? "TYT") as ExamScopeValue;
const ayar = ayarGetir(sinav);

async function anahtar(sessionId: string) {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: {
      questionId: true,
      question: { select: { choices: { select: { id: true, isCorrect: true } } } },
    },
  });
  return items.map((i) => ({
    questionId: i.questionId,
    dogru: i.question.choices.find((c) => c.isCorrect)?.id ?? null,
    yanlis: i.question.choices.find((c) => !c.isCorrect)?.id ?? null,
  }));
}

async function oyna(sessionId: string, dogruAdet: number) {
  const a = await anahtar(sessionId);
  for (const [i, s] of a.entries()) {
    // Bazılarını boş bırak — karnede boş/yanlış ayrımı görünsün.
    if (i >= dogruAdet && i % 7 === 3) continue;
    const choiceId = i < dogruAdet ? s.dogru : s.yanlis;
    if (choiceId) {
      await saveAnswer({
        sessionId,
        userId: user.id,
        questionId: s.questionId,
        choiceId,
        // Bazı sorularda hedefin üstüne çık — "yavaş sorular" dolsun.
        timeSpentMs: i % 5 === 0 ? 180_000 : 30_000,
      });
    }
  }
  await submitCheckup(sessionId, user.id);
  return a.length;
}

await prisma.levelRun.deleteMany({ where: { userId: user.id } });

const { runId, sessionId: s1 } = await seviyeliSinavBaslat(user.id, sinav);
const toplam1 = (await anahtar(s1)).length;

if (durak === "dur") {
  await oyna(s1, 2);
  await asamaDegerlendir(s1, user.id);
} else {
  // Barajın hemen altı → telafi turu açılır.
  await oyna(s1, Math.floor(toplam1 * ayar.seviye1.gecmeOrani) - 1);
  await asamaDegerlendir(s1, user.id);

  if (durak !== "telafi") {
    const telafiId = await telafiyiAc(runId, user.id);
    const telafiToplam = (await anahtar(telafiId)).length;
    const anaDogru = Math.floor(toplam1 * ayar.seviye1.gecmeOrani) - 1;
    const gereken = Math.ceil(
      ayar.telafiSonrasiOran * (toplam1 + telafiToplam) - anaDogru
    );
    await oyna(telafiId, Math.min(gereken, telafiToplam));
    await asamaDegerlendir(telafiId, user.id);

    if (durak === "bitti") {
      const { sessionId: s2 } = await asamaAc(runId, 2, "MAIN");
      const t2 = (await anahtar(s2)).length;
      await oyna(s2, Math.ceil(t2 * ayar.seviye2.gecmeOrani));
      await asamaDegerlendir(s2, user.id);

      const { sessionId: s3 } = await asamaAc(runId, 3, "MAIN");
      const t3 = (await anahtar(s3)).length;
      await oyna(s3, Math.floor(t3 * 0.6));
      await asamaDegerlendir(s3, user.id);
    }
  }
}

// Tarayıcıda bakabilmek için oturum.
const token = randomBytes(32).toString("base64url");
await prisma.authSession.create({
  data: {
    userId: user.id,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 86_400_000),
    userAgent: "demo-level",
  },
});

const son = await prisma.levelRun.findUniqueOrThrow({
  where: { id: runId },
  select: { status: true, unlockedLevel: true, stoppedAtLevel: true, pendingRemedialIds: true },
});

console.log("");
console.log("durum      :", son.status, "| açık seviye:", son.unlockedLevel,
  "| durdu:", son.stoppedAtLevel ?? "-", "| bekleyen telafi:", son.pendingRemedialIds.length);
console.log("adres      : /seviye/" + runId);
console.log("oturum     : kocum_sess=" + token);
console.log("");

await prisma.$disconnect();
