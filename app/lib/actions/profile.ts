"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

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
   */
  // Önce silme, sonra çerez: silme başarısız olursa öğrenci boş yere
  // oturumdan atılmasın. (Oturum satırı zaten zincirleme siliniyor.)
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();

  redirect("/?hesap-silindi=1");
}
