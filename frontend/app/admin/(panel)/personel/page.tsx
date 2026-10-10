import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { InviteForm } from "@/components/admin/StaffForms";
import { StaffStatusPill } from "@/components/admin/StaffStatusPill";
import { Forbidden, relative } from "@/components/admin/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
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
      <PageBreadcrumb pageTitle="Personel" description="Her iki panele de bu hesaplarla girilir: kocum.net/admin ve admin.kocum.net." />
      {sp.silindi === "1" ? (
        <Alert variant="success" className="mb-4">
          Hesap silindi.
        </Alert>
      ) : null}

      <div className={yonetici ? "grid items-start gap-6 2xl:grid-cols-[1fr_26rem]" : ""}>
        <ComponentCard title="Ekip" desc={`${kisiler.length} hesap`} flush>
          {kisiler.length === 0 ? (
            <EmptyState icon={<Users />} title="Personel yok" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Kişi</TableCell>
                  <TableCell isHeader>Rol</TableCell>
                  <TableCell isHeader>Durum</TableCell>
                  <TableCell isHeader nowrap>
                    Son giriş
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kisiler.map((u) => (
                  <TableRow key={u.id} hover className="relative">
                    <TableCell className="min-w-56">
                      <div className="flex items-center gap-3">
                        <Avatar name={staffName(u)} size="medium" decorative />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/personel/${u.id}`}
                            className="block truncate font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
                          >
                            {staffName(u)}
                            {u.id === staff.id ? <span className="ms-1.5 text-theme-xs font-normal text-gray-500">(sen)</span> : null}
                          </Link>
                          <span className="block truncate text-theme-xs text-gray-500">{u.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color={u.role === "admin" ? "primary" : "light"}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StaffStatusPill user={u} />
                    </TableCell>
                    <TableCell nowrap>{u.last_login ? relative(u.last_login) : "hiç girmedi"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ComponentCard>

        {yonetici ? (
          <ComponentCard
            title="Yeni personel"
            desc={
              mailAcik
                ? "Kişiye parola belirleme bağlantısı e-postayla gider; parola kimsenin elinden geçmez."
                : "E-posta gönderimi kapalı (SMTP_URL yok): hesap geçici parolayla açılır."
            }
          >
            <InviteForm mailAcik={mailAcik} />
          </ComponentCard>
        ) : null}
      </div>
    </>
  );
}
