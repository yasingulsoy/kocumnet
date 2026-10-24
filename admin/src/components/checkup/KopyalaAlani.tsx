"use client";

import { useRef } from "react";
import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * Salt okunur alan + "Kopyala": davet bağlantısı ve parola sıfırlama
 * bağlantısı. Pano izni yoksa (http, eski tarayıcı) alan seçili hâle gelir,
 * koç elle kopyalar; tıklayınca da bütünü seçilir (yarım bağlantı gitmesin).
 */
export function KopyalaAlani({ etiket, deger, ipucu }: { etiket: string; deger: string; ipucu?: string }) {
  const alan = useRef<HTMLInputElement>(null);
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(deger);
      toast.success("Kopyalandı.");
    } catch {
      alan.current?.focus();
      alan.current?.select();
      toast.error("Tarayıcı panoya kopyalamaya izin vermedi; seçili metni kendin kopyala.");
    }
  };
  return (
    <Field label={etiket} hint={ipucu}>
      <div className="flex gap-2">
        <Input
          ref={alan}
          value={deger}
          readOnly
          compact
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-theme-xs"
          spellCheck={false}
        />
        <Button variant="outline" size="xs" startIcon={<Copy />} onClick={kopyala} className="shrink-0">
          Kopyala
        </Button>
      </div>
    </Field>
  );
}
