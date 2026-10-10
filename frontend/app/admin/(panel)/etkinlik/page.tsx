import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, History, X } from "lucide-react";
import { Forbidden, qs } from "@/components/admin/ui";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { requireStaff } from "@/lib/admin/auth";
import { getStaffUser, listAudit } from "@/lib/admin/data";
import { AUDIT_AREAS, personName, staffName, type AuditArea, type AuditEntry } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Etkinlik" };

const ALAN_RENGI: Record<AuditArea, BadgeColor> = {
  blog: "primary",
  message: "success",
  user: "warning",
  auth: "light",
};

/** Kaydın ait olduğu sayfa (silinmiş kayıtlar için bağlantı yok). */
function hedefAdresi(e: AuditEntry): string | null {
  if (!e.target_id || e.action.endsWith(".delete")) return null;
  if (e.target_type === "blog") return `/admin/blog/${e.target_id}`;
  if (e.target_type === "message") return `/admin/mesajlar/${e.target_id}`;
  if (e.target_type === "user") return `/admin/personel/${e.target_id}`;
  return null;
}

function alan(e: AuditEntry): AuditArea {
  const onek = e.action.split(".")[0];
  return onek in AUDIT_AREAS ? (onek as AuditArea) : "auth";
}

const gunAnahtari = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

function gunBasligi(anahtar: string) {
  const bugun = gunAnahtari(new Date().toISOString());
  const dun = gunAnahtari(new Date(Date.now() - 86_400_000).toISOString());
  if (anahtar === bugun) return "Bugün";
  if (anahtar === dun) return "Dün";
  return new Date(`${anahtar}T12:00:00Z`).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const saat = (v: string) => new Date(v).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

/**
 * Etkinlik (denetim kaydı) — yalnızca yönetici. "Bu yazıyı kim yayından
 * kaldırdı?", "bu hesabı kim açtı?", "mesaja kim döndü?" soruları için.
 * Kayıtlar 365 gün tutulur; mesaj gönderenlerin adı/e-postası yazılmaz.
 * Tablo günlere bölünür: her gün kendi başlık satırıyla.
 */
// Yeni rota: PageProps<"/admin/etkinlik"> türü ilk derlemede üretiliyor; açık tür, derlemeden bağımsız.
export default async function EtkinlikPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { allowed } = await requireStaff(["admin"], "/admin/etkinlik");
  if (!allowed) return <Forbidden roles="Yönetici" />;

  const sp = await searchParams;
  const secili = typeof sp.alan === "string" && sp.alan in AUDIT_AREAS ? (sp.alan as AuditArea) : undefined;
  const kisiId = Number(sp.kisi);
  const kisi = Number.isInteger(kisiId) && kisiId > 0 ? kisiId : undefined;
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const [sonuc, kisiBilgisi] = await Promise.all([
    listAudit({ page: sayfa, limit: 50, area: secili, actorId: kisi }),
    kisi ? getStaffUser(kisi).catch(() => null) : Promise.resolve(null),
  ]);
  const href = (p: number) => qs("/admin/etkinlik", { alan: secili, kisi, sayfa: p > 1 ? p : undefined });

  // Günlere böl: "Bugün", "Dün", "Cuma, 2 Ekim 2026".
  const gunler: { anahtar: string; kayitlar: AuditEntry[] }[] = [];
  for (const e of sonuc.data) {
    const anahtar = gunAnahtari(e.created_at);
    const son = gunler[gunler.length - 1];
    if (son && son.anahtar === anahtar) son.kayitlar.push(e);
    else gunler.push({ anahtar, kayitlar: [e] });
  }

  return (
    <>
      <PageBreadcrumb
        pageTitle="Etkinlik"
        description="Personelin yaptığı işlemler: yayınlama, silme, rol ve hesap değişiklikleri, girişler. 365 gün saklanır."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <SegmentedTabs
            label="Alan"
            items={[undefined, ...(Object.keys(AUDIT_AREAS) as AuditArea[])].map((a) => ({
              key: a ?? "hepsi",
              label: a ? AUDIT_AREAS[a] : "Tümü",
              href: qs("/admin/etkinlik", { alan: a, kisi }),
              active: a === secili,
            }))}
          />
          {kisi ? (
            <Link
              href={qs("/admin/etkinlik", { alan: secili })}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-theme-sm font-medium text-gray-700 transition hover:bg-gray-200 sm:ms-auto"
            >
              {kisiBilgisi ? staffName(kisiBilgisi) : `Personel #${kisi}`} <X className="size-3.5" aria-label="Kişi süzgecini kaldır" />
            </Link>
          ) : null}
        </div>

        {gunler.length === 0 ? (
          <div className="border-t border-gray-100">
            <EmptyState icon={<History />} title="Kayıt yok" description="Bu süzgeçte henüz işlem kaydı yok." />
          </div>
        ) : (
          <Table className="border-t border-gray-100">
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Saat</TableCell>
                <TableCell isHeader>İşlem</TableCell>
                <TableCell isHeader>Alan</TableCell>
              </TableRow>
            </TableHeader>
            {gunler.map((g) => (
              <TableBody key={g.anahtar}>
                <TableRow className="bg-gray-50">
                  <TableCell isHeader scope="colgroup" colSpan={3} className="tracking-wide uppercase">
                    {gunBasligi(g.anahtar)}
                  </TableCell>
                </TableRow>
                {g.kayitlar.map((e) => {
                  const adres = hedefAdresi(e);
                  const a = alan(e);
                  const kim = personName(e.actor) ?? e.actor_email ?? "Oturumsuz istek";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="w-16 align-top" nowrap>
                        <time dateTime={e.created_at} className="tabular">
                          {saat(e.created_at)}
                        </time>
                      </TableCell>
                      <TableCell className="min-w-64">
                        <p className="text-gray-800">
                          {e.actor_id ? (
                            <Link href={qs("/admin/etkinlik", { alan: secili, kisi: e.actor_id })} className="font-medium hover:text-brand-500">
                              {kim}
                            </Link>
                          ) : (
                            <span className="font-medium">{kim}</span>
                          )}{" "}
                          <span className="text-gray-500">{e.summary}</span>
                        </p>
                        {adres ? (
                          <Link href={adres} className="mt-0.5 inline-flex items-center gap-0.5 text-theme-xs font-medium text-brand-500 hover:text-brand-600">
                            Aç <ArrowUpRight className="size-3" aria-hidden />
                          </Link>
                        ) : null}
                      </TableCell>
                      <TableCell align="end" className="align-top">
                        <Badge size="sm" color={ALAN_RENGI[a]}>
                          {AUDIT_AREAS[a]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            ))}
          </Table>
        )}
      </Card>

      <Pagination currentPage={sonuc.pagination.page} totalPages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
