import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";

/**
 * Davet bağlantısı (/katil/<kod>) — kimlik ekranlarıyla aynı bölünmüş düzen:
 * öğrenci çoğu zaman buradan kayda ya da girişe geçiyor, iki ekran aynı
 * yerde görünsün. Panelin çerçevesi yok: giriş yapmamış öğrenci de açıyor.
 */
export default function KatilLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      top={
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> Ana sayfa
          </Link>
          <Link href="/" aria-label="Ana sayfa" className="lg:hidden">
            <Wordmark />
          </Link>
        </div>
      }
      aside={
        <div className="flex w-full max-w-md flex-col">
          <Link href="/" aria-label="Ana sayfa" className="self-start">
            <Wordmark tone="light" />
          </Link>
          <span className="mt-12 flex size-12 items-center justify-center rounded-xl bg-white/10 text-white">
            <Users className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 font-display text-title-sm font-semibold text-balance text-white">
            Koçun seni grubuna çağırdı.
          </h2>
          <p className="mt-4 text-base text-gray-300">
            Gruba katılınca koçunun verdiği ödevler ana sayfanda görünür, çözdüğün testleri koçun takip eder.
          </p>
        </div>
      }
      bottom={
        <p className="text-center text-theme-xs text-gray-500">
          <Link href="/gizlilik" className="transition hover:text-gray-700">
            Gizlilik ve KVKK
          </Link>
        </p>
      }
    >
      {children}
    </AuthLayout>
  );
}
