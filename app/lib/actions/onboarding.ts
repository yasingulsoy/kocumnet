"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EXAMS, SECILEBILIR_SINAVLAR, isExamScope, isGrade, type ExamScopeValue, type GradeValue } from "@/lib/exams";

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

interface HedefVerisi {
  targetExam: ExamScopeValue;
  grade: GradeValue;
  targetNet: string;
  weeklyTestGoal: number;
}

/**
 * Hedef kuralı — tanışma ve profil AYNI denetimden geçer.
 *
 * Eskiden profildeki güncelleme hiçbir şeyi denetlemiyordu: seçilemeyen
 * sınav (KPSS Ön Lisans), "8. sınıf + ALES" ya da 20 soruluk LGS'de 35 net
 * hedef kaydedilebiliyordu. Kural tek yerde: seçilebilir sınav, sınava uygun
 * sınıf, hedef net sınavın matematik soru sayısını aşmaz (aşan kısım kırpılır).
 */
function hedefKurali(ham: Record<string, unknown>): { error: string } | { veri: HedefVerisi } {
  const parsed = schema.safeParse(ham);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Eksik bilgi var." };

  const { targetNet, weeklyTestGoal } = parsed.data;
  // refine tipi daraltmıyor; isExamScope / isGrade yukarıda doğruladı.
  const targetExam = parsed.data.targetExam as ExamScopeValue;
  const grade = parsed.data.grade as GradeValue;

  if (!SECILEBILIR_SINAVLAR.includes(targetExam)) {
    return { error: "Bu sınav şu an seçilemiyor." };
  }
  // Sınıf seçeneği sınava göre kısıtlı: 26 yaşındaki DGS adayına
  // "11. sınıf" yazdırmak ürünün onu tanımadığını gösterir.
  if (!EXAMS[targetExam].grades.includes(grade)) {
    return { error: "Seçtiğin sınıf bu sınavla uyuşmuyor." };
  }

  const enFazla = EXAMS[targetExam].mathQuestionCount;
  return {
    veri: { targetExam, grade, targetNet: Math.min(targetNet, enFazla).toFixed(2), weeklyTestGoal },
  };
}

/**
 * Tanışma: hangi sınav, hangi sınıf, kaç net hedef, haftada kaç test.
 *
 * Bilgi zaten kayıt formunda toplanıyordu ama hiçbir yerde KULLANILMIYORDU:
 * DGS'ye hazırlanan birine AYT trigonometri paketi öneriliyordu. Artık
 * katalog, pano ve koçluk metinleri buna bakıyor.
 */
export async function tanismaAction(
  _prev: TanismaState,
  formData: FormData
): Promise<TanismaState> {
  const user = await requireUser();

  const sonuc = hedefKurali({
    targetExam: String(formData.get("targetExam") ?? ""),
    grade: String(formData.get("grade") ?? ""),
    targetNet: formData.get("targetNet"),
    weeklyTestGoal: formData.get("weeklyTestGoal") ?? 1,
  });
  if ("error" in sonuc) return { error: sonuc.error };

  await prisma.user.update({
    where: { id: user.id },
    data: { ...sonuc.veri, onboardedAt: new Date() },
  });

  revalidatePath("/panel");
  revalidatePath("/paketler");
  redirect("/panel?tanisma=1");
}

/** Boş ya da gönderilmemiş alan: kayıtlı değer kullanılır. */
function alanVeya(formData: FormData, ad: string, kayitli: unknown): unknown {
  const v = formData.get(ad);
  return v === null || v === "" ? kayitli : v;
}

/**
 * Profilden sınav/hedef değiştirme — tanışmayı tekrar açmadan.
 *
 * Gelen değerler kayıtlı olanlarla BİRLEŞTİRİLİP bütün olarak doğrulanır:
 * yalnızca sınavı değiştiren bir istek, kayıtlı sınıfın yeni sınavla
 * uyuşup uyuşmadığına ve hedef netin yeni üst sınırına da bakılarak
 * kabul edilir.
 */
export async function hedefGuncelleAction(
  _prev: TanismaState,
  formData: FormData
): Promise<TanismaState> {
  const user = await requireUser();

  const sinav = alanVeya(formData, "targetExam", user.targetExam ?? "");
  const sonuc = hedefKurali({
    targetExam: String(sinav ?? ""),
    grade: String(alanVeya(formData, "grade", user.grade ?? "") ?? ""),
    targetNet: alanVeya(
      formData,
      "targetNet",
      user.targetNet ?? (isExamScope(sinav) ? EXAMS[sinav].defaultTargetNet : 0)
    ),
    weeklyTestGoal: alanVeya(formData, "weeklyTestGoal", user.weeklyTestGoal),
  });
  if ("error" in sonuc) return { error: sonuc.error };

  const v = sonuc.veri;
  const ayni =
    v.targetExam === user.targetExam &&
    v.grade === user.grade &&
    Number(v.targetNet) === user.targetNet &&
    v.weeklyTestGoal === user.weeklyTestGoal;
  if (ayni) return { error: "Değişiklik yok." };

  await prisma.user.update({ where: { id: user.id }, data: v });

  revalidatePath("/profil");
  revalidatePath("/panel");
  revalidatePath("/paketler");
  revalidatePath("/gelisim");
  return { ok: "Hedefin güncellendi." };
}
