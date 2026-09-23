"use client";

import { useActionState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  grantEntitlementAction,
  revokeEntitlementAction,
  type GrantState,
} from "@/lib/checkup/actions/students";
import { Field, INPUT_CLASS, Notice, SELECT_CLASS, buttonClass } from "./ui";

const initial: GrantState = {};

/**
 * Erişim hakkı ver.
 *
 * İki satış biçimi tek formdan çıkıyor:
 *   paket seç + süresiz  → tek seferlik alım (o paket, süresiz)
 *   "Tüm paketler" + gün → abonelik
 */
export function GrantForm({
  userId,
  packages,
}: {
  userId: string;
  /** Yalnızca ücretli paketler — ücretsiz pakete hak vermenin anlamı yok. */
  packages: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(grantEntitlementAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kapsam" htmlFor="grant-package">
          <select
            id="grant-package"
            name="packageId"
            className={SELECT_CLASS}
            defaultValue={packages[0]?.id ?? "all"}
          >
            <option value="all">Tüm paketler (abonelik)</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Süre" htmlFor="grant-days">
          <select id="grant-days" name="days" className={SELECT_CLASS} defaultValue="0">
            <option value="0">Süresiz</option>
            <option value="30">30 gün</option>
            <option value="90">90 gün</option>
            <option value="180">180 gün</option>
            <option value="365">1 yıl</option>
          </select>
        </Field>
      </div>

      <Field label="Not" htmlFor="grant-note" hint="Ör. havale dekont no, promosyon kodu. Uyuşmazlıkta kayıt olur.">
        <input
          id="grant-note"
          name="note"
          maxLength={200}
          placeholder="Havale — 21.09.2026"
          className={INPUT_CLASS}
        />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
        {pending ? "Veriliyor…" : "Erişim hakkı ver"}
      </button>
    </form>
  );
}

/** Hakkı geri al. Satır silinmiyor, revokedAt işaretleniyor (kayıt kalsın). */
export function RevokeButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`"${label}" erişimi geri alınsın mı? Öğrenci bu kapsamda yeni test başlatamaz.`)) {
          return;
        }
        start(async () => {
          const res = await revokeEntitlementAction(id);
          if (res.ok) toast.success("Erişim geri alındı.");
          else toast.error(res.error ?? "Geri alınamadı.");
        });
      }}
      className={buttonClass("danger", "xs")}
    >
      {pending ? "…" : "Geri al"}
    </button>
  );
}
