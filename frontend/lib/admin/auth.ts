import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, BackendUnreachable, backendRaw } from "./backend";
import { isStaffRole, type Staff, type StaffRole } from "./types";

/** 6 saat — backend JWT ömrüyle aynı. */
const OTURUM_SN = 6 * 60 * 60;

/**
 * Oturum çerezini bu alan adına yazar. AUTH_COOKIE_DOMAIN=.kocum.net ise
 * check-up paneli (admin.kocum.net) de aynı çerezi görür: tek giriş.
 */
export async function oturumYaz(token: string) {
  const domain = (process.env.AUTH_COOKIE_DOMAIN ?? "").trim();
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OTURUM_SN,
    ...(domain ? { domain } : {}),
  });
}

export async function oturumSil() {
  const domain = (process.env.AUTH_COOKIE_DOMAIN ?? "").trim();
  const store = await cookies();
  store.delete({ name: ADMIN_COOKIE, path: "/", ...(domain ? { domain } : {}) });
}

export type StaffDurumu =
  | { kind: "ok"; staff: Staff; /** Backend'de SMTP ayarlı mı (davet/sıfırlama gönderebilir mi). */ mail: boolean }
  | { kind: "none" }
  | { kind: "unreachable" };

/**
 * Geçerli personel. İstek başına BİR backend çağrısı (React cache): düzen,
 * sayfa ve bileşenler ayrı ayrı sorsa da tek sefer gidilir.
 *
 * Doğrulama backend'e sorulur (tek doğruluk kaynağı): JWT'yi burada çözseydik
 * pasife alınan personel 6 saat daha içeride kalır, rol değişikliği gecikirdi.
 */
export const staffDurumu = cache(async (): Promise<StaffDurumu> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return { kind: "none" };

  let sonuc;
  try {
    sonuc = await backendRaw("/api/admin/auth/verify");
  } catch (e) {
    if (e instanceof BackendUnreachable) {
      console.error("[admin] personel doğrulaması:", e.message);
      return { kind: "unreachable" };
    }
    throw e;
  }

  const { res, json } = sonuc;
  if (res.status === 401 || res.status === 403) return { kind: "none" };
  if (!res.ok || !json?.success) return { kind: "unreachable" };

  const u = json.user as Record<string, unknown> | undefined;
  // Hata kapalı: beklenen biçimde olmayan her yanıt "oturum yok".
  if (!u || u.is_active !== true || !isStaffRole(u.role) || typeof u.email !== "string") {
    return { kind: "none" };
  }
  const id = Number(u.id);
  if (!Number.isInteger(id)) return { kind: "none" };

  const ad = [u.first_name, u.last_name]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .join(" ");

  const features = json.features as { mail?: boolean } | undefined;
  return { kind: "ok", staff: { id, email: u.email, name: ad || u.email, role: u.role }, mail: features?.mail === true };
});

/**
 * Sayfalar için: oturum yoksa girişe yönlendirir, varsa personeli ve rol
 * izni sonucunu döndürür. Rol yetmezse sayfa "yetkin yok" kutusu çizer —
 * yönlendirme değil, çünkü kullanıcı nereye girmeye çalıştığını görmeli.
 *
 * ⚠️ Düzen (layout) seviyesindeki denetim YETMEZ: Next sayfayı düzenle
 * paralel çizebilir. Her sayfa bunu çağırır; cache sayesinde maliyeti yok.
 */
export async function requireStaff(roles?: readonly StaffRole[]): Promise<{ staff: Staff; allowed: boolean }> {
  const d = await staffDurumu();
  if (d.kind === "none") redirect("/admin/giris");
  if (d.kind === "unreachable") redirect("/admin/giris?hata=backend");
  return { staff: d.staff, allowed: !roles || roles.includes(d.staff.role) };
}

/** Server action'lar için: oturum/rol yoksa kullanıcıya gösterilecek mesaj. */
export async function staffForAction(
  roles?: readonly StaffRole[]
): Promise<{ ok: true; staff: Staff } | { ok: false; error: string }> {
  const d = await staffDurumu();
  if (d.kind === "none") return { ok: false, error: "Oturumun kapanmış. Sayfayı yenileyip tekrar giriş yap." };
  if (d.kind === "unreachable") return { ok: false, error: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." };
  if (roles && !roles.includes(d.staff.role)) return { ok: false, error: "Bu işlem için yetkin yok." };
  return { ok: true, staff: d.staff };
}
