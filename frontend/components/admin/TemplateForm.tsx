"use client";

import { useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveReplyTemplateAction } from "@/lib/admin/actions";
import { CONTENT_LOCALES, LOCALE_LABEL, TEMPLATE_PLACEHOLDERS, type ContentLocale, type ReplyTemplate } from "@/lib/admin/types";
import { Button, Field, INPUT_CLASS, Notice, SELECT_CLASS, TEXTAREA_CLASS, cn } from "./ui";
import { useFormAction } from "./useFormAction";

const EN_FAZLA = 3000;
/** Bu uzunluğun üstünde bazı posta programları mailto metnini kesebiliyor. */
const UZUN_UYARISI = 1400;

/**
 * Hazır yanıt şablonu formu — yeni (sablon yok) ya da düzenleme.
 * Yer tutucu düğmeleri metne imlecin olduğu yere ekler.
 */
export function TemplateForm({ sablon, varsayilanDil = "tr" }: { sablon?: ReplyTemplate; varsayilanDil?: ContentLocale }) {
  const { state, pending, formProps } = useFormAction(saveReplyTemplateAction, { sifirlaBasarida: !sablon });
  const govdeRef = useRef<HTMLTextAreaElement>(null);
  const [uzunluk, setUzunluk] = useState(sablon?.body.length ?? 0);

  function ekle(kod: string) {
    const t = govdeRef.current;
    if (!t) return;
    const bas = t.selectionStart ?? t.value.length;
    const son = t.selectionEnd ?? bas;
    t.setRangeText(kod, bas, son, "end");
    t.focus();
    setUzunluk(t.value.length);
  }

  return (
    <form {...formProps} onReset={() => setUzunluk(sablon?.body.length ?? 0)} className="space-y-4">
      {sablon ? <input type="hidden" name="id" value={sablon.id} /> : null}
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Ad" error={state.fields?.title} hint="Listede görünür: “Teşekkür, sizi arayacağız”">
          <input name="title" defaultValue={sablon?.title ?? ""} required maxLength={80} className={INPUT_CLASS} />
        </Field>
        <Field label="Dil" error={state.fields?.locale}>
          <select name="locale" defaultValue={sablon?.locale ?? varsayilanDil} className={SELECT_CLASS}>
            {CONTENT_LOCALES.map((d) => (
              <option key={d} value={d}>
                {LOCALE_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-caption font-medium text-ink">Metin</span>
          <textarea
            ref={govdeRef}
            name="body"
            defaultValue={sablon?.body ?? ""}
            required
            rows={8}
            maxLength={EN_FAZLA}
            dir="auto"
            onChange={(e) => setUzunluk(e.target.value.length)}
            className={TEXTAREA_CLASS}
          />
        </label>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5 text-micro text-ink-faint">
            Ekle:
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <button
                key={p.kod}
                type="button"
                onClick={() => ekle(p.kod)}
                title={p.aciklama}
                className="rounded-md bg-surface-sunk px-1.5 py-0.5 font-mono text-micro text-ink-soft ring-1 ring-inset ring-line transition hover:bg-brand-wash hover:text-brand"
              >
                {p.kod}
              </button>
            ))}
          </span>
          <span className={cn("tabular text-micro", uzunluk > UZUN_UYARISI ? "text-warn" : "text-ink-faint")}>
            {uzunluk} / {EN_FAZLA}
            {uzunluk > UZUN_UYARISI ? " · uzun, bazı posta programları keser" : ""}
          </span>
        </div>
        {state.fields?.body ? <p className="mt-1.5 text-caption text-bad">{state.fields.body}</p> : null}
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {pending ? "Kaydediliyor…" : sablon ? "Kaydet" : "Şablonu ekle"}
      </Button>
    </form>
  );
}
