"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { isQuestionStatus } from "@/lib/checkup/format";
import { ERROR_TYPES } from "@/lib/checkup/shared/error-types";
import { markupToContent } from "@/lib/checkup/shared/question-markup";
import {
  deriveQuestionFields,
  safeParseQuestionContent,
  validateChoices,
  CHOICE_LABELS,
  type ChoiceDraft,
  type QuestionContent,
} from "@/lib/checkup/shared/question-content";

export interface QuestionFormState {
  error?: string;
  /** Alan bazlı hatalar. */
  fields?: Record<string, string>;
}

const schema = z.object({
  topicId: z.string().min(1, "Konu seçin."),
  stem: z.string().trim().min(5, "Soru metni çok kısa."),
  solution: z.string().trim().optional(),
  difficulty: z.coerce.number().int().min(1).max(5),
  targetTimeSeconds: z.coerce
    .number({ message: "Hedef süre bir sayı olmalı." })
    .int("Hedef süre tam sayı olmalı.")
    .min(10, "Hedef süre en az 10 saniye.")
    .max(600, "Hedef süre en fazla 600 saniye."),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
  sourceRef: z.string().trim().max(200, "Kaynak en fazla 200 karakter.").optional(),
  correctIndex: z.coerce.number().int().min(0).max(4),
  choices: z.array(z.string().trim()).min(4, "En az 4 şık gerekli.").max(5),
  errorTypes: z.array(z.string().optional()),
});

type QuestionInput = z.infer<typeof schema>;

/** Formdan gelen ham alanları okur. */
function readForm(formData: FormData) {
  const choices: string[] = [];
  const errorTypes: (string | undefined)[] = [];

  for (let i = 0; i < 5; i++) {
    const value = String(formData.get("choice_" + i) ?? "").trim();
    // Boş bırakılan son şık 4 şıklı soru demek. Aradaki boşluk kabul edilmez:
    // etiketler kayar ve A, B, D gibi bir dizi oluşur.
    if (value) {
      choices.push(value);
      errorTypes.push(String(formData.get("errorType_" + i) ?? "") || undefined);
    }
  }

  return {
    topicId: String(formData.get("topicId") ?? ""),
    stem: String(formData.get("stem") ?? ""),
    solution: String(formData.get("solution") ?? "") || undefined,
    difficulty: formData.get("difficulty"),
    targetTimeSeconds: formData.get("targetTimeSeconds"),
    status: String(formData.get("status") ?? "DRAFT"),
    sourceRef: String(formData.get("sourceRef") ?? "") || undefined,
    correctIndex: formData.get("correctIndex"),
    choices,
    errorTypes,
  };
}

/** Yazım biçimini bloklara çevirir, şıkları kurar ve tüm kuralları uygular. */
function buildQuestion(input: QuestionInput) {
  const stemContent = markupToContent(input.stem);
  const stemParsed = safeParseQuestionContent(stemContent);
  if (!stemParsed.success) {
    return { errors: { stem: "Soru metni çözümlenemedi." } as Record<string, string> };
  }

  if (input.correctIndex >= input.choices.length) {
    return { errors: { correctIndex: "Doğru şık, girilen şıklardan biri olmalı." } };
  }

  const drafts: ChoiceDraft[] = input.choices.map((markup, i) => ({
    label: CHOICE_LABELS[i],
    content: markupToContent(markup),
    isCorrect: i === input.correctIndex,
  }));

  const emptyIndex = drafts.findIndex((d) => d.content.blocks.length === 0);
  if (emptyIndex !== -1) {
    return { errors: { choices: CHOICE_LABELS[emptyIndex] + " şıkkı çözümlenemedi." } };
  }

  // Aynı değerli şık, tek doğru şık, etiket sırası (PLAN §3). Aynı değerli iki
  // şık, doğru değeri işaretleyen öğrenciyi yanlış saydırır — ekranda hiçbir
  // şey ters görünmeden.
  const choiceErrors = validateChoices(drafts);
  if (choiceErrors.length) {
    return { errors: { choices: choiceErrors.join(" ") } };
  }

  // Çözüm isteğe bağlı. Girilmişse aynı yazım biçiminden geçiyor; boşsa null
  // kalıyor ve öğrencinin sonuç ekranında "çözüm eklenmemiş" görünüyor.
  let solution: QuestionContent | null = null;
  if (input.solution) {
    const parsed = safeParseQuestionContent(markupToContent(input.solution));
    if (!parsed.success) return { errors: { solution: "Çözüm metni çözümlenemedi." } };
    solution = parsed.data;
  }

  const derived = deriveQuestionFields(stemParsed.data);

  return {
    data: {
      stem: stemParsed.data,
      solution,
      stemText: derived.stemText,
      fingerprint: derived.fingerprint,
      drafts,
      errorTypes: input.errorTypes,
    },
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function choiceRows(drafts: ChoiceDraft[], errorTypes: (string | undefined)[]) {
  return drafts.map((d, i) => ({
    label: d.label,
    content: d.content,
    isCorrect: d.isCorrect,
    // Doğru şıkta hata tipi olmaz — çeldirici değil.
    errorType: d.isCorrect ? null : normalizeErrorType(errorTypes[i]),
    sortOrder: i,
  }));
}

function normalizeErrorType(value: string | undefined) {
  if (!value) return null;
  return (ERROR_TYPES as readonly string[]).includes(value) ? (value as never) : null;
}

function isDuplicate(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

async function topicIsLeaf(topicId: string): Promise<boolean> {
  // Soru yalnızca yaprak konuya bağlanır: üst konuya bağlanan soru hiçbir
  // pakette seçilemez (seçim tam eşleşme yapıyor). Form zaten yalnızca
  // yaprakları listeliyor; bu denetim elle kurcalanmış isteğe karşı.
  const t = await db.topic.findUnique({
    where: { id: topicId },
    select: { _count: { select: { children: true } } },
  });
  return t !== null && t._count.children === 0;
}

function revalidateQuestionScreens() {
  revalidatePath("/checkup");
  revalidatePath("/checkup/havuz");
  revalidatePath("/checkup/sorular");
}

// ─────────────────────────────────────────────────────────────

export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  if (!(await topicIsLeaf(parsed.data.topicId))) {
    return { fields: { topicId: "Geçersiz konu." } };
  }

  const damga = staffStamp(auth.staff);
  try {
    await db.question.create({
      data: {
        topicId: parsed.data.topicId,
        stem: built.data.stem,
        stemText: built.data.stemText,
        fingerprint: built.data.fingerprint,
        solution: built.data.solution ?? Prisma.DbNull,
        difficulty: parsed.data.difficulty,
        targetTimeSeconds: parsed.data.targetTimeSeconds,
        status: parsed.data.status,
        sourceRef: parsed.data.sourceRef,
        createdByStaff: damga,
        updatedByStaff: damga,
        choices: { create: choiceRows(built.data.drafts, built.data.errorTypes) },
      },
    });
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu soru zaten kayıtlı (aynı metin). Havuzda arayın." } };
    }
    throw e;
  }

  revalidateQuestionScreens();
  // redirect() try/catch DIŞINDA olmalı: fırlattığı özel hata yakalanırsa
  // yönlendirme hiç gerçekleşmez.
  redirect("/checkup/sorular?kaydedildi=1");
}

export async function updateQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Soru kimliği eksik." };

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  if (!(await topicIsLeaf(parsed.data.topicId))) {
    return { fields: { topicId: "Geçersiz konu." } };
  }

  const mevcut = await db.question.findUnique({
    where: { id },
    select: {
      version: true,
      choices: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, isCorrect: true, _count: { select: { answers: true } } },
      },
    },
  });
  if (!mevcut) return { error: "Soru bulunamadı." };

  // Cevap anahtarı değiştiyse sürüm artar: bu soruyu çözmüş öğrencilerin
  // sonucu SessionItem.questionVersion üzerinden ayırt edilebilsin (PLAN §4).
  const eskiDogruIndex = mevcut.choices.findIndex((c) => c.isCorrect);
  const anahtarDegisti = eskiDogruIndex !== parsed.data.correctIndex;

  /*
   * Şıklar YERİNDE güncelleniyor, silinip yeniden kurulmuyor.
   *
   * Öğrenci cevabı şıkka yabancı anahtarla bağlı (Answer → Choice,
   * onDelete: Restrict). Eski yöntem (hepsini sil, yeniden oluştur) bir kez
   * bile cevaplanmış soruda veritabanı hatasıyla patlıyordu — yani yayındaki
   * hiçbir soru düzeltilemiyordu. Konumla eşleştirmek (A→A, B→B) cevapları
   * yerinde bırakıyor; cevabın doğru/yanlış bilgisi cevap anında
   * Answer.isCorrect'e yazıldığı için geçmiş sonuçlar değişmiyor.
   */
  const yeniSiklar = choiceRows(built.data.drafts, built.data.errorTypes);
  const korunan = mevcut.choices.slice(0, yeniSiklar.length);
  const silinen = mevcut.choices.slice(yeniSiklar.length);
  const eklenen = yeniSiklar.slice(mevcut.choices.length);

  const cevapliSilinen = silinen.find((c) => c._count.answers > 0);
  if (cevapliSilinen) {
    return {
      fields: {
        choices:
          cevapliSilinen.label +
          " şıkkını öğrenciler işaretlemiş; şık sayısı azaltılamaz. Şıkkı boş bırakmak " +
          "yerine düzeltin ya da soruyu arşivleyip yenisini ekleyin.",
      },
    };
  }

  try {
    await db.$transaction([
      ...korunan.map((c, i) =>
        db.choice.update({
          where: { id: c.id },
          data: {
            label: yeniSiklar[i].label,
            content: yeniSiklar[i].content,
            isCorrect: yeniSiklar[i].isCorrect,
            errorType: yeniSiklar[i].errorType,
            sortOrder: yeniSiklar[i].sortOrder,
          },
        })
      ),
      ...(silinen.length
        ? [db.choice.deleteMany({ where: { id: { in: silinen.map((c) => c.id) } } })]
        : []),
      ...(eklenen.length
        ? [db.choice.createMany({ data: eklenen.map((r) => ({ ...r, questionId: id })) })]
        : []),
      db.question.update({
        where: { id },
        data: {
          topicId: parsed.data.topicId,
          stem: built.data.stem,
          stemText: built.data.stemText,
          fingerprint: built.data.fingerprint,
          solution: built.data.solution ?? Prisma.DbNull,
          difficulty: parsed.data.difficulty,
          targetTimeSeconds: parsed.data.targetTimeSeconds,
          status: parsed.data.status,
          sourceRef: parsed.data.sourceRef ?? null,
          updatedByStaff: staffStamp(auth.staff),
          version: anahtarDegisti ? mevcut.version + 1 : mevcut.version,
        },
      }),
    ]);
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu metinde başka bir soru zaten var." } };
    }
    // Denetim ile işlem arasında bir öğrenci silinecek şıkkı işaretlediyse.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2003") {
      return { error: "Şıklardan biri az önce cevaplandı; sayfayı yenileyip tekrar deneyin." };
    }
    throw e;
  }

  revalidateQuestionScreens();
  revalidatePath("/checkup/sorular/" + id);
  redirect("/checkup/sorular?guncellendi=1");
}

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu açmak
 * gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 */
export async function setQuestionStatusAction(
  id: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || !isQuestionStatus(status)) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const sonuc = await db.question.updateMany({
    where: { id },
    data: { status, updatedByStaff: staffStamp(auth.staff) },
  });
  if (sonuc.count === 0) return { ok: false, error: "Soru bulunamadı." };

  revalidateQuestionScreens();
  return { ok: true };
}
