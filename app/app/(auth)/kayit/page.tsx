import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/panel");

  return (
    <>
      <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Hesabını oluştur</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Bir dakika sürer. İlk check-up&apos;ın hemen ardından.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-semibold text-brand hover:underline">
          Giriş yap
        </Link>
      </p>
    </>
  );
}
