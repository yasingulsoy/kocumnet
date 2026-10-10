import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../AuthHeading";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function SifremiUnuttumPage() {
  return (
    <>
      <AuthHeading
        title="Parolanı sıfırla"
        description="Hesabının e-postasını yaz; kayıtlıysa bir saat geçerli bir bağlantı göndeririz."
      />
      <ForgotForm />
      <p className="mt-5 text-center text-sm text-gray-700 sm:text-start">
        Parolanı hatırladın mı?{" "}
        <Link href="/admin/giris" className="text-brand-500 hover:text-brand-600">
          Girişe dön
        </Link>
      </p>
    </>
  );
}
