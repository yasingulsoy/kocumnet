"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/auth";

export interface FormState {
  error?: string;
  /** Alan bazlı hatalar: { email: "…" } */
  fields?: Record<string, string>;
}

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-posta gerekli.")
  .email("Geçerli bir e-posta yazın.")
  .transform((v) => v.toLowerCase());

const registerSchema = z.object({
  name: z.string().trim().min(2, "Adınızı yazın.").max(80),
  email: emailSchema,
  password: z.string().min(8, "Parola en az 8 karakter olmalı.").max(200, "Parola çok uzun."),
  grade: z.enum(["GRADE_9", "GRADE_10", "GRADE_11", "GRADE_12", "GRADUATE"]).optional(),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Basit deneme sınırlayıcı.
 *
 * ⚠️ Süreç belleğinde: tek konteynerde çalışırken yeterli, yatay ölçeklenince
 * her kopya kendi sayacını tutar. Çok kopyaya çıkılırsa Redis'e taşınmalı.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60_000;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.until < now) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

async function clientKey(suffix: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${ip}:${suffix}`;
}

/** Zamanlama saldırısına karşı sahte özet — gerçek bir özetle aynı maliyette. */
const DUMMY_HASH =
  "scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

// ─────────────────────────────────────────────────────────────

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    grade: formData.get("grade") || undefined,
  });

  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  // Onay kutusu tarayıcıda "required" ama bu atlatılabilir; asıl denetim burada.
  if (formData.get("kvkk") !== "on") {
    return { error: "Devam etmek için aydınlatma metnini onaylaman gerekiyor." };
  }

  const { name, email, password, grade } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { fields: { email: "Bu e-posta ile bir hesap zaten var." } };
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), grade },
    select: { id: true },
  });

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  // redirect() özel bir hata fırlatarak çalışır — try/catch İÇİNE ALINMAZ,
  // yoksa yönlendirme yutulur ve sayfa olduğu yerde kalır.
  redirect("/panel");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Parola gerekli.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });

  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const { email, password } = parsed.data;

  if (tooManyAttempts(await clientKey(email))) {
    return { error: "Çok fazla deneme yapıldı. Lütfen 10 dakika sonra tekrar deneyin." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Kullanıcı yoksa da bir özetleme yapıyoruz: aksi halde yanıt süresi
  // "bu e-posta kayıtlı mı" sorusunu ele verir.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, DUMMY_HASH);

  if (!user || !ok) {
    // Hangisinin yanlış olduğunu SÖYLEMİYORUZ.
    return { error: "E-posta veya parola hatalı." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  redirect("/panel");
}

export async function logoutAction() {
  await destroySession();
  redirect("/giris");
}
