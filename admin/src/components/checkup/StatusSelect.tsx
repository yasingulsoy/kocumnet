"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setQuestionStatusAction } from "@/lib/checkup/actions/questions";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { Select } from "@/components/tailadmin/form/Select";
import { useOnay } from "./Onay";

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu
 * açmak gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 *
 * Sunucu reddederse seçim eski değerine döner: ekranda "Yayında" yazıp
 * veritabanında taslak kalan soru, en kötü yanılgı.
 *
 * `denemeler`: yayındaki soru bir denemenin sabit listesindeyse adları.
 * Yayından kaldırmadan önce sorulur: deneme eksik kalır, öğrenci başlatamaz.
 */
export function StatusSelect({ id, status, denemeler }: { id: string; status: string; denemeler?: string[] }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const onayla = useOnay();

  return (
    <Select
      aria-label="Durumu değiştir"
      compact
      wrapperClassName="w-36"
      value={value}
      disabled={pending}
      onChange={async (e) => {
        const onceki = value;
        const sonraki = e.target.value;
        if (onceki === "PUBLISHED" && sonraki !== "PUBLISHED" && denemeler?.length) {
          // Denetimli select: onay gelene kadar ekranda eski değer kalır.
          const evet = await onayla({
            title: "Bu soru " + (denemeler.length === 1 ? "bir denemede" : denemeler.length + " denemede") + " kullanılıyor",
            description:
              denemeler.join(", ") +
              ". " +
              QUESTION_STATUS_LABEL[sonraki] +
              " durumuna alırsan deneme eksik kalır ve öğrenci başlatamaz. Önce denemede yerine başka soru koymak daha iyi.",
            confirmLabel: "Yine de değiştir",
            tone: "warning",
          });
          if (!evet) return;
        }
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
      options={QUESTION_STATUSES.map((s) => ({ value: s, label: QUESTION_STATUS_LABEL[s] }))}
    />
  );
}
