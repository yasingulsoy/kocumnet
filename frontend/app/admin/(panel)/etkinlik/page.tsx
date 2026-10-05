import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Card, EmptyState, Forbidden, PageHeader, Pagination, Pill, cn, qs } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { getStaffUser, listAudit } from "@/lib/admin/data";
import { AUDIT_AREAS, personName, staffName, type AuditArea, type AuditEntry } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Etkinlik" };

const ALAN_TONU: Record<AuditArea, "brand" | "ok" | "warn" | "neutral"> = {
  blog: "brand",
  message: "ok",
  user: "warn",
  auth: "neutral",
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

const gunAnahtari = (v: string) =>
  new Date(v).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

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

const saat = (v: string) =>
  new Date(v).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

/**
 * Etkinlik (denetim kaydı) — yalnızca yönetici. "Bu yazıyı kim yayından
 * kaldırdı?", "bu hesabı kim açtı?", "mesaja kim döndü?" soruları için.
 * Kayıtlar 365 gün tutulur; mesaj gönderenlerin adı/e-postası yazılmaz.
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
      <PageHeader
        title="Etkinlik"
        description="Personelin yaptığı işlemler: yayınlama, silme, rol ve hesap değişiklikleri, girişler. 365 gün saklanır."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <nav className="scroll-x -mx-1 flex max-w-full gap-1 px-1" aria-label="Alan">
            {[undefined, ...(Object.keys(AUDIT_AREAS) as AuditArea[])].map((a) => {
              const on = a === secili;
              return (
                <Link
                  key={a ?? "hepsi"}
                  href={qs("/admin/etkinlik", { alan: a, kisi })}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-caption font-medium transition",
                    on ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  {a ? AUDIT_AREAS[a] : "Tümü"}
                </Link>
              );
            })}
          </nav>
          {kisi ? (
            <Link
              href={qs("/admin/etkinlik", { alan: secili })}
              className="ms-auto inline-flex items-center gap-1 rounded-full bg-surface-sunk px-2.5 py-1 text-caption font-medium text-ink ring-1 ring-inset ring-line hover:bg-surface-hover"
            >
              {kisiBilgisi ? staffName(kisiBilgisi) : `Personel #${kisi}`} <X className="size-3" aria-label="Kişi süzgecini kaldır" />
            </Link>
          ) : null}
        </div>

        {gunler.length === 0 ? (
          <EmptyState title="Kayıt yok" description="Bu süzgeçte henüz işlem kaydı yok." />
        ) : (
          gunler.map((g) => (
            <section key={g.anahtar} aria-label={gunBasligi(g.anahtar)}>
              <h2 className="sticky top-14 z-10 border-b border-line bg-surface-sunk px-5 py-2 text-micro font-semibold uppercase tracking-wider text-ink-faint lg:top-0">
                {gunBasligi(g.anahtar)}
              </h2>
              <ul className="divide-y divide-line">
                {g.kayitlar.map((e) => {
                  const adres = hedefAdresi(e);
                  const a = alan(e);
                  const kim = personName(e.actor) ?? e.actor_email ?? "Oturumsuz istek";
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                      <time dateTime={e.created_at} className="tabular w-11 shrink-0 pt-0.5 text-micro text-ink-faint">
                        {saat(e.created_at)}
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-ink">
                          {e.actor_id ? (
                            <Link href={qs("/admin/etkinlik", { alan: secili, kisi: e.actor_id })} className="font-medium hover:text-brand">
                              {kim}
                            </Link>
                          ) : (
                            <span className="font-medium">{kim}</span>
                          )}{" "}
                          <span className="text-ink-soft">{e.summary}</span>
                        </p>
                        {adres ? (
                          <Link href={adres} className="mt-0.5 inline-flex items-center gap-0.5 text-micro font-medium text-brand hover:underline">
                            Aç <ArrowUpRight className="size-3" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                      <Pill tone={ALAN_TONU[a]} className="hidden sm:inline-flex">{AUDIT_AREAS[a]}</Pill>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </Card>

      <Pagination page={sonuc.pagination.page} pages={sonuc.pagination.totalPages} href={href} />
    </>
  );
}
