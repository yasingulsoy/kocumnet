"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setQuestionStatusAction } from "@/lib/checkup/actions/questions";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { KILITLI_DENEME_MESAJI } from "@/lib/checkup/mock-rules";
import { Select } from "@/components/tailadmin/form/Select";
import { useOnay } from "./Onay";

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu
 * açmak gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 *
 * Sunucu reddederse seçim eski değerine döner: ekranda "Yayında" yazıp
 * veritabanında taslak kalan soru, en kötü yanılgı.
 *
 * `denemeler`: yayındaki soru BAŞLATILMAMIŞ bir denemenin sabit listesindeyse
 * adları. Yayından kaldırmadan önce sorulur: deneme eksik kalır, öğrenci
 * başlatamaz; orada yerine başka soru konabilir.
 *
 * `kilitli`: yayındaki ve başlatılmış denemelerin adları. O soru yayından hiç
 * alınamaz (sunucu da reddeder): "yerine başka soru koy" yolu yok, çünkü
 * başlatılmış denemenin listesi değişemiyor. Seçenekler kapalı, nedeni yazılı.
 *
 * `yayinEksigi`: soru "yayına hazır mı" listesinden geçmiyorsa eksiklerin kısa
 * adları ("çözüm yok, hata tipi eksik"). "Yayında" seçeneği kapalı ve nedeni
 * yazılı; sunucu da aynı kuralla reddeder (lib/checkup/yayin-kapisi.ts).
 */
export function StatusSelect({
  id,
  status,
  denemeler,
  kilitli,
  yayinEksigi,
}: {
  id: string;
  status: string;
  denemeler?: string[];
  kilitli?: string[];
  yayinEksigi?: string;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const onayla = useOnay();
  const durumKilitli = value === "PUBLISHED" && Boolean(kilitli?.length);

  return (
    <Select
      aria-label="Durumu değiştir"
      compact
      wrapperClassName="w-36"
      value={value}
      disabled={pending}
      title={durumKilitli ? KILITLI_DENEME_MESAJI + " (" + kilitli!.join(", ") + ")" : undefined}
      onChange={async (e) => {
        const onceki = value;
        const sonraki = e.target.value;
        if (durumKilitli && sonraki !== "PUBLISHED") {
          toast.error(KILITLI_DENEME_MESAJI, { duration: 8000 });
          return;
        }
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
            toast.error(res.error ?? "Durum değiştirilemedi.", { duration: 8000 });
          }
        });
      }}
      options={QUESTION_STATUSES.map((s) => {
        const eksik = s === "PUBLISHED" && value !== "PUBLISHED" && Boolean(yayinEksigi);
        return {
          value: s,
          label: QUESTION_STATUS_LABEL[s] + (durumKilitli && s !== "PUBLISHED" ? " (kilitli)" : eksik ? " (eksik: " + yayinEksigi + ")" : ""),
          disabled: (durumKilitli && s !== "PUBLISHED") || eksik,
        };
      })}
    />
  );
}
