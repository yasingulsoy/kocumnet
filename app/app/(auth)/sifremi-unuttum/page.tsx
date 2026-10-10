import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthHeading } from "../AuthHeading";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function ForgotPage() {
  return (
    <>
      <AuthHeading
        title="Parolanı mı unuttun?"
        description="E-posta adresini yaz, sıfırlama bağlantısını gönderelim."
      />
      <RequestResetForm />
      {/* Girişe dönüş formun altında: üstteki "Ana sayfa" bağlantısıyla iki geri oku alt alta durmasın. */}
      <p className="mt-8 text-center text-sm">
        <Link
          href="/giris"
          className="inline-flex min-h-9 items-center gap-1.5 font-medium text-brand-500 hover:text-brand-600"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> Girişe dön
        </Link>
      </p>
    </>
  );
}
