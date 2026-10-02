"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BACKEND_URL } from "@/lib/api";
import { BackendError, BackendUnreachable, backend, backendRaw, oturumJetonu } from "./backend";
import { oturumSil, oturumYaz, staffForAction } from "./auth";
import {
  CONTENT_ROLES,
  MANAGE_ROLES,
  isMessageStatus,
  isStaffRole,
  type AdminBlog,
  type FormState,
  type StaffUser,
} from "./types";

/*
 * Tüm server action'lar burada. Kural: redirect() try/catch İÇİNE ALINMAZ —
 * özel bir hata fırlatarak çalışır, yakalanırsa yönlendirme yutulur.
 */

function hataDurumu(e: unknown, varsayilan = "Bir şeyler ters gitti."): FormState {
  if (e instanceof BackendError) return { error: e.message, fields: e.fields };
  if (e instanceof BackendUnreachable) return { error: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." };
  console.error("[admin action]", e);
  return { error: varsayilan };
}

const metin = (fd: FormData, ad: string, enFazla = 10_000) =>
  String(fd.get(ad) ?? "")
    .trim()
    .slice(0, enFazla);

const guvenliSonraki = (v: unknown) =>
  typeof v === "string" && v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";

// ─────────────────────────────────────────────────────────────
// Kimlik
// ─────────────────────────────────────────────────────────────

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const kimlik = metin(fd, "kimlik", 255);
  const parola = String(fd.get("parola") ?? "");
  const sonraki = guvenliSonraki(fd.get("next"));

  if (!kimlik || !parola) return { error: "E-posta ve parola gerekli." };

  let token: string | null = null;
  try {
    const { res, json } = await backendRaw("/api/admin/auth/login", {
      method: "POST",
      auth: false,
      body: { usernameOrEmail: kimlik, password: parola },
    });
    if (res.status === 429) return { error: "Çok fazla deneme. 15 dakika sonra tekrar dene." };
    if (!res.ok || !json?.success) {
      return { error: String(json?.error ?? "E-posta veya parola hatalı.") };
    }
    token = oturumJetonu(res);
  } catch (e) {
    return hataDurumu(e);
  }

  if (!token) return { error: "Oturum çerezi alınamadı. Backend sürümünü kontrol et." };
  await oturumYaz(token);
  redirect(sonraki);
}

export async function logoutAction() {
  try {
    await backend("/api/admin/auth/logout", { method: "POST" });
  } catch {
    // Backend'e ulaşılamasa da yerel çerez silinir.
  }
  await oturumSil();
  redirect("/admin/giris");
}

export async function forgotAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = metin(fd, "email", 255).toLowerCase();
  if (!email) return { fields: { email: "E-posta adresini yaz." } };
  try {
    const r = await backend<{ message?: string }>("/api/admin/auth/forgot", {
      method: "POST",
      auth: false,
      body: { email },
    });
    return { ok: true, message: r.message ?? "Bağlantı gönderildi." };
  } catch (e) {
    if (e instanceof BackendError && e.code === "MAIL_NOT_CONFIGURED") return { error: e.message };
    if (e instanceof BackendError && e.status === 429) return { error: "Çok fazla deneme. Biraz sonra tekrar dene." };
    return hataDurumu(e);
  }
}

export async function resetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = metin(fd, "token", 300);
  const parola = String(fd.get("parola") ?? "");
  const tekrar = String(fd.get("parola2") ?? "");
  if (parola !== tekrar) return { fields: { parola2: "Parolalar aynı değil." } };
  try {
    await backend("/api/admin/auth/reset", { method: "POST", auth: false, body: { token, password: parola } });
  } catch (e) {
    return hataDurumu(e);
  }
  redirect("/admin/giris?parola=1");
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const mevcut = String(fd.get("mevcut") ?? "");
  const yeni = String(fd.get("yeni") ?? "");
  const tekrar = String(fd.get("yeni2") ?? "");
  if (yeni !== tekrar) return { fields: { yeni2: "Parolalar aynı değil." } };
  try {
    const { res, json } = await backendRaw("/api/admin/auth/password", {
      method: "PUT",
      body: { current_password: mevcut, new_password: yeni },
    });
    if (!res.ok || !json?.success) return { error: String(json?.error ?? "Parola değiştirilemedi.") };
    // Backend değişiklikten sonra yeni çerez verir: bu cihaz açık kalsın.
    const token = oturumJetonu(res);
    if (token) await oturumYaz(token);
    return { ok: true, message: String(json.message ?? "Parolan değiştirildi.") };
  } catch (e) {
    return hataDurumu(e);
  }
}

// ─────────────────────────────────────────────────────────────
// Blog
// ─────────────────────────────────────────────────────────────

function blogSayfalariniYenile(id?: number) {
  revalidatePath("/admin/blog");
  if (id) revalidatePath(`/admin/blog/${id}`);
  // Herkese açık site: liste ve detay (üç dil). Yol deseni, segment tipi "page".
  revalidatePath("/[lang]/blog", "page");
  revalidatePath("/[lang]/blog/[slug]", "page");
  revalidatePath("/[lang]", "page");
}

/** Editörde mutlak backend adresi kullanılan görselleri göreli hâle çevirir. */
function gorselleriGorelilestir(html: string) {
  return html.split(`${BACKEND_URL}/uploads/`).join("/uploads/");
}

export async function saveBlogAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const yetki = await staffForAction(CONTENT_ROLES);
  if (!yetki.ok) return { error: yetki.error };

  const id = Number(fd.get("id")) || null;
  const title = metin(fd, "title", 500);
  const content = gorselleriGorelilestir(String(fd.get("content") ?? ""));
  const govdeMetin = content.replace(/<[^>]*>/g, "").trim();
  const fields: Record<string, string> = {};
  if (!title) fields.title = "Başlık gerekli.";
  if (!govdeMetin && !/<img/i.test(content)) fields.content = "İçerik boş olamaz.";
  if (Object.keys(fields).length) return { fields };

  const locale = metin(fd, "locale", 5) || "tr";
  const payload = {
    title,
    content,
    excerpt: metin(fd, "excerpt", 1000) || null,
    tags: metin(fd, "tags", 2000)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30),
    is_published: fd.get("is_published") === "on",
    meta_title: metin(fd, "meta_title", 255) || null,
    meta_description: metin(fd, "meta_description", 320) || null,
    locale: ["tr", "en", "ar"].includes(locale) ? locale : "tr",
  };

  let blogId = id;
  try {
    if (id) {
      await backend(`/api/blogs/${id}`, { method: "PUT", body: payload });
    } else {
      const r = await backend<{ data: AdminBlog }>("/api/blogs", { method: "POST", body: payload });
      blogId = r.data.id;
    }

    // Kapak: önce kayıt, sonra görsel — backend iki ayrı uç.
    const kapak = fd.get("cover");
    if (kapak instanceof File && kapak.size > 0) {
      if (kapak.size > 10 * 1024 * 1024) return { error: "Kapak görseli 10 MB'ı aşıyor." };
      const mp = new FormData();
      mp.append("image", kapak, kapak.name);
      await backend(`/api/blogs/${blogId}/image`, { method: "POST", formData: mp });
    } else if (fd.get("remove_cover") === "1") {
      await backend(`/api/blogs/${blogId}/image`, { method: "DELETE" });
    }
  } catch (e) {
    // Yazı kaydedildi ama kapak takıldıysa kullanıcıyı düzenleme sayfasında
    // bırak: yeniden yazmak zorunda kalmasın.
    if (blogId && !id) {
      blogSayfalariniYenile(blogId);
      redirect(`/admin/blog/${blogId}?hata=kapak`);
    }
    return hataDurumu(e, "Yazı kaydedilemedi.");
  }

  blogSayfalariniYenile(blogId ?? undefined);
  redirect(`/admin/blog/${blogId}?kaydedildi=1`);
}

export async function setBlogPublishedAction(id: number, published: boolean): Promise<FormState> {
  const yetki = await staffForAction(CONTENT_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/blogs/${id}`, { method: "PUT", body: { is_published: published } });
  } catch (e) {
    return hataDurumu(e);
  }
  blogSayfalariniYenile(id);
  return { ok: true, message: published ? "Yazı yayınlandı." : "Yazı taslağa alındı." };
}

export async function deleteBlogAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(CONTENT_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/blogs/${id}`, { method: "DELETE" });
  } catch (e) {
    return hataDurumu(e);
  }
  blogSayfalariniYenile();
  redirect("/admin/blog?silindi=1");
}

// ─────────────────────────────────────────────────────────────
// Mesajlar
// ─────────────────────────────────────────────────────────────

export async function setMessageStatusAction(id: number, status: string): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  if (!isMessageStatus(status)) return { error: "Geçersiz durum." };
  try {
    await backend(`/api/admin/contact-messages/${id}`, { method: "PATCH", body: { status } });
  } catch (e) {
    return hataDurumu(e);
  }
  revalidatePath("/admin/mesajlar");
  revalidatePath(`/admin/mesajlar/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteMessageAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/admin/contact-messages/${id}`, { method: "DELETE" });
  } catch (e) {
    return hataDurumu(e);
  }
  revalidatePath("/admin/mesajlar");
  revalidatePath("/admin");
  redirect("/admin/mesajlar?silindi=1");
}

// ─────────────────────────────────────────────────────────────
// Personel
// ─────────────────────────────────────────────────────────────

export async function inviteStaffAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };

  const email = metin(fd, "email", 255).toLowerCase();
  const first_name = metin(fd, "first_name", 100);
  const last_name = metin(fd, "last_name", 100);
  const role = metin(fd, "role", 20);
  const password = String(fd.get("password") ?? "");

  const fields: Record<string, string> = {};
  if (!email) fields.email = "E-posta gerekli.";
  if (!first_name) fields.first_name = "Ad gerekli.";
  if (!last_name) fields.last_name = "Soyad gerekli.";
  if (!isStaffRole(role)) fields.role = "Rol seç.";
  if (Object.keys(fields).length) return { fields };

  try {
    const r = await backend<{ data: StaffUser; invited: boolean; invite_sent: boolean | null; message?: string }>(
      "/api/admin/users",
      {
        method: "POST",
        body: { email, first_name, last_name, role, ...(password ? { password } : {}) },
      }
    );
    revalidatePath("/admin/personel");
    revalidatePath("/admin");
    return { ok: true, message: r.message ?? "Hesap açıldı." };
  } catch (e) {
    return hataDurumu(e, "Hesap açılamadı.");
  }
}

export async function updateStaffAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };

  const id = Number(fd.get("id"));
  if (!id) return { error: "Kayıt bulunamadı." };
  const yonetici = yetki.staff.role === "admin";

  const body: Record<string, unknown> = {
    first_name: metin(fd, "first_name", 100),
    last_name: metin(fd, "last_name", 100),
    phone: metin(fd, "phone", 20) || null,
    username: metin(fd, "username", 50) || null,
    is_active: fd.get("is_active") === "on",
  };
  if (yonetici) {
    const role = metin(fd, "role", 20);
    if (isStaffRole(role)) body.role = role;
    const email = metin(fd, "email", 255).toLowerCase();
    if (email) body.email = email;
  }

  try {
    await backend(`/api/admin/users/${id}`, { method: "PUT", body });
  } catch (e) {
    return hataDurumu(e, "Kaydedilemedi.");
  }
  revalidatePath("/admin/personel");
  revalidatePath(`/admin/personel/${id}`);
  return { ok: true, message: "Kaydedildi." };
}

export async function resendInviteAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };
  try {
    const r = await backend<{ message?: string }>(`/api/admin/users/${id}/invite`, { method: "POST" });
    return { ok: true, message: r.message ?? "Gönderildi." };
  } catch (e) {
    return hataDurumu(e);
  }
}

export async function deleteStaffAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/admin/users/${id}`, { method: "DELETE" });
  } catch (e) {
    return hataDurumu(e);
  }
  revalidatePath("/admin/personel");
  redirect("/admin/personel?silindi=1");
}
