import "server-only";
import { db } from "./db";
import type { Prisma } from "./generated/client";
import { EKSIK_SUZGECI } from "./question-query";
import type { AtlamaOzeti } from "./soru-akisi";
import { EKSIK_KISA, EKSIK_KODLARI, yayinaHazirMi, type EksikKodu, type Hazirlik } from "./shared/question-readiness";

/**
 * Yayın kapısı — veritabanındaki soruya "yayına hazır mı" kuralını uygular
 * (kural shared/question-readiness.ts'te, öğrenci uygulamasıyla ortak).
 *
 * Soru formu kendi kaydını denetler (actions/questions.ts); listedeki durum
 * seçici, toplu durum değiştirme ve inceleme kuyruğunun "Onayla"sı buradaki
 * yayinaAl'dan geçer. Yetkiyi eylemler denetler.
 */

/** Kuralın okuduğu alanlar (şıklar gösterim sırasıyla). */
export const HAZIRLIK_ALANLARI = {
  stem: true,
  solution: true,
  hints: true,
  level: true,
  examScopes: true,
  objective: { select: { status: true } },
  topic: { select: { examScope: true, examScopes: true } },
  choices: { orderBy: { sortOrder: "asc" }, select: { content: true, isCorrect: true, errorType: true } },
} as const satisfies Prisma.QuestionSelect;

type HazirlikSatiri = Prisma.QuestionGetPayload<{ select: typeof HAZIRLIK_ALANLARI }>;

export function satirHazirligi(q: HazirlikSatiri): Hazirlik {
  return yayinaHazirMi({
    stem: q.stem,
    solution: q.solution,
    hints: q.hints,
    choices: q.choices,
    level: q.level,
    kazanim: q.objective ? { arsivde: q.objective.status === "ARCHIVED" } : null,
    examScopes: q.examScopes,
    konu: q.topic,
  });
}

export interface YayinSonucu {
  /** Bu istekle yayına alınanlar. */
  alinan: string[];
  /** Zaten yayında olanlar (dokunulmadı). */
  zatenYayinda: number;
  /** Hazır olmadığı için atlananlar, eksikleriyle. */
  atlanan: { id: string; hazirlik: Hazirlik }[];
  /** Denetimle yazma arasında başkası değiştirdiği için atlananlar (yeniden denenir). */
  degisen: number;
}

/**
 * Soruları yayına alır; hazır olmayanı ATLAR. `publishedAt` ve
 * `publishedByStaff` yalnızca gerçekten yayına girene yazılır,
 * `updatedByStaff` her değişiklikte ilerler.
 *
 * Denetimle yazma arasında soru düzenlenirse (ör. biri çözümü sildi) denetlenen
 * hâl yazılan hâl olmaz: güncelleme koşulu denetimde okunan `updatedAt`'i de
 * arar, değişmiş soru yayına alınmaz ve `degisen` olarak döner.
 */
export async function yayinaAl(idler: readonly string[], damga: string): Promise<YayinSonucu> {
  const satirlar = await db.question.findMany({
    where: { id: { in: [...idler] } },
    select: { id: true, status: true, updatedAt: true, ...HAZIRLIK_ALANLARI },
  });

  let zatenYayinda = 0;
  const hazir: { id: string; updatedAt: Date }[] = [];
  const atlanan: YayinSonucu["atlanan"] = [];
  for (const q of satirlar) {
    if (q.status === "PUBLISHED") {
      zatenYayinda += 1;
      continue;
    }
    const h = satirHazirligi(q);
    if (h.hazir) hazir.push({ id: q.id, updatedAt: q.updatedAt });
    else atlanan.push({ id: q.id, hazirlik: h });
  }

  let alinan: string[] = [];
  if (hazir.length) {
    const yazilan = await db.question.updateManyAndReturn({
      where: { status: { not: "PUBLISHED" }, OR: hazir.map((q) => ({ id: q.id, updatedAt: q.updatedAt })) },
      data: { status: "PUBLISHED", updatedByStaff: damga, publishedAt: new Date(), publishedByStaff: damga },
      select: { id: true },
    });
    alinan = yazilan.map((q) => q.id);
  }

  return { alinan, zatenYayinda, atlanan, degisen: hazir.length - alinan.length };
}

/**
 * Atlananların ekran özeti: eksik türüne göre sayılar ("çözüm yok (2)"),
 * listede süzgeci olanlar için `?eksik=` anahtarı, olmayanlar için soruların
 * kendisi. Bir soru birden çok eksikle birden çok sayıma girer.
 */
export function atlamaOzeti(atlanan: YayinSonucu["atlanan"]): AtlamaOzeti {
  const sayac = new Map<EksikKodu, number>();
  const sorular: AtlamaOzeti["sorular"] = [];
  for (const a of atlanan) {
    const kodlar = [...new Set(a.hazirlik.eksikler.map((e) => e.kod))];
    for (const k of kodlar) sayac.set(k, (sayac.get(k) ?? 0) + 1);
    const suzgecsiz = kodlar.filter((k) => !EKSIK_SUZGECI[k]);
    if (suzgecsiz.length && sorular.length < 20) {
      sorular.push({ id: a.id, etiket: suzgecsiz.map((k) => EKSIK_KISA[k]).join(", ") });
    }
  }
  return {
    toplam: atlanan.length,
    nedenler: EKSIK_KODLARI.filter((k) => sayac.has(k)).map((k) => ({
      kod: k,
      etiket: EKSIK_KISA[k],
      sayi: sayac.get(k)!,
      suzgec: EKSIK_SUZGECI[k] ?? null,
    })),
    sorular,
  };
}
