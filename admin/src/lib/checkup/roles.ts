/**
 * Personel rolleri — SUNUCU/İSTEMCİ ORTAK modül. Hiçbir sunucu API'si
 * (cookies, next/headers) içermez; istemci bileşenleri (kenar çubuğu)
 * buradan okur. Doğrulama mantığı staff.ts'te (server-only).
 *
 * backend/utils/roles.js ile aynı gruplar — yetki farkı orada nasılsa burada da öyle.
 */

export const STAFF_ROLES = ["admin", "manager", "editor", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ANY_STAFF: readonly StaffRole[] = STAFF_ROLES;
/** Soru yazma/düzenleme, şekil yükleme, kazanım. */
export const CONTENT_ROLES: readonly StaffRole[] = ["admin", "manager", "editor"];
/**
 * Öğrenci kişisel verisi, erişim hakları, paket satış ayarları.
 * Soru yazan editörün öğrenci e-postalarını görmesi gerekmiyor (KVKK:
 * veri en az kişiye açık olmalı).
 */
export const MANAGE_ROLES: readonly StaffRole[] = ["admin", "manager"];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  editor: "Editör",
  viewer: "Görüntüleyici",
};

export interface Staff {
  /** backend `users.id` (tamsayı). */
  id: number;
  email: string;
  name: string;
  role: StaffRole;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}
