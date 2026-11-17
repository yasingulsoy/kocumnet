"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/header/UserDropdown.tsx
 *
 * Aynı görünüm: yuvarlak avatar + ad + ok; açılınca ad/e-posta, bağlantılar
 * ve altta çerçeveli "Çıkış" alanı. Farklar: kişi, bağlantılar ve çıkış
 * prop'la gelir (dil seçici yok); avatar baş harflerle çizilebilir;
 * klavyeyle (↓ ya da Enter) açılınca odak ilk öğeye gider.
 *
 *   <UserDropdown name="Ayşe Yılmaz" detail="ayse@kocum.net"
 *     footer={<form action={cikis}><DropdownItem type="submit">Çıkış yap</DropdownItem></form>}>
 *     <DropdownItem tag="a" href="/admin/hesabim" icon={<UserRound />}>Hesabım</DropdownItem>
 *   </UserDropdown>
 */
import { useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../cx";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";

export interface UserDropdownProps {
  name: string;
  /** Adın altında: e-posta, rol. */
  detail?: ReactNode;
  avatarSrc?: string | null;
  /** Menü öğeleri (DropdownItem). */
  children?: ReactNode;
  /** En altta, çizgiyle ayrılmış: çıkış formu. */
  footer?: ReactNode;
  /** Düğmenin erişilebilir adına eklenir: "Ayşe Yılmaz, hesap menüsü". */
  label?: string;
}

export function UserDropdown({ name, detail, avatarSrc, children, footer, label = "hesap menüsü" }: UserDropdownProps) {
  const [acik, setAcik] = useState(false);
  const [klavyeyle, setKlavyeyle] = useState(false);
  const dugme = useRef<HTMLButtonElement>(null);
  const id = useId();
  const ilkAd = name.trim().split(/\s+/)[0] ?? name;

  function tikla(e: MouseEvent<HTMLButtonElement>) {
    // detail === 0: Enter/Boşluk ile tetiklenen tıklama.
    setKlavyeyle(e.detail === 0);
    setAcik((a) => !a);
  }

  function tus(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" && !acik) {
      e.preventDefault();
      setKlavyeyle(true);
      setAcik(true);
    }
  }

  return (
    <div className="relative">
      <button
        ref={dugme}
        type="button"
        onClick={tikla}
        onKeyDown={tus}
        aria-expanded={acik}
        aria-controls={acik ? id : undefined}
        aria-label={`${name}, ${label}`}
        className="flex cursor-pointer items-center rounded-full text-gray-700 transition hover:text-gray-900"
      >
        <Avatar src={avatarSrc} name={name} size="large" decorative className="me-0 sm:me-3" />
        <span className="me-1 hidden max-w-32 truncate text-theme-sm font-medium sm:block">{ilkAd}</span>
        <ChevronDown aria-hidden className={cx("hidden size-5 text-gray-500 transition-transform duration-200 sm:block", acik && "rotate-180")} />
      </button>

      <Dropdown
        isOpen={acik}
        onClose={() => setAcik(false)}
        triggerRef={dugme}
        id={id}
        autoFocus={klavyeyle}
        className="mt-4 flex w-65 max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl p-3"
      >
        <div className="px-1">
          <span className="block truncate text-theme-sm font-medium text-gray-700">{name}</span>
          {detail ? <span className="mt-0.5 block truncate text-theme-xs text-gray-500">{detail}</span> : null}
        </div>
        {children ? <div className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3">{children}</div> : null}
        {footer ? <div className={cx(children ? "mt-3" : "mt-3 border-t border-gray-200 pt-3")}>{footer}</div> : null}
      </Dropdown>
    </div>
  );
}
