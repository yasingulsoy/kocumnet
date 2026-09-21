/**
 * Geliştirme yardımcısı: görsel içeren soruyu barındıran tek soruluk bir
 * oturum kurar, BİLEREK yanlış cevaplar ve bitirir.
 *
 * Amaç: sonuç ekranındaki cevap incelemesini gerçek veriyle görmek —
 * şekil, işaretlenen yanlış şık, hata tipi ve çözüm.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { submitCheckup } from "../lib/checkup";

const user = await prisma.user.findUnique({
  where: { email: "test@kocum.local" },
  select: { id: true },
});
if (!user) throw new Error("test@kocum.local yok");

const hepsi = await prisma.question.findMany({
  where: { status: "PUBLISHED" },
  select: { id: true, stem: true, version: true, stemText: true },
});
const gorselli = hepsi.find((q) => JSON.stringify(q.stem).includes('"type":"image"'));
if (!gorselli) throw new Error("Görsel içeren soru bulunamadı");

const pkg = await prisma.package.findFirstOrThrow({
  where: { status: "PUBLISHED" },
  select: { id: true, durationMinutes: true, penaltyRatio: true },
});

await prisma.checkupSession.deleteMany({ where: { userId: user.id, status: "IN_PROGRESS" } });

const session = await prisma.checkupSession.create({
  data: {
    userId: user.id,
    packageId: pkg.id,
    status: "IN_PROGRESS",
    durationMinutes: pkg.durationMinutes,
    penaltyRatio: pkg.penaltyRatio,
    expiresAt: new Date(Date.now() + 30 * 60_000),
    items: {
      create: [{ questionId: gorselli.id, sortOrder: 0, questionVersion: gorselli.version }],
    },
  },
  select: { id: true },
});

// Bilerek yanlış: inceleme ekranında hata tipi ve çözüm görünsün.
const yanlis = await prisma.choice.findFirstOrThrow({
  where: { questionId: gorselli.id, isCorrect: false },
  select: { id: true },
});
const item = await prisma.sessionItem.findFirstOrThrow({
  where: { sessionId: session.id },
  select: { id: true },
});
await prisma.answer.create({
  data: { sessionItemId: item.id, choiceId: yanlis.id, isCorrect: false, timeSpentMs: 140_000 },
});

await submitCheckup(session.id, user.id);

console.log("  soru: " + gorselli.stemText.slice(0, 55));
console.log("  http://localhost:3100/sonuc/" + session.id);
await prisma.$disconnect();
