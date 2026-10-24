"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, currentSessionHash, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendPasswordChangedMail } from "@/lib/mailer";
import { sinirAsildiKullanici } from "@/lib/rate-limit";
import { GUNLUK_HEDEF_SECENEKLERI } from "@/lib/seri";

export interface ProfileState {
  ok?: string;
  error?: string;
  fields?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// Bilgiler
// ─────────────────────────────────────────────────────────────

/*
 * Sınav ve sınıf BURADAN kaydedilmiyor: onların tek sahibi
 * lib/actions/onboarding.ts (hedefGuncelleAction). Burada da tutulduğunda
 * iki ayrı doğrulama listesi oluşuyordu ve bu form eski listeyle kalmıştı —
 * KPSS'ye hazırlanan bir öğrenci profilini kaydettiğinde hedef sınavı
 * sessizce siliniyordu.
 */
const profileSchema = z.object({
  name: z.string().trim().min(2, "Adını yaz.").max(80),
});

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fields: { name: parsed.error.issues[0]?.message ?? "Geçersiz bilgi." } };
  }

  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  // Kenar çubuğundaki ad da güncellensin.
  revalidatePath("/", "layout");
  return { ok: "Bilgilerin kaydedildi." };
}

// ─────────────────────────────────────────────────────────────
// Günlük soru hedefi (seri kartı)
// ─────────────────────────────────────────────────────────────

const gunlukHedefSemasi = z.coerce
  .number()
  .int()
  .refine((n) => (GUNLUK_HEDEF_SECENEKLERI as readonly number[]).includes(n));

/** Günde kaç soru (0 = hedef yok). Ana sayfadaki seri kartı buna bakar (lib/seri.ts). */
export async function gunlukHedefAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = gunlukHedefSemasi.safeParse(formData.get("dailyQuestionGoal"));
  if (!parsed.success) return { error: "Listeden bir hedef seç." };

  await prisma.user.update({ where: { id: user.id }, data: { dailyQuestionGoal: parsed.data } });
  return {
    ok: parsed.data === 0 ? "Günlük hedef kapatıldı; seri sayılmaya devam ediyor." : `Günlük hedefin ${parsed.data} soru.`,
  };
}

// ─────────────────────────────────────────────────────────────
// Parola değiştir
// ─────────────────────────────────────────────────────────────

export async function changePasswordAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();

  const mevcut = String(formData.get("current") ?? "");
  const yeni = String(formData.get("next") ?? "");

  if (yeni.length < 8) return { fields: { next: "Yeni parola en az 8 karakter olmalı." } };
  if (yeni === mevcut) return { fields: { next: "Yeni parola eskisiyle aynı olamaz." } };
  // Mevcut parolayı deneme alanı olarak kullanmak isteyene sınır.
  if (await sinirAsildiKullanici(user.id, "parola-degistir", 10, 10 * 60_000)) {
    return { error: "Çok fazla deneme. 10 dakika sonra tekrar dene." };
  }

  const kayit = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(mevcut, kayit.passwordHash))) {
    return { fields: { current: "Mevcut parola yanlış." } };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(yeni) },
    }),
    // DİĞER cihazlardaki oturumlar kapanır: parolayı değiştirmenin tipik
    // sebebi "birisi hesabıma girmiş olabilir" şüphesi.
    prisma.authSession.deleteMany({ where: { userId: user.id } }),
  ]);

  // Bu cihazda oturum açık kalsın — öğrenciyi kendi değişikliği yüzünden
  // dışarı atmak anlamsız.
  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  void sendPasswordChangedMail({ to: user.email, name: user.name });

  return { ok: "Parolan değiştirildi. Diğer cihazlardaki oturumların kapatıldı." };
}

// ─────────────────────────────────────────────────────────────
// Hesabı sil (KVKK silme hakkı)
// ─────────────────────────────────────────────────────────────

export async function deleteAccountAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();

  // Parola yeniden isteniyor: açık bırakılmış bir oturumdan tek tıkla hesap
  // silinmesin.
  const parola = String(formData.get("password") ?? "");
  const kayit = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(parola, kayit.passwordHash))) {
    return { fields: { password: "Parola yanlış." } };
  }

  /*
   * Silme ZİNCİRLEME: oturumlar, testler, cevaplar, sonuçlar, erişim hakları
   * ve sıfırlama jetonları kullanıcıyla birlikte gider (şemada Cascade).
   * Kalanlar kimliksiz toplamlar: sorulardaki gösterim/doğru sayaçları ve
   * şıkların seçilme sayıları — aydınlatma metninde yazdığımız gibi.
   *
   * Hata bildirimleri (QuestionNote, STUDENT_REPORT) BİLEREK kalır: sorudaki
   * hatanın kaydı içerik ekibinin işi, öğrenci gidince silinmemeli. İlişki
   * SetNull ile kopuyor; ama öğrencinin yazdığı açıklama serbest metin ve
   * kendini tanıtan bir şey içerebilir ("ben 8-B'den Ayşe…"). Bu yüzden aynı
   * işlemde açıklama boşaltılır; oturum kimliği de silinen oturumu gösterdiği
   * için temizlenir. Sebep ve soru kalır. Cascade'e çevirmeyin.
   */
  // Önce silme, sonra çerez: silme başarısız olursa öğrenci boş yere
  // oturumdan atılmasın. (Oturum satırı zaten zincirleme siliniyor.)
  await prisma.$transaction([
    prisma.questionNote.updateMany({
      where: { reportedById: user.id, kind: "STUDENT_REPORT" },
      data: { body: "", sessionId: null },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  await destroySession();

  redirect("/?hesap-silindi=1");
}

// ─────────────────────────────────────────────────────────────
// Diğer cihazlardan çıkış
// ─────────────────────────────────────────────────────────────

/** Bu cihaz dışındaki tüm oturumları kapatır. "Hesabıma biri mi girdi?" sorusunun cevabı. */
export async function logoutOthersAction() {
  const user = await requireUser();
  const bu = await currentSessionHash();
  await prisma.authSession.deleteMany({
    where: { userId: user.id, ...(bu ? { tokenHash: { not: bu } } : {}) },
  });
  revalidatePath("/profil");
}
