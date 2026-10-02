import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound, Send, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { StaffEditForm } from "@/components/admin/StaffForms";
import { Card, Forbidden, PageHeader, Pill, trDate } from "@/components/admin/ui";
import { deleteStaffAction, resendInviteAction } from "@/lib/admin/actions";
import { requireStaff, staffDurumu } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getStaffUser } from "@/lib/admin/data";
import { MANAGE_ROLES, ROLE_LABEL, staffName } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelDetayPage({ params }: PageProps<"/admin/personel/[id]">) {
  const { staff, allowed } = await requireStaff(MANAGE_ROLES);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;
  const d = await staffDurumu();
  const mailAcik = d.kind === "ok" && d.mail;

  const { id } = await params;
  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  let u;
  try {
    u = await getStaffUser(sayi);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  const yonetici = staff.role === "admin";
  const kendisi = staff.id === u.id;

  return (
    <>
      <PageHeader
        title={staffName(u)}
        crumbs={[{ href: "/admin/personel", label: "Personel" }]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-caption text-ink-faint">
            <Pill tone={u.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[u.role]}</Pill>
            {!u.is_active ? <Pill tone="bad">Pasif</Pill> : !u.has_password ? <Pill tone="warn">Davet bekliyor</Pill> : <Pill tone="ok">Aktif</Pill>}
            <span>eklendi {trDate(u.created_at)} · son giriş {u.last_login ? trDate(u.last_login, { time: true }) : "yok"}</span>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          <StaffEditForm user={u} me={staff} />
        </Card>

        {yonetici ? (
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-display text-body font-semibold text-ink">Erişim</h2>
              <p className="mt-1 text-caption text-ink-soft">
                {u.has_password
                  ? "Kişi parolasını unuttuysa sıfırlama bağlantısı gönder; 1 saat geçerli."
                  : "Henüz parola belirlemedi. Davet 72 saat geçerli; dolduysa yeniden gönder."}
              </p>
              <div className="mt-4">
                <ActionButton action={resendInviteAction.bind(null, u.id)} variant="secondary" size="sm">
                  {u.has_password ? <KeyRound /> : <Send />}
                  {u.has_password ? "Sıfırlama bağlantısı gönder" : "Daveti yeniden gönder"}
                </ActionButton>
                {!mailAcik ? <p className="mt-2 text-micro text-warn">E-posta gönderimi kapalı; bu düğme çalışmaz.</p> : null}
              </div>
            </Card>

            {!kendisi ? (
              <Card className="border-bad/20 p-5">
                <h2 className="font-display text-body font-semibold text-bad">Hesabı sil</h2>
                <p className="mt-1 text-caption text-ink-soft">Geri alınamaz. Yazıları olan bir yazarı silmek yerine pasife almak genellikle daha doğru.</p>
                <div className="mt-4">
                  <ActionButton action={deleteStaffAction.bind(null, u.id)} variant="secondary" size="sm" className="text-bad ring-bad/30 hover:bg-bad-wash" confirm={`${staffName(u)} hesabı kalıcı olarak silinsin mi?`}>
                    <Trash2 /> Hesabı sil
                  </ActionButton>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
