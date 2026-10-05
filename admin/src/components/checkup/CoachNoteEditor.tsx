"use client";

import { useId, useState, useTransition } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { setCoachNoteAction } from "@/lib/checkup/actions/plans";
import { KOC_NOTU_SINIR, kocNotunuTemizle } from "@/lib/checkup/coach-note";
import { Notice, TEXTAREA_CLASS, buttonClass } from "./ui";

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
  const id = useId();

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
      className="space-y-2"
    >
      <label htmlFor={id} className="block text-caption font-medium text-ink">
        Koç notu
      </label>
      <textarea
        id={id}
        rows={3}
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        aria-describedby={id + "-yardim"}
        aria-invalid={fazla || undefined}
        className={clsx(TEXTAREA_CLASS, "leading-relaxed")}
        placeholder="Örn. Bu hafta yalnızca üçgenler: önce konu tekrarı, sonra 40 soru. Cuma kontrol testi."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={id + "-yardim"} className={clsx("text-micro", fazla ? "text-bad" : "text-ink-faint")}>
          <span className="tabular">
            {temiz.length}/{KOC_NOTU_SINIR}
          </span>{" "}
          · Öğrenci plan kartında ve pazartesi postasında görür. Tek paragraf; satır sonları boşluğa döner.
        </p>
        <div className="flex gap-2">
          {kayitli ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Koç notu kaldırılsın mı? Pazartesi postasında genel bir cümle gider.")) kaydet("");
              }}
              className={buttonClass("ghost", "sm")}
            >
              Notu kaldır
            </button>
          ) : null}
          <button type="submit" disabled={pending || !degisti || fazla} className={buttonClass("primary", "sm")}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
      {hata ? <Notice>{hata}</Notice> : null}
    </form>
  );
}
