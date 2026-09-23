"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setQuestionStatusAction } from "@/lib/checkup/actions/questions";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { SMALL_SELECT_CLASS } from "./ui";

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu
 * açmak gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 *
 * Sunucu reddederse seçim eski değerine döner: ekranda "Yayında" yazıp
 * veritabanında taslak kalan soru, en kötü yanılgı.
 */
export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  return (
    <select
      aria-label="Durumu değiştir"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const onceki = value;
        const sonraki = e.target.value;
        setValue(sonraki);
        start(async () => {
          const res = await setQuestionStatusAction(id, sonraki);
          if (res.ok) {
            toast.success("Durum: " + QUESTION_STATUS_LABEL[sonraki]);
          } else {
            setValue(onceki);
            toast.error(res.error ?? "Durum değiştirilemedi.");
          }
        });
      }}
      className={SMALL_SELECT_CLASS}
    >
      {QUESTION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {QUESTION_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
