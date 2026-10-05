import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { staffDurumu } from "@/lib/admin/auth";
import { getSummary } from "@/lib/admin/data";
import { MANAGE_ROLES } from "@/lib/admin/types";

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
        <Notice tone="warn" title="Kimlik sunucusuna ulaşılamadı">
          Güvenlik gereği oturum doğrulanmadan hiçbir veri gösterilmiyor. Birkaç dakika sonra sayfayı yenile.
        </Notice>
      </main>
    );
  }

  // Kenar çubuğundaki "yeni mesaj" sayısı — alınamazsa sessizce gösterilmez.
  // getSummary istek başına bir kez çalışır; genel bakış aynı sonucu kullanır.
  let unread: number | undefined;
  if (MANAGE_ROLES.includes(d.staff.role)) {
    try {
      unread = (await getSummary()).messages?.unread;
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
