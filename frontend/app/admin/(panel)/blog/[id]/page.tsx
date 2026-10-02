import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { BlogForm } from "@/components/admin/BlogForm";
import { Card, Notice, PageHeader, Pill, trDate } from "@/components/admin/ui";
import { deleteBlogAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getBlog } from "@/lib/admin/data";
import { CONTENT_ROLES } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Yazıyı düzenle" };

export default async function BlogDuzenlePage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  const { staff } = await requireStaff();
  const yazar = CONTENT_ROLES.includes(staff.role);

  const { id } = await params;
  const sp = await searchParams;
  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  let blog;
  try {
    blog = await getBlog(sayi);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <PageHeader
        title={blog.title}
        crumbs={[{ href: "/admin/blog", label: "Blog" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={blog.is_published ? "ok" : "warn"}>{blog.is_published ? "Yayında" : "Taslak"}</Pill>
            <span className="text-caption text-ink-faint">
              {authorName(blog) ?? "—"} · oluşturuldu {trDate(blog.created_at)} · güncellendi {trDate(blog.updated_at, { time: true })} · {blog.view_count ?? 0} görüntülenme
            </span>
          </span>
        }
      />

      {sp.kaydedildi === "1" ? <Notice tone="ok" className="mb-4">Kaydedildi.</Notice> : null}
      {sp.hata === "kapak" ? (
        <Notice tone="warn" className="mb-4" title="Yazı kaydedildi, kapak yüklenemedi">
          Görsel JPEG, PNG veya WebP olmalı ve 10 MB&apos;ı aşmamalı. Aşağıdan yeniden dene.
        </Notice>
      ) : null}

      <BlogForm blog={blog} readOnly={!yazar} />

      {yazar ? (
        <Card className="mt-8 border-bad/20 p-5">
          <h2 className="font-display text-body font-semibold text-bad">Tehlikeli bölge</h2>
          <p className="mt-1 text-caption text-ink-soft">Yazı ve tüm görselleri kalıcı olarak silinir; geri alınamaz. Yayından kaldırmak için yukarıdaki &quot;Yayında&quot; kutusunu kapatman yeter.</p>
          <div className="mt-4">
            <ActionButton action={deleteBlogAction.bind(null, blog.id)} variant="secondary" size="sm" className="text-bad ring-bad/30 hover:bg-bad-wash" confirm={`"${blog.title}" kalıcı olarak silinsin mi?`}>
              <Trash2 /> Yazıyı sil
            </ActionButton>
          </div>
        </Card>
      ) : null}
    </>
  );
}
