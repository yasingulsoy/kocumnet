import "server-only";
import { cache } from "react";
import { backend } from "./backend";
import type {
  AdminBlog,
  AdminSummary,
  AuditArea,
  AuditEntry,
  BlogRevision,
  BlogRevisionSummary,
  ContactMessage,
  MessageCounts,
  MessageDetail,
  MessageStatus,
  Pagination,
  ReplyTemplate,
  StaffUser,
} from "./types";

/** Sayfaların okuma sorguları — action'lardan ayrı, önbelleksiz. */

export async function listBlogs(p: {
  page?: number;
  limit?: number;
  search?: string;
  locale?: string;
  /** "published" | "draft" | undefined (hepsi) */
  durum?: string;
  /** "updated": son düzenlenen önce (varsayılan: son oluşturulan önce). */
  sirala?: "updated";
}) {
  const q = new URLSearchParams({ include_drafts: "true", limit: String(p.limit ?? 30), page: String(p.page ?? 1) });
  if (p.search) q.set("search", p.search);
  if (p.locale) q.set("locale", p.locale);
  if (p.durum === "published") q.set("is_published", "true");
  if (p.durum === "draft") q.set("is_published", "false");
  if (p.sirala) q.set("sort", p.sirala);
  return backend<{ data: AdminBlog[]; pagination: Pagination }>(`/api/blogs?${q}`);
}

export async function getBlog(id: number) {
  return backend<{ data: AdminBlog }>(`/api/blogs/${id}`).then((r) => r.data);
}

export async function listMessages(p: {
  page?: number;
  /** Tek durum ya da liste (["new","read"] = bekleyenler); boş: hepsi. */
  status?: MessageStatus | readonly MessageStatus[];
  search?: string;
  limit?: number;
}) {
  const q = new URLSearchParams({ limit: String(p.limit ?? 25), page: String(p.page ?? 1) });
  const durumlar = typeof p.status === "string" ? [p.status] : (p.status ?? []);
  if (durumlar.length) q.set("status", durumlar.join(","));
  if (p.search) q.set("search", p.search);
  return backend<{ data: ContactMessage[]; unread: number; counts: MessageCounts; pagination: Pagination }>(
    `/api/admin/contact-messages?${q}`
  );
}

export async function getMessage(id: number) {
  const r = await backend<MessageDetail>(`/api/admin/contact-messages/${id}`);
  return { data: r.data, related: r.related ?? [], next_waiting: r.next_waiting ?? null } satisfies MessageDetail;
}

export async function listStaff() {
  return backend<{ data: StaffUser[] }>("/api/admin/users").then((r) => r.data);
}

export async function getStaffUser(id: number) {
  return backend<{ data: StaffUser }>(`/api/admin/users/${id}`).then((r) => r.data);
}

/**
 * Genel bakış sayıları. İstek başına bir kez (React cache): kenar
 * çubuğundaki "yeni mesaj" sayısı ile genel bakış aynı çağrıyı paylaşır.
 */
export const getSummary = cache(async () => backend<{ data: AdminSummary }>("/api/admin/summary").then((r) => r.data));

export async function listAudit(p: {
  page?: number;
  limit?: number;
  area?: AuditArea;
  actorId?: number;
  target?: { type: "blog" | "message" | "user"; id: number };
}) {
  const q = new URLSearchParams({ limit: String(p.limit ?? 50), page: String(p.page ?? 1) });
  if (p.area) q.set("area", p.area);
  if (p.actorId) q.set("actor_id", String(p.actorId));
  if (p.target) {
    q.set("target_type", p.target.type);
    q.set("target_id", String(p.target.id));
  }
  return backend<{ data: AuditEntry[]; pagination: Pagination }>(`/api/admin/audit?${q}`);
}

/** Hazır yanıt şablonları; dil verilirse yalnızca o dildekiler. */
export async function listReplyTemplates(locale?: string) {
  const q = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  return backend<{ data: ReplyTemplate[] }>(`/api/admin/reply-templates${q}`).then((r) => r.data);
}

/** Yazının sürümleri (en yeni önce; ilki şu anki hâl). */
export async function listRevisions(blogId: number) {
  return backend<{ data: BlogRevisionSummary[] }>(`/api/blogs/${blogId}/revisions`).then((r) => r.data);
}

export async function getRevision(blogId: number, revisionId: number) {
  return backend<{ data: BlogRevision }>(`/api/blogs/${blogId}/revisions/${revisionId}`).then((r) => r.data);
}
