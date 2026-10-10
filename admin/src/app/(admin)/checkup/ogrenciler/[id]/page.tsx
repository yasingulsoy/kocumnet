import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Circle, CircleCheck, Clock, PieChart, ShieldCheck, TrendingUp } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import {
  LEVEL_LABEL,
  SESSION_STATUS_LABEL,
  durationMinutes,
  examLabel,
  gradeLabel,
  percent,
  relativeDay,
  trDate,
  trNumber,
} from "@/lib/checkup/format";
import { aggregateTopics, studentStats, type ResultLike } from "@/lib/checkup/shared/insights";
import type { TopicBreakdown } from "@/lib/checkup/shared/scoring";
import { GateNotice } from "@/components/checkup/GateNotice";
import { GrantForm, RevokeButton } from "@/components/checkup/EntitlementControls";
import { CoachNoteEditor } from "@/components/checkup/CoachNoteEditor";
import { PuanTrendi, type PuanNoktasi } from "@/components/checkup/Grafikler";
import { Meter, levelColor, levelTone } from "@/components/checkup/ui";
import { haftaBasi, haftaEtiketi } from "@/lib/checkup/shared/coaching";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { MeterList } from "@/components/tailadmin/charts/MeterList";
import { cx } from "@/components/tailadmin/cx";
import { ProfileCard } from "@/components/tailadmin/profile/ProfileCard";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Öğrenci" };

const SESSION_RENGI: Record<string, BadgeColor> = {
  SUBMITTED: "success",
  IN_PROGRESS: "info",
  EXPIRED: "light",
  ABANDONED: "light",
};

const SEVIYE_SIRASI: Record<string, number> = { WEAK: 0, MEDIUM: 1, STRONG: 2 };

const PLAN_IS_ETIKETI: Record<string, string> = {
  STUDY: "Konu tekrarı",
  SOLVE: "Soru çözümü",
  REVIEW: "Yanlış analizi",
  RETEST: "Kontrol testi",
};

/** Yönelme eki sayının okunuşuna göre değişir: bire, ikiye, üçe. */
const SEVIYEYE: Record<number, string> = { 1: "1'e", 2: "2'ye", 3: "3'e" };

const KOSU_DURUMU: Record<string, { etiket: string; renk: BadgeColor }> = {
  IN_PROGRESS: { etiket: "Sürüyor", renk: "primary" },
  COMPLETED: { etiket: "Tamamlandı", renk: "success" },
  STOPPED: { etiket: "Kapıda durdu", renk: "warning" },
};

export default async function StudentDetailPage({ params }: PageProps<"/checkup/ogrenciler/[id]">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const { id } = await params;
  const now = new Date();

  const [ogrenci, ucretliPaketler] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        grade: true,
        targetExam: true,
        createdAt: true,
        lastLoginAt: true,
        // Alıştırma (PRACTICE) bu listeye ve istatistiklere girmez: ölçüm değil.
        checkupSessions: {
          where: { kind: { not: "PRACTICE" } },
          orderBy: { startedAt: "desc" },
          take: 100,
          select: {
            id: true,
            status: true,
            kind: true,
            stageLevel: true,
            stageKind: true,
            startedAt: true,
            submittedAt: true,
            expiresAt: true,
            focusTopic: { select: { name: true } },
            package: { select: { name: true, examScope: true } },
            result: {
              select: {
                correctCount: true,
                wrongCount: true,
                blankCount: true,
                netScore: true,
                totalTimeMs: true,
                computedAt: true,
                topicBreakdown: true,
                examScope: true,
              },
            },
          },
        },
        // Koçun haftalık döngüsü: plan verildi mi, uygulandı mı? Son dört hafta.
        studyPlans: {
          orderBy: { weekStart: "desc" },
          take: 4,
          select: {
            id: true,
            weekStart: true,
            status: true,
            examScope: true,
            coachNote: true,
            items: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                kind: true,
                title: true,
                doneAt: true,
                verifiedBySessionId: true,
                carriedFrom: true,
              },
            },
          },
        },
        levelRuns: {
          orderBy: { startedAt: "desc" },
          take: 10,
          select: {
            id: true,
            examScope: true,
            status: true,
            reachedLevel: true,
            unlockedLevel: true,
            stoppedAtLevel: true,
            pendingRemedialIds: true,
            startedAt: true,
            finishedAt: true,
          },
        },
        entitlements: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            expiresAt: true,
            source: true,
            note: true,
            revokedAt: true,
            createdAt: true,
            grantedByStaff: true,
            revokedByStaff: true,
            package: { select: { name: true } },
          },
        },
      },
    }),
    db.package.findMany({
      where: { isFree: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!ogrenci) notFound();

  // Öğrenci panosuyla AYNI hesap (shared/insights): burada "zayıf" görünen
  // konu, öğrencinin kendi ekranında da zayıf görünür.
  const sonuclar: ResultLike[] = ogrenci.checkupSessions.flatMap((s) =>
    s.result
      ? [
          {
            correctCount: s.result.correctCount,
            wrongCount: s.result.wrongCount,
            blankCount: s.result.blankCount,
            netScore: Number(s.result.netScore),
            totalTimeMs: s.result.totalTimeMs,
            computedAt: s.result.computedAt,
            topicBreakdown: s.result.topicBreakdown as unknown as TopicBreakdown,
          },
        ]
      : []
  );
  const ozet = studentStats(sonuclar);
  const konular = aggregateTopics(sonuclar).sort(
    (a, b) =>
      (a.level ? SEVIYE_SIRASI[a.level] : 3) - (b.level ? SEVIYE_SIRASI[b.level] : 3) || a.ratio - b.ratio
  );

  /** Testin türüne göre ikinci satır: kontrol testinin konusu, seviyeli aşamanın seviyesi. */
  const testTuru = (s: (typeof ogrenci.checkupSessions)[number]) => {
    if (s.kind === "TOPIC_RETEST") return "Kontrol testi" + (s.focusTopic ? " · " + s.focusTopic.name : "");
    if (s.kind === "LEVEL_STAGE" && s.stageLevel) {
      return "Seviye " + s.stageLevel + (s.stageKind === "REMEDIAL" ? " · telafi turu" : "");
    }
    return null;
  };

  /*
   * Başarı eğilimi yalnızca ÖLÇÜMLERDEN (öğrenci uygulamasının Gelişim
   * ekranıyla aynı karar): 5 soruluk kontrol testi tek bir zayıf konuyu
   * yeniden ölçüyor, çizgiye girerse grafik sebepsiz düşer. Sınavlar ayrı.
   */
  const trend: PuanNoktasi[] = ogrenci.checkupSessions
    .filter((s) => s.result && s.kind !== "TOPIC_RETEST")
    .map((s) => {
      const r = s.result!;
      const sorulan = r.correctCount + r.wrongCount + r.blankCount;
      const tur = testTuru(s);
      return {
        zaman: r.computedAt.getTime(),
        nokta: {
          etiket: trDate(r.computedAt, { year: false }),
          baslik: s.package.name + (tur ? " · " + tur : "") + " · " + trDate(r.computedAt, { time: true }),
          basari: sorulan > 0 ? Math.round((r.correctCount / sorulan) * 1000) / 10 : 0,
          net: Number(r.netScore),
          sinav: examLabel(r.examScope ?? s.package.examScope),
        },
      };
    })
    .sort((a, b) => a.zaman - b.zaman)
    .map((x) => x.nokta);

  const aktifHaklar = ogrenci.entitlements.filter(
    (e) => !e.revokedAt && (e.expiresAt === null || e.expiresAt > now)
  );
  const gecmisHaklar = ogrenci.entitlements.filter((e) => !aktifHaklar.includes(e));

  const [buHafta, ...oncekiHaftalar] = ogrenci.studyPlans;
  // Öğrenci yalnızca İÇİNDE BULUNULAN haftanın planını görüyor (app/lib/plan.ts
  // aktifPlan); koç notu da yalnızca ona yazılabilir. Hafta sınırı uygulamanınki.
  const guncelHafta = Boolean(buHafta && buHafta.weekStart.getTime() === haftaBasi(now).getTime());

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/ogrenciler", label: "Öğrenciler" },
        ]}
        pageTitle="Öğrenci"
        currentLabel={ogrenci.name}
      />

      <ProfileCard
        className="mb-6"
        name={ogrenci.name}
        meta={[ogrenci.email, ogrenci.phone].filter((x): x is string => Boolean(x))}
        badges={
          <>
            {gradeLabel(ogrenci.grade) ? (
              <Badge size="sm" color="light">
                {gradeLabel(ogrenci.grade)}
              </Badge>
            ) : null}
            {ogrenci.targetExam ? (
              <Badge size="sm" color="primary">
                hedef {examLabel(ogrenci.targetExam)}
              </Badge>
            ) : null}
          </>
        }
        details={[
          { label: "Kayıt", value: trDate(ogrenci.createdAt) },
          { label: "Son giriş", value: ogrenci.lastLoginAt ? relativeDay(ogrenci.lastLoginAt, now) : "hiç giriş yapmadı" },
          { label: "Aktif erişim hakkı", value: aktifHaklar.length ? aktifHaklar.length + " hak" : "yok" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <MetricCard label="Tamamlanan test" value={ozet.testCount} icon={<CircleCheck />} tone="brand" />
        <MetricCard
          label="Genel başarı"
          value={ozet.testCount ? percent(ozet.avgRatio) : "—"}
          icon={<PieChart />}
          tone="success"
          hint="tüm testlerde doğru / sorulan"
        />
        <MetricCard
          label="Son net"
          value={ozet.lastNet === null ? "—" : trNumber(ozet.lastNet, 2)}
          icon={<TrendingUp />}
          tone={ozet.trend === null ? "gray" : ozet.trend >= 0 ? "success" : "error"}
          badge={
            ozet.trend === null ? undefined : (
              <Badge size="sm" color={ozet.trend >= 0 ? "success" : "error"}>
                {(ozet.trend > 0 ? "+" : "") + ozet.trend} puan
              </Badge>
            )
          }
          hint={ozet.trend === null ? "karşılaştıracak önceki test yok" : "başarı önceki teste göre"}
        />
        <MetricCard
          label="Toplam çalışma"
          value={ozet.totalMinutes + " dk"}
          icon={<Clock />}
          tone="warning"
          hint="testlerde geçen süre"
        />
      </div>

      <div className="mt-6 grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 md:space-y-6">
          {/* ── Başarı eğilimi (ApexCharts) ──── */}
          {trend.length > 0 ? (
            <PuanTrendi noktalar={trend} varsayilanSinav={ogrenci.targetExam ? examLabel(ogrenci.targetExam) : null} />
          ) : null}

          {/* ── Test geçmişi ─────────────────── */}
          <ComponentCard title="Test geçmişi" desc="Yarım kalan ve süresi dolanlar dahil; alıştırmalar hariç." flush>
            {ogrenci.checkupSessions.length === 0 ? (
              <EmptyState icon={<CircleCheck />} title="Henüz test başlatmadı" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader>Paket</TableCell>
                    <TableCell isHeader>Durum</TableCell>
                    <TableCell isHeader align="end" nowrap>
                      D / Y / B
                    </TableCell>
                    <TableCell isHeader align="end">
                      Net
                    </TableCell>
                    <TableCell isHeader align="end">
                      Başarı
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ogrenci.checkupSessions.map((s) => {
                    // Süresi geçmiş ama henüz "süresi doldu"ya çekilmemiş oturum
                    // (öğrenci uygulaması bunu tembelce, bir sonraki ziyarette yapıyor).
                    const durum = s.status === "IN_PROGRESS" && s.expiresAt < now ? "EXPIRED" : s.status;
                    const r = s.result;
                    const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                    const tur = testTuru(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="min-w-48">
                          <p className="font-medium text-gray-800">{s.package.name}</p>
                          <p className="text-theme-xs">
                            {tur ? tur + " · " : ""}
                            {trDate(s.submittedAt ?? s.startedAt, { time: true })}
                            {r ? " · " + durationMinutes(r.totalTimeMs) : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge size="sm" color={SESSION_RENGI[durum] ?? "light"}>
                            {SESSION_STATUS_LABEL[durum]}
                          </Badge>
                        </TableCell>
                        <TableCell align="end" nowrap className="tabular">
                          {r ? r.correctCount + " / " + r.wrongCount + " / " + r.blankCount : "—"}
                        </TableCell>
                        <TableCell align="end">
                          <span className="tabular font-medium text-gray-800">{r ? trNumber(Number(r.netScore), 2) : "—"}</span>
                        </TableCell>
                        <TableCell align="end">
                          <span className="tabular text-gray-800">{r && toplam > 0 ? percent(r.correctCount / toplam) : "—"}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ComponentCard>

          {/* ── Konu haritası ────────────────── */}
          <ChartCard title="Konu haritası" description="Tüm testler birlikte. Seviye için bir konuda en az 3 soru görülmüş olmalı.">
            {konular.length === 0 ? (
              <EmptyState title="Henüz veri yok" description="Öğrenci bir test tamamladığında konular burada görünür." />
            ) : (
              <MeterList
                max={100}
                items={konular.map((k) => ({
                  key: k.topicId,
                  label: k.name,
                  meta: k.correct + " / " + k.asked + " doğru",
                  value: Math.round(k.ratio * 100),
                  valueLabel: percent(k.ratio),
                  tone: levelTone(k.level),
                  badge: (
                    <Badge size="sm" color={levelColor(k.level)}>
                      {k.level ? LEVEL_LABEL[k.level] : "Az veri"}
                    </Badge>
                  ),
                }))}
              />
            )}
          </ChartCard>
        </div>

        <div className="min-w-0 space-y-4 md:space-y-6">
          {/* ── Haftalık plan ──────────────────── */}
          <ComponentCard title="Çalışma planı" desc="Test sonucundan üretilen haftalık plan ve uygulanışı." flush={!buHafta}>
            {!buHafta ? (
              <EmptyState title="Henüz plan yok" description="Öğrenci bir paket testini tamamlayınca o haftanın planı oluşur." />
            ) : (
              <>
                {!guncelHafta ? (
                  <Alert variant="info" compact>
                    Bu hafta plan yok: öğrenci bu hafta paket testi çözmedi. Aşağıda en son plan görünüyor (
                    {haftaEtiketi(buHafta.weekStart)}). Koç notu yalnızca bu haftanın planına yazılabilir.
                  </Alert>
                ) : null}
                <PlanOzeti plan={buHafta} baslik={(guncelHafta ? "Bu hafta · " : "") + haftaEtiketi(buHafta.weekStart)} />
                <ul className="space-y-2.5">
                  {buHafta.items.map((i) => {
                    const bitti = isBitti(i);
                    const dogrulandi = Boolean(i.verifiedBySessionId);
                    return (
                      <li key={i.id} className="flex items-start gap-2.5 text-theme-sm">
                        <span
                          className={cx(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                            bitti ? "bg-success-500 text-white" : "text-gray-400"
                          )}
                        >
                          {bitti ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block", bitti ? "text-gray-500" : "text-gray-800")}>
                            <span className="sr-only">{bitti ? "Tamamlandı: " : "Bekliyor: "}</span>
                            {i.title}
                          </span>
                          <span className="block text-theme-xs text-gray-500">
                            {PLAN_IS_ETIKETI[i.kind] ?? i.kind}
                            {dogrulandi ? (
                              <span className="ms-1 inline-flex items-center gap-0.5 text-success-700">
                                · <ShieldCheck className="size-3" aria-hidden /> sistem doğruladı
                              </span>
                            ) : null}
                            {i.carriedFrom ? <span className="text-warning-700"> · geçen haftadan devretti</span> : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {guncelHafta ? (
                  <div className="border-t border-gray-100 pt-5">
                    <CoachNoteEditor planId={buHafta.id} note={buHafta.coachNote} />
                  </div>
                ) : buHafta.coachNote ? (
                  <p className="rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Koç notu:</span> {buHafta.coachNote}
                  </p>
                ) : null}
                {oncekiHaftalar.length > 0 ? (
                  <div className="space-y-3 border-t border-gray-100 pt-5">
                    <p className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Önceki haftalar</p>
                    {oncekiHaftalar.map((p) => (
                      <PlanOzeti key={p.id} plan={p} baslik={haftaEtiketi(p.weekStart)} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </ComponentCard>

          {/* ── Seviyeli koşular ──────────────── */}
          {ogrenci.levelRuns.length > 0 ? (
            <ComponentCard title="Seviyeli check-up" desc="Kapı kararları öğrenci uygulamasında verilir." flush>
              <ul className="divide-y divide-gray-100">
                {ogrenci.levelRuns.map((k) => {
                  const d = KOSU_DURUMU[k.status] ?? { etiket: k.status, renk: "light" as BadgeColor };
                  return (
                    <li key={k.id} className="flex items-start justify-between gap-3 px-5 py-3.5 sm:px-6">
                      <div className="min-w-0">
                        <p className="text-theme-sm font-medium text-gray-800">
                          {examLabel(k.examScope)} ·{" "}
                          {k.status === "STOPPED"
                            ? "Seviye " + k.stoppedAtLevel + " kapısında durdu"
                            : "Seviye " + (SEVIYEYE[k.reachedLevel] ?? k.reachedLevel) + " ulaştı"}
                        </p>
                        <p className="text-theme-xs text-gray-500">
                          {trDate(k.startedAt)}
                          {k.finishedAt ? " → " + trDate(k.finishedAt) : ""}
                          {k.pendingRemedialIds.length ? " · telafi bekliyor (" + k.pendingRemedialIds.length + " kazanım)" : ""}
                        </p>
                      </div>
                      <Badge size="sm" color={d.renk}>
                        {d.etiket}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </ComponentCard>
          ) : null}

          {/* ── Erişim hakları ────────────────── */}
          <ComponentCard title="Erişim hakları" desc="Ücretli paketleri açar. Geri alınan hak silinmez, kayıt olarak kalır.">
            {aktifHaklar.length === 0 ? (
              <p className="text-theme-sm text-gray-500">Aktif erişim hakkı yok.</p>
            ) : (
              <ul className="space-y-3">
                {aktifHaklar.map((e) => {
                  const kapsam = e.package?.name ?? "Tüm paketler";
                  return (
                    <li key={e.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-theme-sm font-medium text-gray-800">{kapsam}</p>
                          <p className="mt-0.5 text-theme-xs text-gray-500">
                            {e.expiresAt ? trDate(e.expiresAt) + " tarihine kadar" : "Süresiz"}
                            {" · "}
                            {e.source}
                          </p>
                        </div>
                        <RevokeButton id={e.id} label={kapsam} />
                      </div>
                      {e.note || e.grantedByStaff ? (
                        <p className="mt-2 border-t border-gray-100 pt-2 text-theme-xs text-gray-500">
                          {e.note ? <span className="text-gray-700">{e.note} · </span> : null}
                          {trDate(e.createdAt)}
                          {e.grantedByStaff ? " · veren: " + e.grantedByStaff : ""}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 text-theme-sm font-semibold text-gray-800">Hak ver</p>
              {ucretliPaketler.length === 0 ? (
                <Alert variant="info" compact className="mb-4">
                  Şu an tüm paketler ücretsiz; tek tek hak vermeye gerek yok. Abonelik yine de önceden verilebilir — paket
                  ücretliye çevrildiğinde geçerli olur.
                </Alert>
              ) : null}
              <GrantForm userId={ogrenci.id} packages={ucretliPaketler} />
            </div>

            {gecmisHaklar.length > 0 ? (
              <details className="border-t border-gray-100 pt-4">
                <summary className="cursor-pointer text-theme-sm font-medium text-gray-600 select-none hover:text-brand-500">
                  Geçmiş haklar ({gecmisHaklar.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {gecmisHaklar.map((e) => (
                    <li key={e.id} className="text-theme-xs text-gray-500">
                      <span className="font-medium text-gray-600 line-through">{e.package?.name ?? "Tüm paketler"}</span>
                      {" · "}
                      {e.revokedAt
                        ? "geri alındı " + trDate(e.revokedAt) + (e.revokedByStaff ? " · " + e.revokedByStaff : "")
                        : "süresi doldu " + trDate(e.expiresAt as Date)}
                      {e.note ? " · " + e.note : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </ComponentCard>
        </div>
      </div>
    </>
  );
}

type PlanIsiDurumu = { kind: string; doneAt: Date | null; verifiedBySessionId: string | null };

/**
 * Öğrenci uygulamasındaki tanım (app/lib/plan.ts): kontrol testi işi yalnızca
 * sistem doğruladıysa biter; öğrenci onu elle işaretleyemez.
 */
function isBitti(i: PlanIsiDurumu): boolean {
  return i.kind === "RETEST" ? i.verifiedBySessionId !== null : i.doneAt !== null;
}

/** Bir haftanın uygulanma oranı: "4/6 iş" + çubuk. */
function PlanOzeti({
  plan,
  baslik,
}: {
  plan: { status: string; examScope: string; items: PlanIsiDurumu[] };
  baslik: string;
}) {
  const toplam = plan.items.length;
  const biten = plan.items.filter(isBitti).length;
  const oran = toplam ? biten / toplam : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-theme-sm">
        <span className="truncate font-medium text-gray-800">
          {baslik} <span className="font-normal text-gray-500">· {examLabel(plan.examScope)}</span>
        </span>
        <span className="tabular shrink-0 text-gray-600">
          {biten}/{toplam} iş
        </span>
      </div>
      <Meter ratio={oran} tone={oran >= 0.8 ? "success" : oran >= 0.4 ? "warning" : toplam ? "error" : "gray"} />
    </div>
  );
}
