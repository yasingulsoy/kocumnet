"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { appUrl, isMailConfigured, sendPasswordResetMail } from "@/lib/mailer";
import { sinirAsildi } from "@/lib/rate-limit";

export interface ResetState {
  error?: string;
  ok?: string;
  fields?: Record<string, string>;
}

/** Sıfırlama bağlantısı e-posta kutusunda kalıcı bir arka kapı olmamalı. */
const TOKEN_TTL_MS = 60 * 60_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// ─────────────────────────────────────────────────────────────

export async function requestResetAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase())
    .safeParse(formData.get("email"));

  if (!parsed.success) return { fields: { email: "Geçerli bir e-posta yazın." } };

  // Saatte 5 istek: her istek scrypt çalıştırmıyor ama e-posta gönderiyor;
  // bir adrese sıfırlama bombardımanı yapılmasın.
  if (await sinirAsildi(`sifirlama:${parsed.data}`, 5, 60 * 60_000)) {
    return { error: "Çok fazla istek. Bir saat sonra tekrar dene." };
  }

  if (!isMailConfigured() && process.env.NODE_ENV === "production") {
    // Dürüst mesaj: "gönderdik" deyip hiçbir şey göndermemek, kullanıcıyı
    // hesabının dışında bekletmenin en can sıkıcı yolu.
    return {
      error:
        "Parola sıfırlama şu anda kapalı. Lütfen bizimle iletişime geçin: " +
        (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "info@kocum.net"),
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, name: true },
  });

  // Kullanıcı yoksa da AYNI mesajı dönüyoruz: aksi halde bu form bir
  // "bu e-posta kayıtlı mı" sorgusuna dönüşür.
  if (user) {
    // Bekleyen eski jetonları geçersiz kıl — aynı anda birden fazla geçerli
    // sıfırlama bağlantısı dolaşmasın.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    // Gönderim hatası KULLANICIYA YANSIMAZ: "hata" yalnızca kayıtlı adreslerde
    // çıksaydı, form bir "bu e-posta kayıtlı mı" sorgusuna dönüşürdü. Hata
    // sunucu günlüğüne düşer (sendMail fırlatmaz); operasyon oradan görür.
    await sendPasswordResetMail({
      to: parsed.data,
      name: user.name,
      link: `${appUrl()}/sifre-sifirla/${token}`,
      dakika: TOKEN_TTL_MS / 60_000,
    });
  }

  return {
    ok: "Bu adres kayıtlıysa parola sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.",
  };
}

// ─────────────────────────────────────────────────────────────

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Parola en az 8 karakter olmalı.").max(200),
});

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fields: { password: issue?.message ?? "Geçersiz istek." } };
  }

  const kayit = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!kayit || kayit.usedAt || kayit.expiresAt < new Date()) {
    return { error: "Bu bağlantı geçersiz veya süresi dolmuş. Yeniden talep et." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: kayit.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: kayit.id },
      data: { usedAt: new Date() },
    }),
    // TÜM oturumları kapat. Hesap ele geçirilmişse parolayı değiştirmek tek
    // başına yetmez; saldırganın açık oturumu çalışmaya devam ederdi.
    prisma.authSession.deleteMany({ where: { userId: kayit.userId } }),
  ]);

  redirect("/giris?sifirlandi=1");
}
