"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { setPackageFreeAction, setPackageStatusAction } from "@/lib/checkup/actions/packages";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { SMALL_SELECT_CLASS } from "./ui";

/** Paketin yayın durumu. Sunucu reddederse (havuz yetersiz) eski değere döner. */
export function PackageStatusSelect({ id, status, name }: { id: string; status: string; name: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  return (
    <select
      aria-label={name + " yayın durumu"}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const onceki = value;
        const sonraki = e.target.value;
        setValue(sonraki);
        start(async () => {
          const res = await setPackageStatusAction(id, sonraki);
          if (res.ok) {
            toast.success(name + ": " + QUESTION_STATUS_LABEL[sonraki]);
          } else {
            setValue(onceki);
            toast.error(res.error ?? "Durum değiştirilemedi.", { duration: 6000 });
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

/** Ücretsiz / ücretli anahtarı. */
export function PackageFreeToggle({ id, isFree, name }: { id: string; isFree: boolean; name: string }) {
  const [value, setValue] = useState(isFree);
  const [pending, start] = useTransition();

  const degistir = () => {
    const sonraki = !value;
    if (
      !sonraki &&
      !window.confirm(
        `"${name}" ücretli yapılsın mı?\n\nErişim hakkı olmayan öğrenciler bu paketle yeni test başlatamaz. Tamamlanmış sonuçları durur.`
      )
    ) {
      return;
    }
    setValue(sonraki);
    start(async () => {
      const res = await setPackageFreeAction(id, sonraki);
      if (res.ok) {
        toast.success(name + (sonraki ? " artık ücretsiz." : " artık ücretli."));
      } else {
        setValue(!sonraki);
        toast.error(res.error ?? "Değiştirilemedi.");
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!value}
      aria-label={name + " ücretli"}
      disabled={pending}
      onClick={degistir}
      className="group inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={clsx(
          "relative h-5 w-9 rounded-full transition",
          value ? "bg-gray-200 dark:bg-white/10" : "bg-brand-500"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-theme-sm transition-transform",
            !value && "translate-x-4"
          )}
        />
      </span>
      <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
        {value ? "Ücretsiz" : "Ücretli"}
      </span>
    </button>
  );
}
