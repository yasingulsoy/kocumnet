"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/example/ModalExample/ModalBasedAlerts.tsx
 * ve FormInModal.tsx kalıbı (ortalı ikon, başlık, açıklama, düğmeler).
 *
 * window.confirm / window.prompt yerine:
 *
 *   const [onayPenceresi, onayla] = useConfirm();
 *   if (!(await onayla({ title: "Silinsin mi?", tone: "danger", confirmLabel: "Sil" }))) return;
 *   …
 *   return <>{onayPenceresi}…</>;
 *
 *   const [soruPenceresi, sor] = usePrompt();
 *   const adres = await sor({ title: "Bağlantı ekle", label: "Adres" }); // iptalde null
 *
 * Tehlikeli işlemde odak "Vazgeç"te başlar (yanlışlıkla Enter silmesin).
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleHelp, OctagonAlert, TriangleAlert } from "lucide-react";
import { cx } from "../cx";
import { Field } from "../form/Field";
import { Input } from "../form/Input";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type ConfirmTone = "primary" | "warning" | "danger";

const TON: Record<ConfirmTone, { kutu: string; Ikon: typeof CircleHelp }> = {
  primary: { kutu: "bg-brand-50 text-brand-500", Ikon: CircleHelp },
  warning: { kutu: "bg-warning-50 text-warning-600", Ikon: TriangleAlert },
  danger: { kutu: "bg-error-50 text-error-600", Ikon: OctagonAlert },
};

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Onaydan sonra işlem sürerken: düğmeler kilitli, pencere kapanmaz. */
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  pending = false,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  tone = "primary",
}: ConfirmDialogProps) {
  const iptal = useRef<HTMLButtonElement>(null);
  const onay = useRef<HTMLButtonElement>(null);
  const baslikId = useId();
  const aciklamaId = useId();
  const { kutu, Ikon } = TON[tone];

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      size="sm"
      labelledBy={baslikId}
      describedBy={description ? aciklamaId : undefined}
      showCloseButton={false}
      dismissable={!pending}
      initialFocusRef={tone === "danger" ? iptal : onay}
    >
      <div className="text-center">
        <span className={cx("mx-auto mb-5 flex size-16 items-center justify-center rounded-full", kutu)}>
          <Ikon className="size-7" aria-hidden />
        </span>
        <h2 id={baslikId} className="font-display text-xl font-semibold text-balance text-gray-800">
          {title}
        </h2>
        {description ? (
          <p id={aciklamaId} className="mt-2 text-sm leading-6 text-gray-500">
            {description}
          </p>
        ) : null}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button ref={iptal} variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button ref={onay} variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Söz veren onay penceresi: [çizilecek pencere, onayla(seçenekler) → Promise<boolean>]. */
export function useConfirm(): [ReactNode, (secenekler: ConfirmOptions) => Promise<boolean>] {
  const [istek, setIstek] = useState<ConfirmOptions | null>(null);
  const coz = useRef<((v: boolean) => void) | null>(null);

  const onayla = useCallback(
    (secenekler: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        coz.current?.(false);
        coz.current = resolve;
        setIstek(secenekler);
      }),
    []
  );

  const bitir = useCallback((sonuc: boolean) => {
    const c = coz.current;
    coz.current = null;
    setIstek(null);
    c?.(sonuc);
  }, []);

  // Bileşen kapanırken bekleyen soru "hayır" sayılır.
  useEffect(
    () => () => {
      coz.current?.(false);
      coz.current = null;
    },
    []
  );

  const pencere = (
    <ConfirmDialog
      open={istek !== null}
      title={istek?.title ?? ""}
      description={istek?.description}
      confirmLabel={istek?.confirmLabel}
      cancelLabel={istek?.cancelLabel}
      tone={istek?.tone}
      onConfirm={() => bitir(true)}
      onCancel={() => bitir(false)}
    />
  );
  return [pencere, onayla];
}

export interface PromptOptions {
  title: ReactNode;
  description?: ReactNode;
  /** Alanın görünür etiketi. */
  label: string;
  hint?: ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputMode?: "text" | "url" | "email";
  /** true: boş yanıt da onaylanır ("" döner). */
  allowEmpty?: boolean;
  maxLength?: number;
}

export interface PromptDialogProps extends PromptOptions {
  open: boolean;
  onSubmit: (deger: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  onSubmit,
  onCancel,
  title,
  description,
  label,
  hint,
  defaultValue = "",
  placeholder,
  confirmLabel = "Tamam",
  cancelLabel = "Vazgeç",
  inputMode = "text",
  allowEmpty = false,
  maxLength,
}: PromptDialogProps) {
  const alan = useRef<HTMLInputElement>(null);

  function gonder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const deger = alan.current?.value.trim() ?? "";
    if (!deger && !allowEmpty) {
      alan.current?.focus();
      return;
    }
    onSubmit(deger);
  }

  return (
    <Modal isOpen={open} onClose={onCancel} size="sm" title={title} description={description} initialFocusRef={alan}>
      <form onSubmit={gonder} className="space-y-6">
        <Field label={label} hint={hint}>
          <Input
            ref={alan}
            defaultValue={defaultValue}
            placeholder={placeholder}
            inputMode={inputMode === "text" ? undefined : inputMode}
            maxLength={maxLength}
            required={!allowEmpty}
            autoComplete="off"
          />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit">{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Söz veren metin sorusu: [çizilecek pencere, sor(seçenekler) → Promise<string | null>]. */
export function usePrompt(): [ReactNode, (secenekler: PromptOptions) => Promise<string | null>] {
  const [istek, setIstek] = useState<PromptOptions | null>(null);
  const coz = useRef<((v: string | null) => void) | null>(null);

  const sor = useCallback(
    (secenekler: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        coz.current?.(null);
        coz.current = resolve;
        setIstek(secenekler);
      }),
    []
  );

  const bitir = useCallback((sonuc: string | null) => {
    const c = coz.current;
    coz.current = null;
    setIstek(null);
    c?.(sonuc);
  }, []);

  useEffect(
    () => () => {
      coz.current?.(null);
      coz.current = null;
    },
    []
  );

  const pencere = istek ? (
    <PromptDialog {...istek} open onSubmit={(v) => bitir(v)} onCancel={() => bitir(null)} />
  ) : (
    <PromptDialog open={false} title="" label="" onSubmit={() => {}} onCancel={() => {}} />
  );
  return [pencere, sor];
}
