import type { BlogPost } from "@/lib/blog";

/** Backend personel rolleri — utils/roles.js ile aynı. */
export const STAFF_ROLES = ["admin", "manager", "editor", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  editor: "Editör",
  viewer: "Görüntüleyici",
};

export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  admin: "Her şey: personel ekler/siler, rol verir, mesaj siler.",
  manager: "Blog ve mesajları yönetir, personeli görür; rol ve parola değiştiremez.",
  editor: "Blog yazar ve yayınlar. Mesajları ve personeli görmez.",
  viewer: "Yalnızca okur; taslakları görebilir.",
};

/** Blog yazıp düzenleyebilen roller. */
export const CONTENT_ROLES: readonly StaffRole[] = ["admin", "manager", "editor"];
/** Mesajlar ve personel listesi. */
export const MANAGE_ROLES: readonly StaffRole[] = ["admin", "manager"];

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);
}

export interface Staff {
  id: number;
  email: string;
  name: string;
  role: StaffRole;
}

/** GET /api/admin/users satırı. */
export interface StaffUser {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: StaffRole;
  is_active: boolean;
  is_admin: boolean;
  /** false: davet edildi, parola henüz belirlenmedi. */
  has_password: boolean;
  last_login: string | null;
  created_at: string;
}

export function staffName(u: Pick<StaffUser, "first_name" | "last_name" | "email">): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email;
}

/** Yönetim listesi: taslaklar dahil, yayın durumu ve dil alanıyla. */
export interface AdminBlog extends BlogPost {
  is_published: boolean;
  locale: string;
  author_id: number | null;
}

export const MESSAGE_STATUSES = ["new", "read", "archived", "spam"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  new: "Yeni",
  read: "Okundu",
  archived: "Arşiv",
  spam: "Spam",
};

export function isMessageStatus(v: unknown): v is MessageStatus {
  return typeof v === "string" && (MESSAGE_STATUSES as readonly string[]).includes(v);
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  locale: string;
  source: string;
  status: MessageStatus;
  handled_by: number | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  handler?: { id: number; first_name: string | null; last_name: string | null } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Form action'larının ortak durumu (useActionState). */
export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Alan bazlı hatalar: { email: "…" } */
  fields?: Record<string, string>;
}
