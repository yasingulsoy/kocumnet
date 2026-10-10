import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/LogoMark";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";

/**
 * Kimlik ekranları (giriş, parola) — TailAdmin'in giriş sayfası düzeni:
 * solda form, sağda lacivert marka paneli; telefonda yalnızca form.
 */
export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      top={
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-700">
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            kocum.net&apos;e dön
          </Link>
          <Link href="/" aria-label="kocum.net" className="lg:hidden">
            <Wordmark size="sm" />
          </Link>
        </div>
      }
      aside={
        <div className="flex max-w-sm flex-col items-center text-center">
          <Link href="/" aria-label="kocum.net">
            <Wordmark tone="light" size="lg" />
          </Link>
          <p className="mt-8 font-display text-2xl leading-snug font-semibold text-balance text-white">
            Blog, gelen mesajlar ve ekip tek yerde.
          </p>
          <p className="mt-3 text-gray-400">
            Bu panel kocum.net&apos;in içeriğini yönetir. Soru havuzu ve öğrenciler ayrı panelde: admin.kocum.net.
          </p>
          <p className="mt-10 flex items-center gap-2 text-sm text-gray-400">
            <ShieldCheck className="size-4" aria-hidden /> Oturumlar 6 saat sonra kendiliğinden kapanır.
          </p>
        </div>
      }
    >
      {children}
    </AuthLayout>
  );
}
