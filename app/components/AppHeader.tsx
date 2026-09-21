import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { LinkButton, Wordmark } from "@/components/ui";

export async function AppHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        {user ? (
          <div className="flex items-center gap-1">
            <Link
              href="/gecmis"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
            >
              Geçmişim
            </Link>
            {user.role === "ADMIN" ? (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
              >
                Yönetim
              </Link>
            ) : null}
            <span className="mx-2 hidden text-sm text-ink-faint sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
              >
                Çıkış
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/giris"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
            >
              Giriş
            </Link>
            <LinkButton href="/kayit" className="!px-4 !py-1.5">
              Kayıt ol
            </LinkButton>
          </div>
        )}
      </div>
    </header>
  );
}
