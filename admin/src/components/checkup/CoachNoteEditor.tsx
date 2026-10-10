"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setCoachNoteAction } from "@/lib/checkup/actions/plans";
import { KOC_NOTU_SINIR, kocNotunuTemizle } from "@/lib/checkup/coach-note";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

/**
 * Bu haftanın planına koç notu. Öğrenci notu plan kartında ve pazartesi
 * postasında görür. Kurallar lib/checkup/coach-note.ts'te, yetki ve hafta
 * denetimi sunucuda (actions/plans.ts).
 */
export function CoachNoteEditor({ planId, note }: { planId: string; note: string | null }) {
  const [metin, setMetin] = useState(note ?? "");
  const [kayitli, setKayitli] = useState(note ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onayla = useOnay();

  const temiz = kocNotunuTemizle(metin);
  const degisti = temiz !== kocNotunuTemizle(kayitli);
  const fazla = temiz.length > KOC_NOTU_SINIR;

  const kaydet = (yeni: string) =>
    start(async () => {
      const r = await setCoachNoteAction(planId, yeni);
      if (!r.ok) {
        setHata(r.error ?? "Kaydedilemedi.");
        return;
      }
      setHata(null);
      setMetin(r.note ?? "");
      setKayitli(r.note ?? "");
      toast.success(r.note ? "Koç notu kaydedildi." : "Koç notu kaldırıldı.");
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && degisti && !fazla) kaydet(metin);
      }}
      className="space-y-3"
    >
      <Field
        label="Koç notu"
        error={fazla ? "Not " + KOC_NOTU_SINIR + " karakteri aşıyor (" + temiz.length + ")." : undefined}
        hint={
          <>
            <span className="tabular">
              {temiz.length}/{KOC_NOTU_SINIR}
            </span>{" "}
            · Öğrenci plan kartında ve pazartesi postasında görür. Tek paragraf; satır sonları boşluğa döner.
          </>
        }
      >
        <TextArea
          rows={3}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          className="leading-relaxed"
          placeholder="Örn. Bu hafta yalnızca üçgenler: önce konu tekrarı, sonra 40 soru. Cuma kontrol testi."
        />
      </Field>
      <div className={cx("flex flex-wrap items-center justify-end gap-2")}>
        {kayitli ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={pending}
            onClick={async () => {
              const evet = await onayla({
                title: "Koç notu kaldırılsın mı?",
                description: "Pazartesi postasında genel bir cümle gider.",
                confirmLabel: "Notu kaldır",
                tone: "warning",
              });
              if (evet) kaydet("");
            }}
          >
            Notu kaldır
          </Button>
        ) : null}
        <Button type="submit" size="xs" loading={pending} disabled={!degisti || fazla}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}
    </form>
  );
}
