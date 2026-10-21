"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * Kitapçığı yazdır ya da tarayıcının "PDF olarak kaydet" seçeneğiyle indir.
 * Ayrı bir PDF üretici yok: tarayıcının yazdırma motoru KaTeX'i ve görselleri
 * ekranda nasıl görünüyorsa öyle basıyor, sunucuda ek bağımlılık gerekmiyor.
 */
export function YazdirDugmesi() {
  return (
    <Button size="sm" startIcon={<Printer />} onClick={() => window.print()}>
      Yazdır / PDF olarak kaydet
    </Button>
  );
}
