/*
 * Uyarlama: TailAdmin Free (MIT) — TailAdmin'de karşılığı yok; kartların ve
 * tabloların boş hâli için kitin tipografisi ve renkleriyle yazıldı.
 */
import type { ReactNode } from "react";
import { cx } from "../cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-base font-semibold text-gray-800">{title}</p>
      {description ? <div className="mt-1 max-w-md text-sm text-gray-500">{description}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
