import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, KeyRound, LogOut, Send, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { StaffEditForm } from "@/components/admin/StaffForms";
import { StaffStatusPill } from "@/components/admin/StaffStatusPill";
import { Forbidden, remaining, trDate } from "@/components/admin/ui";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { deleteStaffAction, resendInviteAction, revokeSessionsAction } from "@/lib/admin/actions";
import { requireStaff, staffDurumu } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getStaffUser } from "@/lib/admin/data";
import { MANAGE_ROLES, ROLE_LABEL, staffName, staffStatus } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelDetayPage({ params }: PageProps<"/admin/personel/[id]">) {
  const { id } = await params;
  const { staff, allowed } = await requireStaff(MANAGE_ROLES, `/admin/personel/${encodeURIComponent(id)}`);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;
  const d = await staffDurumu();
  const mailAcik = d.kind === "ok" && d.mail;

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
  const durum = staffStatus(u);
  const erisimMetni =
    durum === "active" || durum === "inactive"
      ? "Kişi parolasını unuttuysa sıfırlama bağlantısı gönder; 1 saat geçerli."
      : durum === "invited"
        ? `Henüz parola belirlemedi. Davet bağlantısının süresi: ${remaining(u.invite_expires_at) ?? "az kaldı"}.`
        : "Davetin süresi doldu ya da hiç gönderilemedi; kişi bu hâliyle giriş yapamaz. Yeniden gönder (72 saat geçerli).";

  return (
    <>
      <PageBreadcrumb
        pageTitle={staffName(u)}
        crumbs={[{ href: "/admin/personel", label: "Personel" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge size="sm" color={u.role === "admin" ? "primary" : "light"}>
              {ROLE_LABEL[u.role]}
            </Badge>
            <StaffStatusPill user={u} />
            <span>
              eklendi {trDate(u.created_at)} · son giriş {u.last_login ? trDate(u.last_login, { time: true }) : "yok"}
            </span>
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <ComponentCard title="Hesap bilgileri">
          <StaffEditForm user={u} me={staff} />
        </ComponentCard>

        {yonetici ? (
          <div className="space-y-6">
            <ComponentCard title="Erişim">
              <p className={durum === "invite_expired" ? "text-theme-sm text-error-600" : "text-theme-sm text-gray-500"}>{erisimMetni}</p>
              <div>
                <ActionButton action={resendInviteAction.bind(null, u.id)} icon={u.has_password ? <KeyRound aria-hidden /> : <Send aria-hidden />}>
                  {u.has_password ? "Sıfırlama bağlantısı gönder" : "Daveti yeniden gönder"}
                </ActionButton>
                {!mailAcik ? <p className="mt-2 text-theme-xs text-warning-700">E-posta gönderimi kapalı; bu düğme çalışmaz.</p> : null}
              </div>
              {!kendisi && u.has_password ? (
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-theme-sm text-gray-500">Kayıp cihaz ya da işten ayrılma: açık oturumların hepsini kapat (iki panelde de).</p>
                  <div className="mt-3">
                    <ActionButton
                      action={revokeSessionsAction.bind(null, u.id)}
                      icon={<LogOut aria-hidden />}
                      confirm={{
                        title: `${staffName(u)} bütün cihazlardan çıkarılsın mı?`,
                        description: "Açık oturumların hepsi kapanır (iki panelde de); kişi yeniden giriş yapabilir.",
                        confirmLabel: "Oturumlarını kapat",
                        tone: "warning",
                      }}
                    >
                      Oturumlarını kapat
                    </ActionButton>
                  </div>
                </div>
              ) : null}
            </ComponentCard>

            <ComponentCard title="Etkinlik" desc="Bu kişinin girişleri ve yaptığı işlemler.">
              <Link
                href={`/admin/etkinlik?kisi=${u.id}`}
                className="inline-flex items-center gap-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
              >
                Etkinliği gör <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </ComponentCard>

            {!kendisi ? (
              <ComponentCard
                tone="danger"
                title="Hesabı sil"
                desc="Geri alınamaz. Yazıları olan bir yazarı silmek yerine pasife almak genellikle daha doğru."
              >
                <ActionButton
                  action={deleteStaffAction.bind(null, u.id)}
                  variant="danger-outline"
                  icon={<Trash2 aria-hidden />}
                  confirm={{
                    title: `${staffName(u)} hesabı kalıcı olarak silinsin mi?`,
                    description: "Bu işlem geri alınamaz. Pasife almak hesabı ve geçmişini korur.",
                    confirmLabel: "Hesabı sil",
                    tone: "danger",
                  }}
                >
                  Hesabı sil
                </ActionButton>
              </ComponentCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
