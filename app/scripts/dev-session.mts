/**
 * Geliştirme yardımcısı: var olan bir öğrenci için oturum çerezi basar ki
 * ekranlar tarayıcıda parola bilmeden açılabilsin.
 *
 *   npx tsx scripts/dev-session.mts <e-posta>        → çerez değerini yazar
 *   npx tsx scripts/dev-session.mts --temizle         → bu betiğin açtığı oturumları siler
 *
 * ⚠️ YALNIZCA GELİŞTİRME. NODE_ENV=production altında çalışmaz.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/db";

if (process.env.NODE_ENV === "production") throw new Error("Bu betik üretimde çalıştırılamaz.");

const UA = "dev-session.mts";
const arg = process.argv[2];

if (arg === "--temizle") {
  const r = await prisma.authSession.deleteMany({ where: { userAgent: UA } });
  console.log(`${r.count} geliştirme oturumu silindi.`);
} else {
  if (!arg) throw new Error("E-posta ver.");
  const user = await prisma.user.findUniqueOrThrow({ where: { email: arg }, select: { id: true, name: true } });
  const token = randomBytes(32).toString("base64url");
  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 2 * 3600_000),
      userAgent: UA,
    },
  });
  console.log(`${user.name} için 2 saatlik oturum. Çerez:`);
  console.log(`kocum_sess=${token}`);
}
await prisma.$disconnect();
