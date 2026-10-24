import { prisma } from "@/lib/db";
import { haftaBasi, haftaBasiAni } from "@/lib/coaching";

/**
 * Plandaki soru işinin ("Üçgenler 40 soru", SOLVE) uygulamadaki ilerlemesi.
 *
 * İş eskiden yalnızca "Yaptım" ile kapanıyordu: öğrenci 40 soruyu nerede
 * çözeceğini bilmiyordu, çözse de kimse görmüyordu. Artık "Bugün" kartı
 * uygulamada 5 soruluk alıştırma açıyor ve bu hafta o konudan kaç soru
 * çözüldüğünü sayıyor; hedefe varınca iş kendiliğinden kapanır (doneAt'ı
 * sistem yazar). "Yaptım" yine duruyor: kitaptan çözen öğrenci de var.
 *
 * Sayım (tek tanım, haftalikKonuSorusu):
 *  - yalnızca ALIŞTIRMA cevapları (sınavdaki sorular ölçüm, çalışma değil);
 *  - sorunun konusu işin konusu (benzer soru, konu çalışması, bugünkü tekrar
 *    ve koçun konu ödevi; hepsi aynı konunun sorusu);
 *  - bu Türkiye haftası (pazartesi 00:00'dan, lib/coaching.ts haftaBasiAni);
 *  - "Bilmiyorum" sayılmaz (choiceId boş): soruyu çözmeden geçmek çalışma değil.
 */

/**
 * HOCAYA SORULACAK: plandaki 40 soru gerçekten uygulamada mı sayılsın?
 * Varsayılan evet. false olursa kart ilerleme göstermez, iş yalnızca
 * "Yaptım" ile kapanır ("5 soru çöz" düğmesi yine durur).
 */
export const SORU_ISI_UYGULAMADA = true;

export interface SoruIsiIlerlemesi {
  cozulen: number;
  hedef: number;
  /** Hedefe vardı: iş kendiliğinden kapanır. */
  tamam: boolean;
}

/** İşin hedefi ve bu haftaki sayıdan ilerleme. Hedefsiz işte ya da kural kapalıyken null. */
export function soruIsiIlerlemesi(cozulen: number, hedef: number | null | undefined): SoruIsiIlerlemesi | null {
  if (!SORU_ISI_UYGULAMADA || !hedef || hedef <= 0) return null;
  return { cozulen, hedef, tamam: cozulen >= hedef };
}

/** Bu Türkiye haftasında alıştırmada bu konudan cevaplanan soru ("Bilmiyorum" hariç). */
export async function haftalikKonuSorusu(userId: string, topicId: string, now: Date): Promise<number> {
  return prisma.answer.count({
    where: {
      choiceId: { not: null },
      answeredAt: { gte: haftaBasiAni(now) },
      sessionItem: { question: { topicId }, session: { userId, kind: "PRACTICE" } },
    },
  });
}

export interface PlanSoruDurumu {
  /** Planın kurulduğu test: "5 soru çöz" alıştırması bu testin konusundan açılır. */
  kaynakOturumId: string | null;
  /** Soru işinin kimliği → ilerleme (yalnızca hedefi olan soru işleri). */
  isler: Map<string, SoruIsiIlerlemesi>;
}

/** Pano: bu haftanın planındaki soru işlerinin ilerlemesi. Plan yoksa null. */
export async function planSoruDurumu(userId: string, now: Date): Promise<PlanSoruDurumu | null> {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: haftaBasi(now) } },
    select: {
      sourceSessionId: true,
      items: {
        where: { kind: "SOLVE", topicId: { not: null } },
        select: { id: true, topicId: true, targetQuestionCount: true },
      },
    },
  });
  if (!plan) return null;

  const isler = new Map<string, SoruIsiIlerlemesi>();
  if (SORU_ISI_UYGULAMADA) {
    // Planda en fazla iki konu var: konu başına bir sayım yeter.
    const konular = [...new Set(plan.items.map((i) => i.topicId as string))];
    const sayilar = new Map(
      await Promise.all(konular.map(async (k) => [k, await haftalikKonuSorusu(userId, k, now)] as const))
    );
    for (const i of plan.items) {
      const ilerleme = soruIsiIlerlemesi(sayilar.get(i.topicId as string) ?? 0, i.targetQuestionCount);
      if (ilerleme) isler.set(i.id, ilerleme);
    }
  }
  return { kaynakOturumId: plan.sourceSessionId, isler };
}

/**
 * Alıştırma cevabından sonra (lib/practice.ts answerPractice): bu haftanın
 * planında bu konunun soru işi hedefe vardıysa kapatır. doneAt'ı sistem
 * yazar; öğrenci işareti kaldırırsa sıradaki cevapta yeniden kapanır.
 * İdempotent (yalnızca doneAt boş olan iş). Kapanan iş sayısını döndürür.
 */
export async function soruIsleriniKapat(userId: string, topicId: string, now: Date): Promise<number> {
  if (!SORU_ISI_UYGULAMADA) return 0;
  const isler = await prisma.planItem.findMany({
    where: {
      kind: "SOLVE",
      topicId,
      doneAt: null,
      targetQuestionCount: { gt: 0 },
      plan: { userId, weekStart: haftaBasi(now) },
    },
    select: { id: true, targetQuestionCount: true },
  });
  if (isler.length === 0) return 0;

  const cozulen = await haftalikKonuSorusu(userId, topicId, now);
  const kapanacak = isler.filter((i) => soruIsiIlerlemesi(cozulen, i.targetQuestionCount)?.tamam).map((i) => i.id);
  if (kapanacak.length === 0) return 0;
  const r = await prisma.planItem.updateMany({
    where: { id: { in: kapanacak }, doneAt: null },
    data: { doneAt: now },
  });
  return r.count;
}
