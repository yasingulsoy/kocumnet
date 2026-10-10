import type { Metadata } from "next";
import { BlogForm } from "@/components/admin/BlogForm";
import { Forbidden } from "@/components/admin/ui";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { requireStaff } from "@/lib/admin/auth";
import { CONTENT_ROLES } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Yeni yazı" };

export default async function YeniYaziPage() {
  const { allowed } = await requireStaff(CONTENT_ROLES, "/admin/blog/yeni");
  if (!allowed) return <Forbidden roles="Yönetici, Müdür, Editör" />;

  return (
    <>
      <PageBreadcrumb
        pageTitle="Yeni yazı"
        crumbs={[{ href: "/admin/blog", label: "Blog" }]}
        description="Taslak olarak kaydedip sonra yayınlayabilirsin. Yazdıkların bu tarayıcıda da yedeklenir."
      />
      <BlogForm />
    </>
  );
}
