import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Inbox, PenLine, Users } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, StatCard, buttonClass, relative } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { listBlogs, listMessages, listStaff } from "@/lib/admin/data";
import { CONTENT_ROLES, MANAGE_ROLES, MESSAGE_STATUS_LABEL, type AdminBlog, type ContactMessage } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Genel bakış" };

const DIL: Record<string, string> = { tr: "TR", en: "EN", ar: "AR" };

export default async function DashboardPage() {
  const { staff } = await requireStaff();
  const yonetim = MANAGE_ROLES.includes(staff.role);
  const yazar = CONTENT_ROLES.includes(staff.role);

  // Her kart bağımsız: biri düşerse diğerleri çizilmeye devam eder.
  const guvenli = <T,>(p: Promise<T>) => p.catch(() => null);
  const [yazilar, taslaklar, mesajlar, personel] = await Promise.all([
    guvenli(listBlogs({ limit: 5 })),
    guvenli(listBlogs({ limit: 1, durum: "draft" })),
    yonetim ? guvenli(listMessages({ page: 1 })) : Promise.resolve(null),
    yonetim ? guvenli(listStaff()) : Promise.resolve(null),
  ]);

  const saat = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", timeZone: "Europe/Istanbul" });
  const selam = Number(saat) < 12 ? "Günaydın" : Number(saat) < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <>
      <PageHeader
        title={`${selam}, ${staff.name.split(" ")[0]}`}
        description="kocum.net içeriğinin durumu."
        actions={
          yazar ? (
            <Link href="/admin/blog/yeni" className={buttonClass({ size: "sm" })}>
              <PenLine /> Yeni yazı
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Yayındaki yazı" value={yazilar ? yazilar.pagination.total - (taslaklar?.pagination.total ?? 0) : "—"} icon={<FileText />} href="/admin/blog?durum=published" />
        <StatCard label="Taslak" value={taslaklar?.pagination.total ?? "—"} icon={<PenLine />} tone="warn" href="/admin/blog?durum=draft" sub={taslaklar?.pagination.total ? "Yayına hazır mı?" : undefined} />
        {yonetim ? (
          <>
            <StatCard label="Okunmamış mesaj" value={mesajlar?.unread ?? "—"} icon={<Inbox />} tone={mesajlar?.unread ? "brand" : "neutral"} href="/admin/mesajlar?durum=new" sub={mesajlar ? `toplam ${mesajlar.pagination.total}` : undefined} />
            <StatCard label="Personel" value={personel?.length ?? "—"} icon={<Users />} tone="neutral" href="/admin/personel" sub={personel ? `${personel.filter((p) => !p.has_password).length} davet bekliyor` : undefined} />
          </>
        ) : null}
      </div>

      <div className={`mt-6 grid gap-6 ${yonetim ? "xl:grid-cols-2" : ""}`}>
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-body font-semibold text-ink">Son yazılar</h2>
            <Link href="/admin/blog" className="flex items-center gap-1 text-caption font-medium text-brand hover:underline">
              Hepsi <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {yazilar && yazilar.data.length ? (
            <ul className="divide-y divide-line">
              {yazilar.data.map((b: AdminBlog) => (
                <li key={b.id}>
                  <Link href={`/admin/blog/${b.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-caption font-medium text-ink">{b.title}</p>
                      <p className="mt-0.5 text-micro text-ink-faint">
                        {authorName(b) ?? "—"} · {relative(b.updated_at ?? b.created_at)}
                      </p>
                    </div>
                    <Pill tone="neutral">{DIL[b.locale] ?? b.locale}</Pill>
                    <Pill tone={b.is_published ? "ok" : "warn"}>{b.is_published ? "Yayında" : "Taslak"}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Henüz yazı yok" action={yazar ? <Link href="/admin/blog/yeni" className={buttonClass({ size: "sm" })}>İlk yazıyı oluştur</Link> : undefined} />
          )}
        </Card>

        {yonetim ? (
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-body font-semibold text-ink">Son mesajlar</h2>
              <Link href="/admin/mesajlar" className="flex items-center gap-1 text-caption font-medium text-brand hover:underline">
                Hepsi <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {mesajlar && mesajlar.data.length ? (
              <ul className="divide-y divide-line">
                {mesajlar.data.slice(0, 5).map((m: ContactMessage) => (
                  <li key={m.id}>
                    <Link href={`/admin/mesajlar/${m.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-caption font-medium text-ink">
                          {m.name} <span className="font-normal text-ink-faint">· {m.subject ?? "Konu yok"}</span>
                        </p>
                        <p className="mt-0.5 truncate text-micro text-ink-faint">{m.message}</p>
                      </div>
                      <span className="text-micro text-ink-faint">{relative(m.created_at)}</span>
                      <Pill tone={m.status === "new" ? "brand" : m.status === "spam" ? "bad" : "neutral"}>{MESSAGE_STATUS_LABEL[m.status]}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Mesaj yok" description="İletişim formundan gelenler burada görünür." />
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
