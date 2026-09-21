import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Yeni parola" };

export default async function ResetPage({ params }: PageProps<"/sifre-sifirla/[token]">) {
  const { token } = await params;

  /*
   * Jetonun geçerliliğini BURADA denetlemiyoruz, bilinçli: sayfayı açmak
   * "bu jeton geçerli" bilgisini vermemeli. Geçersizse kaydetmeye çalışınca
   * anlaşılır — o da tek bir denemelik bilgi sızdırır.
   */
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-ink">
          Yeni parola belirle
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Kaydettiğinde açık olan tüm oturumların kapanır.
        </p>
      </div>

      <ResetForm token={token} />
    </main>
  );
}
