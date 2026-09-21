import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/enums";

export const SESSION_COOKIE = "kocum_sess";

/** Oturum ömrü. */
const SESSION_DAYS = 30;

/**
 * Çerezdeki token'ın SHA-256'sı saklanır, token'ın kendisi saklanmaz.
 * Veritabanı sızarsa saldırgan geçerli bir çerez üretemez.
 * (Parolanın aksine burada yavaş KDF gerekmez: token 256 bit rastgele,
 * sözlük saldırısına konu değil.)
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Oturum açar. YALNIZCA Server Action veya Route Handler içinde çağrılabilir —
 * Next.js, Server Component render'ı sırasında çerez yazılmasına izin vermez.
 */
export async function createSession(userId: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // localhost http üzerinden çalışır; secure'u sabit true yapmak geliştirmede
    // oturumu tamamen kırar.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Satırı siliyoruz: çerez silinse bile veritabanındaki oturum geçerli
    // kalırsa çalınmış bir token çıkışa rağmen kullanılabilir.
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Geçerli kullanıcı. React `cache` ile aynı istek içinde tek sorguya iner —
 * layout, sayfa ve bileşenler ayrı ayrı çağırsa da veritabanına bir kez gidilir.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!session) return null;
  // Süresi geçmiş oturumu geçerli sayma. Temizliği burada yapmıyoruz (okuma
  // yolunda yazmak Server Component'te sorun çıkarır); süresi geçenler
  // periyodik olarak silinir.
  if (session.expiresAt < new Date()) return null;

  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Giriş yapmanız gerekiyor.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Bu işlem için yetkiniz yok.");
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Süresi geçmiş oturumları siler. */
export async function pruneExpiredSessions() {
  const { count } = await prisma.authSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
