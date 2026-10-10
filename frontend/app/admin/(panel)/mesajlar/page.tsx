import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, MessageSquareText, Search, X } from "lucide-react";
import { MessageList, type MessageRow } from "@/components/admin/MessageList";
import { Forbidden, qs, relative, trDate } from "@/components/admin/ui";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
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

const SUZGEC_CIPI =
  "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-700 transition hover:bg-gray-200";

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
      <PageBreadcrumb
        pageTitle="Mesajlar"
        description={aciklama}
        actions={
          <ButtonLink href="/admin/mesajlar/sablonlar" variant="outline" size="xs" startIcon={<MessageSquareText />}>
            Hazır yanıtlar
          </ButtonLink>
        }
      />
      {sp.silindi === "1" ? (
        <Alert variant="success" className="mb-4">
          Mesaj silindi.
        </Alert>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <SegmentedTabs
            label="Mesaj durumu"
            items={SEKMELER.map((s) => ({
              key: s.id,
              label: s.label,
              href: qs("/admin/mesajlar", { durum: s.id === "bekleyen" ? undefined : s.id, ara }),
              active: s.id === sekme,
              count: s.sayi(sonuc.counts) || null,
            }))}
          />
          <form className="flex w-full items-center gap-2 sm:ms-auto sm:w-auto" role="search">
            {durumAdresi ? <input type="hidden" name="durum" value={durumAdresi} /> : null}
            <Input
              name="ara"
              type="search"
              defaultValue={ara}
              placeholder="Ad, e-posta, metin"
              aria-label="Mesajlarda ara"
              compact
              startIcon={<Search />}
              wrapperClassName="min-w-0 flex-1 sm:w-60 sm:flex-none"
            />
            <Button type="submit" variant="outline" size="xs">
              Ara
            </Button>
          </form>
        </div>

        {yalnizca || ara ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-theme-sm text-gray-600 sm:px-6">
            Süzgeç:
            {yalnizca ? (
              <Link href={qs("/admin/mesajlar", { ara })} className={SUZGEC_CIPI}>
                yalnızca {yalnizca === "new" ? "okunmamışlar" : "okunmuşlar"} <X className="size-3" aria-label="Süzgeci kaldır" />
              </Link>
            ) : null}
            {ara ? (
              <Link href={qs("/admin/mesajlar", { durum: durumAdresi })} className={SUZGEC_CIPI}>
                “{ara}” <X className="size-3" aria-label="Aramayı temizle" />
              </Link>
            ) : null}
            <span className="tabular text-gray-500">· {sonuc.pagination.total} sonuç</span>
          </div>
        ) : null}

        {satirlar.length === 0 ? (
          <div className="border-t border-gray-100">
            <EmptyState
              icon={<Inbox />}
              title={ara ? "Sonuç yok" : sekme === "bekleyen" ? "Bekleyen mesaj yok" : "Bu sekmede mesaj yok"}
              description={
                ara
                  ? `"${ara}" için bu sekmede sonuç yok. Tümü sekmesinde aramayı dene.`
                  : sekme === "bekleyen"
                    ? "Hepsi yanıtlanmış ya da arşivlenmiş. Yeni mesaj gelince burada görünür."
                    : undefined
              }
            />
          </div>
        ) : (
          <MessageList rows={satirlar} />
        )}
      </Card>

      <Pagination currentPage={sonuc.pagination.page} totalPages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
