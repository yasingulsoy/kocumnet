import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Silinmiş ya da yanlış kimlikli soru/öğrenci (`notFound()`). Panel
 * çerçevesi içinde çizilir; tam ekran 404 (kitin ErrorPage'i) çerçevenin
 * dışındaki bilinmeyen adresler için: app/not-found.tsx.
 */
export default function CheckupNotFound() {
  return (
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <Compass className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Kayıt bulunamadı</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Aradığın soru, öğrenci ya da sayfa yok. Bağlantı eskimiş ya da kimlik yanlış kopyalanmış
        olabilir — soruları listede <span className="font-medium text-gray-700">#kimlik</span> ile
        arayabilirsin.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/checkup/sorular" size="xs">
          Sorular
        </ButtonLink>
        <ButtonLink href="/checkup" variant="outline" size="xs">
          Genel bakış
        </ButtonLink>
      </div>
    </Card>
  );
}
