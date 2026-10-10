import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, History, Inbox, PenLine, Users } from "lucide-react";
import { MESAJ_RENGI, relative } from "@/components/admin/ui";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
// ApexCharts eklentisi (ürün sahibi onayladı): grafikler yalnızca tarayıcıda,
// next/dynamic + ssr:false ile yüklenir; kütüphane yalnızca bu sayfada iner.
import { ApexAreaChart } from "@/components/tailadmin/extras/charts/ApexAreaChart";
import { ApexBarChart } from "@/components/tailadmin/extras/charts/ApexBarChart";
import { ApexRadialChart } from "@/components/tailadmin/extras/charts/ApexRadialChart";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { requireStaff } from "@/lib/admin/auth";
import { getSummary, listAudit, listBlogs, listMessages } from "@/lib/admin/data";
import { haftalikMesajlar, yayindakiYazilar } from "@/lib/admin/istatistik";
import { CONTENT_ROLES, MANAGE_ROLES, MESSAGE_STATUS_LABEL, WAITING_STATUSES, personName } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Genel bakış" };

const DIL: Record<string, string> = { tr: "TR", en: "EN", ar: "AR" };

function HepsiBaglantisi({ href, children = "Hepsi" }: { href: string; children?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600">
      {children} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

/**
 * Genel bakış: "bugün ne yapmalıyım?" sorusunun cevabı. Üstte sayı
 * kartları, yanında grafikler (backend'in verdiği listelerden; uydurma veri
 * yok), altta iş listeleri: yanıt bekleyen mesajlar, taslaklar, son
 * yayınlananlar, (yöneticiye) son etkinlik. Her kart bağımsız: biri düşerse
 * diğerleri çizilir.
 *
 * Grafikler kitin ApexCharts eklentisi (üstüne gelince değer ipucu):
 * haftalık mesaj alan grafiği, yanıtlanma oranı yarım daire göstergesi, en
 * çok okunanlar yatay sütun grafiği. Ekran okuyucu her grafiğin özetini
 * (ariaLabel) okur.
 */
export default async function DashboardPage() {
  const { staff } = await requireStaff(undefined, "/admin");
  const yonetim = MANAGE_ROLES.includes(staff.role);
  const yazar = CONTENT_ROLES.includes(staff.role);
  const yonetici = staff.role === "admin";

  const guvenli = <T,>(p: Promise<T>) => p.catch(() => null);
  const [ozet, taslaklar, yayin, bekleyenler, etkinlik, haftalik] = await Promise.all([
    guvenli(getSummary()),
    guvenli(listBlogs({ limit: 5, durum: "draft", sirala: "updated" })),
    guvenli(yayindakiYazilar()),
    yonetim ? guvenli(listMessages({ status: WAITING_STATUSES, limit: 5 })) : Promise.resolve(null),
    yonetici ? guvenli(listAudit({ limit: 6 })) : Promise.resolve(null),
    yonetim ? guvenli(haftalikMesajlar(12)) : Promise.resolve(null),
  ]);

  const saat = Number(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }));
  const selam = saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar";

  const m = ozet?.messages;
  const p = ozet?.staff;
  const davetNotu = p ? [p.invited ? `${p.invited} davet bekliyor` : null, p.invite_expired ? `${p.invite_expired} süresi doldu` : null].filter(Boolean).join(" · ") : "";

  let aciklama = "kocum.net içeriğinin durumu.";
  if (m && m.waiting) aciklama = `${m.waiting} mesaj yanıt bekliyor${m.unread ? `, ${m.unread} tanesi henüz okunmadı` : ""}.`;
  else if (m) aciklama = "Bekleyen mesaj yok. İçerikte sırada ne var?";

  // Mesaj durumu: spam hariç bütün mesajların ne kadarı yanıtlandı ya da kapatıldı.
  const c = m?.counts;
  const islenmis = c ? c.answered + c.archived : 0;
  const tumu = c ? c.new + c.read + c.answered + c.archived : 0;
  const oran = tumu ? (islenmis / tumu) * 100 : 0;

  // En çok okunanlar: yayındakiler okunma sayısına göre.
  const enCok = yayin ? [...yayin.yazilar].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 6) : [];
  const sonYayinlar = yayin ? yayin.yazilar.slice(0, 5) : [];

  const kartlar = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {yonetim ? (
        <MetricCard
          label="Yanıt bekleyen mesaj"
          value={m ? m.waiting : "—"}
          icon={<Inbox />}
          tone={m?.waiting ? "brand" : "gray"}
          href="/admin/mesajlar"
          badge={m?.unread ? <Badge size="sm">{m.unread} yeni</Badge> : undefined}
          hint={m ? (m.oldest_waiting_at ? `En eskisi ${relative(m.oldest_waiting_at)}` : "Hepsi yanıtlandı") : undefined}
        />
      ) : null}
      <MetricCard
        label="Taslak"
        value={ozet ? ozet.blogs.draft : "—"}
        icon={<PenLine />}
        tone={ozet?.blogs.draft ? "warning" : "gray"}
        href="/admin/blog?durum=draft"
        hint={ozet?.blogs.draft ? "Yayına hazır olan var mı?" : undefined}
      />
      <MetricCard
        label="Yayındaki yazı"
        value={ozet ? ozet.blogs.published : "—"}
        icon={<FileText />}
        tone="success"
        href="/admin/blog?durum=published"
      />
      {yonetim ? (
        <MetricCard
          label="Aktif personel"
          value={p ? p.active : "—"}
          icon={<Users />}
          href="/admin/personel"
          badge={p?.invite_expired ? <Badge size="sm" color="error">{p.invite_expired} süresi doldu</Badge> : undefined}
          hint={davetNotu || undefined}
        />
      ) : null}
    </div>
  );

  const okunanlar = (
    <ChartCard
      title="En çok okunan yazılar"
      description={
        yayin && yayin.toplam > yayin.yazilar.length
          ? `Son ${yayin.yazilar.length} yayın içinde, toplam okunma.`
          : "Yayındaki yazıların toplam okunma sayısı."
      }
      actions={<HepsiBaglantisi href="/admin/blog?durum=published">Yazılar</HepsiBaglantisi>}
    >
      {enCok.length ? (
        <ApexBarChart
          horizontal
          // Eksende ApexCharts uzun adı kısaltır; ipucunda tamamı görünür.
          categories={enCok.map((b) => `${b.title} (${DIL[b.locale] ?? b.locale})`)}
          series={[{ name: "Okunma", data: enCok.map((b) => b.view_count ?? 0) }]}
          ariaLabel={`En çok okunan yazılar: ${enCok.map((b) => `${b.title}, ${(b.view_count ?? 0).toLocaleString("tr-TR")} okunma`).join("; ")}`}
          height={70 + enCok.length * 38}
        />
      ) : (
        <EmptyState title="Yayında yazı yok" description="Yazı yayınlandıkça okunma sayıları burada sıralanır." />
      )}
    </ChartCard>
  );

  return (
    <>
      <PageBreadcrumb
        pageTitle={`${selam}, ${staff.name.split(" ")[0]}`}
        description={aciklama}
        actions={
          <>
            {yonetim && m?.waiting ? (
              <ButtonLink href="/admin/mesajlar" variant="outline" size="xs" startIcon={<Inbox />}>
                Mesajlara git
              </ButtonLink>
            ) : null}
            {yazar ? (
              <ButtonLink href="/admin/blog/yeni" size="xs" startIcon={<PenLine />}>
                Yeni yazı
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-7">
          {kartlar}
          {yonetim ? (
            <ChartCard
              title="Haftalık gelen mesajlar"
              description={
                haftalik
                  ? `Son ${haftalik.etiketler.length} hafta, spam hariç: ${haftalik.toplam} mesaj.${haftalik.kisaltildi ? " Mesaj çok olduğu için dönem kısaltıldı." : ""}`
                  : "Sayılar şu an alınamadı."
              }
              actions={<HepsiBaglantisi href="/admin/mesajlar?durum=hepsi">Bütün mesajlar</HepsiBaglantisi>}
            >
              {haftalik ? (
                <ApexAreaChart
                  categories={haftalik.etiketler}
                  series={[{ name: "Gelen mesaj", data: haftalik.sayilar }]}
                  ariaLabel={`Haftalık gelen mesaj sayısı: ${haftalik.etiketler.map((e, i) => `${e} haftası ${haftalik.sayilar[i]}`).join(", ")}`}
                  height={260}
                />
              ) : (
                <EmptyState title="Grafik yüklenemedi" description="Biraz sonra sayfayı yenile." />
              )}
            </ChartCard>
          ) : (
            okunanlar
          )}
        </div>

        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-5">
          {yonetim ? (
            <ChartCard
              title="Mesaj durumu"
              description="Spam hariç bütün mesajların ne kadarı yanıtlandı ya da arşivlendi."
              note={c ? (m?.waiting ? `${m.waiting} mesaj yanıt bekliyor.` : "Bekleyen mesaj yok.") : "Sayılar şu an alınamadı."}
              stats={
                c
                  ? [
                      { label: "Bekleyen", value: c.new + c.read },
                      { label: "Yanıtlandı", value: c.answered },
                      { label: "Arşiv", value: c.archived },
                    ]
                  : undefined
              }
            >
              <ApexRadialChart value={oran} ariaLabel="Yanıtlanan ya da arşivlenen mesaj oranı" />
            </ChartCard>
          ) : null}
          {yonetim ? okunanlar : null}
          {!yonetim ? (
            <ComponentCard title="Taslaklar" actions={<HepsiBaglantisi href="/admin/blog?durum=draft" />} flush>
              <Taslaklar taslaklar={taslaklar?.data ?? null} yazar={yazar} />
            </ComponentCard>
          ) : null}
        </div>

        {yonetim ? (
          <ComponentCard
            className="col-span-12 xl:col-span-7"
            title="Yanıt bekleyen mesajlar"
            actions={<HepsiBaglantisi href="/admin/mesajlar" />}
            flush
          >
            {bekleyenler && bekleyenler.data.length ? (
              <ul className="divide-y divide-gray-100">
                {bekleyenler.data.map((mesaj) => (
                  <li key={mesaj.id}>
                    <Link href={`/admin/mesajlar/${mesaj.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 sm:px-6">
                      <Avatar name={mesaj.name} size="medium" decorative />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-theme-sm font-medium text-gray-800">
                          {mesaj.name} <span className="font-normal text-gray-500">· {mesaj.subject ?? "Konu yok"}</span>
                        </p>
                        <p className="mt-0.5 truncate text-theme-xs text-gray-500">{mesaj.message}</p>
                      </div>
                      <span className="hidden shrink-0 text-theme-xs text-gray-500 sm:block">{relative(mesaj.created_at)}</span>
                      <Badge size="sm" color={MESAJ_RENGI[mesaj.status]}>
                        {MESSAGE_STATUS_LABEL[mesaj.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Inbox />} title="Bekleyen mesaj yok" description="Hepsi yanıtlanmış ya da arşivlenmiş." />
            )}
          </ComponentCard>
        ) : null}

        {yonetim ? (
          <ComponentCard
            className="col-span-12 xl:col-span-5"
            title="Taslaklar"
            actions={<HepsiBaglantisi href="/admin/blog?durum=draft" />}
            flush
          >
            <Taslaklar taslaklar={taslaklar?.data ?? null} yazar={yazar} />
          </ComponentCard>
        ) : null}

        <ComponentCard
          className={yonetici ? "col-span-12 xl:col-span-7" : "col-span-12"}
          title="Son yayınlananlar"
          actions={<HepsiBaglantisi href="/admin/blog?durum=published" />}
          flush
        >
          {sonYayinlar.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Yazı</TableCell>
                  <TableCell isHeader>Dil</TableCell>
                  <TableCell isHeader align="end">
                    Okunma
                  </TableCell>
                  <TableCell isHeader nowrap>
                    Yayın
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sonYayinlar.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell className="w-full max-w-0 min-w-48">
                      <Link href={`/admin/blog/${b.id}`} className="block truncate font-medium text-gray-800 hover:text-brand-500">
                        {b.title}
                      </Link>
                      <span className="block truncate text-theme-xs text-gray-500">{authorName(b) ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color="light">
                        {DIL[b.locale] ?? b.locale}
                      </Badge>
                    </TableCell>
                    <TableCell align="end" className="tabular">
                      {(b.view_count ?? 0).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell nowrap>{relative(b.published_at ?? b.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={<FileText />} title="Yayında yazı yok" />
          )}
        </ComponentCard>

        {yonetici ? (
          <ComponentCard
            className="col-span-12 xl:col-span-5"
            title="Son etkinlik"
            actions={<HepsiBaglantisi href="/admin/etkinlik">Kaydın tamamı</HepsiBaglantisi>}
            flush
          >
            {etkinlik && etkinlik.data.length ? (
              <ul className="divide-y divide-gray-100">
                {etkinlik.data.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                    <History className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-theme-sm text-gray-800">
                        <span className="font-medium">{personName(e.actor) ?? e.actor_email ?? "Oturumsuz istek"}</span>{" "}
                        <span className="text-gray-500">{e.summary}</span>
                      </p>
                      <p className="mt-0.5 text-theme-xs text-gray-500">{relative(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<History />}
                title="Henüz kayıt yok"
                description="Personelin yaptığı işlemler (yayınlama, silme, rol değişikliği…) burada listelenir."
              />
            )}
          </ComponentCard>
        ) : null}
      </div>
    </>
  );
}

function Taslaklar({ taslaklar, yazar }: { taslaklar: Awaited<ReturnType<typeof listBlogs>>["data"] | null; yazar: boolean }) {
  if (!taslaklar || !taslaklar.length) {
    return (
      <EmptyState
        icon={<PenLine />}
        title="Taslak yok"
        description="Yarım kalan yazılar burada durur; kaldığın yerden devam edersin."
        action={
          yazar ? (
            <ButtonLink href="/admin/blog/yeni" size="xs">
              Yeni yazı
            </ButtonLink>
          ) : undefined
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {taslaklar.map((b) => (
        <li key={b.id}>
          <Link href={`/admin/blog/${b.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-theme-sm font-medium text-gray-800">{b.title}</p>
              <p className="mt-0.5 text-theme-xs text-gray-500">
                {authorName(b) ?? "—"} · son düzenleme {relative(b.updated_at ?? b.created_at)}
              </p>
            </div>
            <Badge size="sm" color="light">
              {DIL[b.locale] ?? b.locale}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
