import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/ui";
import { TanismaForm } from "./TanismaForm";

export const metadata: Metadata = { title: "Tanışalım" };

/**
 * Tanışma — panelin dışında, tam ekran.
 *
 * Koç bir öğrenciyle önce tanışır: hangi sınav, hangi sınıf, kaç net hedef.
 * Bu üç cevap olmadan söylenebilecek hiçbir şey yok; katalog da, koçluk
 * metinleri de buna göre şekilleniyor. Sekme çubuğu ve kenar çubuğu bilerek
 * yok: tek işi olan bir ekran.
 */
export default async function TanismaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  return (
    <div className="flex min-h-[100svh] flex-col bg-bg">
      <header className="px-4 pt-6 sm:px-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-6 sm:px-6">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-brand">
          Tanışalım
        </p>
        <h1 className="font-display mt-1.5 text-h1 font-bold tracking-tight text-ink text-balance">
          Merhaba {user.name.split(" ")[0]}, hangi sınava hazırlanıyorsun?
        </h1>
        <p className="mt-2 text-body text-ink-soft">
          Üç soruluk bir tanışma. Buna göre sana doğru testleri öneriyor, sonuçlarını
          doğru sınavın puanlamasıyla hesaplıyoruz.
        </p>

        <div className="mt-6">
          <TanismaForm
            mevcutSinav={user.targetExam}
            mevcutSinif={user.grade}
            mevcutHedef={user.targetNet}
          />
        </div>
      </main>
    </div>
  );
}
