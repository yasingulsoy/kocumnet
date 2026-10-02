import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function SifremiUnuttumPage() {
  return (
    <>
      <h1 className="font-display text-h2 font-bold tracking-tight text-ink">Parolanı sıfırla</h1>
      <p className="mt-1.5 text-body text-ink-soft">
        Hesabının e-postasını yaz; kayıtlıysa bir saat geçerli bir bağlantı göndeririz.
      </p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-caption">
        <Link href="/admin/giris" className="font-medium text-brand hover:underline">
          Girişe dön
        </Link>
      </p>
    </>
  );
}
