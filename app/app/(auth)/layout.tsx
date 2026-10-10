import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Brain, CircleCheck, Crosshair, Lightbulb } from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";

/**
 * Kimlik ekranları (giriş, kayıt, parola) — kitin AuthLayout'u. Masaüstünde
 * bölünmüş düzen: solda form, sağda ürünün ne verdiğini hatırlatan lacivert
 * marka paneli. Mobilde yalnızca form — telefonda iki sütun yer kaplamaktan
 * başka işe yaramıyor.
 */
export default function AuthPagesLayout({ children }: { children: ReactNode }) {
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
      aside={<MarkaPaneli />}
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

const OZELLIKLER = [
  { icon: Crosshair, t: "Konu konu seviye haritası" },
  { icon: Brain, t: "Yanlışlarının nedeni: bilgi mi, dikkat mi?" },
  { icon: Lightbulb, t: "Her sorunun adım adım çözümü" },
];

/** Lacivert panelin içi (brand-950): açık renk metin, beyaz/10 ikon kutuları. */
function MarkaPaneli() {
  return (
    <div className="flex w-full max-w-md flex-col">
      <Link href="/" aria-label="Ana sayfa" className="self-start">
        <Wordmark tone="light" />
      </Link>

      <h2 className="mt-12 font-display text-title-sm font-semibold text-balance text-white">
        Matematikte nerede durduğunu 20 dakikada öğren.
      </h2>
      <ul className="mt-8 space-y-4">
        {OZELLIKLER.map(({ icon: Icon, t }) => (
          <li key={t} className="flex items-center gap-3 text-base text-gray-300">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            {t}
          </li>
        ))}
      </ul>

      <p className="mt-12 flex items-center gap-2 text-sm text-gray-400">
        <CircleCheck className="size-4" aria-hidden /> Koçum.Net — sınava kadar aklında.
      </p>
    </div>
  );
}
