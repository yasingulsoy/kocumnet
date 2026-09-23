import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

/**
 * Check-up ekranları için SUNUCU TARAFI personel doğrulaması.
 *
 * Neden ayrı bir denetim: panelin `(admin)/layout.tsx`'i bir istemci
 * bileşeni ve oturumu yalnızca tarayıcıda kontrol ediyor. Blog ekranları
 * verisini tarayıcıdan backend'e sorduğu için bu yetiyordu. Check-up
 * ekranları ise veriyi SUNUCUDA, doğrudan veritabanından çiziyor — sunucu
 * denetlemezse öğrenci listesi, çerezi olmayan birine giden RSC yanıtının
 * içinde durur; istemci düzeni onu sadece ekrana basmamış olur.
 *
 * Bu yüzden her sayfa ve her server action `checkStaff()` çağırır.
 * Düzen (layout) seviyesinde tek denetim YETMEZ: Next sayfaları düzenden
 * bağımsız çizebiliyor.
 *
 * Doğrulama backend'e sorulur (tek doğruluk kaynağı): JWT'yi burada kendimiz
 * çözseydik pasife alınan personel, jetonun süresi dolana kadar (6 saat)
 * içeride kalırdı; rol değişikliği de gecikirdi.
 *
 * ⚠️ ÜRETİM: Tarayıcı çerezi api.kocum.net'ten alıyor. Backend'de
 * AUTH_COOKIE_DOMAIN=.kocum.net tanımlı değilse çerez admin.kocum.net
 * sunucusuna HİÇ GELMEZ ve bu ekranlar "oturum doğrulanamadı" gösterir.
 * Geliştirmede sorun yok: /api-backend yeniden yazması çerezi aynı kökene koyuyor.
 */

export const STAFF_ROLES = ["admin", "manager", "editor", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** backend/utils/roles.js ile aynı gruplar — yetki farkı orada nasılsa burada da öyle. */
export const ANY_STAFF: readonly StaffRole[] = STAFF_ROLES;
/** Soru yazma/düzenleme, şekil yükleme. */
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

export type GateReason = "no-session" | "forbidden" | "unreachable";

export type StaffCheck =
  | { ok: true; staff: Staff }
  | { ok: false; reason: GateReason; staff?: Staff };

const COOKIE = "admin_access_token";

function backendUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:5000";
  return raw.replace(/\/$/, "");
}

type Verify = { kind: "ok"; staff: Staff } | { kind: "none" } | { kind: "unreachable" };

function isRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * İstek başına BİR kez backend'e sorar (React `cache`): aynı sayfada
 * birden fazla bileşen denetlese de tek çağrı yapılır.
 */
const verify = cache(async (): Promise<Verify> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return { kind: "none" };

  let res: Response;
  try {
    res = await fetch(backendUrl() + "/api/admin/auth/verify", {
      headers: { cookie: COOKIE + "=" + encodeURIComponent(token) },
      cache: "no-store",
      // Backend asılı kalırsa panel de asılı kalmasın; kapalı kalmak yeğ.
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[checkup] personel doğrulaması: backend'e ulaşılamadı —", (e as Error).message);
    return { kind: "unreachable" };
  }

  if (res.status === 401 || res.status === 403) return { kind: "none" };
  if (!res.ok) {
    console.error("[checkup] personel doğrulaması: backend " + res.status + " döndü");
    return { kind: "unreachable" };
  }

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    user?: Record<string, unknown>;
  } | null;
  const u = body?.user;

  // Hata kapalı: beklenen biçimde olmayan her yanıt "oturum yok" sayılır.
  if (!body?.success || !u || u.is_active !== true || !isRole(u.role)) {
    return { kind: "none" };
  }
  const id = Number(u.id);
  if (!Number.isInteger(id) || typeof u.email !== "string") return { kind: "none" };

  const ad = [u.first_name, u.last_name]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .join(" ");

  return {
    kind: "ok",
    staff: {
      id,
      email: u.email,
      name: ad || (typeof u.username === "string" ? u.username : u.email),
      role: u.role,
    },
  };
});

/** Sayfalar için: sonucu döndürür, sayfa yetkisizse bilgi kutusu çizer. */
export async function checkStaff(roles: readonly StaffRole[] = ANY_STAFF): Promise<StaffCheck> {
  const v = await verify();
  if (v.kind === "none") return { ok: false, reason: "no-session" };
  if (v.kind === "unreachable") return { ok: false, reason: "unreachable" };
  if (!roles.includes(v.staff.role)) return { ok: false, reason: "forbidden", staff: v.staff };
  return { ok: true, staff: v.staff };
}

const ACTION_ERRORS: Record<GateReason, string> = {
  "no-session": "Oturumun doğrulanamadı. Sayfayı yenileyip tekrar giriş yap.",
  forbidden: "Bu işlem için yetkin yok.",
  unreachable: "Kimlik doğrulama sunucusuna ulaşılamadı. Biraz sonra tekrar dene.",
};

/**
 * Server action'lar için. Yetki yoksa kullanıcıya gösterilecek mesaj döner;
 * action veritabanına dokunmadan çıkar.
 */
export async function staffForAction(
  roles: readonly StaffRole[]
): Promise<{ ok: true; staff: Staff } | { ok: false; error: string }> {
  const c = await checkStaff(roles);
  return c.ok ? { ok: true, staff: c.staff } : { ok: false, error: ACTION_ERRORS[c.reason] };
}

/**
 * Kayıtlara yazılan personel damgası. Personel başka veritabanında
 * (backend `users`) olduğu için yabancı anahtar kurulamıyor; e-posta o anki
 * hâliyle, kimlik de değişmeyen anahtar olarak saklanıyor.
 */
export function staffStamp(staff: Staff): string {
  return staff.email + " (#" + staff.id + ")";
}
