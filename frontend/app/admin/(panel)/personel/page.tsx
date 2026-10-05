import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, Forbidden, Notice, PageHeader, Pill, relative } from "@/components/admin/ui";
import { InviteForm } from "@/components/admin/StaffForms";
import { StaffStatusPill } from "@/components/admin/StaffStatusPill";
import { requireStaff, staffDurumu } from "@/lib/admin/auth";
import { listStaff } from "@/lib/admin/data";
import { MANAGE_ROLES, ROLE_LABEL, staffName } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelPage({ searchParams }: PageProps<"/admin/personel">) {
  const { staff, allowed } = await requireStaff(MANAGE_ROLES, "/admin/personel");
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;
  const d = await staffDurumu();
  const mailAcik = d.kind === "ok" && d.mail;

  const sp = await searchParams;
  const kisiler = await listStaff();
  const yonetici = staff.role === "admin";

  return (
    <>
      <PageHeader title="Personel" description="Her iki panele de bu hesaplarla girilir: kocum.net/admin ve admin.kocum.net." />
      {sp.silindi === "1" ? <Notice tone="ok" className="mb-4">Hesap silindi.</Notice> : null}

      <div className={yonetici ? "grid gap-6 xl:grid-cols-[1fr_380px]" : ""}>
        <Card>
          {kisiler.length === 0 ? (
            <EmptyState title="Personel yok" />
          ) : (
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kişi</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th>Son giriş</th>
                  </tr>
                </thead>
                <tbody>
                  {kisiler.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/admin/personel/${u.id}`} className="font-medium text-ink hover:text-brand">
                          {staffName(u)}
                          {u.id === staff.id ? <span className="ms-1.5 text-micro text-ink-faint">(sen)</span> : null}
                        </Link>
                        <p className="mt-0.5 text-micro text-ink-faint">{u.email}</p>
                      </td>
                      <td><Pill tone={u.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[u.role]}</Pill></td>
                      <td>
                        <StaffStatusPill user={u} />
                      </td>
                      <td className="whitespace-nowrap text-ink-faint">{u.last_login ? relative(u.last_login) : "hiç girmedi"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {yonetici ? (
          <Card className="self-start p-5">
            <h2 className="font-display text-body font-semibold text-ink">Yeni personel</h2>
            <p className="mt-0.5 text-caption text-ink-soft">
              {mailAcik
                ? "Kişiye parola belirleme bağlantısı e-postayla gider; parola kimsenin elinden geçmez."
                : "E-posta gönderimi kapalı (SMTP_URL yok): hesap geçici parolayla açılır."}
            </p>
            <div className="mt-4">
              <InviteForm mailAcik={mailAcik} />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
