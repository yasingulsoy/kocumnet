/*
 * Uyarlama: TailAdmin Free (MIT) — app/[locale]/(full-width-pages)/(error-pages)/error-404/page.tsx
 *
 * Tam ekran hata sayfası: köşelerde ızgara, ortada büyük kod (TailAdmin'in
 * 404.svg çizimi yerine marka mavisinde Poppins rakamlar), başlık, açıklama,
 * eylemler; en altta küçük not. Koyu sürüm yok.
 *
 * `embedded`: sitenin kendi düzeninde (başlık ile altbilgi arasında). Tam
 * ekran değil; kök öğe <main> olur ve id almaz (düzen "içeriğe geç" hedefini
 * kendisi verir). `code={null}`: büyük rakam yok (genel hata sayfası, ikon
 * `top`'ta). `children`: eylemlerin altında ek içerik (önerilen sayfalar).
 *
 *   <ErrorPage code="404" title="Sayfa bulunamadı" message="…" actions={<ButtonLink href="/">Ana sayfa</ButtonLink>} />
 */
import type { ReactNode } from "react";
import { cx } from "../cx";
import { GridShape } from "../ui/GridShape";

export interface ErrorPageProps {
  /** null: kod çizilmez. */
  code?: string | null;
  title: ReactNode;
  message?: ReactNode;
  actions?: ReactNode;
  /** Kodun üstünde (logo gibi). */
  top?: ReactNode;
  /** Sayfanın en altında küçük not. */
  footer?: ReactNode;
  /** Eylemlerin altında ek içerik. */
  children?: ReactNode;
  /** true: site düzeninin içinde (tam ekran değil, <main> id'siz). */
  embedded?: boolean;
}

export function ErrorPage({ code = "404", title, message, actions, top, footer, children, embedded = false }: ErrorPageProps) {
  const icerik = (
    <>
      {top ? <div className="mb-10 flex justify-center">{top}</div> : null}
      {code ? (
        <p aria-hidden className="tabular font-display text-[6.5rem] leading-none font-bold tracking-tight text-brand-500 sm:text-[9.5rem]">
          {code}
        </p>
      ) : null}
      <h1 className={cx(code && "mt-6", "font-display text-title-sm font-bold text-gray-800 xl:text-title-md")}>{title}</h1>
      {message ? <p className="mt-4 mb-8 text-base text-gray-700 sm:text-lg">{message}</p> : <div className="mb-8" />}
      {actions ? <div className="flex flex-wrap justify-center gap-3">{actions}</div> : null}
      {children}
    </>
  );

  if (embedded) {
    return (
      <main className="relative z-1 flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-16 sm:py-24">
        <GridShape />
        <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">{icerik}</div>
        {footer ? <p className="mt-10 text-center text-sm text-gray-500">{footer}</p> : null}
      </main>
    );
  }

  return (
    <div className="relative z-1 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white p-6">
      <GridShape />
      <main id="icerik" className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
        {icerik}
      </main>
      {footer ? <p className="absolute inset-x-0 bottom-6 text-center text-sm text-gray-500">{footer}</p> : null}
    </div>
  );
}
