"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Sonucu yazdır / PDF olarak kaydet. Veli ya da öğretmenle paylaşmanın en
 * kısa yolu: tarayıcının "PDF olarak kaydet" seçeneği. Yazdırma düzeninde
 * kenar çubuğu, alt menü ve bu düğme gizlenir (print: sınıfları).
 */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer /> Yazdır / PDF
    </Button>
  );
}
