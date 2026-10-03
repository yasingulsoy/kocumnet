/**
 * ornek-import.md ile yapılan deneme içe aktarmalarının izlerini siler.
 *   npx tsx scripts/fixtures/temizle-ornek.mts
 */
import "dotenv/config";
import { prisma } from "../../lib/db";

async function main() {
  const partiler = await prisma.importBatch.findMany({ where: { filename: "ornek-import.md" }, select: { id: true } });
  const ids = partiler.map((p) => p.id);
  const sorular = await prisma.question.findMany({
    where: { OR: [{ importBatchId: { in: ids } }, { sourceRef: { startsWith: "ORNEK-" } }] },
    select: { id: true },
  });
  const qids = sorular.map((q) => q.id);
  if (qids.length) {
    await prisma.choice.deleteMany({ where: { questionId: { in: qids } } });
    await prisma.question.deleteMany({ where: { id: { in: qids } } });
  }
  const k = await prisma.objective.deleteMany({ where: { code: { startsWith: "ORNEK-" }, questions: { none: {} } } });
  const b = await prisma.importBatch.deleteMany({ where: { id: { in: ids } } });
  console.log({ silinenSoru: qids.length, silinenKazanim: k.count, silinenParti: b.count });
}

main().finally(() => prisma.$disconnect());
