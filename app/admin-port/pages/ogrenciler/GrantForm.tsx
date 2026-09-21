"use client";

import { useActionState } from "react";
import { grantEntitlementAction, type GrantState } from "@/lib/actions/students";
import { Alert, Button } from "@/components/ui";

const initial: GrantState = {};

const SELECT =
  "rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink";

/**
 * Erişim hakkı ver.
 *
 * İki satış biçimi tek formdan çıkıyor:
 *   paket seç + süre 0   → tek seferlik alım (o paket, süresiz)
 *   "Tüm paketler" + gün → abonelik
 */
export function GrantForm({
  userId,
  packages,
}: {
  userId: string;
  packages: { id: string; name: string; isFree: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(grantEntitlementAction, initial);
  const ucretliler = packages.filter((p) => !p.isFree);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />

      {state.error ? (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      {state.ok ? (
        <div className="w-full">
          <Alert tone="ok">{state.ok}</Alert>
        </div>
      ) : null}

      <select name="packageId" className={SELECT} defaultValue={ucretliler[0]?.id ?? "all"}>
        <option value="all">Tüm paketler (abonelik)</option>
        {ucretliler.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select name="days" className={SELECT} defaultValue="0">
        <option value="0">Süresiz</option>
        <option value="30">30 gün</option>
        <option value="90">90 gün</option>
        <option value="180">180 gün</option>
        <option value="365">1 yıl</option>
      </select>

      <input
        name="note"
        placeholder="Not (ör. havale, promosyon)"
        className="flex-1 basis-40 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs"
      />

      <Button type="submit" variant="ghost" disabled={pending} className="!px-3 !py-1.5 !text-xs">
        {pending ? "…" : "Hak ver"}
      </Button>
    </form>
  );
}
