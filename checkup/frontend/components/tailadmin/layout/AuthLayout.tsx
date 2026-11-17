/*
 * Uyarlama: TailAdmin Free (MIT) — app/[locale]/(full-width-pages)/(auth)/layout.tsx
 * ve components/auth/SignInForm.tsx'in sütun düzeni
 *
 * Masaüstünde iki yarım: form sütunu (başında geri bağlantısı, ortada en
 * fazla 448px form) ve marka paneli (bg-brand-950 = logodaki lacivert,
 * köşelerde ızgara). Telefonda panel gizlenir, form tam genişlik. Tema
 * düğmesi yok. Arapça sayfada sütunlar kendiliğinden yer değiştirir.
 *
 *   <AuthLayout top={<GeriBaglantisi />} aside={<MarkaPaneli />} bottom={<Altbilgi />}>
 *     <h1>…</h1><form>…</form>
 *   </AuthLayout>
 */
import type { ReactNode } from "react";
import { cx } from "../cx";
import { GridShape } from "../ui/GridShape";

export interface AuthLayoutProps {
  children: ReactNode;
  /** Marka panelinin içi (logo, kısa metin). Yoksa panel çizilmez. */
  aside?: ReactNode;
  /** Formun üstü: "← siteye dön" bağlantısı, mobil logo. */
  top?: ReactNode;
  /** Formun altı: küçük altbilgi. */
  bottom?: ReactNode;
  className?: string;
}

export function AuthLayout({ children, aside, top, bottom, className }: AuthLayoutProps) {
  return (
    <div className={cx("relative z-1 min-h-screen bg-white", className)}>
      <div className="relative flex min-h-screen w-full flex-col lg:flex-row">
        <div className="flex w-full flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:w-1/2">
          {top ? <div className="mx-auto mb-5 w-full max-w-md sm:pt-4">{top}</div> : null}
          <main id="icerik" className="animate-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
            {children}
          </main>
          {bottom ? <div className="mx-auto mt-6 w-full max-w-md">{bottom}</div> : null}
        </div>
        {aside ? (
          <aside className="relative z-1 hidden w-full items-center overflow-hidden bg-brand-950 lg:sticky lg:top-0 lg:grid lg:h-screen lg:w-1/2">
            <GridShape />
            <div className="relative z-1 flex flex-col items-center justify-center px-10 py-14 xl:px-16">{aside}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
