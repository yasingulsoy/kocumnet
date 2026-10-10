import type { Metadata } from "next";
import { AuthHeading } from "../../AuthHeading";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Yeni parola" };

export default async function ResetPage({ params }: PageProps<"/sifre-sifirla/[token]">) {
  const { token } = await params;

  /*
   * Jetonun geçerliliğini BURADA denetlemiyoruz, bilinçli: sayfayı açmak
   * "bu jeton geçerli" bilgisini vermemeli. Geçersizse kaydetmeye çalışınca
   * anlaşılır.
   */
  return (
    <>
      <AuthHeading title="Yeni parola belirle" description="Kaydettiğinde açık olan tüm oturumların kapanır." />
      <ResetForm token={token} />
    </>
  );
}
