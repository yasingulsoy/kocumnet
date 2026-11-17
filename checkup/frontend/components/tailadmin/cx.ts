/*
 * Uyarlama: TailAdmin Free (MIT) — src/utils/index.ts (cn) yerine.
 *
 * Sınıf birleştirici. TailAdmin clsx + tailwind-merge kullanıyor; kit
 * bağımlılıksız kalsın diye yalnızca dolu metinleri birleştirir
 * (`kosul && "sinif"` kalıbındaki false/0/null/undefined atılır).
 * ÇAKIŞMA ÇÖZMEZ: "px-4" ile "px-2" birlikte gelirse hangisinin kazanacağı
 * CSS sırasına kalır. Bileşenler bu yüzden varyantları prop'la seçer;
 * className yalnızca EK sınıf içindir (genişlik, kenar boşluğu, görünürlük).
 * (tailwind-merge v2 ayrıca text-theme-xs'i renk sanıp siliyordu.)
 */
export type ClassValue = string | number | bigint | boolean | null | undefined;

export function cx(...parts: ClassValue[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p !== "").join(" ");
}
