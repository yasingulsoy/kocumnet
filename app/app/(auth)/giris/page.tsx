import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { guvenliSonra, kayitKaynagi, kimlikAdresi } from "@/lib/hesap-kurallari";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { AuthHeading } from "../AuthHeading";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

/*
 * `sonra`: giriş isteyen sayfa buraya kendi yoluyla yönlendirir (lib/auth.ts
 * girisAdresi); girişten sonra oraya dönülür. `k`: kocum.net'ten gelen
 * kaynak etiketi; öğrenci buradan kayda geçerse kaybolmasın. İkisi de
 * süzülerek taşınır (lib/hesap-kurallari.ts), eylem yeniden süzer.
 */
export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const sp = await searchParams;
  const sonra = guvenliSonra(sp.sonra);
  const k = kayitKaynagi(sp.k);
  if (await getCurrentUser()) redirect(sonra ?? "/panel");

  return (
    <>
      <AuthHeading
        title="Tekrar hoş geldin"
        description="Konu haritana ve geçmiş testlerine kaldığın yerden devam et."
      />

      <div className="space-y-5">
        {sp.sifirlandi ? (
          <Alert variant="success">Parolan değiştirildi. Yeni parolanla giriş yapabilirsin.</Alert>
        ) : sonra ? (
          <Alert variant="info">Giriş yapınca açmak istediğin sayfaya döneceksin.</Alert>
        ) : null}
        <LoginForm sonra={sonra} />
      </div>

      <p className="mt-8 text-center text-sm text-gray-700">
        Hesabın yok mu?{" "}
        <Link href={kimlikAdresi("/kayit", { sonra, k })} className="font-medium text-brand-500 hover:text-brand-600">
          Ücretsiz hesap oluştur
        </Link>
      </p>
    </>
  );
}
