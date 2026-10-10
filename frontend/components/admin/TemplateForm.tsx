"use client";

import { useRef, useState } from "react";
import { Save } from "lucide-react";
import { saveReplyTemplateAction } from "@/lib/admin/actions";
import { CONTENT_LOCALES, LOCALE_LABEL, TEMPLATE_PLACEHOLDERS, type ContentLocale, type ReplyTemplate } from "@/lib/admin/types";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
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
    <form {...formProps} onReset={() => setUzunluk(sablon?.body.length ?? 0)} className="space-y-5">
      {sablon ? <input type="hidden" name="id" value={sablon.id} /> : null}
      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.message}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
        <Field label="Ad" error={state.fields?.title} hint="Listede görünür: “Teşekkür, sizi arayacağız”" required>
          <Input name="title" defaultValue={sablon?.title ?? ""} required maxLength={80} />
        </Field>
        <Field label="Dil" error={state.fields?.locale}>
          <Select name="locale" defaultValue={sablon?.locale ?? varsayilanDil}>
            {CONTENT_LOCALES.map((d) => (
              <option key={d} value={d}>
                {LOCALE_LABEL[d]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Metin" error={state.fields?.body} required>
        <TextArea
          ref={govdeRef}
          name="body"
          defaultValue={sablon?.body ?? ""}
          required
          rows={8}
          maxLength={EN_FAZLA}
          dir="auto"
          onChange={(e) => setUzunluk(e.target.value.length)}
        />
      </Field>
      <div className="-mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5 text-theme-xs text-gray-500">
          Ekle:
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <button
              key={p.kod}
              type="button"
              onClick={() => ekle(p.kod)}
              title={p.aciklama}
              className="cursor-pointer rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-700 transition hover:bg-brand-50 hover:text-brand-500"
            >
              {p.kod}
            </button>
          ))}
        </span>
        <span className={cx("tabular text-theme-xs", uzunluk > UZUN_UYARISI ? "text-warning-700" : "text-gray-500")}>
          {uzunluk} / {EN_FAZLA}
          {uzunluk > UZUN_UYARISI ? " · uzun, bazı posta programları keser" : ""}
        </span>
      </div>

      <Button type="submit" size="xs" loading={pending} startIcon={<Save />}>
        {pending ? "Kaydediliyor…" : sablon ? "Kaydet" : "Şablonu ekle"}
      </Button>
    </form>
  );
}
