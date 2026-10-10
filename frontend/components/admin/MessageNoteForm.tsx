"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { saveMessageNoteAction } from "@/lib/admin/actions";
import { cx } from "@/components/tailadmin/cx";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
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
      <TextArea
        name="note"
        aria-label="Ekip notu"
        defaultValue={note ?? ""}
        rows={3}
        maxLength={EN_FAZLA}
        onChange={(e) => setUzunluk(e.target.value.length)}
        placeholder="Örn. Telefonla arandı, pazartesi 15.00'te görüşme ayarlandı."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="xs" loading={pending} startIcon={<Save />}>
          {pending ? "Kaydediliyor…" : "Notu kaydet"}
        </Button>
        <span className={cx("tabular text-theme-xs", uzunluk > EN_FAZLA * 0.9 ? "text-warning-700" : "text-gray-500")}>
          {uzunluk} / {EN_FAZLA}
        </span>
      </div>
      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.message}</Alert> : null}
    </form>
  );
}
