import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Sayfanın tek h1'i, kısa açıklaması ve isteğe bağlı geri bağlantısı. */
export function SayfaBasligi({
  baslik,
  aciklama,
  geri,
  eylemler,
}: {
  baslik: ReactNode;
  aciklama?: ReactNode;
  geri?: { href: string; etiket: string };
  eylemler?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {geri ? (
        <Link
          href={geri.href}
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 transition hover:text-gray-800 print:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {geri.etiket}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_16rem]">
          <h1 className="font-display text-h1 font-semibold text-balance text-gray-800">{baslik}</h1>
          {aciklama ? <div className="mt-2 text-body text-gray-600">{aciklama}</div> : null}
        </div>
        {eylemler ? <div className="flex flex-wrap items-center gap-2 print:hidden">{eylemler}</div> : null}
      </div>
    </div>
  );
}
