import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, EmptyState, Forbidden, INPUT_CLASS, Notice, PageHeader, Pagination, Pill, buttonClass, cn, qs, relative } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { listMessages } from "@/lib/admin/data";
import { MANAGE_ROLES, MESSAGE_STATUSES, MESSAGE_STATUS_LABEL, isMessageStatus, type MessageStatus } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Mesajlar" };

const TON: Record<MessageStatus, "brand" | "neutral" | "bad"> = { new: "brand", read: "neutral", archived: "neutral", spam: "bad" };
const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa" };

export default async function MesajlarPage({ searchParams }: PageProps<"/admin/mesajlar">) {
  const { allowed } = await requireStaff(MANAGE_ROLES);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;

  const sp = await searchParams;
  const durum = isMessageStatus(sp.durum) ? sp.durum : undefined;
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const sonuc = await listMessages({ page: sayfa, status: durum, search: ara || undefined });
  const href = (p: number) => qs("/admin/mesajlar", { durum, ara, sayfa: p > 1 ? p : undefined });

  return (
    <>
      <PageHeader title="Mesajlar" description={`İletişim formundan gelenler. ${sonuc.unread} okunmamış.`} />
      {sp.silindi === "1" ? <Notice tone="ok" className="mb-4">Mesaj silindi.</Notice> : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <nav className="scroll-x flex gap-1" aria-label="Durum">
            {[undefined, ...MESSAGE_STATUSES].map((s) => {
              const on = s === durum;
              return (
                <Link
                  key={s ?? "hepsi"}
                  href={qs("/admin/mesajlar", { durum: s, ara })}
                  aria-current={on ? "page" : undefined}
                  className={cn("rounded-lg px-3 py-1.5 text-caption font-medium transition", on ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink")}
                >
                  {s ? MESSAGE_STATUS_LABEL[s] : "Hepsi"}
                  {s === "new" && sonuc.unread ? <span className="tabular ms-1.5 text-micro text-brand">{sonuc.unread}</span> : null}
                </Link>
              );
            })}
          </nav>
          <form className="ms-auto flex items-center gap-2" role="search">
            {durum ? <input type="hidden" name="durum" value={durum} /> : null}
            <label className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input name="ara" defaultValue={ara} placeholder="Ad, e-posta, metin" className={INPUT_CLASS + " h-10 w-56 ps-9 text-caption"} aria-label="Ara" />
            </label>
            <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>Ara</button>
          </form>
        </div>

        {sonuc.data.length === 0 ? (
          <EmptyState title="Mesaj yok" description={ara ? `"${ara}" için sonuç yok.` : "Bu süzgeçte mesaj yok."} />
        ) : (
          <ul className="divide-y divide-line">
            {sonuc.data.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/mesajlar/${m.id}`} className={cn("flex items-start gap-4 px-5 py-4 transition hover:bg-surface-hover", m.status === "new" && "bg-brand-wash/40")}>
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", m.status === "new" ? "bg-brand" : "bg-transparent")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cn("text-caption text-ink", m.status === "new" ? "font-semibold" : "font-medium")}>{m.name}</span>
                      <span className="text-micro text-ink-faint">{m.email}</span>
                    </p>
                    <p className="mt-0.5 truncate text-caption text-ink-soft">
                      {m.subject ? <span className="font-medium text-ink">{m.subject} — </span> : null}
                      {m.message}
                    </p>
                    <p className="mt-1 text-micro text-ink-faint">
                      {KAYNAK[m.source] ?? m.source} · {m.locale.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-micro text-ink-faint">{relative(m.created_at)}</span>
                    <Pill tone={TON[m.status]}>{MESSAGE_STATUS_LABEL[m.status]}</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination page={sonuc.pagination.page} pages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
