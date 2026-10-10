import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { AuthHeading } from "../AuthHeading";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  if (await getCurrentUser()) redirect("/panel");
  const sp = await searchParams;

  return (
    <>
      <AuthHeading
        title="Tekrar hoş geldin"
        description="Konu haritana ve geçmiş testlerine kaldığın yerden devam et."
      />

      <div className="space-y-5">
        {sp.sifirlandi ? (
          <Alert variant="success">Parolan değiştirildi. Yeni parolanla giriş yapabilirsin.</Alert>
        ) : null}
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-sm text-gray-700">
        Hesabın yok mu?{" "}
        <Link href="/kayit" className="font-medium text-brand-500 hover:text-brand-600">
          Ücretsiz hesap oluştur
        </Link>
      </p>
    </>
  );
}
