/**
 * Haftalık koçluk postasını gerçek SMTP olmadan dener.
 *
 *   SMTP_URL=log://console npx tsx scripts/digest-test.mts
 *
 * Postalar sunucu günlüğüne yazılır; adaylar damgalanır (lastDigestAt).
 * Yalnızca geliştirmede: üretim verisine karşı çalıştırma.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

if (process.env.NODE_ENV === "production") {
  console.error("Üretimde çalıştırılmaz.");
  process.exit(1);
}
if (!/^log:/i.test(process.env.SMTP_URL ?? "")) {
  console.error("SMTP_URL=log://console ile çalıştır — gerçek posta gitmesin.");
  process.exit(1);
}

const { haftalikPostalariGonder, postaZamaniMi } = await import("../lib/digest");

const now = new Date();
console.log("posta zamanı mı:", postaZamaniMi(now));
const sonuc = await haftalikPostalariGonder(now);
console.log("sonuç:", sonuc);

const ornek = await prisma.user.findFirst({
  where: { onboardedAt: { not: null } },
  orderBy: { createdAt: "asc" },
  select: { email: true, mailToken: true, mailOptOut: true, lastDigestAt: true },
});
console.log("örnek kullanıcı:", ornek);
await prisma.$disconnect();
