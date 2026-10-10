"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — context/SidebarContext.tsx
 *
 * Masaüstünde (lg ≥ 1024px) kenar çubuğu geniş (290px) ya da dar (90px,
 * yalnızca ikon; üstüne gelince/odaklanınca açılır). Altında mobil çekmece.
 * Farklar: çekmece "hangi adreste açıldı" diye tutulur — sayfa değişince
 * effect'siz kendiliğinden kapanır; ekran masaüstü genişliğine çıkınca da
 * kapanır. Kırılma lg (TailAdmin xl kullanıyordu; site ve check-up
 * panelleri lg'de yerleşik).
 */
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface SidebarState {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar() {
  const c = useContext(SidebarContext);
  if (!c) throw new Error("useSidebar yalnızca SidebarProvider içinde kullanılabilir");
  return c;
}

/** Masaüstü kırılması: theme.css'teki lg ile aynı (64rem). */
export const MASAUSTU_SORGUSU = "(min-width: 64rem)";

export function SidebarProvider({ children, defaultExpanded = true }: { children: ReactNode; defaultExpanded?: boolean }) {
  const pathname = usePathname() ?? "";
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  /** Çekmecenin açıldığı adres; başka adreste kapalı sayılır. */
  const [acikAdres, setAcikAdres] = useState<string | null>(null);
  const isMobileOpen = acikAdres !== null && acikAdres === pathname;

  useEffect(() => {
    const mq = window.matchMedia(MASAUSTU_SORGUSU);
    const degisti = () => {
      if (mq.matches) setAcikAdres(null);
    };
    mq.addEventListener("change", degisti);
    return () => mq.removeEventListener("change", degisti);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((v) => !v);
    setIsHovered(false);
  }, []);
  const openMobileSidebar = useCallback(() => setAcikAdres(pathname), [pathname]);
  const closeMobileSidebar = useCallback(() => setAcikAdres(null), []);
  const toggleMobileSidebar = useCallback(() => setAcikAdres((a) => (a === pathname ? null : pathname)), [pathname]);

  const deger = useMemo<SidebarState>(
    () => ({
      isExpanded,
      isMobileOpen,
      isHovered,
      toggleSidebar,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      setIsHovered,
    }),
    [isExpanded, isMobileOpen, isHovered, toggleSidebar, openMobileSidebar, closeMobileSidebar, toggleMobileSidebar]
  );

  return <SidebarContext.Provider value={deger}>{children}</SidebarContext.Provider>;
}
