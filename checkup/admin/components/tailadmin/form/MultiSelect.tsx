"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/MultiSelect.tsx
 *
 * Aynı görünüm (seçilenler gri "çip", altta açılan liste). Farklar:
 *  · Açan öğe gerçek bir <button> (aria-haspopup="listbox", aria-expanded);
 *    liste role="listbox" + aria-multiselectable, etkin seçenek
 *    aria-activedescendant ile. ↑/↓ gezer, Enter/Boşluk seçer, Esc kapatır.
 *    TailAdmin'de her tuşa preventDefault vardı: Tab ile çıkılamıyordu.
 *  · `name` verilirse her seçim gizli bir alanla formla gider.
 *  · Etiketin id'si useId'den (TailAdmin etiket metnini id yapıyordu).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cx } from "../cx";

export interface MultiSelectOption {
  value: string;
  text: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  defaultSelected?: string[];
  value?: string[];
  onChange?: (secilenler: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Form alanı adı: her seçili değer için bir gizli input. */
  name?: string;
  removeLabel?: (metin: string) => string;
  className?: string;
}

export function MultiSelect({
  label,
  options,
  defaultSelected = [],
  value,
  onChange,
  disabled = false,
  placeholder = "Seç",
  name,
  removeLabel = (m) => `${m} seçimini kaldır`,
  className,
}: MultiSelectProps) {
  const denetimli = value !== undefined;
  const [ic, setIc] = useState<string[]>(defaultSelected);
  const secili = denetimli ? value : ic;
  const [acik, setAcik] = useState(false);
  const [etkin, setEtkin] = useState(-1);
  const kok = useRef<HTMLDivElement>(null);
  const etiketId = useId();
  const listeId = useId();

  useEffect(() => {
    if (!acik) return;
    const disari = (e: MouseEvent) => {
      if (kok.current && !kok.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("mousedown", disari);
    return () => document.removeEventListener("mousedown", disari);
  }, [acik]);

  function guncelle(yeni: string[]) {
    if (!denetimli) setIc(yeni);
    onChange?.(yeni);
  }

  function degistir(v: string) {
    guncelle(secili.includes(v) ? secili.filter((x) => x !== v) : [...secili, v]);
  }

  function tus(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!acik) {
        setAcik(true);
        setEtkin(0);
        return;
      }
      setEtkin((i) => (e.key === "ArrowDown" ? (i + 1) % options.length : (i - 1 + options.length) % options.length));
    } else if ((e.key === "Enter" || e.key === " ") && acik && etkin >= 0) {
      e.preventDefault();
      degistir(options[etkin].value);
    } else if (e.key === "Escape" && acik) {
      e.preventDefault();
      setAcik(false);
    }
  }

  return (
    <div ref={kok} className={cx("relative w-full", className)}>
      <span id={etiketId} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      <div
        className={cx(
          "flex min-h-11 w-full items-start gap-2 rounded-lg border bg-white px-3 py-1.5 shadow-theme-xs transition",
          acik ? "border-brand-500 ring-3 ring-brand-500/20" : "border-gray-300",
          disabled && "cursor-not-allowed bg-gray-50 opacity-60"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-2 py-0.5">
          {secili.length ? (
            secili.map((v) => {
              const metin = options.find((o) => o.value === v)?.text ?? v;
              return (
                <span key={v} className="flex items-center rounded-full bg-gray-100 py-1 ps-2.5 pe-1.5 text-sm text-gray-800">
                  {metin}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => guncelle(secili.filter((x) => x !== v))}
                    aria-label={removeLabel(metin)}
                    className="ms-1 flex size-5 cursor-pointer items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="py-1 text-sm text-gray-500">{placeholder}</span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={acik}
          aria-controls={acik ? listeId : undefined}
          aria-labelledby={etiketId}
          aria-activedescendant={acik && etkin >= 0 ? `${listeId}-${etkin}` : undefined}
          onClick={() => {
            setAcik((a) => !a);
            setEtkin(-1);
          }}
          onKeyDown={tus}
          className="mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed"
        >
          <ChevronDown className={cx("size-5 transition-transform", acik && "rotate-180")} aria-hidden />
        </button>
      </div>

      {acik ? (
        <ul
          id={listeId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={etiketId}
          className="custom-scrollbar absolute start-0 top-full z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg"
        >
          {options.map((o, i) => {
            const sec = secili.includes(o.value);
            return (
              <li
                key={o.value}
                id={`${listeId}-${i}`}
                role="option"
                aria-selected={sec}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => degistir(o.value)}
                onMouseEnter={() => setEtkin(i)}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                  i === etkin && "bg-gray-100",
                  sec ? "font-medium text-brand-500" : "text-gray-800"
                )}
              >
                {o.text}
                {sec ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {name ? secili.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
    </div>
  );
}
