"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setMessageStatusAction } from "@/lib/admin/actions";
import type { MessageStatus } from "@/lib/admin/types";

/**
 * Bu sekmede kendiliğinden "okundu" yapılmış mesajlar. Modül düzeyinde:
 * sayfa yenilense (router.refresh) de bilgi kalır.
 *
 * Neden: eskiden bileşen yalnızca durum "new" iken çiziliyordu. "Okunmadı
 * yap"a basınca sayfa yenileniyor, durum "new" oluyor, bileşen yeniden
 * bağlanıp mesajı ANINDA tekrar "okundu" yapıyordu — düğme hiç çalışmıyordu.
 * Artık her mesaj bu sekmede en fazla bir kez kendiliğinden işaretlenir;
 * sonrasında karar personelin.
 */
const isaretlenenler = new Set<number>();

/**
 * Mesaj açılınca "yeni" → "okundu". Sunucu bileşeni çizim sırasında yazma
 * yapamaz (revalidate çizimde yasak); istemci bağlanınca tek sefer çağırır.
 */
export function MarkRead({ id, status }: { id: number; status: MessageStatus }) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "new" || isaretlenenler.has(id)) return;
    isaretlenenler.add(id);
    // Sayfadan çıkılmış olsa da yenilemek zararsız: kenar çubuğundaki sayı da güncellenir.
    setMessageStatusAction(id, "read")
      .then(() => router.refresh())
      .catch(() => isaretlenenler.delete(id)); // olmadıysa bir dahaki açılışta yeniden dene
  }, [id, status, router]);
  return null;
}
