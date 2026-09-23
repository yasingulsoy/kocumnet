import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function ForgotPage() {
  return (
    <>
      <Link
        href="/giris"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Girişe dön
      </Link>
      <h1 className="font-display mt-6 text-[28px] font-bold tracking-tight text-ink">
        Parolanı mı unuttun?
      </h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        E-posta adresini yaz, sıfırlama bağlantısını gönderelim.
      </p>
      <div className="mt-8">
        <RequestResetForm />
      </div>
    </>
  );
}
