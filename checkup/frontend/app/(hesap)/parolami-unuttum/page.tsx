import type { Metadata } from "next";
import Link from "next/link";
import { SifirlamaIstekFormu } from "./SifirlamaIstekFormu";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function ParolamiUnuttumSayfasi() {
  return (
    <>
      <h1 className="font-display text-h1 font-semibold text-gray-800">Parolanı mı unuttun?</h1>
      <p className="mt-2 text-body text-gray-600">E-postanı yaz, parolanı yenilemen için bir bağlantı gönderelim.</p>
      <div className="mt-8">
        <SifirlamaIstekFormu />
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        Hatırladın mı?{" "}
        <Link href="/giris" className="font-medium text-brand-500 hover:text-brand-600 hover:underline">
          Giriş yap
        </Link>
      </p>
    </>
  );
}
