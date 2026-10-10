import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/ui/logo";
import { TanismaForm } from "./TanismaForm";

export const metadata: Metadata = { title: "Tanışalım" };

/**
 * Tanışma — panelin dışında, tam ekran.
 *
 * Koç bir öğrenciyle önce tanışır: hangi sınav, hangi sınıf, kaç net hedef.
 * Bu üç cevap olmadan söylenebilecek hiçbir şey yok; katalog da, koçluk
 * metinleri de buna göre şekilleniyor. Sekme çubuğu ve kenar çubuğu bilerek
 * yok: tek işi olan bir ekran (üstte yalnızca logo).
 */
export default async function TanismaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  return (
    <div className="flex min-h-svh flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      </header>

      <main className="animate-rise mx-auto w-full max-w-lg flex-1 px-4 pt-8 pb-10 sm:px-6">
        <p className="text-theme-xs font-semibold tracking-widest text-brand-500 uppercase">Tanışalım</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-balance text-gray-800">
          Merhaba {user.name.split(" ")[0]}, hangi sınava hazırlanıyorsun?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
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
