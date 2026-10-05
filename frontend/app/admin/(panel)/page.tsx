import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileText, History, Inbox, PenLine, Users } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, StatCard, buttonClass, relative } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { getSummary, listAudit, listBlogs, listMessages } from "@/lib/admin/data";
import { CONTENT_ROLES, MANAGE_ROLES, MESSAGE_STATUS_LABEL, WAITING_STATUSES, personName } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Genel bakış" };

const DIL: Record<string, string> = { tr: "TR", en: "EN", ar: "AR" };

function Bolum({ baslik, href, hepsi = "Hepsi", children }: { baslik: string; href: string; hepsi?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-body font-semibold text-ink">{baslik}</h2>
        <Link href={href} className="flex items-center gap-1 text-caption font-medium text-brand hover:underline">
          {hepsi} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {children}
    </Card>
  );
}

/**
 * Genel bakış: "bugün ne yapmalıyım?" sorusunun cevabı. Sayılar tek
 * çağrıdan (getSummary); listeler iş listesi: yanıt bekleyen mesajlar,
 * bitmemiş taslaklar, son yayınlananlar, (yöneticiye) son etkinlik.
 */
export default async function DashboardPage() {
  const { staff } = await requireStaff(undefined, "/admin");
  const yonetim = MANAGE_ROLES.includes(staff.role);
  const yazar = CONTENT_ROLES.includes(staff.role);
  const yonetici = staff.role === "admin";

  // Her kart bağımsız: biri düşerse diğerleri çizilmeye devam eder.
  const guvenli = <T,>(p: Promise<T>) => p.catch(() => null);
  const [ozet, taslaklar, yayindakiler, bekleyenler, etkinlik] = await Promise.all([
    guvenli(getSummary()),
    guvenli(listBlogs({ limit: 5, durum: "draft", sirala: "updated" })),
    guvenli(listBlogs({ limit: 5, durum: "published" })),
    yonetim ? guvenli(listMessages({ status: WAITING_STATUSES, limit: 5 })) : Promise.resolve(null),
    yonetici ? guvenli(listAudit({ limit: 6 })) : Promise.resolve(null),
  ]);

  const saat = Number(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }));
  const selam = saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar";

  const m = ozet?.messages;
  const p = ozet?.staff;
  const davetNotu = p ? [p.invited ? `${p.invited} davet bekliyor` : null, p.invite_expired ? `${p.invite_expired} süresi doldu` : null].filter(Boolean).join(" · ") : "";

  let aciklama = "kocum.net içeriğinin durumu.";
  if (m && m.waiting) aciklama = `${m.waiting} mesaj yanıt bekliyor${m.unread ? `, ${m.unread} tanesi henüz okunmadı` : ""}.`;
  else if (m) aciklama = "Bekleyen mesaj yok. İçerikte sırada ne var?";

  return (
    <>
      <PageHeader
        title={`${selam}, ${staff.name.split(" ")[0]}`}
        description={aciklama}
        actions={
          <>
            {yonetim && m?.waiting ? (
              <Link href="/admin/mesajlar" className={buttonClass({ variant: "secondary", size: "sm" })}>
                <Inbox /> Mesajlara git
              </Link>
            ) : null}
            {yazar ? (
              <Link href="/admin/blog/yeni" className={buttonClass({ size: "sm" })}>
                <PenLine /> Yeni yazı
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {yonetim ? (
          <StatCard
            label="Yanıt bekleyen mesaj"
            value={m ? m.waiting : "—"}
            icon={<Inbox />}
            tone={m?.waiting ? "brand" : "neutral"}
            href="/admin/mesajlar"
            sub={m ? (m.oldest_waiting_at ? `en eskisi ${relative(m.oldest_waiting_at)}` : "hepsi yanıtlandı") : undefined}
          />
        ) : null}
        <StatCard
          label="Taslak"
          value={ozet ? ozet.blogs.draft : "—"}
          icon={<PenLine />}
          tone={ozet?.blogs.draft ? "warn" : "neutral"}
          href="/admin/blog?durum=draft"
          sub={ozet?.blogs.draft ? "Yayına hazır olan var mı?" : undefined}
        />
        <StatCard label="Yayındaki yazı" value={ozet ? ozet.blogs.published : "—"} icon={<FileText />} tone="ok" href="/admin/blog?durum=published" />
        {yonetim ? (
          <StatCard label="Aktif personel" value={p ? p.active : "—"} icon={<Users />} tone="neutral" href="/admin/personel" sub={davetNotu || undefined} />
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {yonetim ? (
          <Bolum baslik="Yanıt bekleyen mesajlar" href="/admin/mesajlar">
            {bekleyenler && bekleyenler.data.length ? (
              <ul className="divide-y divide-line">
                {bekleyenler.data.map((mesaj) => (
                  <li key={mesaj.id}>
                    <Link href={`/admin/mesajlar/${mesaj.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                      <span aria-hidden className={mesaj.status === "new" ? "size-2 shrink-0 rounded-full bg-brand" : "size-2 shrink-0"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-caption font-medium text-ink">
                          {mesaj.name} <span className="font-normal text-ink-faint">· {mesaj.subject ?? "Konu yok"}</span>
                        </p>
                        <p className="mt-0.5 truncate text-micro text-ink-faint">{mesaj.message}</p>
                      </div>
                      <span className="shrink-0 text-micro text-ink-faint">{relative(mesaj.created_at)}</span>
                      <Pill tone={mesaj.status === "new" ? "brand" : "neutral"}>{MESSAGE_STATUS_LABEL[mesaj.status]}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Bekleyen mesaj yok" description="Hepsi yanıtlanmış ya da arşivlenmiş." />
            )}
          </Bolum>
        ) : null}

        <Bolum baslik="Taslaklar" href="/admin/blog?durum=draft">
          {taslaklar && taslaklar.data.length ? (
            <ul className="divide-y divide-line">
              {taslaklar.data.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/blog/${b.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-caption font-medium text-ink">{b.title}</p>
                      <p className="mt-0.5 text-micro text-ink-faint">
                        {authorName(b) ?? "—"} · son düzenleme {relative(b.updated_at ?? b.created_at)}
                      </p>
                    </div>
                    <Pill tone="neutral">{DIL[b.locale] ?? b.locale}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Taslak yok"
              description="Yarım kalan yazılar burada durur; kaldığın yerden devam edersin."
              action={yazar ? <Link href="/admin/blog/yeni" className={buttonClass({ size: "sm" })}>Yeni yazı</Link> : undefined}
            />
          )}
        </Bolum>

        <Bolum baslik="Son yayınlananlar" href="/admin/blog?durum=published">
          {yayindakiler && yayindakiler.data.length ? (
            <ul className="divide-y divide-line">
              {yayindakiler.data.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/blog/${b.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-caption font-medium text-ink">{b.title}</p>
                      <p className="mt-0.5 text-micro text-ink-faint">
                        {authorName(b) ?? "—"} · {relative(b.published_at ?? b.created_at)}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-micro text-ink-faint" title="Görüntülenme">{b.view_count ?? 0} okuma</span>
                    <Pill tone="neutral">{DIL[b.locale] ?? b.locale}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Yayında yazı yok" />
          )}
        </Bolum>

        {yonetici ? (
          <Bolum baslik="Son etkinlik" href="/admin/etkinlik" hepsi="Kaydın tamamı">
            {etkinlik && etkinlik.data.length ? (
              <ul className="divide-y divide-line">
                {etkinlik.data.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                    <History className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption text-ink">
                        <span className="font-medium">{personName(e.actor) ?? e.actor_email ?? "Oturumsuz istek"}</span>{" "}
                        <span className="text-ink-soft">{e.summary}</span>
                      </p>
                      <p className="mt-0.5 text-micro text-ink-faint">{relative(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Henüz kayıt yok" description="Personelin yaptığı işlemler (yayınlama, silme, rol değişikliği…) burada listelenir." />
            )}
          </Bolum>
        ) : null}
      </div>
    </>
  );
}
