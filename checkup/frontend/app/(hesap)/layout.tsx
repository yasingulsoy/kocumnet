import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";
import { UygulamaLogosu } from "@/components/Logo";
import { ADIMLAR } from "@/components/Adimlar";

/*
 * Kayıt, giriş ve parola sayfalarının ortak düzeni: solda form, geniş
 * ekranda sağda lacivert marka paneli (TailAdmin AuthLayout).
 */

function MarkaPaneli() {
  return (
    <div className="max-w-sm text-white">
      <UygulamaLogosu size="md" tone="light" />
      <p className="mt-8 font-display text-h2 font-semibold text-balance">Nerede eksiğin var, birlikte görelim.</p>
      <ol className="mt-8 space-y-5">
        {ADIMLAR.map((a, i) => (
          <li key={a.baslik} className="flex gap-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight font-display text-sm font-bold text-highlight-ink">
              {i + 1}
            </span>
            <span>
              <span className="block font-medium">{a.baslik}</span>
              <span className="mt-0.5 block text-sm text-white/75">{a.aciklama}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function HesapDuzeni({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      top={
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 transition hover:text-gray-800"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Ana sayfa
          </Link>
          <Link href="/" className="lg:hidden" aria-label="Koçum.Net Check-up ana sayfa">
            <UygulamaLogosu />
          </Link>
        </div>
      }
      aside={<MarkaPaneli />}
      bottom={
        <p className="text-center text-caption text-gray-500">
          <Link href="/gizlilik" className="underline-offset-2 hover:text-gray-700 hover:underline">
            Gizlilik ve KVKK aydınlatma metni
          </Link>
        </p>
      }
    >
      {children}
    </AuthLayout>
  );
}
