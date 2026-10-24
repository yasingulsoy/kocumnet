import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { guvenliSonra, kayitKaynagi, kimlikAdresi } from "@/lib/hesap-kurallari";
import { kodGecerliMi, kodNormalize } from "@/lib/grup-katilim";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { AuthHeading } from "../AuthHeading";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Kayıt ol" };

/*
 * Adresten üç değer forma gizli alanla taşınır, üçü de burada süzülür:
 *  - `sonra`: hesap açılınca dönülecek sayfa (lib/hesap-kurallari.ts guvenliSonra),
 *  - `grup`: davet kodu (/katil/<kod> → "Hesap aç"); hesap açılınca gruba katılır,
 *  - `k`: kocum.net bağlantısının kaynak etiketi, izin listesinden.
 * Grup adı burada GÖSTERİLMEZ: kodu bilen girişsiz biri grubun adını
 * öğrenmesin; adı katılım sayfası girişten sonra söyler.
 */
export default async function RegisterPage({ searchParams }: PageProps<"/kayit">) {
  const sp = await searchParams;
  const sonra = guvenliSonra(sp.sonra);
  const k = kayitKaynagi(sp.k);
  const grupKodu = kodNormalize(Array.isArray(sp.grup) ? sp.grup[0] : sp.grup);
  const grup = kodGecerliMi(grupKodu) ? grupKodu : null;

  if (await getCurrentUser()) redirect(grup ? `/katil/${grup}` : (sonra ?? "/panel"));

  return (
    <>
      <AuthHeading title="Hesabını oluştur" description="Bir dakika sürer. İlk check-up'ın hemen ardından." />

      {grup ? (
        <Alert variant="info" className="mb-5">
          Hesabını açınca seni davet eden grubuna kendiliğinden katılacaksın.
        </Alert>
      ) : null}

      <RegisterForm sonra={sonra} grup={grup} k={k} />

      <p className="mt-8 text-center text-sm text-gray-700">
        Zaten hesabın var mı?{" "}
        <Link
          href={kimlikAdresi("/giris", { sonra: grup ? `/katil/${grup}` : sonra, k })}
          className="font-medium text-brand-500 hover:text-brand-600"
        >
          Giriş yap
        </Link>
      </p>
    </>
  );
}
