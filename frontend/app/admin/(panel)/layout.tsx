import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { relative } from "@/components/admin/ui";
import type { NotificationItem } from "@/components/tailadmin/header/NotificationDropdown";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { staffDurumu } from "@/lib/admin/auth";
import { listMessages } from "@/lib/admin/data";
import { MANAGE_ROLES } from "@/lib/admin/types";

const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa formu" };

/**
 * Panel düzeni: oturumu sunucuda doğrular, personeli çerçeveye verir.
 *
 * Oturum yoksa burada YÖNLENDİRMİYORUZ: sayfalar kendi denetimini yapıyor
 * (requireStaff) ve girişe kendi adresleriyle gidiyor (?next=…). Düzen de
 * yönlendirseydi iki yönlendirme yarışır, kazanan çoğu zaman adressiz olan
 * olurdu: bildirim postasındaki "Panelde aç" bağlantısıyla gelen personel
 * girişten sonra mesaja değil genel bakışa düşüyordu. Çerçeve çizilmez;
 * içerik hiçbir veri göstermeden sayfanın yönlendirmesine bırakılır.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const d = await staffDurumu();
  if (d.kind === "none") return <>{children}</>;
  if (d.kind === "unreachable") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="warning" title="Kimlik sunucusuna ulaşılamadı">
          Güvenlik gereği oturum doğrulanmadan hiçbir veri gösterilmiyor. Birkaç dakika sonra sayfayı yenile.
        </Alert>
      </main>
    );
  }

  // Kenar çubuğundaki sayı ve üst çubuktaki bildirimler: okunmamış mesajlar.
  // Tek çağrı (sayı da aynı yanıtta); alınamazsa sessizce gösterilmez.
  let unread: number | undefined;
  let notifications: NotificationItem[] | undefined;
  if (MANAGE_ROLES.includes(d.staff.role)) {
    try {
      const r = await listMessages({ status: "new", limit: 5 });
      unread = r.unread;
      notifications = r.data.map((m) => ({
        id: m.id,
        href: `/admin/mesajlar/${m.id}`,
        title: m.name,
        text: m.subject ? `· ${m.subject}` : "yeni mesaj gönderdi",
        meta: `${KAYNAK[m.source] ?? m.source} · ${m.locale.toUpperCase()}`,
        time: relative(m.created_at),
        avatarName: m.name,
      }));
    } catch {
      unread = undefined;
    }
  }

  return (
    <AdminShell staff={d.staff} unread={unread} notifications={notifications}>
      {children}
    </AdminShell>
  );
}
