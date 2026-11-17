"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/dropdown/Dropdown.tsx + DropdownItem.tsx
 *
 * TailAdmin'in denetimli API'si (isOpen, onClose) korunur. Eklenenler:
 *  · triggerRef: açan düğme "dışarı tıklama" sayılmaz (TailAdmin'in
 *    .dropdown-toggle sınıf hilesi yerine); Esc ile odak ona döner.
 *  · Klavye: ↑/↓/Home/End öğeler arasında gezer, Tab ile dışarı çıkınca
 *    kapanır. autoFocus: klavyeyle açılınca ilk öğeye odaklanır.
 *  · DropdownItem tıklanınca menüyü kendisi kapatır. type="submit" kapatmaz:
 *    form DOM'dan kalkarsa gönderim iptal olurdu (ör. "Çıkış yap" formu).
 *    TailAdmin'in düğmedeki preventDefault'u da bu yüzden yok.
 *  · DropdownItem `active` (seçili öğe, aria-current) ve bağlantıda
 *    `hrefLang` / `lang` (dil menüsü).
 */
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "../cx";

const KapatContext = createContext<() => void>(() => {});

/** Kendi öğesini çizen bileşenler için: menüyü kapatan işlev. */
export function useDropdownClose() {
  return useContext(KapatContext);
}

const ODAKLANABILIR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function odaklanabilirler(kok: HTMLElement | null): HTMLElement[] {
  return kok ? Array.from(kok.querySelectorAll<HTMLElement>(ODAKLANABILIR)) : [];
}

export interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  /** Menünün hizası, açan düğmeye göre (RTL'de kendiliğinden ters). */
  align?: "start" | "end";
  id?: string;
  autoFocus?: boolean;
  /** Ekran okuyucu için menünün adı. */
  ariaLabel?: string;
}

export function Dropdown({ isOpen, onClose, children, className, triggerRef, align = "end", id, autoFocus = false, ariaLabel }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const kapat = useRef(onClose);

  useEffect(() => {
    kapat.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const disari = (e: Event) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || triggerRef?.current?.contains(t)) return;
      kapat.current();
    };
    const tus = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      kapat.current();
      triggerRef?.current?.focus();
    };
    document.addEventListener("mousedown", disari);
    document.addEventListener("touchstart", disari);
    document.addEventListener("keydown", tus);
    if (autoFocus) odaklanabilirler(ref.current)[0]?.focus();
    return () => {
      document.removeEventListener("mousedown", disari);
      document.removeEventListener("touchstart", disari);
      document.removeEventListener("keydown", tus);
    };
  }, [isOpen, triggerRef, autoFocus]);

  if (!isOpen) return null;

  function okTuslari(e: KeyboardEvent<HTMLDivElement>) {
    const liste = odaklanabilirler(ref.current);
    if (!liste.length) return;
    const i = liste.indexOf(document.activeElement as HTMLElement);
    let hedef: HTMLElement | undefined;
    if (e.key === "ArrowDown") hedef = liste[(i + 1) % liste.length];
    else if (e.key === "ArrowUp") hedef = liste[(i - 1 + liste.length) % liste.length];
    else if (e.key === "Home") hedef = liste[0];
    else if (e.key === "End") hedef = liste[liste.length - 1];
    if (!hedef) return;
    e.preventDefault();
    hedef.focus();
  }

  function odakCikti(e: FocusEvent<HTMLDivElement>) {
    const sonraki = e.relatedTarget as Node | null;
    if (!sonraki) return; // fareyle boşluğa tıklama: mousedown dinleyicisi karar verir
    if (ref.current?.contains(sonraki) || triggerRef?.current?.contains(sonraki)) return;
    kapat.current();
  }

  return (
    <KapatContext.Provider value={onClose}>
      <div
        ref={ref}
        id={id}
        role={ariaLabel ? "region" : undefined}
        aria-label={ariaLabel}
        onKeyDown={okTuslari}
        onBlur={odakCikti}
        className={cx(
          "absolute z-40 mt-2 rounded-xl border border-gray-200 bg-white shadow-theme-lg",
          align === "end" ? "end-0" : "start-0",
          className
        )}
      >
        {children}
      </div>
    </KapatContext.Provider>
  );
}

export interface DropdownItemProps {
  tag?: "a" | "button";
  href?: string;
  /** Site dışı bağlantı: next/link yerine <a>. */
  external?: boolean;
  target?: string;
  type?: "button" | "submit";
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** TailAdmin uyumu: tıklandıktan sonra çağrılır. */
  onItemClick?: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** true: tıklanınca menü açık kalır. */
  keepOpen?: boolean;
  /** Seçili öğe (ör. geçerli dil): vurgulu çizilir, aria-current="true" alır. */
  active?: boolean;
  /** Bağlantının hedef dili (dil menüsü). */
  hrefLang?: string;
  /** Öğe metninin dili: ekran okuyucu doğru telaffuz etsin. */
  lang?: string;
  className?: string;
  children: ReactNode;
}

const OGE =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0";

const OGE_TONU = {
  default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-gray-100 [&_svg]:text-gray-500",
  danger: "text-error-700 hover:bg-error-50 focus-visible:bg-error-50 [&_svg]:text-error-600",
} as const;

/** Seçili öğe: menü öğesinin etkin hâli (menu-item-active ile aynı ton). */
const OGE_SECILI = "bg-brand-50 text-brand-500 hover:bg-brand-100 focus-visible:bg-brand-100 [&_svg]:text-brand-500";

export function DropdownItem({
  tag = "button",
  href,
  external = false,
  target,
  type = "button",
  onClick,
  onItemClick,
  icon,
  tone = "default",
  disabled,
  keepOpen = false,
  active = false,
  hrefLang,
  lang,
  className,
  children,
}: DropdownItemProps) {
  const menuyuKapat = useContext(KapatContext);
  const sinif = cx(OGE, active ? OGE_SECILI : OGE_TONU[tone], className);
  const secili = active ? ("true" as const) : undefined;

  function tikla(e: MouseEvent<HTMLElement>) {
    onClick?.(e);
    onItemClick?.();
    if (!keepOpen && type !== "submit") menuyuKapat();
  }

  if (tag === "a" && href) {
    return external ? (
      <a
        href={href}
        hrefLang={hrefLang}
        lang={lang}
        aria-current={secili}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={sinif}
        onClick={tikla}
      >
        {icon}
        {children}
      </a>
    ) : (
      <Link href={href} hrefLang={hrefLang} lang={lang} aria-current={secili} target={target} className={sinif} onClick={tikla}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} lang={lang} aria-current={secili} className={sinif} onClick={tikla}>
      {icon}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div role="separator" className="my-1.5 h-px bg-gray-200" />;
}
