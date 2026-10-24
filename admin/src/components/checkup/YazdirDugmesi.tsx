"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";

/** Tarayıcının yazdırma penceresini açar; kâğıtta görünmez. */
export function YazdirDugmesi() {
  return (
    <Button size="xs" startIcon={<Printer />} onClick={() => window.print()} className="print:hidden">
      Yazdır
    </Button>
  );
}
