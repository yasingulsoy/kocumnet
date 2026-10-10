"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import type { FormState } from "@/lib/admin/types";
import { cx } from "@/components/tailadmin/cx";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/tailadmin/ui/Button";
import { useConfirm, type ConfirmOptions } from "@/components/tailadmin/ui/Dialogs";

/**
 * Tek tıklık işlemler (yayınla, arşivle, sil). Sunucu action'ı çağırır,
 * sonucu küçük bir durum satırında gösterir. Geri alınamaz işler için
 * `confirm`: kitin onay penceresi (eskiden window.confirm). Metin verilirse
 * başlık olur; ayrıntı için { title, description, confirmLabel, tone }.
 */
export function ActionButton({
  action,
  confirm,
  children,
  icon,
  variant = "outline",
  size = "xs",
  className,
  onDone,
}: {
  action: () => Promise<FormState | void>;
  confirm?: string | ConfirmOptions;
  children: ReactNode;
  /** Düğme simgesi; işlem sürerken yerini dönen halka alır. */
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onDone?: (r: FormState | void) => void;
}) {
  const [pending, start] = useTransition();
  const [mesaj, setMesaj] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [onayPenceresi, onayla] = useConfirm();
  const router = useRouter();

  async function tikla() {
    if (confirm && !(await onayla(typeof confirm === "string" ? { title: confirm } : confirm))) return;
    setMesaj(null);
    start(async () => {
      let r: FormState | void;
      try {
        r = await action();
      } catch (e) {
        // Yönlendirme (ör. silindikten sonra listeye) Next'e kalır; ağ
        // kopması sayfayı hata ekranına düşürmesin, düğmenin altında yazsın.
        unstable_rethrow(e);
        setMesaj({ tone: "bad", text: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." });
        return;
      }
      if (r && r.error) setMesaj({ tone: "bad", text: r.error });
      else if (r && r.message) setMesaj({ tone: "ok", text: r.message });
      onDone?.(r);
      router.refresh();
    });
  }

  return (
    <span className={cx("inline-flex flex-col items-start gap-1", className)}>
      <Button variant={variant} size={size} loading={pending} startIcon={icon} onClick={tikla}>
        {children}
      </Button>
      {mesaj ? (
        <span role="status" className={cx("text-theme-xs", mesaj.tone === "ok" ? "text-success-700" : "text-error-600")}>
          {mesaj.text}
        </span>
      ) : null}
      {onayPenceresi}
    </span>
  );
}
