"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * Sonucu yazdır / PDF olarak kaydet. Veli ya da öğretmenle paylaşmanın en
 * kısa yolu: tarayıcının "PDF olarak kaydet" seçeneği. Yazdırma düzeninde
 * kenar çubuğu, üst ve alt çubuk (kitin çerçevesi) ve bu düğme gizlenir.
 */
export function PrintButton() {
  return (
    <Button variant="outline" size="xs" className="print:hidden" startIcon={<Printer />} onClick={() => window.print()}>
      Yazdır / PDF
    </Button>
  );
}
