"use client";

import { useTransition } from "react";
import { setQuestionStatusAction } from "@/lib/actions/admin";

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu
 * açmak gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 */
export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();

  return (
    <select
      aria-label="Durumu değiştir"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(() => {
          void setQuestionStatusAction(id, next);
        });
      }}
      className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink-soft disabled:opacity-50"
    >
      <option value="DRAFT">Taslak</option>
      <option value="REVIEW">İncelemede</option>
      <option value="PUBLISHED">Yayında</option>
      <option value="ARCHIVED">Arşiv</option>
    </select>
  );
}
