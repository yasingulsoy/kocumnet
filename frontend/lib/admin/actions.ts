"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BACKEND_URL } from "@/lib/api";
import { BackendError, BackendUnreachable, backend, backendRaw, oturumJetonu } from "./backend";
import { guvenliSonraki, oturumSil, oturumYaz, staffForAction } from "./auth";
import { basarisizDenemeSay, denemeSayaciniSifirla, denemeSiniriAsildi, denemeSiniriDolu } from "./limiter";
import {
  CONTENT_ROLES,
  MANAGE_ROLES,
  isContentLocale,
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
  if (e instanceof BackendUnreachable) {
    // Sunucu yanıt verdi ama hata oldu: kod, backend günlüğündeki satırı bulmaya yarar.
    if (e.status && e.requestId) {
      return { error: `Sunucuda bir hata oluştu. Tekrar dene; sürerse bu kodu teknik ekibe ilet: ${e.requestId}` };
    }
    return { error: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." };
  }
  console.error("[admin action]", e);
  return { error: varsayilan };
}

const metin = (fd: FormData, ad: string, enFazla = 10_000) =>
  String(fd.get(ad) ?? "")
    .trim()
    .slice(0, enFazla);

const COK_DENEME = "Çok fazla deneme. 15 dakika sonra tekrar dene.";
const ON_BES_DK = 15 * 60_000;

// ─────────────────────────────────────────────────────────────
// Kimlik
// ─────────────────────────────────────────────────────────────

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const kimlik = metin(fd, "kimlik", 255);
  const parola = String(fd.get("parola") ?? "");
  const sonraki = guvenliSonraki(fd.get("next")) ?? "/admin";

  if (!kimlik || !parola) return { error: "E-posta ve parola gerekli." };

  // İstemci başına, yalnızca BAŞARISIZ denemeler: bütün hesaplar için 30, aynı hesap için 10 / 15 dk.
  const hesapAnahtari = `giris:${kimlik.toLowerCase()}`;
  if ((await denemeSiniriDolu("giris", 30)) || (await denemeSiniriDolu(hesapAnahtari, 10))) {
    return { error: COK_DENEME };
  }

  let token: string | null = null;
  try {
    const { res, json } = await backendRaw("/api/admin/auth/login", {
      method: "POST",
      auth: false,
      body: { usernameOrEmail: kimlik, password: parola },
    });
    if (res.status === 429) return { error: COK_DENEME };
    if (!res.ok || !json?.success) {
      await basarisizDenemeSay("giris", ON_BES_DK);
      await basarisizDenemeSay(hesapAnahtari, ON_BES_DK);
      return { error: String(json?.error ?? "E-posta veya parola hatalı.") };
    }
    token = oturumJetonu(res);
  } catch (e) {
    return hataDurumu(e);
  }

  if (!token) return { error: "Oturum çerezi alınamadı. Backend sürümünü kontrol et." };
  await denemeSayaciniSifirla(hesapAnahtari);
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
  if (await denemeSiniriAsildi("sifremi-unuttum", 10, 60 * 60_000)) {
    return { error: "Çok fazla istek. Bir saat sonra tekrar dene." };
  }
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
  if (await denemeSiniriAsildi("parola-belirle", 20, ON_BES_DK)) return { error: COK_DENEME };
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

/** Diğer bütün cihazlardaki oturumları kapat; bu cihaz yeni çerezle açık kalır. */
export async function logoutOthersAction(): Promise<FormState> {
  try {
    const { res, json } = await backendRaw("/api/admin/auth/logout-all", { method: "POST" });
    if (!res.ok || !json?.success) return { error: String(json?.error ?? "Oturumlar kapatılamadı.") };
    const token = oturumJetonu(res);
    if (token) await oturumYaz(token);
    return { ok: true, message: String(json.message ?? "Diğer cihazlardaki oturumlar kapatıldı.") };
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
  const slug = metin(fd, "slug", 120).toLowerCase();
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { fields: { slug: "Yalnızca küçük harf, rakam ve tire. Örnek: tyt-matematik-plani" } };
  }

  /*
   * Yayın durumu, basılan düğmeden gelir ("yayin" = "1" yayınla, "0" taslağa
   * al). Düğmesiz gönderim (Ctrl+S) durumu KORUR: eskiden bir kutucuktu ve
   * kaydet'e basmak yanlışlıkla yayına almanın en kısa yoluydu.
   * Yeni yazı düğmesiz kaydedilirse taslaktır.
   */
  const yayinIstegi = fd.get("yayin");
  const yayin = yayinIstegi === "1" ? true : yayinIstegi === "0" ? false : id ? undefined : false;

  const payload = {
    title,
    // Yalnızca düzenlemede ve dolu ise gönderilir: yeni yazıda adres başlıktan üretilir.
    ...(id && slug ? { slug } : {}),
    content,
    excerpt: metin(fd, "excerpt", 1000) || null,
    tags: metin(fd, "tags", 2000)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30),
    ...(yayin === undefined ? {} : { is_published: yayin }),
    meta_title: metin(fd, "meta_title", 255) || null,
    meta_description: metin(fd, "meta_description", 320) || null,
    // Alan yalnızca kapak varken formda; yoksa dokunma (kapak silinince backend temizler).
    ...(fd.has("image_alt") ? { image_alt: metin(fd, "image_alt", 200) || null } : {}),
    locale: ["tr", "en", "ar"].includes(locale) ? locale : "tr",
  };

  // Boyut denetimi kayıttan ÖNCE: eskiden yazı oluşturulduktan sonra
  // yapılıyordu; yeni yazıda hata dönünce kullanıcı yeniden kaydediyor ve
  // aynı yazının ikinci kopyası oluşuyordu.
  const kapak = fd.get("cover");
  if (kapak instanceof File && kapak.size > 10 * 1024 * 1024) {
    return { fields: { cover: "Kapak görseli 10 MB'ı aşıyor." }, error: "Kapak görseli 10 MB'ı aşıyor." };
  }

  let blogId = id;
  let kaydedildi = false;
  try {
    if (id) {
      await backend(`/api/blogs/${id}`, { method: "PUT", body: payload });
    } else {
      const r = await backend<{ data: AdminBlog }>("/api/blogs", { method: "POST", body: payload });
      blogId = r.data.id;
    }
    kaydedildi = true;

    // Kapak: önce kayıt, sonra görsel — backend iki ayrı uç.
    if (kapak instanceof File && kapak.size > 0) {
      const mp = new FormData();
      mp.append("image", kapak, kapak.name);
      await backend(`/api/blogs/${blogId}/image`, { method: "POST", formData: mp });
    } else if (fd.get("remove_cover") === "1") {
      await backend(`/api/blogs/${blogId}/image`, { method: "DELETE" });
    }
  } catch (e) {
    // Yazı kaydedildi ama kapak takıldıysa düzenleme sayfasına "kapak
    // yüklenemedi" uyarısıyla dön: metin kayıtlı, yalnızca kapak yeniden seçilir.
    // (Yeni yazıda bu, kullanıcının yeniden kaydedip İKİNCİ kopya açmasını da önler.)
    if (kaydedildi && blogId) {
      console.error("[admin] kapak yüklenemedi:", e instanceof Error ? e.message : e);
      blogSayfalariniYenile(blogId);
      redirect(`/admin/blog/${blogId}?hata=kapak&k=${Date.now().toString(36)}`);
    }
    return hataDurumu(e, "Yazı kaydedilemedi.");
  }

  blogSayfalariniYenile(blogId ?? undefined);
  // Sayfadaki bildirim neyin olduğunu söylesin: kaydedildi / yayınlandı / taslağa alındı.
  // `k`: her kayıtta farklı; sayfa formu bununla yeniden bağlar (hiçbir alan
  // değişmediyse updated_at da değişmiyor, "kaydedilmedi" izi takılı kalıyordu).
  const sonuc = yayin === true ? "yayinlandi" : yayin === false && fd.get("yayin") === "0" ? "taslak" : "1";
  redirect(`/admin/blog/${blogId}?kaydedildi=${sonuc}&k=${Date.now().toString(36)}`);
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

/**
 * Yazıyı bir sürüme döndür. Adres, kapak, yayın durumu değişmez; dönüş de
 * yeni bir sürüm olarak kaydedilir. Editör yeniden bağlansın diye `k`.
 */
export async function restoreRevisionAction(blogId: number, revisionId: number): Promise<FormState> {
  const yetki = await staffForAction(CONTENT_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/blogs/${blogId}/revisions/${revisionId}/restore`, { method: "POST" });
  } catch (e) {
    return hataDurumu(e, "Sürüme dönülemedi.");
  }
  blogSayfalariniYenile(blogId);
  redirect(`/admin/blog/${blogId}?kaydedildi=geri&k=${Date.now().toString(36)}`);
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

function mesajSayfalariniYenile(id?: number) {
  revalidatePath("/admin/mesajlar");
  if (id) revalidatePath(`/admin/mesajlar/${id}`);
  revalidatePath("/admin");
}

const DURUM_SONUCU: Record<string, string> = {
  new: "Okunmadı olarak işaretlendi.",
  read: "Okundu olarak işaretlendi.",
  answered: "Yanıtlandı olarak işaretlendi.",
  archived: "Arşivlendi.",
  spam: "Spam olarak işaretlendi.",
};

export async function setMessageStatusAction(id: number, status: string): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  if (!isMessageStatus(status)) return { error: "Geçersiz durum." };
  try {
    await backend(`/api/admin/contact-messages/${id}`, { method: "PATCH", body: { status } });
  } catch (e) {
    return hataDurumu(e);
  }
  mesajSayfalariniYenile(id);
  return { ok: true, message: DURUM_SONUCU[status] };
}

/** Listeden seçilen mesajlara tek seferde durum (en fazla 100). */
export async function bulkMessageStatusAction(ids: number[], status: string): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  if (!isMessageStatus(status)) return { error: "Geçersiz durum." };
  const temiz = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 100);
  if (temiz.length === 0) return { error: "Mesaj seçilmedi." };
  let guncellenen = 0;
  try {
    const r = await backend<{ updated?: number }>("/api/admin/contact-messages", {
      method: "PATCH",
      body: { ids: temiz, status },
    });
    guncellenen = Number(r.updated) || 0;
  } catch (e) {
    return hataDurumu(e);
  }
  mesajSayfalariniYenile();
  return { ok: true, message: `${guncellenen} mesaj: ${DURUM_SONUCU[status].toLocaleLowerCase("tr-TR")}` };
}

/** Ekip içi not (gönderen görmez). Boş kaydedilirse not silinir. */
export async function saveMessageNoteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Mesaj bulunamadı." };
  const not = String(fd.get("note") ?? "").trim().slice(0, 2000);
  try {
    await backend(`/api/admin/contact-messages/${id}`, { method: "PATCH", body: { note: not || null } });
  } catch (e) {
    return hataDurumu(e, "Not kaydedilemedi.");
  }
  mesajSayfalariniYenile(id);
  return { ok: true, message: not ? "Not kaydedildi." : "Not silindi." };
}

// ─── Hazır yanıt şablonları ──────────────────────────────────

function sablonSayfalariniYenile() {
  revalidatePath("/admin/mesajlar/sablonlar");
  revalidatePath("/admin/mesajlar/[id]", "page");
}

/** Şablon ekle (id yoksa) ya da güncelle. */
export async function saveReplyTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };

  const id = Number(fd.get("id")) || null;
  const title = metin(fd, "title", 80);
  const locale = metin(fd, "locale", 5);
  // Gövdede satır sonları korunur; yalnızca uçlar kırpılır.
  const body = String(fd.get("body") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 3000);

  const fields: Record<string, string> = {};
  if (!title) fields.title = "Şablona bir ad ver.";
  if (!isContentLocale(locale)) fields.locale = "Dil seç.";
  if (!body) fields.body = "Şablon metni boş olamaz.";
  if (Object.keys(fields).length) return { fields };

  try {
    const r = await backend<{ message?: string }>(id ? `/api/admin/reply-templates/${id}` : "/api/admin/reply-templates", {
      method: id ? "PUT" : "POST",
      body: { title, locale, body },
    });
    sablonSayfalariniYenile();
    return { ok: true, message: r.message ?? "Kaydedildi." };
  } catch (e) {
    return hataDurumu(e, "Şablon kaydedilemedi.");
  }
}

export async function deleteReplyTemplateAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/admin/reply-templates/${id}`, { method: "DELETE" });
  } catch (e) {
    return hataDurumu(e);
  }
  sablonSayfalariniYenile();
  return { ok: true, message: "Şablon silindi." };
}

/** Boş listeye başlangıç örnekleri (TR/EN/AR genel metinler). */
export async function addSampleTemplatesAction(): Promise<FormState> {
  const yetki = await staffForAction(MANAGE_ROLES);
  if (!yetki.ok) return { error: yetki.error };
  try {
    const r = await backend<{ message?: string }>("/api/admin/reply-templates/samples", { method: "POST" });
    sablonSayfalariniYenile();
    return { ok: true, message: r.message ?? "Örnek şablonlar eklendi." };
  } catch (e) {
    return hataDurumu(e);
  }
}

export async function deleteMessageAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };
  try {
    await backend(`/api/admin/contact-messages/${id}`, { method: "DELETE" });
  } catch (e) {
    return hataDurumu(e);
  }
  mesajSayfalariniYenile();
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
    // Davet bitiş tarihi değişti: liste ve ayrıntı yeni süreyi göstersin.
    revalidatePath("/admin/personel");
    revalidatePath(`/admin/personel/${id}`);
    return { ok: true, message: r.message ?? "Gönderildi." };
  } catch (e) {
    return hataDurumu(e);
  }
}

/** Yönetici: başka bir personelin bütün oturumlarını kapatır (iki panelde de). */
export async function revokeSessionsAction(id: number): Promise<FormState> {
  const yetki = await staffForAction(["admin"]);
  if (!yetki.ok) return { error: yetki.error };
  try {
    const r = await backend<{ message?: string }>(`/api/admin/users/${id}/revoke-sessions`, { method: "POST" });
    return { ok: true, message: r.message ?? "Oturumlar kapatıldı." };
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
