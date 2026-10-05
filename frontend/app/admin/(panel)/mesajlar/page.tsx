import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Search, X } from "lucide-react";
import { MessageList, type MessageRow } from "@/components/admin/MessageList";
import { Card, EmptyState, Forbidden, INPUT_CLASS, Notice, PageHeader, Pagination, buttonClass, cn, qs, relative, trDate } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { listMessages } from "@/lib/admin/data";
import { MANAGE_ROLES, WAITING_STATUSES, isMessageStatus, type MessageCounts, type MessageStatus } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Mesajlar" };

const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa" };

/**
 * Sekmeler. Varsayılan "Bekleyen" (yeni + okundu): yanıt ya da karar
 * bekleyenler. Eskiden varsayılan "Hepsi"ydi; arşiv ve spam de iş listesine
 * karışıyordu.
 */
type Sekme = "bekleyen" | "answered" | "archived" | "spam" | "hepsi";
const SEKMELER: { id: Sekme; label: string; sayi: (c: MessageCounts) => number | null }[] = [
  { id: "bekleyen", label: "Bekleyen", sayi: (c) => c.new + c.read },
  { id: "answered", label: "Yanıtlandı", sayi: (c) => c.answered },
  { id: "archived", label: "Arşiv", sayi: (c) => c.archived },
  { id: "spam", label: "Spam", sayi: (c) => c.spam },
  { id: "hepsi", label: "Tümü", sayi: () => null },
];

export default async function MesajlarPage({ searchParams }: PageProps<"/admin/mesajlar">) {
  const { allowed } = await requireStaff(MANAGE_ROLES, "/admin/mesajlar");
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;

  const sp = await searchParams;
  // "?durum=new" (eski bağlantılar, genel bakış kartı) bekleyenlerin içinde "yalnızca okunmamış".
  const durumParam = typeof sp.durum === "string" ? sp.durum : "";
  const yalnizca: MessageStatus | null = durumParam === "new" || durumParam === "read" ? durumParam : null;
  const sekme: Sekme =
    yalnizca || !durumParam ? "bekleyen" : (SEKMELER.find((s) => s.id === durumParam)?.id ?? "bekleyen");
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const durumlar: readonly MessageStatus[] =
    yalnizca ? [yalnizca] : sekme === "bekleyen" ? WAITING_STATUSES : sekme === "hepsi" ? [] : isMessageStatus(sekme) ? [sekme] : [];

  const sonuc = await listMessages({ page: sayfa, status: durumlar, search: ara || undefined });
  const durumAdresi = yalnizca ?? (sekme === "bekleyen" ? undefined : sekme);
  const href = (p: number) => qs("/admin/mesajlar", { durum: durumAdresi, ara, sayfa: p > 1 ? p : undefined });

  const satirlar: MessageRow[] = sonuc.data.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    preview: m.message.replace(/\s+/g, " ").slice(0, 220),
    status: m.status,
    kaynak: `${KAYNAK[m.source] ?? m.source} · ${m.locale.toUpperCase()}`,
    zaman: relative(m.created_at),
    tarih: trDate(m.created_at, { time: true }),
    hasNote: Boolean(m.note),
  }));

  const bekleyen = sonuc.counts.new + sonuc.counts.read;
  const aciklama = bekleyen
    ? `${bekleyen} mesaj yanıt bekliyor${sonuc.unread ? `, ${sonuc.unread} tanesi okunmadı` : ""}.`
    : "Bekleyen mesaj yok. İletişim formundan gelenler burada görünür.";

  return (
    <>
      <PageHeader
        title="Mesajlar"
        description={aciklama}
        actions={
          <Link href="/admin/mesajlar/sablonlar" className={buttonClass({ variant: "secondary", size: "sm" })}>
            <MessageSquareText /> Hazır yanıtlar
          </Link>
        }
      />
      {sp.silindi === "1" ? <Notice tone="ok" className="mb-4">Mesaj silindi.</Notice> : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <nav className="scroll-x -mx-1 flex max-w-full gap-1 px-1" aria-label="Mesaj durumu">
            {SEKMELER.map((s) => {
              const on = s.id === sekme;
              const sayi = s.sayi(sonuc.counts);
              return (
                <Link
                  key={s.id}
                  href={qs("/admin/mesajlar", { durum: s.id === "bekleyen" ? undefined : s.id, ara })}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-caption font-medium transition",
                    on ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  {s.label}
                  {sayi ? (
                    <span className={cn("tabular text-micro", on ? "text-brand" : "text-ink-faint")}>{sayi}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <form className="flex w-full items-center gap-2 sm:ms-auto sm:w-auto" role="search">
            {durumAdresi ? <input type="hidden" name="durum" value={durumAdresi} /> : null}
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                name="ara"
                type="search"
                defaultValue={ara}
                placeholder="Ad, e-posta, metin"
                className={INPUT_CLASS + " h-10 ps-9 text-caption sm:w-56"}
                aria-label="Mesajlarda ara"
              />
            </label>
            <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>Ara</button>
          </form>
        </div>

        {yalnizca || ara ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-caption text-ink-soft sm:px-5">
            Süzgeç:
            {yalnizca ? (
              <Link href={qs("/admin/mesajlar", { ara })} className="inline-flex items-center gap-1 rounded-full bg-surface-sunk px-2.5 py-0.5 font-medium text-ink ring-1 ring-inset ring-line hover:bg-surface-hover">
                yalnızca {yalnizca === "new" ? "okunmamışlar" : "okunmuşlar"} <X className="size-3" aria-label="Süzgeci kaldır" />
              </Link>
            ) : null}
            {ara ? (
              <Link href={qs("/admin/mesajlar", { durum: durumAdresi })} className="inline-flex items-center gap-1 rounded-full bg-surface-sunk px-2.5 py-0.5 font-medium text-ink ring-1 ring-inset ring-line hover:bg-surface-hover">
                “{ara}” <X className="size-3" aria-label="Aramayı temizle" />
              </Link>
            ) : null}
            <span className="tabular text-ink-faint">· {sonuc.pagination.total} sonuç</span>
          </div>
        ) : null}

        {satirlar.length === 0 ? (
          <EmptyState
            title={ara ? "Sonuç yok" : sekme === "bekleyen" ? "Bekleyen mesaj yok" : "Bu sekmede mesaj yok"}
            description={ara ? `"${ara}" için bu sekmede sonuç yok. Tümü sekmesinde aramayı dene.` : sekme === "bekleyen" ? "Hepsi yanıtlanmış ya da arşivlenmiş. Yeni mesaj gelince burada görünür." : undefined}
          />
        ) : (
          <MessageList rows={satirlar} />
        )}
      </Card>

      <Pagination page={sonuc.pagination.page} pages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
