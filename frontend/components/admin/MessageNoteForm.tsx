"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveMessageNoteAction } from "@/lib/admin/actions";
import { Button, Notice, TEXTAREA_CLASS, cn } from "./ui";
import { useFormAction } from "./useFormAction";

const EN_FAZLA = 2000;

/**
 * Ekip içi not: "telefonla arandı, pazartesi görüşme". Gönderen görmez.
 * Mesajla ilgilenen ikinci kişi aynı veliyi yeniden aramasın diye.
 */
export function MessageNoteForm({ id, note }: { id: number; note: string | null }) {
  const { state, pending, formProps } = useFormAction(saveMessageNoteAction);
  const [uzunluk, setUzunluk] = useState(note?.length ?? 0);

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="sr-only">Ekip notu</span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          rows={3}
          maxLength={EN_FAZLA}
          onChange={(e) => setUzunluk(e.target.value.length)}
          placeholder="Örn. Telefonla arandı, pazartesi 15.00'te görüşme ayarlandı."
          className={TEXTAREA_CLASS}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {pending ? "Kaydediliyor…" : "Notu kaydet"}
        </Button>
        <span className={cn("tabular text-micro", uzunluk > EN_FAZLA * 0.9 ? "text-warn" : "text-ink-faint")}>
          {uzunluk} / {EN_FAZLA}
        </span>
      </div>
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}
    </form>
  );
}
