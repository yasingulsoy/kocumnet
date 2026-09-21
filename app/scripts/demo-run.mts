/**
 * Geliştirme yardımcısı: verilen kullanıcı için bir check-up'ı baştan sona
 * oynatır ve sonuç adresini yazar. Sonuç ekranını gerçek veriyle görmek için.
 *
 *   npx tsx scripts/demo-run.mts <e-posta> <paket-slug> [dogruOrani]
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { startCheckup, getStudentSession, saveAnswer, submitCheckup } from "../lib/checkup";

const email = process.argv[2] ?? "test@kocum.local";
const slug = process.argv[3] ?? "tyt-ilk-15";
const oran = Number(process.argv[4] ?? 0.55);

const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
if (!user) throw new Error(`Kullanıcı yok: ${email}`);

const sessionId = await startCheckup(user.id, slug);
const session = await getStudentSession(sessionId, user.id);

const keys = await prisma.choice.findMany({
  where: { questionId: { in: session.questions.map((q) => q.id) }, isCorrect: true },
  select: { questionId: true, id: true },
});
const correctBy = new Map(keys.map((k) => [k.questionId, k.id]));

for (const [i, q] of session.questions.entries()) {
  // Konu konu değişen bir başarı deseni: harita tek renk çıkmasın.
  const dogruMu = (i * 7919) % 100 < oran * 100;
  if (i % 9 === 4) continue; // bazılarını boş bırak

  const correctId = correctBy.get(q.id)!;
  const choiceId = dogruMu ? correctId : q.choices.find((c) => c.id !== correctId)!.id;

  await saveAnswer({
    sessionId,
    userId: user.id,
    questionId: q.id,
    choiceId,
    timeSpentMs: 40_000 + ((i * 13) % 60) * 1000,
  });
}

const score = await submitCheckup(sessionId, user.id);
console.log(
  `\n  ${score.correctCount}D ${score.wrongCount}Y ${score.blankCount}B · net ${score.netScore}` +
    `\n  http://localhost:3100/sonuc/${sessionId}\n`
);
await prisma.$disconnect();
