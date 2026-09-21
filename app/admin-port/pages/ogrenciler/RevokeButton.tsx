"use client";

import { useTransition } from "react";
import { revokeEntitlementAction } from "@/lib/actions/students";

/** Hakkı geri al. Satır silinmiyor, revokedAt işaretleniyor (kayıt kalsın). */
export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void revokeEntitlementAction(id))}
      className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-bad hover:bg-bad-wash disabled:opacity-50"
    >
      {pending ? "…" : "geri al"}
    </button>
  );
}
