import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

/** Panel içi 404 (silinmiş soru, yanlış kimlik): çerçeve yerinde kalır. */
export default function PanelBulunamadi() {
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Kayıt bulunamadı</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Aradığınız kayıt silinmiş ya da adres yanlış olabilir.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href="/" size="xs">
          Panoya dön
        </ButtonLink>
        <ButtonLink href="/sorular" size="xs" variant="outline">
          Soru listesi
        </ButtonLink>
      </div>
    </div>
  );
}
