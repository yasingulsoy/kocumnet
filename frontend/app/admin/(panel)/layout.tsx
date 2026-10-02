import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { staffDurumu } from "@/lib/admin/auth";
import { listMessages } from "@/lib/admin/data";
import { MANAGE_ROLES } from "@/lib/admin/types";

/**
 * Panel düzeni: oturumu sunucuda doğrular, personeli çerçeveye verir.
 * ⚠️ Sayfalar kendi denetimini de yapar (requireStaff): Next sayfayı düzenle
 * paralel çizebilir; buradaki yönlendirme yalnızca kullanıcı deneyimi için.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const d = await staffDurumu();
  if (d.kind === "none") redirect("/admin/giris");
  if (d.kind === "unreachable") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Notice tone="warn" title="Kimlik sunucusuna ulaşılamadı">
          Güvenlik gereği oturum doğrulanmadan hiçbir veri gösterilmiyor. Birkaç dakika sonra sayfayı yenile.
        </Notice>
      </main>
    );
  }

  // Kenar çubuğundaki "yeni mesaj" sayısı — alınamazsa sessizce gösterilmez.
  let unread: number | undefined;
  if (MANAGE_ROLES.includes(d.staff.role)) {
    try {
      unread = (await listMessages({ status: "new" })).unread;
    } catch {
      unread = undefined;
    }
  }

  return (
    <AdminShell staff={d.staff} unread={unread}>
      {children}
    </AdminShell>
  );
}
