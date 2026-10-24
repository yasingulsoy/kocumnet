import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarClock, ClipboardCheck, ClipboardList, Play } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { ogrenciOdevleri, type OgrenciOdevi } from "@/lib/odev-sorgu";
import { BUGUN_ESIGI_GUN, kalanGun, kalanGunMetni, type OdevDurumu } from "@/lib/odev";
import { Progress, trNumber } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { KonuOdevButonu } from "./KonuOdevButonu";

export const metadata: Metadata = { title: "Ödevler" };

/*
 * Koçun gruplarına verdiği ödevler. Tamamlanma TÜRETİLİR (lib/odev.ts):
 * öğrencinin "yaptım" düğmesi yok; testi bitirince ya da konuda istenen
 * kadar soru çözünce ödev kendiliğinden kapanır. Öğrenci grubun öbür
 * üyelerini görmez (lib/odev-sorgu.ts yalnızca kendi kayıtlarını okur).
 */

const DURUM: Record<OdevDurumu, { etiket: string; renk: BadgeColor }> = {
  TAMAMLANDI: { etiket: "Tamamladın", renk: "success" },
  GEC_TAMAMLANDI: { etiket: "Geç tamamladın", renk: "warning" },
  BASLADI: { etiket: "Başladın", renk: "primary" },
  BASLAMADI: { etiket: "Başlamadın", renk: "light" },
};

const TUR_ETIKETI: Record<OgrenciOdevi["kind"], string> = {
  PACKAGE: "Test",
  TOPIC_PRACTICE: "Konu alıştırması",
};

/** "28 Ekim Çarşamba, 23:59" — Türkiye saatiyle. */
function sonTarih(d: Date): string {
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Durum({ o }: { o: OgrenciOdevi }) {
  if (o.gecikti) {
    return (
      <Badge size="sm" color="error">
        Gecikti
      </Badge>
    );
  }
  const d = DURUM[o.ilerleme.durum];
  return (
    <Badge size="sm" color={d.renk}>
      {d.etiket}
    </Badge>
  );
}

/** Açık ödevin tek düğmesi. Başlatılamıyorsa nedenini söyler. */
function Eylem({ o }: { o: OgrenciOdevi }) {
  if (o.kind === "PACKAGE") {
    if (!o.paket || !o.paket.yayinda) {
      return <p className="text-theme-xs text-gray-500">Bu test şu an yayında değil; koçuna haber ver.</p>;
    }
    return (
      <ButtonLink
        href={`/paketler/${o.paket.slug}`}
        block
        startIcon={<Play />}
        aria-label={`${o.paket.name} testine ${o.acikOturumId ? "dön" : "başla"}`}
      >
        {o.acikOturumId ? "Teste dön" : "Başla"}
      </ButtonLink>
    );
  }
  if (!o.konu) return null;
  // Ödevin alıştırması kaynak test istemez (lib/practice.ts odevKonuCalismasiBaslat).
  return (
    <KonuOdevButonu
      assignmentId={o.id}
      topicName={o.konu.name}
      etiket={o.ilerleme.durum === "BASLADI" ? "Devam et" : "Başla"}
      block
    />
  );
}

function AcikOdev({ o, now }: { o: OgrenciOdevi; now: Date }) {
  const kalan = kalanGun(o.dueAt, now);
  const yakin = !o.gecikti && kalan <= BUGUN_ESIGI_GUN;
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="flex items-center gap-1.5 text-theme-xs text-gray-500">
            {o.kind === "PACKAGE" ? (
              <ClipboardList className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <BookOpenCheck className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 truncate">
              {o.grupAdi} · {TUR_ETIKETI[o.kind]}
            </span>
          </p>
          <h3 className="mt-1 font-display text-base font-semibold break-words text-gray-800">{o.title}</h3>
          {o.note ? (
            <p className="mt-1 text-theme-sm leading-relaxed break-words whitespace-pre-line text-gray-600">{o.note}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-theme-xs text-gray-500">
            <Durum o={o} />
            <span
              className={cx(
                "inline-flex items-center gap-1",
                o.gecikti ? "font-semibold text-error-600" : yakin ? "font-semibold text-warning-700" : ""
              )}
            >
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              {sonTarih(o.dueAt)} · {kalanGunMetni(o.dueAt, now)}
            </span>
            {o.kind === "PACKAGE" && o.paket ? (
              <span className="tabular">
                {o.paket.questionCount} soru · {o.paket.durationMinutes} dk
              </span>
            ) : null}
          </div>
          {/* Sayılmayan deneme: öğrenci "yaptım ama tamamlanmadı" diye şaşırmasın (lib/odev.ts). */}
          {o.kind === "PACKAGE" && (o.ilerleme.yarimKaldi || o.ilerleme.bosGonderildi) ? (
            <p className="mt-2 text-theme-xs font-medium text-warning-700">
              {o.ilerleme.yarimKaldi
                ? "Son denemen yarım kaldı: soruların yarısından azını işaretledin, ödeve sayılmadı. Testi yeniden çöz."
                : "Testi hiç işaretlemeden gönderdin; ödeve sayılmadı. Testi yeniden çöz."}
            </p>
          ) : null}
          {o.kind === "TOPIC_PRACTICE" ? (
            <div className="mt-3 max-w-sm">
              <Progress
                value={(Math.min(o.ilerleme.cozulen, o.ilerleme.hedef) / o.ilerleme.hedef) * 100}
                label={`${o.title}: ${o.ilerleme.hedef} sorudan ${o.ilerleme.cozulen} soru çözüldü`}
                className="h-1.5"
              />
              <p className="tabular mt-1 text-theme-xs text-gray-500">
                {o.ilerleme.cozulen}/{o.ilerleme.hedef} soru · süre yok, her cevaptan sonra çözümü görürsün
              </p>
            </div>
          ) : null}
        </div>
        <div className="w-full sm:w-48 sm:shrink-0">
          <Eylem o={o} />
        </div>
      </div>
    </li>
  );
}

export default async function OdevlerPage() {
  const user = await requirePageUser();
  const now = new Date();
  const { grupSayisi, acik, gecmis } = await ogrenciOdevleri(user.id, now);

  return (
    <div className="mx-auto w-full max-w-4xl animate-rise">
      <PageBreadcrumb
        pageTitle="Ödevler"
        description="Koçunun verdiği ödevler. Bitirdiğini sistem kendisi görür: testi bitirdiğinde ya da konuda istenen kadar soru çözdüğünde ödev tamamlanır."
      />

      <div className="space-y-4 md:space-y-6">
        {grupSayisi === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardCheck />}
              title="Henüz bir koçluk grubunda değilsin"
              description="Koçun seni bir gruba eklediğinde verdiği ödevler burada görünür."
              action={<ButtonLink href="/paketler">Testlere göz at</ButtonLink>}
            />
          </Card>
        ) : (
          <ComponentCard
            title="Açık ödevler"
            desc="Son tarihi en yakın olan en üstte."
            badge={
              acik.length > 0 ? (
                <Badge size="sm" color="primary">
                  <span className="tabular">{acik.length}</span>
                </Badge>
              ) : null
            }
            flush
          >
            {acik.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck />}
                title="Açık ödevin yok"
                description="Yeni bir ödev geldiğinde burada görünür. Bu arada bugünkü işine dön."
                action={
                  <ButtonLink href="/panel" variant="outline">
                    Ana sayfaya dön
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {acik.map((o) => (
                  <AcikOdev key={o.id} o={o} now={now} />
                ))}
              </ul>
            )}
          </ComponentCard>
        )}

        {gecmis.length > 0 ? (
          <ComponentCard title="Geçmiş ödevler" desc="Tamamlananlar ve süresi kapananlar, en yeni önce." flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Ödev</TableCell>
                  <TableCell isHeader className="hidden sm:table-cell">
                    Son tarih
                  </TableCell>
                  <TableCell isHeader>Durum</TableCell>
                  <TableCell isHeader align="end">
                    Sonuç
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gecmis.map((o) => {
                  const bitti = o.ilerleme.durum === "TAMAMLANDI" || o.ilerleme.durum === "GEC_TAMAMLANDI";
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="w-full max-w-0 min-w-40">
                        <span className="block truncate font-medium text-gray-800">{o.title}</span>
                        <span className="block truncate text-theme-xs">
                          {o.grupAdi}
                          <span className="sm:hidden"> · {o.dueAt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" })}</span>
                        </span>
                      </TableCell>
                      <TableCell nowrap className="hidden sm:table-cell">
                        {o.dueAt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" })}
                      </TableCell>
                      <TableCell nowrap>
                        {bitti ? (
                          <Badge size="sm" color={DURUM[o.ilerleme.durum].renk}>
                            {DURUM[o.ilerleme.durum].etiket}
                          </Badge>
                        ) : (
                          <Badge size="sm" color="light">
                            Yapılmadı
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell nowrap align="end" className="tabular">
                        {o.kind === "TOPIC_PRACTICE" ? (
                          `${o.ilerleme.cozulen}/${o.ilerleme.hedef} soru`
                        ) : o.ilerleme.net !== null && o.ilerleme.oturumId ? (
                          <Link
                            href={`/sonuc/${o.ilerleme.oturumId}`}
                            className="inline-flex min-h-9 items-center font-medium text-brand-500 transition hover:text-brand-600"
                          >
                            {trNumber(o.ilerleme.net)} net
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ComponentCard>
        ) : null}
      </div>
    </div>
  );
}
