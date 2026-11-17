import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { oturumluOgrenci } from "@/lib/backend";
import { guvenliDonus } from "@/lib/donus";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { GirisFormu } from "./GirisFormu";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function GirisSayfasi({ searchParams }: PageProps<"/giris">) {
  const p = await searchParams;
  const donus = guvenliDonus(p.donus);
  if (await oturumluOgrenci()) redirect(donus);

  const bilgi =
    p.oturum === "bitti"
      ? { variant: "info" as const, metin: "Oturumun kapanmış. Kaldığın yerden devam etmek için yeniden giriş yap." }
      : p.sifirlandi
        ? { variant: "success" as const, metin: "Parolan yenilendi. Yeni parolanla giriş yapabilirsin." }
        : p.cikis
          ? { variant: "success" as const, metin: "Çıkış yaptın. Görüşmek üzere!" }
          : null;

  return (
    <>
      <h1 className="font-display text-h1 font-semibold text-gray-800">Giriş yap</h1>
      <p className="mt-2 text-body text-gray-600">Tekrar hoş geldin.</p>
      {bilgi ? (
        <Alert variant={bilgi.variant} compact className="mt-6">
          {bilgi.metin}
        </Alert>
      ) : null}
      <div className="mt-8">
        <GirisFormu donus={donus} />
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        Hesabın yok mu?{" "}
        <Link href="/kayit" className="font-medium text-brand-500 hover:text-brand-600 hover:underline">
          Ücretsiz kayıt ol
        </Link>
      </p>
    </>
  );
}
