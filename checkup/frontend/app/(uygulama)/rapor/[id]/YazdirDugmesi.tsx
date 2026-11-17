"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * "Yazdır" düğmesi. Yazdırırken kapalı <details> bölümleri (kazanım
 * ayrıntısı) açılır, bitince eski hâline döner: kapalı bölüm baskıda boş çıkar.
 */
export function YazdirDugmesi() {
  useEffect(() => {
    let acilanlar: HTMLDetailsElement[] = [];
    const once = () => {
      acilanlar = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
      for (const d of acilanlar) d.open = true;
    };
    const sonra = () => {
      for (const d of acilanlar) d.open = false;
      acilanlar = [];
    };
    window.addEventListener("beforeprint", once);
    window.addEventListener("afterprint", sonra);
    return () => {
      window.removeEventListener("beforeprint", once);
      window.removeEventListener("afterprint", sonra);
    };
  }, []);

  return (
    <Button variant="outline" onClick={() => window.print()} startIcon={<Printer />}>
      Yazdır
    </Button>
  );
}
