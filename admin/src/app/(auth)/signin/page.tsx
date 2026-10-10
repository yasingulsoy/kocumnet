import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { Wordmark } from "@/components/brand/Logo";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Giriş" };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net").replace(/\/$/, "");

/**
 * Personel girişi — TailAdmin'in giriş sayfası düzeni (kitin AuthLayout'u):
 * solda form, sağda lacivert marka paneli; telefonda yalnızca form.
 * Zaten oturumu olan doğrudan panele gider. Parola sıfırlama
 * kocum.net/admin'de (personel hesapları orada yönetiliyor).
 */
export default async function SignInPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (gate.ok) redirect("/checkup");

  return (
    <AuthLayout
      top={
        <div className="flex items-center justify-between gap-4">
          <a href={SITE_URL} className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-700">
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            kocum.net&apos;e dön
          </a>
          <span className="lg:hidden">
            <Wordmark />
          </span>
        </div>
      }
      aside={
        <div className="flex max-w-sm flex-col items-center text-center">
          <Wordmark tone="light" className="[&_svg]:h-10" />
          <p className="mt-8 font-display text-2xl leading-snug font-semibold text-balance text-white">
            Soru havuzu, paketler ve öğrenciler tek yerde.
          </p>
          <p className="mt-3 text-gray-400">
            Bu panel yalnızca Matematik Check-up&apos;ı yönetir. Blog, iletişim mesajları ve personel hesapları
            kocum.net/admin&apos;de.
          </p>
          <p className="mt-10 flex items-center gap-2 text-sm text-gray-400">
            <ShieldCheck className="size-4" aria-hidden /> Öğrenci verisi yalnızca yetkili role açılır.
          </p>
        </div>
      }
    >
      <div className="mb-5 sm:mb-8">
        <h1 className="mb-2 font-display text-title-sm font-semibold text-gray-800 sm:text-title-md">Personel girişi</h1>
        <p className="text-sm text-gray-500">kocum.net personel hesabınla gir. Hesabın yoksa yöneticiden davet iste.</p>
      </div>
      <SignInForm forgotHref={`${SITE_URL}/admin/sifremi-unuttum`} />
    </AuthLayout>
  );
}
