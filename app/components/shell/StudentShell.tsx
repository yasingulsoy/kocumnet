import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { SITE_URL } from "@/lib/products";
import { Avatar, Wordmark } from "@/components/ui";
import { BottomNav, SidebarNav } from "./nav";

/**
 * Öğrenci uygulamasının çerçevesi.
 *
 * Masaüstü: sabit sol kenar çubuğu. Mobil: üst çubuk + alt sekme çubuğu —
 * öğrencilerin çoğu telefondan giriyor, ana gezinme başparmağın ulaştığı
 * yerde olmalı.
 *
 * Sınav ekranı BU ÇERÇEVEYİ KULLANMIYOR: test sırasında menü, dikkat
 * dağıtan her şey kaldırılıyor.
 */
export function StudentShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:ps-[264px]">
      {/* Masaüstü kenar çubuğu */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/panel" aria-label="Ana sayfa">
            <Wordmark />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>

        <div className="border-t border-line p-3">
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener"
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-ink-soft transition hover:bg-surface-hover hover:text-ink"
          >
            kocum.net
            <ArrowUpRight className="size-3.5" />
          </a>

          <div className="flex items-center gap-3 rounded-xl bg-surface-sunk p-2.5">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Çıkış yap"
                title="Çıkış yap"
                className="flex size-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-bad"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/panel" aria-label="Ana sayfa">
          <Wordmark compact />
        </Link>
        <Link href="/profil" aria-label="Profil">
          <Avatar name={user.name} className="size-8 text-xs" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
