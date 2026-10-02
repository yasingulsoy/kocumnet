import type { Metadata } from "next";
import Link from "next/link";
import { Eye, PenLine, Search } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { Card, EmptyState, INPUT_CLASS, Notice, PageHeader, Pagination, Pill, SELECT_CLASS, buttonClass, qs, trDate } from "@/components/admin/ui";
import { setBlogPublishedAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { listBlogs } from "@/lib/admin/data";
import { CONTENT_ROLES } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog" };

const DIL: Record<string, string> = { tr: "Türkçe", en: "English", ar: "Arapça" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const BLOG_YOLU: Record<string, string> = { tr: "/blog", en: "/en/blog", ar: "/ar/blog" };

export default async function BlogListPage({ searchParams }: PageProps<"/admin/blog">) {
  const { staff } = await requireStaff();
  const yazar = CONTENT_ROLES.includes(staff.role);

  const sp = await searchParams;
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const durum = sp.durum === "published" || sp.durum === "draft" ? sp.durum : "";
  const dil = typeof sp.dil === "string" && ["tr", "en", "ar"].includes(sp.dil) ? sp.dil : "";
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const sonuc = await listBlogs({ page: sayfa, search: ara || undefined, locale: dil || undefined, durum: durum || undefined });
  const href = (p: number) => qs("/admin/blog", { ara, durum, dil, sayfa: p > 1 ? p : undefined });

  return (
    <>
      <PageHeader
        title="Blog"
        description={`${sonuc.pagination.total} yazı. Taslaklar yalnızca burada görünür.`}
        actions={yazar ? <Link href="/admin/blog/yeni" className={buttonClass({ size: "sm" })}><PenLine /> Yeni yazı</Link> : null}
      />

      {sp.silindi === "1" ? <Notice tone="ok" className="mb-4">Yazı silindi.</Notice> : null}

      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-line p-3" role="search">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="ara" defaultValue={ara} placeholder="Başlık veya özette ara" className={INPUT_CLASS + " h-10 ps-9 text-caption"} aria-label="Ara" />
          </label>
          <select name="durum" defaultValue={durum} className={SELECT_CLASS + " h-10 w-auto text-caption"} aria-label="Durum">
            <option value="">Tüm durumlar</option>
            <option value="published">Yayında</option>
            <option value="draft">Taslak</option>
          </select>
          <select name="dil" defaultValue={dil} className={SELECT_CLASS + " h-10 w-auto text-caption"} aria-label="Dil">
            <option value="">Tüm diller</option>
            {Object.entries(DIL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>Süz</button>
          {ara || durum || dil ? (
            <Link href="/admin/blog" className="text-caption text-ink-faint hover:text-ink">Temizle</Link>
          ) : null}
        </form>

        {sonuc.data.length === 0 ? (
          <EmptyState title="Yazı bulunamadı" description={ara ? `"${ara}" için sonuç yok.` : "Henüz yazı yok."} />
        ) : (
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Yazı</th>
                  <th>Dil</th>
                  <th>Durum</th>
                  <th>Yazar</th>
                  <th>Tarih</th>
                  <th className="text-end"><Eye className="inline size-3.5" aria-label="Görüntülenme" /></th>
                  {yazar ? <th className="text-end">İşlem</th> : null}
                </tr>
              </thead>
              <tbody>
                {sonuc.data.map((b) => {
                  const url = b.is_published && SITE_URL ? `${SITE_URL}${BLOG_YOLU[b.locale] ?? "/blog"}/${b.slug}` : null;
                  return (
                    <tr key={b.id}>
                      <td className="max-w-md">
                        <Link href={`/admin/blog/${b.id}`} className="font-medium text-ink hover:text-brand">
                          {b.title}
                        </Link>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener" className="ms-2 text-micro text-ink-faint hover:text-brand">sitede ↗</a>
                        ) : null}
                        <p className="mt-0.5 truncate text-micro text-ink-faint">{b.excerpt ?? "Özet yok"}</p>
                      </td>
                      <td><Pill>{DIL[b.locale] ?? b.locale}</Pill></td>
                      <td><Pill tone={b.is_published ? "ok" : "warn"}>{b.is_published ? "Yayında" : "Taslak"}</Pill></td>
                      <td className="whitespace-nowrap">{authorName(b) ?? "—"}</td>
                      <td className="whitespace-nowrap">{trDate(b.published_at ?? b.created_at)}</td>
                      <td className="tabular text-end">{b.view_count ?? 0}</td>
                      {yazar ? (
                        <td className="text-end">
                          <ActionButton
                            action={setBlogPublishedAction.bind(null, b.id, !b.is_published)}
                            variant={b.is_published ? "ghost" : "soft"}
                            size="sm"
                            confirm={b.is_published ? `"${b.title}" yayından kaldırılsın mı? Sitedeki adresi 404 verir.` : undefined}
                          >
                            {b.is_published ? "Taslağa al" : "Yayınla"}
                          </ActionButton>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={sonuc.pagination.page} pages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
