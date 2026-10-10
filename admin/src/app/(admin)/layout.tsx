import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { GateNotice } from "@/components/checkup/GateNotice";
import { AdminShell } from "@/components/shell/AdminShell";

/**
 * Panel düzeni: oturumu SUNUCUDA doğrular, personel bilgisini çerçeveye verir.
 *
 * Eskiden bu düzen bir istemci bileşeniydi: oturumu tarayıcıdan bir kez daha
 * soruyor, cevap gelene kadar dönen halka gösteriyor ve girişsizleri
 * istemci tarafında yönlendiriyordu. Şimdi tek tur: çerez yoksa doğrudan
 * /signin.
 *
 * ⚠️ Bu denetim sayfaların KENDİ denetiminin yerine geçmez: Next sayfayı
 * düzenle paralel çizebilir. Her sayfa checkStaff() çağırmaya devam eder
 * (React cache sayesinde istek başına tek backend çağrısı).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await checkStaff(ANY_STAFF);

  if (!gate.ok) {
    if (gate.reason === "no-session") redirect("/signin");
    return (
      <main id="icerik" className="min-h-screen bg-gray-50 px-4 py-10">
        <GateNotice gate={gate} roles={ANY_STAFF} />
      </main>
    );
  }

  return <AdminShell staff={gate.staff}>{children}</AdminShell>;
}
