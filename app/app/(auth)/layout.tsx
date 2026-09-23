import Link from "next/link";
import type { ReactNode } from "react";
import { Brain, CircleCheck, Crosshair, Lightbulb } from "lucide-react";
import { Wordmark } from "@/components/ui";

/**
 * Kimlik ekranları (giriş, kayıt, parola). Masaüstünde bölünmüş düzen:
 * solda ürünün ne verdiğini hatırlatan marka paneli, sağda form. Mobilde
 * yalnızca form — telefonda iki sütun yer kaplamaktan başka işe yaramıyor.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1.05fr]">
      {/* Marka paneli */}
      <aside className="bg-brand-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div aria-hidden className="bg-grid-fade absolute inset-0" />
        <div
          aria-hidden
          className="absolute -bottom-32 -start-24 size-96 rounded-full bg-brand-bright/30 blur-3xl"
        />

        <Link href="/" className="relative" aria-label="Ana sayfa">
          <Wordmark tone="light" />
        </Link>

        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-[34px] font-bold leading-tight tracking-tight text-balance">
            Matematikte nerede durduğunu 20 dakikada öğren.
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Crosshair, t: "Konu konu seviye haritası" },
              { icon: Brain, t: "Yanlışlarının nedeni: bilgi mi, dikkat mi?" },
              { icon: Lightbulb, t: "Her sorunun adım adım çözümü" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3 text-[15px] text-white/90">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-[18px]" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 flex items-center gap-2 text-sm text-white/60">
          <CircleCheck className="size-4" /> Koçum.Net — sınava kadar aklında.
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="lg:hidden" aria-label="Ana sayfa">
          <Wordmark />
        </Link>
        <div className="animate-rise mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {children}
        </div>
        <p className="text-center text-xs text-ink-faint">
          <Link href="/gizlilik" className="hover:text-ink">
            Gizlilik ve KVKK
          </Link>
        </p>
      </main>
    </div>
  );
}
