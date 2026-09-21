import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Alert, Wordmark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const sp = await searchParams;
  // Zaten girişliyse formu göstermek kafa karıştırır.
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-ink">
          Tekrar hoş geldin
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Check-up geçmişine ve seviye haritana erişmek için giriş yap.
        </p>
      </div>

      {sp.sifirlandi ? (
        <div className="mb-4">
          <Alert tone="ok">Parolan değiştirildi. Yeni parolanla giriş yapabilirsin.</Alert>
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-4 text-center text-sm">
        <Link href="/sifremi-unuttum" className="text-ink-soft hover:text-ink hover:underline">
          Parolamı unuttum
        </Link>
      </p>

      <p className="mt-3 text-center text-sm text-ink-soft">
        Hesabın yok mu?{" "}
        <Link href="/kayit" className="font-semibold text-brand hover:underline">
          Ücretsiz hesap oluştur
        </Link>
      </p>
    </main>
  );
}
