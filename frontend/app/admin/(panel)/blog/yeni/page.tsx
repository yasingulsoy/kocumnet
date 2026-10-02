import type { Metadata } from "next";
import { BlogForm } from "@/components/admin/BlogForm";
import { Forbidden, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { CONTENT_ROLES } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Yeni yazı" };

export default async function YeniYaziPage() {
  const { allowed } = await requireStaff(CONTENT_ROLES);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür, Editör" />;

  return (
    <>
      <PageHeader title="Yeni yazı" crumbs={[{ href: "/admin/blog", label: "Blog" }]} description="Önce taslak olarak kaydet; yayına almak tek kutucuk." />
      <BlogForm />
    </>
  );
}
