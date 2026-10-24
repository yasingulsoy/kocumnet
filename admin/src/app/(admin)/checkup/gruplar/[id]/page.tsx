import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartColumn, CircleCheck, ClipboardList, Users, UsersRound } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { LEVEL_LABEL, examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { RAPOR_GUN, grupRaporu, odevKayitlari, odevOrani, oranaSayilir } from "@/lib/checkup/gruplar";
import { HARITA_EN_AZ_SORU, HARITA_GUCLU_ORAN, HARITA_ORTA_ORAN } from "@/lib/checkup/shared/insights";
import {
  ODEV_DURUM_ETIKETI,
  ODEV_DURUM_RENGI as DURUM_RENGI,
  ODEV_DURUM_SIRASI,
  ODEV_PAKET_TURLERI,
  ODEV_TURU_ETIKETI,
  odevKonuSinavi,
} from "@/lib/checkup/grup-kurallari";
import { denemeHazirliklari } from "@/lib/checkup/mock";
import { soruSinavdaKosulu } from "@/lib/checkup/shared/exam-scope";
import { damgaAdi } from "@/lib/checkup/question-note";
import { ODEV_DURUMLARI, enGecSonTarih, kalanGunMetni, tamamlandiMi, trTarih, varsayilanSonTarih } from "@/lib/checkup/shared/odev";
import { GateNotice } from "@/components/checkup/GateNotice";
import { GrupArsivDugmesi, GrupDuzenleDugmesi } from "@/components/checkup/GrupFormu";
import { GrupIsiHaritasi } from "@/components/checkup/GrupIsiHaritasi";
import { UyeCikarDugmesi, UyeEkle } from "@/components/checkup/GrupUyeleri";
import { OdevIptalDugmesi, OdevUzatDugmesi, YeniOdevDugmesi, type OdevKonusu, type OdevPaketi } from "@/components/checkup/OdevFormu";
import { Meter, levelColor, qs } from "@/components/checkup/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Grup" };

function oranTonu(o: number) {
  return o >= 0.75 ? ("success" as const) : o >= 0.45 ? ("warning" as const) : ("error" as const);
}

/**
 * Grup ayrıntısı: üyeler, ödevler, seçili ödevin üye × durum tablosu ve
 * konu × öğrenci raporu. Öğrenci kişisel verisi: yalnızca yönetici ve müdür.
 *
 * Tamamlanma her açılışta kayıtlardan türetilir (shared/odev.ts, öğrenci
 * ekranıyla aynı kural); saklanan bir "tamamladı" işareti yok.
 */
export default async function GrupPage({ params, searchParams }: PageProps<"/checkup/gruplar/[id]">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();

  const grup = await db.studyGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      examScope: true,
      note: true,
      archivedAt: true,
      createdByStaff: true,
      createdAt: true,
      members: {
        orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
        select: {
          userId: true,
          createdAt: true,
          addedByStaff: true,
          user: { select: { name: true, email: true, grade: true, targetExam: true } },
        },
      },
      assignments: {
        orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          kind: true,
          packageId: true,
          topicId: true,
          questionCount: true,
          title: true,
          note: true,
          startsAt: true,
          dueAt: true,
          createdByStaff: true,
          cancelledAt: true,
          cancelledByStaff: true,
          package: { select: { name: true } },
          topic: { select: { name: true } },
        },
      },
    },
  });
  if (!grup) notFound();

  const arsivde = grup.archivedAt !== null;
  const uyeIdleri = grup.members.map((m) => m.userId);

  const [kayitlar, rapor, paketler, konular] = await Promise.all([
    odevKayitlari(uyeIdleri, grup.assignments),
    grupRaporu(uyeIdleri, grup.examScope, now),
    arsivde
      ? Promise.resolve([])
      : db.package.findMany({
          where: { status: "PUBLISHED", kind: { in: [...ODEV_PAKET_TURLERI] } },
          orderBy: [{ examScope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, examScope: true, kind: true, questionCount: true, durationMinutes: true, isFree: true },
        }),
    arsivde
      ? Promise.resolve([])
      : db.topic.findMany({
          where: { questions: { some: { status: "PUBLISHED" } } },
          orderBy: [{ examScope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            examScope: true,
            examScopes: true,
            parent: { select: { name: true } },
            _count: { select: { questions: { where: { status: "PUBLISHED" } } } },
          },
        }),
  ]);

  /*
   * Ödev formunun seçenekleri öğrencinin gerçekten çözebileceği kadar:
   *  · Deneme yalnızca HAZIRSA (liste tam ve hepsi yayında; shared/deneme.ts):
   *    hazır olmayan denemeyi ödev alan öğrenci "hazırlanıyor" görürdü. Eylem de
   *    reddediyor (actions/gruplar.ts).
   *  · Konu havuzu, alıştırmanın seçeceği sınavda sayılır (grup-kurallari.ts
   *    odevKonuSinavi; soruSinavdaKosulu): grubun sınavına kısıtlanmamış
   *    sorular sayılmaz. Sınavsız grupta konunun bütün yayındaki soruları.
   */
  const denemeHazir = await denemeHazirliklari(paketler.filter((p) => p.kind === "MOCK"));
  const konuSinavlari = new Map(konular.map((k) => [k.id, odevKonuSinavi(grup.examScope, k)]));
  const sinavlar = [...new Set([...konuSinavlari.values()].filter((s) => s !== null))];
  const sinavHavuzlari = new Map(
    await Promise.all(
      sinavlar.map(async (sinav) => {
        const satirlar = await db.question.groupBy({
          by: ["topicId"],
          where: {
            AND: [
              { status: "PUBLISHED", topicId: { in: konular.filter((k) => konuSinavlari.get(k.id) === sinav).map((k) => k.id) } },
              soruSinavdaKosulu(sinav),
            ],
          },
          _count: { _all: true },
        });
        return [sinav, new Map(satirlar.map((r) => [r.topicId, r._count._all]))] as const;
      })
    )
  );
  const konuHavuzu = (k: (typeof konular)[number]) => {
    const sinav = konuSinavlari.get(k.id) ?? null;
    return sinav ? (sinavHavuzlari.get(sinav)?.get(k.id) ?? 0) : k._count.questions;
  };

  // ── Ödevler ve oranlar ──────────────────────────────────
  const odevler = grup.assignments.map((a) => ({ ...a, ...odevOrani(a, grup.members, kayitlar) }));
  const gecerli = odevler.filter((a) => a.cancelledAt === null);
  const acikOdevler = gecerli.filter((a) => a.dueAt.getTime() >= now.getTime());
  const bitenOranlar = gecerli
    .filter((a) => a.dueAt.getTime() < now.getTime())
    .map((a) => a.oran)
    .filter((o): o is number => o !== null);
  const ortalama = bitenOranlar.length > 0 ? bitenOranlar.reduce((t, o) => t + o, 0) / bitenOranlar.length : null;

  // Seçili ödev: adresteki; yoksa son tarihi en yakın açık ödev; yoksa en yeni geçerli ödev.
  const istenen = typeof sp.odev === "string" ? odevler.find((a) => a.id === sp.odev) : undefined;
  const secili =
    istenen ??
    [...acikOdevler].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0] ??
    gecerli[0] ??
    odevler[0] ??
    null;

  // Üye başına: sayılan (iptal edilmemiş, katıldıktan sonra son tarihi gelen) ödevlerden kaçını bitirdi.
  const uyeOzeti = new Map(
    grup.members.map((m) => {
      const sayilan = gecerli.filter((a) => oranaSayilir(m, a));
      const biten = sayilan.filter((a) => {
        const d = a.ilerlemeler.get(m.userId)?.durum;
        return d !== undefined && tamamlandiMi(d);
      }).length;
      return [m.userId, { biten, sayilan: sayilan.length }];
    })
  );

  // ── Ödev formu ──────────────────────────────────────────
  const formPaketleri: OdevPaketi[] = paketler.filter((p) => p.kind !== "MOCK" || denemeHazir.get(p.id));
  const formKonulari: OdevKonusu[] = konular
    .map((k) => ({
      id: k.id,
      name: k.name,
      ustAd: k.parent?.name ?? null,
      examScope: k.examScope,
      examScopes: k.examScopes,
      soruSayisi: konuHavuzu(k),
    }))
    .filter((k) => k.soruSayisi > 0);
  const formOrtak = {
    groupId: grup.id,
    paketler: formPaketleri,
    konular: formKonulari,
    grupSinavi: grup.examScope,
    bugun: trTarih(now),
    enGec: enGecSonTarih(now),
    varsayilanTarih: varsayilanSonTarih(now),
  };
  const odevVerilebilir = !arsivde && (formPaketleri.length > 0 || formKonulari.length > 0);
  const atanabilirKonu = new Set(formKonulari.map((k) => k.id));

  // ── Seçili ödevin tablosu ───────────────────────────────
  const satirlar = secili
    ? grup.members
        .map((m) => ({ m, i: secili.ilerlemeler.get(m.userId)!, sayilir: oranaSayilir(m, secili) }))
        .sort((a, b) => ODEV_DURUM_SIRASI[a.i.durum] - ODEV_DURUM_SIRASI[b.i.durum])
    : [];
  const durumSayilari = ODEV_DURUMLARI.map((d) => ({ d, n: satirlar.filter((s) => s.sayilir && s.i.durum === d).length }));

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/gruplar", label: "Gruplar ve ödevler" },
        ]}
        pageTitle={grup.name}
        badge={
          <>
            {grup.examScope ? (
              <Badge size="sm" color="light">
                {examLabel(grup.examScope)}
              </Badge>
            ) : null}
            {arsivde ? (
              <Badge size="sm" color="warning">
                Arşivde
              </Badge>
            ) : null}
          </>
        }
        description={
          (grup.note ? grup.note + " · " : "") +
          "Kuran " +
          damgaAdi(grup.createdByStaff) +
          ", " +
          trDate(grup.createdAt) +
          "."
        }
        actions={
          <>
            <GrupDuzenleDugmesi
              grup={{ id: grup.id, name: grup.name, examScope: grup.examScope ?? "", note: grup.note ?? "" }}
            />
            <GrupArsivDugmesi id={grup.id} arsivde={arsivde} />
          </>
        }
      />

      {arsivde ? (
        <Alert variant="warning" className="mb-6" title="Bu grup arşivde">
          Ödevleri öğrencilerin ekranında görünmüyor; yeni üye ve ödev eklenmiyor. Kayıtlar duruyor, arşivden alınca hepsi geri gelir.
        </Alert>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-4 md:mb-6 md:gap-6 xl:grid-cols-4">
        <MetricCard compact label="Üye" value={trNumber(grup.members.length)} icon={<Users />} tone="brand" />
        <MetricCard
          compact
          label="Açık ödev"
          value={trNumber(acikOdevler.length)}
          icon={<ClipboardList />}
          hint={gecerli.length - acikOdevler.length > 0 ? gecerli.length - acikOdevler.length + " ödevin süresi doldu" : "Süresi dolan ödev yok"}
        />
        <MetricCard
          compact
          label="Tamamlanma"
          value={ortalama === null ? "—" : percent(ortalama)}
          icon={<CircleCheck />}
          tone={ortalama === null ? "gray" : oranTonu(ortalama)}
          hint={ortalama === null ? "Süresi dolan ödevlerden hesaplanır" : bitenOranlar.length + " süresi dolan ödevin ortalaması"}
        />
        <MetricCard
          compact
          label={`Son ${RAPOR_GUN} gün`}
          value={trNumber(rapor.sonucSayisi)}
          icon={<ChartColumn />}
          hint="üyelerin puanlanmış testi"
        />
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* ── Ödevler ─────────────────────────────────── */}
        <ComponentCard
          className="col-span-12 xl:col-span-8"
          title="Ödevler"
          desc="Satıra dokun: aşağıda üye × durum tablosu açılır. Süresi dolan ödev de görünür; iptal edilen öğrenciden kalkar."
          actions={odevVerilebilir ? <YeniOdevDugmesi {...formOrtak} /> : null}
          flush
        >
          {odevler.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title="Henüz ödev yok"
              description={
                grup.members.length === 0
                  ? "Önce üye ekle; sonra gruba bir test ya da konu alıştırması ver."
                  : "“Ödev ver” ile bir test ya da konu alıştırması ver. Öğrenci kendi ekranında görür."
              }
            />
          ) : (
            <Table>
              <caption className="sr-only">Grubun ödevleri, son tarihi en geç olan en üstte</caption>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Ödev</TableCell>
                  <TableCell isHeader nowrap>
                    Son tarih
                  </TableCell>
                  <TableCell isHeader nowrap>
                    Tamamlanma
                  </TableCell>
                  <TableCell isHeader>
                    <span className="sr-only">İşlem</span>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {odevler.map((a) => {
                  const iptal = a.cancelledAt !== null;
                  const doldu = a.dueAt.getTime() < now.getTime();
                  const ayrinti =
                    a.kind === "PACKAGE"
                      ? (a.package?.name ?? "—")
                      : (a.topic?.name ?? "—") + " · " + (a.questionCount ?? "?") + " soru";
                  return (
                    <TableRow key={a.id} hover selected={secili?.id === a.id} className="relative">
                      <TableCell className="w-full max-w-0 min-w-56">
                        <Link
                          href={qs("/checkup/gruplar/" + grup.id, { odev: a.id }) + "#ilerleme"}
                          aria-current={secili?.id === a.id ? "true" : undefined}
                          className="block truncate font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
                        >
                          {a.title}
                        </Link>
                        <span className="block truncate text-theme-xs">
                          {ODEV_TURU_ETIKETI[a.kind] ?? a.kind} · {ayrinti}
                        </span>
                      </TableCell>
                      <TableCell nowrap>
                        <span className="block text-gray-800">{trDate(a.dueAt, { time: true })}</span>
                        {iptal ? (
                          <Badge size="sm" color="light">
                            İptal edildi
                          </Badge>
                        ) : doldu ? (
                          <span className="text-theme-xs">Süresi doldu</span>
                        ) : (
                          <span className="text-theme-xs">{kalanGunMetni(a.dueAt, now)}</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-36">
                        {a.oran === null ? (
                          <span className="text-theme-xs">Üye yok</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Meter ratio={a.oran} tone={iptal ? "gray" : oranTonu(a.oran)} className="w-16" />
                              <span className="tabular font-medium text-gray-800">{percent(a.oran)}</span>
                            </div>
                            <span className="tabular text-theme-xs">
                              {a.tamamlayan}/{a.sayilan} tamamladı
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell align="end" nowrap>
                        {!iptal && !arsivde ? (
                          <div className="flex justify-end gap-2">
                            <OdevUzatDugmesi id={a.id} baslik={a.title} eskiSonTarih={a.dueAt} />
                            <OdevIptalDugmesi id={a.id} baslik={a.title} />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ComponentCard>

        {/* ── Üyeler ──────────────────────────────────── */}
        <ComponentCard
          className="col-span-12 xl:col-span-4"
          title="Üyeler"
          badge={
            <Badge size="sm" color="light">
              <span className="tabular">{grup.members.length}</span>
            </Badge>
          }
          desc="Öğrenci yalnızca kendi ödevlerini görür; grubun öbür üyelerini görmez."
          flush
        >
          {!arsivde ? (
            <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
              <UyeEkle groupId={grup.id} />
            </div>
          ) : null}
          {grup.members.length === 0 ? (
            <EmptyState icon={<UsersRound />} title="Grupta üye yok" description={arsivde ? undefined : "Yukarıdan ad ya da e-postayla ara, ekle."} />
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {grup.members.map((m) => {
                const oz = uyeOzeti.get(m.userId)!;
                const ayrinti = [gradeLabel(m.user.grade), m.user.targetExam ? examLabel(m.user.targetExam) : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={m.userId} className="relative flex items-center gap-3 px-5 py-3 transition hover:bg-gray-50 sm:px-6">
                    <Avatar name={m.user.name} size="small" decorative />
                    <span className="min-w-0 flex-1">
                      <Link
                        href={"/checkup/ogrenciler/" + m.userId}
                        className="block truncate text-theme-sm font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
                      >
                        {m.user.name}
                      </Link>
                      <span className="block truncate text-theme-xs text-gray-500">{m.user.email}</span>
                      <span className="block truncate text-theme-xs text-gray-500" title={"Ekleyen " + damgaAdi(m.addedByStaff)}>
                        {[ayrinti, "eklendi " + relativeDay(m.createdAt, now), oz.sayilan > 0 ? `${oz.biten}/${oz.sayilan} ödev` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {!arsivde ? <UyeCikarDugmesi groupId={grup.id} userId={m.userId} ad={m.user.name} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </ComponentCard>

        {/* ── Seçili ödevin ilerlemesi ────────────────── */}
        {secili ? (
          <ComponentCard
            id="ilerleme"
            className="col-span-12 scroll-mt-24"
            title={"İlerleme · " + secili.title}
            badge={
              secili.cancelledAt ? (
                <Badge size="sm" color="light">
                  İptal edildi
                </Badge>
              ) : null
            }
            desc={
              (ODEV_TURU_ETIKETI[secili.kind] ?? secili.kind) +
              " · verildi " +
              trDate(secili.startsAt, { time: true }) +
              " (" +
              damgaAdi(secili.createdByStaff) +
              ") · son tarih " +
              trDate(secili.dueAt, { time: true }) +
              (secili.cancelledAt
                ? " · iptal " + trDate(secili.cancelledAt, { time: true }) + " (" + damgaAdi(secili.cancelledByStaff) + ")"
                : "")
            }
            flush
          >
            {secili.note ? (
              <p className="border-t border-gray-100 px-5 py-3 text-theme-sm leading-relaxed break-words whitespace-pre-line text-gray-600 sm:px-6">
                <span className="font-medium text-gray-800">Öğrenciye not: </span>
                {secili.note}
              </p>
            ) : null}
            {satirlar.length === 0 ? (
              <EmptyState icon={<Users />} title="Grupta üye yok" />
            ) : (
              <>
                <ul className="flex flex-wrap gap-2 border-t border-gray-100 px-5 py-3 sm:px-6" aria-label="Durumlara göre üye sayısı">
                  {durumSayilari.map(({ d, n }) => (
                    <li key={d}>
                      <Badge size="sm" color={n > 0 ? DURUM_RENGI[d] : "light"}>
                        {ODEV_DURUM_ETIKETI[d]} <span className="tabular">{n}</span>
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Table>
                  <caption className="sr-only">Üyelerin bu ödevdeki durumu; yapmayanlar en üstte</caption>
                  <TableHeader>
                    <TableRow>
                      <TableCell isHeader>Öğrenci</TableCell>
                      <TableCell isHeader>Durum</TableCell>
                      <TableCell isHeader align="end">
                        {secili.kind === "PACKAGE" ? "Net" : "Soru"}
                      </TableCell>
                      <TableCell isHeader nowrap>
                        Bitirdiği an
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {satirlar.map(({ m, i, sayilir }) => (
                      <TableRow key={m.userId} hover className="relative">
                        <TableCell className="w-full max-w-0 min-w-52">
                          <Link
                            href={"/checkup/ogrenciler/" + m.userId}
                            className="group flex items-center gap-3 after:absolute after:inset-0"
                          >
                            <Avatar name={m.user.name} size="small" decorative />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-gray-800 group-hover:text-brand-500">{m.user.name}</span>
                              <span className="block truncate text-theme-xs">{m.user.email}</span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell nowrap>
                          <Badge size="sm" color={DURUM_RENGI[i.durum]}>
                            {ODEV_DURUM_ETIKETI[i.durum]}
                          </Badge>
                          {!sayilir ? (
                            <span className="mt-1 block text-theme-xs" title="Orana sayılmıyor">
                              son tarihten sonra katıldı
                            </span>
                          ) : null}
                          {i.bosGonderildi ? (
                            <span className="mt-1 block text-theme-xs" title="Hiç işaret konmadan gönderilen test ödevi tamamlamaz">
                              boş gönderildi
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell align="end" nowrap className="tabular">
                          {secili.kind === "PACKAGE" ? (
                            i.net !== null ? (
                              <span className="font-medium text-gray-800">{trNumber(i.net, 2)}</span>
                            ) : (
                              "—"
                            )
                          ) : (
                            <span className={i.cozulen >= i.hedef ? "font-medium text-gray-800" : ""}>
                              {i.cozulen}/{i.hedef}
                            </span>
                          )}
                        </TableCell>
                        <TableCell nowrap>{i.tamamlanmaAni ? trDate(i.tamamlanmaAni, { time: true }) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </ComponentCard>
        ) : null}

        {/* ── Grup raporu ─────────────────────────────── */}
        <ComponentCard
          className="col-span-12"
          title="Grup raporu"
          desc={
            `Son ${RAPOR_GUN} günün puanlanmış testleri` +
            (grup.examScope ? ` · yalnızca ${examLabel(grup.examScope)}` : "") +
            `. Oran ve seviye öğrenci panosundaki kuralla: en az ${HARITA_EN_AZ_SORU} soru, ${percent(HARITA_GUCLU_ORAN)} güçlü, ${percent(HARITA_ORTA_ORAN)} orta.`
          }
          flush
        >
          {rapor.konular.length === 0 ? (
            <EmptyState
              icon={<ChartColumn />}
              title="Henüz rapor yok"
              description={
                grup.members.length === 0
                  ? "Üye ekleyince, üyelerin testleri buraya konu konu düşer."
                  : `Üyeler son ${RAPOR_GUN} günde ${grup.examScope ? examLabel(grup.examScope) + " " : ""}testi bitirmemiş.`
              }
            />
          ) : (
            <>
              {rapor.enZayif.length > 0 ? (
                <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
                  <h3 className="text-theme-xs font-semibold tracking-[0.14em] text-gray-500 uppercase">Grubun en zayıf konuları</h3>
                  <ol className="mt-3 grid gap-3 md:grid-cols-3">
                    {rapor.enZayif.map((k, n) => (
                      <li key={k.topicId} className="flex min-w-0 flex-col gap-2 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-theme-sm font-semibold break-words text-gray-800">
                            <span className="tabular text-gray-500">{n + 1}. </span>
                            {k.name}
                          </p>
                          <Badge size="sm" color={levelColor(k.level)}>
                            {k.level ? LEVEL_LABEL[k.level] : "—"}
                          </Badge>
                        </div>
                        <p className="tabular text-theme-xs text-gray-500">
                          {percent(k.ratio)} · {k.correct}/{k.asked} doğru · {k.zayifUye}/{k.olculenUye} öğrencide zayıf
                        </p>
                        {odevVerilebilir && atanabilirKonu.has(k.topicId) ? (
                          <div>
                            <YeniOdevDugmesi
                              {...formOrtak}
                              ilk={{ kind: "TOPIC_PRACTICE", topicId: k.topicId }}
                              etiket="Bu konuda ödev ver"
                              variant="soft"
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="border-t border-gray-100 pt-2">
                <GrupIsiHaritasi
                  konular={rapor.konular}
                  uyeler={grup.members.map((m) => ({ userId: m.userId, name: m.user.name }))}
                  hucreler={rapor.hucreler}
                />
              </div>
            </>
          )}
        </ComponentCard>
      </div>
    </>
  );
}
