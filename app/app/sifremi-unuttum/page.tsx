import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-ink">
          Parolanı mı unuttun?
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          E-posta adresini yaz, sıfırlama bağlantısı gönderelim.
        </p>
      </div>

      <RequestResetForm />

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/giris" className="font-semibold text-brand hover:underline">
          Girişe dön
        </Link>
      </p>
    </main>
  );
}
