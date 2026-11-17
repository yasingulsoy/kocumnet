import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { oturumluOgrenci } from "@/lib/backend";
import { KayitFormu } from "./KayitFormu";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function KayitSayfasi() {
  if (await oturumluOgrenci()) redirect("/panel");

  return (
    <>
      <h1 className="font-display text-h1 font-semibold text-gray-800">Ücretsiz kayıt ol</h1>
      <p className="mt-2 text-body text-gray-600">Bir dakikada hesabını aç, ilk check-up&apos;ını hemen başlat.</p>
      <div className="mt-8">
        <KayitFormu />
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        Hesabın var mı?{" "}
        <Link href="/giris" className="font-medium text-brand-500 hover:text-brand-600 hover:underline">
          Giriş yap
        </Link>
      </p>
    </>
  );
}
