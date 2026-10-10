import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Eye, FileText, PenLine, Search } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { qs, trDate } from "@/components/admin/ui";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
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
  const { staff } = await requireStaff(undefined, "/admin/blog");
  const yazar = CONTENT_ROLES.includes(staff.role);

  const sp = await searchParams;
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const durum = sp.durum === "published" || sp.durum === "draft" ? sp.durum : "";
  const dil = typeof sp.dil === "string" && ["tr", "en", "ar"].includes(sp.dil) ? sp.dil : "";
  // "Dün düzenlediğim yazı nerede?" — son düzenlenen önce.
  const sirala = sp.sirala === "duzenleme" ? "duzenleme" : "";
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const sonuc = await listBlogs({
    page: sayfa,
    search: ara || undefined,
    locale: dil || undefined,
    durum: durum || undefined,
    sirala: sirala ? "updated" : undefined,
  });
  const href = (p: number) => qs("/admin/blog", { ara, durum, dil, sirala, sayfa: p > 1 ? p : undefined });

  return (
    <>
      <PageBreadcrumb
        pageTitle="Blog"
        description={`${sonuc.pagination.total} yazı. Taslaklar yalnızca burada görünür.`}
        actions={
          yazar ? (
            <ButtonLink href="/admin/blog/yeni" size="xs" startIcon={<PenLine />}>
              Yeni yazı
            </ButtonLink>
          ) : null
        }
      />

      {sp.silindi === "1" ? (
        <Alert variant="success" className="mb-4">
          Yazı silindi.
        </Alert>
      ) : null}

      <ComponentCard
        title="Yazılar"
        flush
        actions={
          <form className="flex flex-wrap items-center gap-2" role="search">
            <Input
              name="ara"
              type="search"
              defaultValue={ara}
              placeholder="Başlık veya özette ara"
              aria-label="Ara"
              compact
              startIcon={<Search />}
              wrapperClassName="w-full sm:w-60"
            />
            <Select name="durum" defaultValue={durum} aria-label="Durum" compact wrapperClassName="w-36">
              <option value="">Tüm durumlar</option>
              <option value="published">Yayında</option>
              <option value="draft">Taslak</option>
            </Select>
            <Select name="dil" defaultValue={dil} aria-label="Dil" compact wrapperClassName="w-32">
              <option value="">Tüm diller</option>
              {Object.entries(DIL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select name="sirala" defaultValue={sirala} aria-label="Sıralama" compact wrapperClassName="w-40">
              <option value="">Son eklenen</option>
              <option value="duzenleme">Son düzenlenen</option>
            </Select>
            <Button type="submit" variant="outline" size="xs">
              Süz
            </Button>
            {ara || durum || dil || sirala ? (
              <Link href="/admin/blog" className="text-theme-sm text-gray-500 hover:text-gray-800">
                Temizle
              </Link>
            ) : null}
          </form>
        }
      >
        {sonuc.data.length === 0 ? (
          <EmptyState icon={<FileText />} title="Yazı bulunamadı" description={ara ? `"${ara}" için sonuç yok.` : "Henüz yazı yok."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Yazı</TableCell>
                <TableCell isHeader>Dil</TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader>Yazar</TableCell>
                <TableCell isHeader>{sirala ? "Son düzenleme" : "Tarih"}</TableCell>
                <TableCell isHeader align="end">
                  <Eye className="inline size-3.5" aria-hidden />
                  <span className="sr-only">Görüntülenme</span>
                </TableCell>
                {yazar ? (
                  <TableCell isHeader align="end">
                    İşlem
                  </TableCell>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sonuc.data.map((b) => {
                const url = b.is_published && SITE_URL ? `${SITE_URL}${BLOG_YOLU[b.locale] ?? "/blog"}/${b.slug}` : null;
                return (
                  <TableRow key={b.id} hover>
                    <TableCell className="w-full max-w-0 min-w-52">
                      <Link href={`/admin/blog/${b.id}`} className="font-medium text-gray-800 hover:text-brand-500">
                        {b.title}
                      </Link>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener" className="ms-2 inline-flex items-center gap-0.5 text-theme-xs text-gray-500 hover:text-brand-500">
                          sitede <ArrowUpRight className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <Link href={`/admin/blog/${b.id}/onizleme`} className="ms-2 text-theme-xs text-gray-500 hover:text-brand-500">
                          önizle
                        </Link>
                      )}
                      <p className="mt-0.5 truncate text-theme-xs text-gray-500">{b.excerpt ?? "Özet yok"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color="light">
                        {DIL[b.locale] ?? b.locale}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color={b.is_published ? "success" : "warning"}>
                        {b.is_published ? "Yayında" : "Taslak"}
                      </Badge>
                    </TableCell>
                    <TableCell nowrap>{authorName(b) ?? "—"}</TableCell>
                    <TableCell nowrap>{trDate(sirala ? (b.updated_at ?? b.created_at) : (b.published_at ?? b.created_at))}</TableCell>
                    <TableCell align="end" className="tabular">
                      {(b.view_count ?? 0).toLocaleString("tr-TR")}
                    </TableCell>
                    {yazar ? (
                      <TableCell align="end">
                        <ActionButton
                          action={setBlogPublishedAction.bind(null, b.id, !b.is_published)}
                          variant={b.is_published ? "ghost" : "soft"}
                          confirm={
                            b.is_published
                              ? {
                                  title: `"${b.title}" yayından kaldırılsın mı?`,
                                  description: "Sitedeki adresi 404 verir. İstediğinde yeniden yayınlayabilirsin.",
                                  confirmLabel: "Taslağa al",
                                  tone: "warning",
                                }
                              : undefined
                          }
                        >
                          {b.is_published ? "Taslağa al" : "Yayınla"}
                        </ActionButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ComponentCard>

      <Pagination currentPage={sonuc.pagination.page} totalPages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
