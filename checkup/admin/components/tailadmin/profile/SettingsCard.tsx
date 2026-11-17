/*
 * Uyarlama: TailAdmin Free (MIT) — components/user-profile/Security.tsx + DangerZone.tsx
 *
 * Başlıklı kart + satırlar: solda başlık ve açıklama, sağda (telefonda
 * altta) eylem. Satırlar arasında ince çizgi. tone="danger": başlık ve
 * kenar kırmızı (hesabı sil gibi geri dönüşsüz işler).
 */
import type { ReactNode } from "react";
import { cx } from "../cx";

export interface SettingsCardProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  id?: string;
}

export function SettingsCard({ title, description, children, tone = "default", className, id }: SettingsCardProps) {
  return (
    <section
      id={id}
      className={cx("rounded-2xl border bg-white p-5 lg:p-6", tone === "danger" ? "border-error-200" : "border-gray-200", className)}
    >
      <div className="mb-4 lg:mb-6">
        <h2 className={cx("font-display text-lg font-semibold", tone === "danger" ? "text-error-700" : "text-gray-800")}>{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** Sağdaki düğme / anahtar / bağlantı. */
  action?: ReactNode;
  /** Açıklamanın altında ek içerik (form gibi). */
  children?: ReactNode;
}

export function SettingRow({ title, description, action, children }: SettingRowProps) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-gray-200 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <span className="mb-1 block text-base font-medium text-gray-800">{title}</span>
        {description ? <div className="text-sm text-gray-500">{description}</div> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
