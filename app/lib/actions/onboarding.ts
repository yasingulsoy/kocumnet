"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EXAMS, SECILEBILIR_SINAVLAR, isExamScope, isGrade } from "@/lib/exams";

export interface TanismaState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  targetExam: z.string().refine(isExamScope, "Bir sınav seç."),
  grade: z.string().refine(isGrade, "Sınıfını seç."),
  targetNet: z.coerce.number().min(0).max(120),
  weeklyTestGoal: z.coerce.number().int().min(1).max(7),
});

/**
 * Tanışma: hangi sınav, hangi sınıf, kaç net hedef.
 *
 * Koçun ilk sorduğu üç şey bunlar. Bilgi zaten kayıt formunda toplanıyordu
 * ama hiçbir yerde KULLANILMIYORDU: DGS'ye hazırlanan birine AYT trigonometri
 * paketi öneriliyordu. Artık katalog, pano ve koçluk metinleri buna bakıyor.
 */
export async function tanismaAction(
  _prev: TanismaState,
  formData: FormData
): Promise<TanismaState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    targetExam: String(formData.get("targetExam") ?? ""),
    grade: String(formData.get("grade") ?? ""),
    targetNet: formData.get("targetNet"),
    weeklyTestGoal: formData.get("weeklyTestGoal") ?? 1,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eksik bilgi var." };
  }

  const { targetExam, grade, targetNet, weeklyTestGoal } = parsed.data;

  if (!SECILEBILIR_SINAVLAR.includes(targetExam)) {
    return { error: "Bu sınav şu an seçilemiyor." };
  }
  // Sınıf seçeneği sınava göre kısıtlı: 26 yaşındaki DGS adayına
  // "11. sınıf" yazdırmak ürünün onu tanımadığını gösterir.
  if (!EXAMS[targetExam].grades.includes(grade)) {
    return { error: "Seçtiğin sınıf bu sınavla uyuşmuyor." };
  }

  const enFazla = EXAMS[targetExam].mathQuestionCount;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      targetExam,
      grade,
      targetNet: Math.min(targetNet, enFazla).toFixed(2),
      weeklyTestGoal,
      onboardedAt: new Date(),
    },
  });

  revalidatePath("/panel");
  revalidatePath("/paketler");
  redirect("/panel?tanisma=1");
}

/** Profilden sınav/hedef değiştirme — tanışmayı tekrar açmadan. */
export async function hedefGuncelleAction(
  _prev: TanismaState,
  formData: FormData
): Promise<TanismaState> {
  const user = await requireUser();

  const parsed = schema.partial().safeParse({
    targetExam: formData.get("targetExam") ?? undefined,
    grade: formData.get("grade") ?? undefined,
    targetNet: formData.get("targetNet") ?? undefined,
    weeklyTestGoal: formData.get("weeklyTestGoal") ?? undefined,
  });
  if (!parsed.success) return { error: "Geçersiz değer." };

  const veri: Record<string, unknown> = {};
  if (parsed.data.targetExam) veri.targetExam = parsed.data.targetExam;
  if (parsed.data.grade && isGrade(parsed.data.grade)) veri.grade = parsed.data.grade;
  if (parsed.data.targetNet !== undefined) veri.targetNet = parsed.data.targetNet.toFixed(2);
  if (parsed.data.weeklyTestGoal !== undefined) veri.weeklyTestGoal = parsed.data.weeklyTestGoal;

  if (Object.keys(veri).length === 0) return { error: "Değişiklik yok." };

  await prisma.user.update({ where: { id: user.id }, data: veri });

  revalidatePath("/profil");
  revalidatePath("/panel");
  revalidatePath("/paketler");
  revalidatePath("/gelisim");
  return { ok: "Hedefin güncellendi." };
}
