"use client";

import { useEffect } from "react";
import { cevaplariOkuduAction } from "@/lib/actions/koca-soru";

/**
 * Sayfa TARAYICIDA gösterilince koçun yeni cevaplarını "okundu" işaretler.
 *
 * Sunucuda çizerken işaretlemek yanlış olurdu: bağlantının ön yüklemesi ya
 * da yarıda kalan bir istek de "okundu" sayılırdı ve öğrenci cevabı hiç
 * görmeden ana sayfadaki kart sönerdi. Ekrandaki "Yeni" rozetleri bu
 * ziyarette kalır; bir sonraki açılışta görünmez.
 */
export function OkunduIsaretle({ ids }: { ids: string[] }) {
  const anahtar = ids.join(",");
  useEffect(() => {
    if (!anahtar) return;
    cevaplariOkuduAction(anahtar.split(",")).catch(() => {
      // Ağ hatası: bir sonraki açılışta yeniden denenir; öğrenciye söylenecek bir şey yok.
    });
  }, [anahtar]);
  return null;
}
