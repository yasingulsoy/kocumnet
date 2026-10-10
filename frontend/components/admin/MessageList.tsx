"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCheck, Loader2, Mail, MailOpen, ShieldBan, StickyNote, type LucideIcon } from "lucide-react";
import { bulkMessageStatusAction } from "@/lib/admin/actions";
import { MESSAGE_STATUS_LABEL, type MessageStatus } from "@/lib/admin/types";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { MESAJ_RENGI } from "./ui";

/** Sunucuda hazırlanan satır: göreli zaman sunucuda hesaplanır (hidrasyon farkı olmasın). */
export interface MessageRow {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  preview: string;
  status: MessageStatus;
  kaynak: string;
  zaman: string;
  tarih: string;
  hasNote: boolean;
}

const TOPLU: { status: MessageStatus; label: string; icon: LucideIcon }[] = [
  { status: "read", label: "Okundu", icon: MailOpen },
  { status: "new", label: "Okunmadı", icon: Mail },
  { status: "answered", label: "Yanıtlandı", icon: CheckCheck },
  { status: "archived", label: "Arşivle", icon: Archive },
  { status: "spam", label: "Spam", icon: ShieldBan },
];

/**
 * Mesaj tablosu + toplu işlem. Satırlar seçilip tek seferde okundu,
 * yanıtlandı, arşiv ya da spam yapılır — spam dalgasında ya da toplu
 * arşivlemede mesajları tek tek açmak gerekmesin. Satırın tamamı mesaja
 * gider (gönderen bağlantısı satırı kaplar); onay kutusu onun üstünde.
 */
export function MessageList({ rows }: { rows: MessageRow[] }) {
  const router = useRouter();
  const [secili, setSecili] = useState<ReadonlySet<number>>(new Set());
  const [pending, start] = useTransition();
  const [sonuc, setSonuc] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  // Yenilemeden sonra listede kalmayanlar seçili sayılmaz (türetilmiş durum).
  const secililer = rows.filter((r) => secili.has(r.id)).map((r) => r.id);
  const hepsi = rows.length > 0 && secililer.length === rows.length;
  const bazisi = secililer.length > 0 && !hepsi;

  function degistir(id: number) {
    setSonuc(null);
    setSecili((s) => {
      const yeni = new Set(s);
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
      return yeni;
    });
  }

  function topluUygula(status: MessageStatus) {
    const idler = secililer;
    start(async () => {
      let r;
      try {
        r = await bulkMessageStatusAction(idler, status);
      } catch (e) {
        unstable_rethrow(e);
        setSonuc({ tone: "bad", text: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." });
        return;
      }
      if (r.error) {
        setSonuc({ tone: "bad", text: r.error });
        return;
      }
      setSonuc({ tone: "ok", text: r.message ?? "Güncellendi." });
      setSecili(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div
        className={cx(
          "flex min-h-13 flex-wrap items-center gap-2 border-y border-gray-100 px-4 py-2 sm:px-6",
          secililer.length ? "bg-brand-25" : "bg-gray-50"
        )}
      >
        {secililer.length ? (
          <>
            <span className="tabular text-theme-sm font-semibold text-brand-900">{secililer.length} seçili</span>
            <span className="flex flex-wrap gap-1.5" role="group" aria-label="Seçilenlere uygula">
              {TOPLU.map(({ status, label, icon: Icon }) => (
                <Button
                  key={status}
                  variant={status === "spam" ? "danger-outline" : "outline"}
                  size="xs"
                  disabled={pending}
                  onClick={() => topluUygula(status)}
                  startIcon={<Icon aria-hidden />}
                >
                  {label}
                </Button>
              ))}
            </span>
            {pending ? <Loader2 className="size-4 animate-spin text-brand-500" aria-label="Uygulanıyor" /> : null}
          </>
        ) : (
          <span className="text-theme-sm text-gray-500">Satırları seçip toplu işlem yapabilirsin.</span>
        )}
        {sonuc ? (
          <span role="status" className={cx("ms-auto text-theme-sm", sonuc.tone === "ok" ? "text-success-700" : "text-error-600")}>
            {sonuc.text}
          </span>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableCell isHeader className="w-12 pe-0 sm:pe-0">
              <Checkbox
                checked={hepsi}
                indeterminate={bazisi}
                onChange={() => {
                  setSonuc(null);
                  setSecili(hepsi ? new Set() : new Set(rows.map((r) => r.id)));
                }}
                aria-label="Bu sayfadaki bütün mesajları seç"
              />
            </TableCell>
            <TableCell isHeader>Gönderen</TableCell>
            <TableCell isHeader className="hidden md:table-cell">
              Mesaj
            </TableCell>
            <TableCell isHeader>Durum</TableCell>
            <TableCell isHeader align="end">
              Zaman
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const yeni = m.status === "new";
            const isaretli = secili.has(m.id);
            return (
              <TableRow key={m.id} hover selected={isaretli} className={cx("relative", yeni && !isaretli && "bg-brand-25/60")}>
                <TableCell className="relative z-1 w-12 pe-0 sm:pe-0">
                  <Checkbox
                    checked={isaretli}
                    onChange={() => degistir(m.id)}
                    aria-label={`Seç: ${m.name}${m.subject ? `, ${m.subject}` : ""}`}
                  />
                </TableCell>
                <TableCell className="max-w-72 min-w-56 md:w-72">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size="medium" decorative />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/mesajlar/${m.id}`}
                        className={cx("block truncate text-theme-sm text-gray-800 after:absolute after:inset-0", yeni ? "font-semibold" : "font-medium")}
                      >
                        {m.name}
                        {yeni ? <span className="sr-only"> (okunmadı)</span> : null}
                      </Link>
                      <span className="block truncate text-theme-xs text-gray-500">{m.email}</span>
                      <span className="mt-0.5 block truncate text-theme-xs text-gray-600 md:hidden">{m.subject ?? m.preview}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden w-full max-w-0 min-w-48 md:table-cell">
                  <p className="truncate text-theme-sm text-gray-600">
                    {m.subject ? <span className="font-medium text-gray-800">{m.subject} — </span> : null}
                    {m.preview}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-theme-xs text-gray-500">
                    {m.kaynak}
                    {m.hasNote ? (
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        · <StickyNote className="size-3" aria-hidden /> not var
                      </span>
                    ) : null}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge size="sm" color={MESAJ_RENGI[m.status]}>
                    {MESSAGE_STATUS_LABEL[m.status]}
                  </Badge>
                </TableCell>
                <TableCell align="end" nowrap>
                  <time title={m.tarih}>{m.zaman}</time>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
