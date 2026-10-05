"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { FormState } from "@/lib/admin/types";
import { buttonClass, cn, type ButtonStyleProps } from "@/components/ui";

/**
 * Tek tıklık işlemler (yayınla, arşivle, sil). Sunucu action'ı çağırır,
 * sonucu küçük bir durum satırında gösterir. Sil gibi geri alınamaz işler
 * için `confirm` metni verilir.
 */
export function ActionButton({
  action,
  confirm,
  children,
  variant = "secondary",
  size = "sm",
  className,
  onDone,
}: {
  action: () => Promise<FormState | void>;
  confirm?: string;
  children: ReactNode;
  className?: string;
  onDone?: (r: FormState | void) => void;
} & ButtonStyleProps) {
  const [pending, start] = useTransition();
  const [mesaj, setMesaj] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const router = useRouter();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={cn(buttonClass({ variant, size }), className)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
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
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {children}
      </button>
      {mesaj ? (
        <span role="status" className={cn("text-micro", mesaj.tone === "ok" ? "text-ok" : "text-bad")}>
          {mesaj.text}
        </span>
      ) : null}
    </span>
  );
}
