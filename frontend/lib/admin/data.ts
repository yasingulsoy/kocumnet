import "server-only";
import { backend } from "./backend";
import type { AdminBlog, ContactMessage, MessageStatus, Pagination, StaffUser } from "./types";

/** Sayfaların okuma sorguları — action'lardan ayrı, önbelleksiz. */

export async function listBlogs(p: {
  page?: number;
  limit?: number;
  search?: string;
  locale?: string;
  /** "published" | "draft" | undefined (hepsi) */
  durum?: string;
}) {
  const q = new URLSearchParams({ include_drafts: "true", limit: String(p.limit ?? 30), page: String(p.page ?? 1) });
  if (p.search) q.set("search", p.search);
  if (p.locale) q.set("locale", p.locale);
  if (p.durum === "published") q.set("is_published", "true");
  if (p.durum === "draft") q.set("is_published", "false");
  return backend<{ data: AdminBlog[]; pagination: Pagination }>(`/api/blogs?${q}`);
}

export async function getBlog(id: number) {
  return backend<{ data: AdminBlog }>(`/api/blogs/${id}`).then((r) => r.data);
}

export async function listMessages(p: { page?: number; status?: MessageStatus; search?: string }) {
  const q = new URLSearchParams({ limit: "25", page: String(p.page ?? 1) });
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  return backend<{ data: ContactMessage[]; unread: number; pagination: Pagination }>(
    `/api/admin/contact-messages?${q}`
  );
}

export async function getMessage(id: number) {
  return backend<{ data: ContactMessage }>(`/api/admin/contact-messages/${id}`).then((r) => r.data);
}

export async function listStaff() {
  return backend<{ data: StaffUser[] }>("/api/admin/users").then((r) => r.data);
}

export async function getStaffUser(id: number) {
  return backend<{ data: StaffUser }>(`/api/admin/users/${id}`).then((r) => r.data);
}
