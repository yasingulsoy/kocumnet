import type { Metadata } from "next";
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
      <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Yeni parola belirle</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Kaydettiğinde açık olan tüm oturumların kapanır.
      </p>
      <div className="mt-8">
        <ResetForm token={token} />
      </div>
    </>
  );
}
