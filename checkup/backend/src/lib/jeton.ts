import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Oturum ve parola sıfırlama jetonu: 32 rastgele bayt, base64url. */
export function jetonUret(): string {
  return randomBytes(32).toString("base64url");
}

/** Veritabanında jetonun kendisi değil SHA-256 özeti (hex) saklanır. */
export function jetonOzeti(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

/**
 * Sabit sürede karşılaştırma. timingSafeEqual eşit uzunluk ister; iki tarafın
 * SHA-256 özetini karşılaştırarak uzunluk farkı da sızmaz.
 */
export function guvenliEsit(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}
