import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  if (await getCurrentUser()) redirect("/panel");
  const sp = await searchParams;

  return (
    <>
      <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Tekrar hoş geldin</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Konu haritana ve geçmiş testlerine kaldığın yerden devam et.
      </p>

      {sp.sifirlandi ? (
        <Alert tone="ok" className="mt-6">
          Parolan değiştirildi. Yeni parolanla giriş yapabilirsin.
        </Alert>
      ) : null}

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Hesabın yok mu?{" "}
        <Link href="/kayit" className="font-semibold text-brand hover:underline">
          Ücretsiz hesap oluştur
        </Link>
      </p>
    </>
  );
}
