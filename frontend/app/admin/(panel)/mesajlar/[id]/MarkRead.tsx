"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setMessageStatusAction } from "@/lib/admin/actions";

/**
 * Mesaj açılınca "yeni" → "okundu". Sunucu bileşeni çizim sırasında yazma
 * yapamaz (revalidate çizimde yasak); istemci bağlanınca tek sefer çağırır.
 */
export function MarkRead({ id }: { id: number }) {
  const router = useRouter();
  useEffect(() => {
    let iptal = false;
    setMessageStatusAction(id, "read").then(() => {
      if (!iptal) router.refresh();
    });
    return () => {
      iptal = true;
    };
  }, [id, router]);
  return null;
}
