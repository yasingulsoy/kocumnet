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
  admin: "Her şey: personel ekler/siler, rol verir, mesaj siler, etkinlik kaydını görür.",
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
  /** Parolasız hesapta son davetin bitişi; geçmişteyse davet süresi dolmuş. */
  invite_expires_at?: string | null;
  last_login: string | null;
  created_at: string;
}

/** Hesap durumu: pasif · davet bekliyor · davet süresi doldu · aktif. */
export type StaffStatus = "inactive" | "invited" | "invite_expired" | "active";

export function staffStatus(u: Pick<StaffUser, "is_active" | "has_password" | "invite_expires_at">, now = Date.now()): StaffStatus {
  if (!u.is_active) return "inactive";
  if (u.has_password) return "active";
  const bitis = u.invite_expires_at ? new Date(u.invite_expires_at).getTime() : 0;
  return bitis > now ? "invited" : "invite_expired";
}

export function staffName(u: Pick<StaffUser, "first_name" | "last_name" | "email">): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email;
}

/** Yönetim listesi: taslaklar dahil, yayın durumu ve dil alanıyla. */
export interface AdminBlog extends BlogPost {
  is_published: boolean;
  locale: string;
  author_id: number | null;
  /** Kapak görselinin alt metni; boşsa site başlığı kullanır. */
  image_alt: string | null;
}

export const MESSAGE_STATUSES = ["new", "read", "answered", "archived", "spam"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  new: "Yeni",
  read: "Okundu",
  answered: "Yanıtlandı",
  archived: "Arşiv",
  spam: "Spam",
};

/** "Bekleyen": henüz yanıtlanmamış ya da kapatılmamış — mesaj kutusunun varsayılanı. */
export const WAITING_STATUSES: readonly MessageStatus[] = ["new", "read"];

export type MessageCounts = Record<MessageStatus, number>;

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
  answered_by?: number | null;
  answered_at?: string | null;
  /** Ekip içi not; gönderen görmez. */
  note?: string | null;
  created_at: string;
  updated_at: string;
  handler?: PersonRef | null;
  answerer?: PersonRef | null;
}

export interface PersonRef {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

export function personName(p: PersonRef | null | undefined): string | null {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

/** Mesaj ayrıntısı: aynı adresten önceki mesajlar ve sıradaki bekleyen. */
export interface MessageDetail {
  data: ContactMessage;
  related: Pick<ContactMessage, "id" | "subject" | "status" | "created_at">[];
  next_waiting: { id: number; name: string } | null;
}

/** GET /api/admin/summary — rolün görebildiği sayılar. */
export interface AdminSummary {
  blogs: { published: number; draft: number };
  messages: { counts: MessageCounts; unread: number; waiting: number; oldest_waiting_at: string | null } | null;
  staff: { total: number; active: number; invited: number; invite_expired: number } | null;
}

/** Denetim kaydı (etkinlik) satırı. */
export interface AuditEntry {
  id: number;
  actor_id: number | null;
  /** Yalnızca yöneticiye döner. */
  actor_email?: string | null;
  actor_role: string | null;
  action: string;
  target_type: "blog" | "message" | "user" | "auth" | null;
  target_id: number | null;
  summary: string;
  created_at: string;
  actor?: PersonRef | null;
}

export const AUDIT_AREAS = { blog: "Blog", message: "Mesajlar", user: "Personel", auth: "Oturum" } as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

/** Site dilleri — yazı, mesaj ve şablon dilleri aynı üçlü. */
export const CONTENT_LOCALES = ["tr", "en", "ar"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const LOCALE_LABEL: Record<ContentLocale, string> = { tr: "Türkçe", en: "İngilizce", ar: "Arapça" };

export function isContentLocale(v: unknown): v is ContentLocale {
  return typeof v === "string" && (CONTENT_LOCALES as readonly string[]).includes(v);
}

/** Hazır yanıt şablonu (GET /api/admin/reply-templates). */
export interface ReplyTemplate {
  id: number;
  title: string;
  locale: ContentLocale;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Şablonda kullanılabilen yer tutucular. */
export const TEMPLATE_PLACEHOLDERS: readonly { kod: string; aciklama: string }[] = [
  { kod: "{ad}", aciklama: "gönderenin adı" },
  { kod: "{imza}", aciklama: "yanıtlayanın (senin) adın" },
  { kod: "{konu}", aciklama: "mesajın konusu" },
];

/** Yazı sürümü — liste satırı (içeriksiz). */
export interface BlogRevisionSummary {
  id: number;
  title: string;
  created_at: string;
  created_by: number | null;
  content_length: number | string | null;
  author?: PersonRef | null;
}

/** Yazı sürümü — tam (önizleme ve geri dönüş). */
export interface BlogRevision extends BlogRevisionSummary {
  blog_id: number;
  content: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[] | null;
  image_alt: string | null;
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
