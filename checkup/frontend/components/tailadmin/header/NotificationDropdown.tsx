"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/header/NotificationDropdown.tsx
 *
 * Aynı görünüm: yuvarlak zil düğmesi, yeni bildirim varken turuncu nabız
 * noktası; açılınca başlık, kaydırılan liste ve altta "Tümünü gör". Farklar:
 * öğeler prop'la gelir (sabit örnek yok), boş liste metni, zil düğmesinin
 * erişilebilir adı sayıyı söyler. Telefonda liste ekran genişliğinde açılır
 * (TailAdmin'de sola taşıyordu).
 */
import Link from "next/link";
import { useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Bell, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown, useDropdownClose } from "../ui/Dropdown";

export interface NotificationItem {
  id: string | number;
  href: string;
  /** Kalın yazılan kısım (gönderen adı gibi). */
  title: ReactNode;
  /** Başlığın devamı (konu, kısa metin). */
  text?: ReactNode;
  /** Alt satır: kaynak, tür. */
  meta?: ReactNode;
  time?: ReactNode;
  /** Avatar baş harfleri için ad. */
  avatarName?: string;
}

export interface NotificationDropdownProps {
  items: NotificationItem[];
  /** Okunmamış sayısı; 0 ya da yoksa nokta yanmaz. */
  count?: number;
  title?: string;
  emptyText?: ReactNode;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Zil düğmesinin adı; sayı eklenir. */
  label?: string;
  closeLabel?: string;
}

export function NotificationDropdown({
  items,
  count = 0,
  title = "Bildirimler",
  emptyText = "Yeni bildirim yok.",
  viewAllHref,
  viewAllLabel = "Tümünü gör",
  label = "Bildirimler",
  closeLabel = "Bildirimleri kapat",
}: NotificationDropdownProps) {
  const [acik, setAcik] = useState(false);
  const [klavyeyle, setKlavyeyle] = useState(false);
  const dugme = useRef<HTMLButtonElement>(null);
  const id = useId();

  function tikla(e: MouseEvent<HTMLButtonElement>) {
    setKlavyeyle(e.detail === 0);
    setAcik((a) => !a);
  }

  return (
    <div className="relative">
      <button
        ref={dugme}
        type="button"
        onClick={tikla}
        aria-expanded={acik}
        aria-controls={acik ? id : undefined}
        aria-label={count > 0 ? `${label}: ${count} yeni` : label}
        className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
      >
        {count > 0 ? (
          <span aria-hidden className="absolute end-0 top-0.5 z-10 flex size-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" />
          </span>
        ) : null}
        <Bell className="size-5" aria-hidden />
      </button>

      <Dropdown
        isOpen={acik}
        onClose={() => setAcik(false)}
        triggerRef={dugme}
        id={id}
        autoFocus={klavyeyle}
        ariaLabel={title}
        className="flex max-h-[min(30rem,calc(100vh-6rem))] flex-col rounded-2xl p-3 max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:mt-0 sm:mt-4 sm:w-90"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="font-display text-lg font-semibold text-gray-800">{title}</h2>
          <button
            type="button"
            onClick={() => {
              setAcik(false);
              dugme.current?.focus();
            }}
            aria-label={closeLabel}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {items.length ? (
          <ul className="custom-scrollbar flex flex-col overflow-y-auto">
            {items.map((o) => (
              <li key={o.id}>
                <Bildirim oge={o} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-gray-500">{emptyText}</p>
        )}

        {viewAllHref ? (
          <Link
            href={viewAllHref}
            onClick={() => setAcik(false)}
            className="mt-3 block rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </Dropdown>
    </div>
  );
}

function Bildirim({ oge: o }: { oge: NotificationItem }) {
  const kapat = useDropdownClose();
  return (
    <Link
      href={o.href}
      onClick={kapat}
      className="flex gap-3 rounded-lg border-b border-gray-100 px-4.5 py-3 transition hover:bg-gray-100 focus-visible:bg-gray-100"
    >
      {o.avatarName ? <Avatar name={o.avatarName} size="medium" decorative /> : null}
      <span className="block min-w-0">
        <span className="mb-1.5 block text-theme-sm text-gray-500">
          <span className="font-medium text-gray-800">{o.title}</span>
          {o.text ? <> {o.text}</> : null}
        </span>
        {o.meta || o.time ? (
          <span className="flex items-center gap-2 text-theme-xs text-gray-500">
            {o.meta ? <span>{o.meta}</span> : null}
            {o.meta && o.time ? <span aria-hidden className="size-1 rounded-full bg-gray-400" /> : null}
            {o.time ? <span>{o.time}</span> : null}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
