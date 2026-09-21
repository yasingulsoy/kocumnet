"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ERROR_TYPES } from "@/lib/error-types";
import { markupToContent } from "@/lib/question-markup";
import {
  deriveQuestionFields,
  safeParseQuestionContent,
  validateChoices,
  CHOICE_LABELS,
  type ChoiceDraft,
  type QuestionContent,
} from "@/lib/question-content";

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
  targetTimeSeconds: z.coerce.number().int().min(10).max(600),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
  sourceRef: z.string().trim().max(200).optional(),
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

  // Aynı değerli şık, tek doğru şık, etiket sırası (PLAN §3).
  const choiceErrors = validateChoices(drafts);
  if (choiceErrors.length) {
    return { errors: { choices: choiceErrors.join(" ") } };
  }

  // Çözüm isteğe bağlı. Girilmişse aynı yazım biçiminden geçiyor; boşsa null
  // kalıyor ve sonuç ekranında "çözüm eklenmemiş" görünüyor.
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

function choiceRows(
  drafts: ChoiceDraft[],
  errorTypes: (string | undefined)[]
) {
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

// ─────────────────────────────────────────────────────────────

export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  await requireAdmin();

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  try {
    await prisma.question.create({
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
        choices: { create: choiceRows(built.data.drafts, built.data.errorTypes) },
      },
    });
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu soru zaten kayıtlı (aynı metin). Havuzda arayın." } };
    }
    throw e;
  }

  revalidatePath("/admin/sorular");
  // redirect() try/catch DIŞINDA olmalı.
  redirect("/admin/sorular?kaydedildi=1");
}

export async function updateQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Soru kimliği eksik." };

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  const mevcut = await prisma.question.findUnique({
    where: { id },
    select: {
      version: true,
      choices: { select: { isCorrect: true, sortOrder: true } },
    },
  });
  if (!mevcut) return { error: "Soru bulunamadı." };

  // Cevap anahtarı değiştiyse sürüm artar: bu soruyu çözmüş öğrencilerin
  // sonucu SessionItem.questionVersion üzerinden ayırt edilebilsin (PLAN §4).
  const eskiDogruIndex = [...mevcut.choices]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .findIndex((c) => c.isCorrect);
  const anahtarDegisti = eskiDogruIndex !== parsed.data.correctIndex;

  try {
    await prisma.$transaction([
      prisma.choice.deleteMany({ where: { questionId: id } }),
      prisma.question.update({
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
          sourceRef: parsed.data.sourceRef,
          version: anahtarDegisti ? mevcut.version + 1 : mevcut.version,
          choices: { create: choiceRows(built.data.drafts, built.data.errorTypes) },
        },
      }),
    ]);
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu metinde başka bir soru zaten var." } };
    }
    throw e;
  }

  revalidatePath("/admin/sorular");
  redirect("/admin/sorular?guncellendi=1");
}

export async function setQuestionStatusAction(id: string, status: string) {
  await requireAdmin();

  const allowed = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"];
  if (!allowed.includes(status)) return;

  await prisma.question.update({ where: { id }, data: { status: status as never } });
  revalidatePath("/admin/sorular");
  revalidatePath("/admin");
}
