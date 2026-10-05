import type { Metadata } from "next";
import { ArrowUpRight, LogOut } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { PasswordForm } from "@/components/admin/PasswordForm";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { logoutOthersAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Hesabım" };

const CHECKUP_ADMIN_URL = process.env.NEXT_PUBLIC_CHECKUP_ADMIN_URL ?? "https://admin.kocum.net";

export default async function HesabimPage() {
  const { staff } = await requireStaff(undefined, "/admin/hesabim");

  return (
    <>
      <PageHeader title="Hesabım" description="Oturum ve parola. Ad, e-posta gibi bilgiler için bir yöneticiye yaz." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-body font-semibold text-ink">Parolayı değiştir</h2>
          <p className="mt-1 text-caption text-ink-soft">Değişiklikten sonra diğer cihazlardaki oturumlar kapanır; bu cihaz açık kalır.</p>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">{staff.name}</h2>
            <p className="mt-0.5 text-caption text-ink-faint">{staff.email}</p>
            <div className="mt-3">
              <Pill tone="brand">{ROLE_LABEL[staff.role]}</Pill>
            </div>
            <p className="mt-3 text-caption text-ink-soft">{ROLE_DESCRIPTION[staff.role]}</p>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Oturumlar</h2>
            <p className="mt-1 text-caption text-ink-soft">
              Telefonunu kaybettiysen ya da ortak bir bilgisayarda açık bıraktıysan: diğer bütün cihazlarda (iki panelde de)
              çıkış yapılır, bu cihaz açık kalır. Parolan değişmez.
            </p>
            <div className="mt-3">
              <ActionButton action={logoutOthersAction} variant="secondary" size="sm" confirm="Diğer bütün cihazlardaki oturumların kapatılsın mı?">
                <LogOut /> Diğer cihazlardan çıkış yap
              </ActionButton>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Check-up paneli</h2>
            <p className="mt-1 text-caption text-ink-soft">Soru havuzu, paketler ve öğrenciler ayrı panelde. Aynı hesapla girilir.</p>
            <a href={CHECKUP_ADMIN_URL} className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline">
              admin.kocum.net <ArrowUpRight className="size-3.5" />
            </a>
          </Card>
        </div>
      </div>
    </>
  );
}
