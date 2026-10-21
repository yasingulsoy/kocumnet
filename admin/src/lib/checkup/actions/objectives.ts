"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/checkup/db";
import { Prisma } from "@/lib/checkup/generated/client";
import { CONTENT_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { OZET_KARTI_SINIRI } from "@/lib/checkup/content-limits";
import { markupToContent } from "@/lib/checkup/shared/question-markup";
import { containsStepBreak, safeParseQuestionContent, type QuestionContent } from "@/lib/checkup/shared/question-content";
// Sınav listesi öğrenci uygulamasından (shared/exams.ts): yeni sınav burada ayrıca eklenmesin.
import { EXAM_SCOPES } from "@/lib/checkup/format";

/**
 * Kazanım (öğrenme çıktısı) yönetimi — seviyeli check-up'ın yapı taşı.
 *
 * Seviye 1 "kazanım başına bir soru" ilkesiyle kurulur (app/lib/level-selection.ts):
 * kazanım yoksa seviye yok. Kod kalıcıdır — soru dosyalarında (SORU-SABLONU.md
 * "Kazanım Kodu") bu geçer; içe aktarma kazanımı kodla bulur.
 */

export interface ObjectiveFormState {
  ok?: string;
  error?: string;
  fields?: Record<string, string>;
}

const schema = z.object({
  topicId: z.string().min(1, "Konu seç."),
  code: z
    .string()
    .trim()
    .min(2, "Kod en az 2 karakter.")
    .max(40, "Kod en fazla 40 karakter.")
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/i, "Kod yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(3, "Kazanım adı çok kısa.").max(200, "Kazanım adı en fazla 200 karakter."),
  examScopes: z.array(z.enum(EXAM_SCOPES)).default([]),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

function readForm(fd: FormData) {
  return {
    topicId: String(fd.get("topicId") ?? ""),
    code: String(fd.get("code") ?? ""),
    name: String(fd.get("name") ?? ""),
    examScopes: fd.getAll("examScopes").map(String),
    status: String(fd.get("status") ?? "DRAFT"),
    sortOrder: fd.get("sortOrder") ?? 0,
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

function yenile() {
  revalidatePath("/checkup/kazanimlar");
  revalidatePath("/checkup/sorular");
  revalidatePath("/checkup/sorular/yeni");
}

const kopya = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function createObjectiveAction(_prev: ObjectiveFormState, fd: FormData): Promise<ObjectiveFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const parsed = schema.safeParse(readForm(fd));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const konu = await db.topic.findUnique({
    where: { id: parsed.data.topicId },
    select: { id: true, _count: { select: { children: true } } },
  });
  if (!konu || konu._count.children > 0) return { fields: { topicId: "Kazanım yalnızca yaprak konuya bağlanır." } };

  try {
    await db.objective.create({ data: parsed.data });
  } catch (e) {
    if (kopya(e)) return { fields: { code: "Bu kod zaten kullanılıyor." } };
    throw e;
  }
  yenile();
  return { ok: `${parsed.data.code} eklendi.` };
}

export async function updateObjectiveAction(_prev: ObjectiveFormState, fd: FormData): Promise<ObjectiveFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Kayıt bulunamadı." };

  const parsed = schema.omit({ topicId: true }).safeParse({ ...readForm(fd), topicId: undefined });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  try {
    await db.objective.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (kopya(e)) return { fields: { code: "Bu kod zaten kullanılıyor." } };
    throw e;
  }
  yenile();
  return { ok: "Kaydedildi." };
}

export async function deleteObjectiveAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const kayit = await db.objective.findUnique({
    where: { id },
    select: { code: true, _count: { select: { questions: true } } },
  });
  if (!kayit) return { ok: false, error: "Kazanım bulunamadı." };
  // Sorusu olan kazanım silinmez: sorular kazanımsız kalır ve seviye 1 seçimi
  // onları göremez. Önce soruları başka kazanıma taşı ya da arşivle.
  if (kayit._count.questions > 0) {
    return { ok: false, error: `${kayit.code} kazanımına ${kayit._count.questions} soru bağlı; silmek yerine arşivle.` };
  }
  await db.objective.delete({ where: { id } });
  yenile();
  return { ok: true };
}

/**
 * Kazanım özet kartı (Objective.summary): yazım biçiminde 3-5 satır özet ve
 * formül. Öğrenci uygulaması sonuç ekranında ve defterde, yanlış yapılan
 * kazanımın altında gösteriyor. Boş metin kartı kaldırır (null).
 *
 * Kurallar: OZET_KARTI_SINIRI karakter (kart kısa kalsın), adım ayırıcı
 * (---) yok — kart tek parça açılır. Kim yazdı: summaryUpdatedByStaff.
 */
export async function saveObjectiveSummaryAction(
  id: unknown,
  markup: unknown
): Promise<{ ok: true; silindi: boolean } | { ok: false; error: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !/^[a-z0-9]{6,64}$/i.test(id) || typeof markup !== "string" || markup.length > OZET_KARTI_SINIRI * 4) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const metin = markup.replace(/\r\n?/g, "\n").trim();
  if (metin.length > OZET_KARTI_SINIRI) {
    return { ok: false, error: `Özet kartı en fazla ${OZET_KARTI_SINIRI} karakter (şu an ${metin.length}): kısa tut, ders anlatımı başka yerde.` };
  }

  let summary: QuestionContent | null = null;
  if (metin) {
    const p = safeParseQuestionContent(markupToContent(metin));
    if (!p.success) return { ok: false, error: "Özet çözümlenemedi." };
    if (containsStepBreak(p.data)) return { ok: false, error: "Özet kartında --- (adım ayırıcı) olamaz; kart tek parça açılır." };
    summary = p.data;
  }

  const r = await db.objective.updateMany({
    where: { id },
    data: { summary: summary ?? Prisma.DbNull, summaryUpdatedByStaff: staffStamp(auth.staff) },
  });
  if (r.count === 0) return { ok: false, error: "Kazanım bulunamadı." };

  yenile();
  return { ok: true, silindi: summary === null };
}
