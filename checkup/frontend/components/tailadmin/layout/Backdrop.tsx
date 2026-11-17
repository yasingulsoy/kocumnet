"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — layout/Backdrop.tsx
 *
 * Mobil çekmece açıkken arkadaki koyu perde; tıklanınca çekmece kapanır.
 * Ekran okuyucudan gizli (kapatma düğmesi çekmecenin içinde).
 */
import { useSidebar } from "./SidebarContext";

export function Backdrop() {
  const { isMobileOpen, closeMobileSidebar } = useSidebar();
  if (!isMobileOpen) return null;
  return <div aria-hidden onClick={closeMobileSidebar} className="animate-fade fixed inset-0 z-40 bg-gray-900/50 lg:hidden" />;
}
