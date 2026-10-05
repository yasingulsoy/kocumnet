"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCheck, Loader2, Mail, MailOpen, ShieldBan, StickyNote, type LucideIcon } from "lucide-react";
import { bulkMessageStatusAction } from "@/lib/admin/actions";
import { MESSAGE_STATUS_LABEL, type MessageStatus } from "@/lib/admin/types";
import { CHECKBOX_CLASS, Pill, buttonClass, cn } from "./ui";

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

const TON: Record<MessageStatus, "brand" | "neutral" | "ok" | "bad"> = {
  new: "brand",
  read: "neutral",
  answered: "ok",
  archived: "neutral",
  spam: "bad",
};

const TOPLU: { status: MessageStatus; label: string; icon: LucideIcon }[] = [
  { status: "read", label: "Okundu", icon: MailOpen },
  { status: "new", label: "Okunmadı", icon: Mail },
  { status: "answered", label: "Yanıtlandı", icon: CheckCheck },
  { status: "archived", label: "Arşivle", icon: Archive },
  { status: "spam", label: "Spam", icon: ShieldBan },
];

/**
 * Mesaj listesi + toplu işlem. Satırlar seçilip tek seferde okundu,
 * yanıtlandı, arşiv ya da spam yapılır — spam dalgasında ya da toplu
 * arşivlemede mesajları tek tek açmak gerekmesin.
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
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-5",
          secililer.length ? "bg-brand-wash" : "bg-surface-sunk"
        )}
      >
        <label className="-ms-1.5 flex size-9 items-center justify-center" title="Bu sayfadakilerin hepsini seç">
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={hepsi}
            ref={(el) => {
              if (el) el.indeterminate = bazisi;
            }}
            onChange={() => {
              setSonuc(null);
              setSecili(hepsi ? new Set() : new Set(rows.map((r) => r.id)));
            }}
            aria-label="Bu sayfadaki bütün mesajları seç"
          />
        </label>
        {secililer.length ? (
          <>
            <span className="tabular text-caption font-semibold text-brand-deep">{secililer.length} seçili</span>
            <span className="flex flex-wrap gap-1.5" role="group" aria-label="Seçilenlere uygula">
              {TOPLU.map(({ status, label, icon: Icon }) => (
                <button
                  key={status}
                  type="button"
                  disabled={pending}
                  onClick={() => topluUygula(status)}
                  className={cn(buttonClass({ variant: "secondary", size: "sm" }), "min-h-8 px-2.5", status === "spam" && "text-warn")}
                >
                  <Icon aria-hidden /> {label}
                </button>
              ))}
            </span>
            {pending ? <Loader2 className="size-4 animate-spin text-brand" aria-label="Uygulanıyor" /> : null}
          </>
        ) : (
          <span className="text-caption text-ink-faint">Seçip toplu işlem yapabilirsin.</span>
        )}
        {sonuc ? (
          <span role="status" className={cn("ms-auto text-caption", sonuc.tone === "ok" ? "text-ok" : "text-bad")}>
            {sonuc.text}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-line">
        {rows.map((m) => {
          const yeni = m.status === "new";
          const isaretli = secili.has(m.id);
          return (
            <li
              key={m.id}
              className={cn(
                "flex items-start gap-1 ps-1.5 pe-3 transition hover:bg-surface-hover sm:ps-3.5 sm:pe-5",
                yeni && "bg-brand-wash/40",
                isaretli && "bg-brand-wash"
              )}
            >
              <label className="mt-2 flex size-9 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={isaretli}
                  onChange={() => degistir(m.id)}
                  aria-label={`Seç: ${m.name}${m.subject ? `, ${m.subject}` : ""}`}
                />
              </label>
              <Link href={`/admin/mesajlar/${m.id}`} className="flex min-w-0 flex-1 items-start gap-3 py-4">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", yeni ? "bg-brand" : "bg-transparent")}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("text-caption text-ink", yeni ? "font-semibold" : "font-medium")}>
                      {m.name}
                      {yeni ? <span className="sr-only"> (okunmadı)</span> : null}
                    </span>
                    <span className="truncate text-micro text-ink-faint">{m.email}</span>
                  </p>
                  <p className="mt-0.5 truncate text-caption text-ink-soft">
                    {m.subject ? <span className="font-medium text-ink">{m.subject} — </span> : null}
                    {m.preview}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-micro text-ink-faint">
                    {m.kaynak}
                    {m.hasNote ? (
                      <span className="inline-flex items-center gap-1 text-ink-soft">
                        · <StickyNote className="size-3" aria-hidden /> not var
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <time className="text-micro text-ink-faint" title={m.tarih}>
                    {m.zaman}
                  </time>
                  <Pill tone={TON[m.status]}>{MESSAGE_STATUS_LABEL[m.status]}</Pill>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
