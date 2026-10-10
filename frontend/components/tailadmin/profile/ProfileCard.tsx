/*
 * Uyarlama: TailAdmin Free (MIT) — components/user-profile/UserMetaCard.tsx
 * (+ UserAddressCard.tsx'in etiket/değer ızgarası)
 *
 * Kişi kartı: büyük avatar, ad, ince çizgiyle ayrılmış alt bilgiler (rol,
 * e-posta), sağda eylemler; altta etiket/değer ızgarası. TailAdmin'in
 * sabit örnek verisi ve düzenleme modalı yok: eylemler prop'la gelir.
 */
import { Fragment, type ReactNode } from "react";
import { cx } from "../cx";
import { Avatar } from "../ui/Avatar";

export interface ProfileDetail {
  label: string;
  value: ReactNode;
}

export interface ProfileCardProps {
  name: string;
  avatarSrc?: string | null;
  /** Adın altında, aralarında dikey çizgiyle: ["Yönetici", "ayse@kocum.net"]. */
  meta?: ReactNode[];
  /** Adın yanında rozetler. */
  badges?: ReactNode;
  actions?: ReactNode;
  details?: ProfileDetail[];
  className?: string;
}

export function ProfileCard({ name, avatarSrc, meta = [], badges, actions, details = [], className }: ProfileCardProps) {
  return (
    <section className={cx("rounded-2xl border border-gray-200 bg-white p-5 lg:p-6", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center lg:gap-6">
          <span className="rounded-full border border-gray-200 p-0.5">
            <Avatar src={avatarSrc} name={name} size="huge" decorative />
          </span>
          <div className="min-w-0 text-start">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold break-words text-gray-800">{name}</h2>
              {badges}
            </div>
            {meta.length ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {meta.map((m, i) => (
                  <Fragment key={i}>
                    {i > 0 ? <span aria-hidden className="hidden h-3.5 w-px bg-gray-300 sm:block" /> : null}
                    <span className="text-sm break-all text-gray-500">{m}</span>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {details.length ? (
        <dl className="mt-6 grid grid-cols-1 gap-5 border-t border-gray-100 pt-6 sm:grid-cols-2 xl:grid-cols-3">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="mb-2 text-xs leading-normal text-gray-500">{d.label}</dt>
              <dd className="text-sm font-medium break-words text-gray-800">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
