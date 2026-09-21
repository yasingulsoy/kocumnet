import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/ui";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-ink">
          Matematik seviyeni ölç
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Kısa bir testle zayıf konularını gör. Ücretsiz.
        </p>
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-ink-soft">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-semibold text-brand hover:underline">
          Giriş yap
        </Link>
      </p>
    </main>
  );
}
