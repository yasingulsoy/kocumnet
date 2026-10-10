"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useConfirm, type ConfirmOptions } from "@/components/tailadmin/ui/Dialogs";

/**
 * Panelin tek onay penceresi — kitin useConfirm'ü (window.confirm yerine):
 *
 *   const onayla = useOnay();
 *   if (!(await onayla({ title: "Silinsin mi?", tone: "danger", confirmLabel: "Sil" }))) return;
 *
 * Pencere çerçevede (AdminShell) bir kez çizilir: tablodaki her satır kendi
 * penceresini kurmasın (paket tablosunda onlarca boş <dialog> olurdu).
 */
const OnayCtx = createContext<((secenekler: ConfirmOptions) => Promise<boolean>) | null>(null);

export function OnayProvider({ children }: { children: ReactNode }) {
  const [pencere, onayla] = useConfirm();
  return (
    <OnayCtx.Provider value={onayla}>
      {children}
      {pencere}
    </OnayCtx.Provider>
  );
}

export function useOnay() {
  const onayla = useContext(OnayCtx);
  if (!onayla) throw new Error("useOnay yalnızca panel çerçevesinin (OnayProvider) içinde kullanılabilir.");
  return onayla;
}
