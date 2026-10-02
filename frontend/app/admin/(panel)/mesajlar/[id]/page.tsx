import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, Mail, MailOpen, ShieldBan, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { Card, PageHeader, Pill, buttonClass, trDate } from "@/components/admin/ui";
import { deleteMessageAction, setMessageStatusAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getMessage } from "@/lib/admin/data";
import { MANAGE_ROLES, MESSAGE_STATUS_LABEL } from "@/lib/admin/types";
import { Forbidden } from "@/components/admin/ui";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Mesaj" };

const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa formu" };
const DIL: Record<string, string> = { tr: "Türkçe", en: "İngilizce", ar: "Arapça" };

export default async function MesajPage({ params }: PageProps<"/admin/mesajlar/[id]">) {
  const { staff, allowed } = await requireStaff(MANAGE_ROLES);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;

  const { id } = await params;
  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  let m;
  try {
    m = await getMessage(sayi);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  const konu = m.subject ? `Re: ${m.subject}` : "Koçum.Net — mesajınız hakkında";
  const yanitla = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(konu)}`;
  const ilgilenen = m.handler ? [m.handler.first_name, m.handler.last_name].filter(Boolean).join(" ") : null;

  return (
    <>
      {m.status === "new" ? <MarkRead id={m.id} /> : null}

      <PageHeader
        title={m.subject ?? "Konu yok"}
        crumbs={[{ href: "/admin/mesajlar", label: "Mesajlar" }]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-caption text-ink-faint">
            <Pill tone={m.status === "new" ? "brand" : m.status === "spam" ? "bad" : "neutral"}>{MESSAGE_STATUS_LABEL[m.status]}</Pill>
            {trDate(m.created_at, { time: true })} · {KAYNAK[m.source] ?? m.source} · {DIL[m.locale] ?? m.locale}
            {ilgilenen && m.handled_at ? <> · {ilgilenen} {trDate(m.handled_at, { time: true })} baktı</> : null}
          </span>
        }
        actions={
          <a href={yanitla} className={buttonClass({ size: "sm" })}>
            <Mail /> E-postayla yanıtla
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-5 sm:p-6">
          <p className="whitespace-pre-wrap text-body leading-relaxed text-ink">{m.message}</p>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Gönderen</h2>
            <dl className="mt-3 space-y-2 text-caption">
              <div>
                <dt className="text-micro uppercase tracking-wider text-ink-faint">Ad</dt>
                <dd className="font-medium text-ink">{m.name}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wider text-ink-faint">E-posta</dt>
                <dd><a href={yanitla} className="font-medium text-brand hover:underline">{m.email}</a></dd>
              </div>
              {m.phone ? (
                <div>
                  <dt className="text-micro uppercase tracking-wider text-ink-faint">Telefon</dt>
                  <dd><a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="font-medium text-brand hover:underline">{m.phone}</a></dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Durum</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {m.status !== "read" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "read")} variant="secondary" size="sm"><MailOpen /> Okundu</ActionButton>
              ) : (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "new")} variant="secondary" size="sm"><Mail /> Okunmadı yap</ActionButton>
              )}
              {m.status !== "archived" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "archived")} variant="secondary" size="sm"><Archive /> Arşivle</ActionButton>
              ) : null}
              {m.status !== "spam" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "spam")} variant="ghost" size="sm" className="text-warn"><ShieldBan /> Spam</ActionButton>
              ) : null}
            </div>
            {staff.role === "admin" ? (
              <div className="mt-4 border-t border-line pt-4">
                <ActionButton action={deleteMessageAction.bind(null, m.id)} variant="secondary" size="sm" className="text-bad ring-bad/30 hover:bg-bad-wash" confirm="Mesaj kalıcı olarak silinsin mi? KVKK gereği talep üzerine silinmesi gerekebilir; başka durumda arşivlemek yeterli.">
                  <Trash2 /> Kalıcı sil
                </ActionButton>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
