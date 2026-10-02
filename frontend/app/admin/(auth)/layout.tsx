import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/LogoMark";

/**
 * Kimlik ekranları (giriş, parola). Masaüstünde bölünmüş düzen — check-up
 * uygulaması ve check-up paneliyle aynı kalıp.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1.05fr]">
      <aside className="bg-brand-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div aria-hidden className="bg-grid-fade absolute inset-0" />
        <Link href="/" className="relative" aria-label="kocum.net">
          <Wordmark tone="light" size="lg" />
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-[34px] font-bold leading-tight tracking-tight text-balance">
            Blog, gelen mesajlar ve ekip tek yerde.
          </h2>
          <p className="mt-4 text-body text-white/75">
            Bu panel kocum.net&apos;in içeriğini yönetir. Soru havuzu ve öğrenciler ayrı panelde:
            admin.kocum.net.
          </p>
        </div>
        <p className="relative mt-12 flex items-center gap-2 text-caption text-white/60">
          <ShieldCheck className="size-4" /> Oturumlar 6 saat sonra kendiliğinden kapanır.
        </p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="lg:hidden" aria-label="kocum.net">
          <Wordmark />
        </Link>
        <div className="animate-rise mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {children}
        </div>
        <p className="text-center text-micro text-ink-faint">
          <Link href="/" className="hover:text-ink">
            kocum.net
          </Link>
        </p>
      </main>
    </div>
  );
}
