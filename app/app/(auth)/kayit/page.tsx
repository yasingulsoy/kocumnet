import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthHeading } from "../AuthHeading";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/panel");

  return (
    <>
      <AuthHeading title="Hesabını oluştur" description="Bir dakika sürer. İlk check-up'ın hemen ardından." />

      <RegisterForm />

      <p className="mt-8 text-center text-sm text-gray-700">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-medium text-brand-500 hover:text-brand-600">
          Giriş yap
        </Link>
      </p>
    </>
  );
}
