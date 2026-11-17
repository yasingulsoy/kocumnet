import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

/** Rolü yetmeyen yönetici sayfaya doğrudan gelirse (menüde zaten görünmez). */
export function YetkiYok({ aciklama }: { aciklama?: string }) {
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Bu sayfa için yetkiniz yok</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        {aciklama ?? "Bu bölümü yalnızca YÖNETİCİ rolündeki hesaplar görebilir. Erişim gerekiyorsa bir yöneticiye başvurun."}
      </p>
      <div className="mt-5">
        <ButtonLink href="/" size="xs" variant="outline">
          Panoya dön
        </ButtonLink>
      </div>
    </div>
  );
}
