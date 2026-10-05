import Link from "next/link";
import { Compass } from "lucide-react";
import { Card, buttonClass } from "@/components/checkup/ui";

/**
 * Silinmiş ya da yanlış kimlikli soru/öğrenci. Panel çerçevesi içinde
 * çizilir; kök 404 sayfası kenar çubuğunu da götürüyordu.
 */
export default function CheckupNotFound() {
  return (
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand-wash text-brand">
        <Compass className="size-6" aria-hidden />
      </span>
      <h1 className="font-display mt-4 text-h2 font-semibold text-ink">Kayıt bulunamadı</h1>
      <p className="mt-2 text-body text-ink-soft">
        Aradığın soru, öğrenci ya da sayfa yok. Bağlantı eskimiş ya da kimlik yanlış kopyalanmış
        olabilir — soruları listede <span className="font-medium text-ink">#kimlik</span> ile
        arayabilirsin.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/checkup/sorular" className={buttonClass("primary", "sm")}>
          Sorular
        </Link>
        <Link href="/checkup" className={buttonClass("outline", "sm")}>
          Genel bakış
        </Link>
      </div>
    </Card>
  );
}
