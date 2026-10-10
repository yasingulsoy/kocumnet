import type { Metadata } from "next";
import { ArrowUpRight, LogOut } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { PasswordDialogButton } from "@/components/admin/PasswordForm";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { ProfileCard } from "@/components/tailadmin/profile/ProfileCard";
import { SettingRow, SettingsCard } from "@/components/tailadmin/profile/SettingsCard";
import { logoutOthersAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Hesabım" };

const CHECKUP_ADMIN_URL = process.env.NEXT_PUBLIC_CHECKUP_ADMIN_URL ?? "https://admin.kocum.net";

/** Hesabım — TailAdmin'in profil sayfası: kişi kartı, güvenlik ve bağlantılar. */
export default async function HesabimPage() {
  const { staff } = await requireStaff(undefined, "/admin/hesabim");

  return (
    <>
      <PageBreadcrumb pageTitle="Hesabım" description="Oturum ve parola. Ad, e-posta gibi bilgiler için bir yöneticiye yaz." />

      <div className="space-y-6">
        <ProfileCard
          name={staff.name}
          badges={<Badge size="sm">{ROLE_LABEL[staff.role]}</Badge>}
          meta={[staff.email, "Site yönetimi ve check-up paneli"]}
          details={[
            { label: "Ad soyad", value: staff.name },
            { label: "E-posta", value: staff.email },
            { label: "Rol", value: ROLE_DESCRIPTION[staff.role] },
          ]}
        />

        <SettingsCard title="Güvenlik">
          <SettingRow
            title="Parola"
            description="Değişiklikten sonra diğer cihazlardaki oturumlar kapanır; bu cihaz açık kalır."
            action={<PasswordDialogButton />}
          />
          <SettingRow
            title="Oturumlar"
            description="Telefonunu kaybettiysen ya da ortak bir bilgisayarda açık bıraktıysan: diğer bütün cihazlarda (iki panelde de) çıkış yapılır, bu cihaz açık kalır. Parolan değişmez."
            action={
              <ActionButton
                action={logoutOthersAction}
                icon={<LogOut aria-hidden />}
                confirm={{
                  title: "Diğer bütün cihazlardaki oturumların kapatılsın mı?",
                  description: "Bu cihaz açık kalır; parolan değişmez.",
                  confirmLabel: "Diğer cihazlardan çıkış yap",
                  tone: "warning",
                }}
              >
                Diğer cihazlardan çıkış yap
              </ActionButton>
            }
          />
        </SettingsCard>

        <SettingsCard title="Bağlantılar">
          <SettingRow
            title="Check-up paneli"
            description="Soru havuzu, paketler ve öğrenciler ayrı panelde. Aynı hesapla girilir."
            action={
              <ButtonLink href={CHECKUP_ADMIN_URL} variant="outline" size="xs" endIcon={<ArrowUpRight />}>
                admin.kocum.net
              </ButtonLink>
            }
          />
        </SettingsCard>
      </div>
    </>
  );
}
