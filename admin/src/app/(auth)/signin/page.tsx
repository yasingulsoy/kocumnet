import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { Wordmark } from "@/components/brand/Logo";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Giriş" };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net").replace(/\/$/, "");

/**
 * Personel girişi. Zaten oturumu olan doğrudan panele gider.
 * Parola sıfırlama kocum.net/admin'de (personel hesapları orada yönetiliyor).
 */
export default async function SignInPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (gate.ok) redirect("/checkup");

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1fr_1.05fr]">
      <aside className="bg-brand-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div aria-hidden className="bg-grid-fade absolute inset-0" />
        <Wordmark tone="light" />
        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-[34px] font-bold leading-tight tracking-tight text-balance">
            Soru havuzu, paketler ve öğrenciler tek yerde.
          </h2>
          <p className="mt-4 text-body text-white/75">
            Bu panel yalnızca Matematik Check-up&apos;ı yönetir. Blog, iletişim mesajları ve
            personel hesapları kocum.net/admin&apos;de.
          </p>
        </div>
        <p className="relative mt-12 flex items-center gap-2 text-caption text-white/60">
          <ShieldCheck className="size-4" /> Öğrenci verisi yalnızca yetkili role açılır.
        </p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="animate-rise mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-h1 font-bold tracking-tight text-ink">Personel girişi</h1>
          <p className="mt-1.5 text-body text-ink-soft">
            kocum.net personel hesabınla gir. Hesabın yoksa yöneticiden davet iste.
          </p>
          <div className="mt-8">
            <SignInForm />
          </div>
        </div>
        <p className="text-center text-micro text-ink-faint">
          <Link href={`${SITE_URL}/admin/sifremi-unuttum`} className="hover:text-ink">
            Parolamı unuttum
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <a href={SITE_URL} className="hover:text-ink">
            kocum.net
          </a>
        </p>
      </main>
    </div>
  );
}
