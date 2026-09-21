import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Wordmark } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Havuz" },
  { href: "/admin/sorular", label: "Sorular" },
  { href: "/admin/sorular/yeni", label: "Yeni soru" },
  { href: "/admin/ogrenciler", label: "Öğrenciler" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();

  // Yetkisiz kullanıcıya "burada bir yönetim paneli var" bilgisini bile
  // vermiyoruz: giriş yoksa girişe, yetki yoksa ana sayfaya.
  if (!user) redirect("/giris");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Wordmark />
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-ink-faint sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-surface-sunk hover:text-ink"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
