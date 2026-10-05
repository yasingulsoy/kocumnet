import type { Metadata } from "next";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Check, Circle, ShieldCheck } from "lucide-react";
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
import { haftaBasi, haftaEtiketi } from "@/lib/checkup/shared/coaching";
import {
  Card,
  CardHeader,
  EmptyState,
  Meter,
  Notice,
  PageHeader,
  Pill,
  StatCard,
  levelTone,
  type Tone,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Öğrenci" };

const SESSION_TONE: Record<string, Tone> = {
  SUBMITTED: "ok",
  IN_PROGRESS: "info",
  EXPIRED: "neutral",
  ABANDONED: "neutral",
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

const KOSU_DURUMU: Record<string, { etiket: string; ton: Tone }> = {
  IN_PROGRESS: { etiket: "Sürüyor", ton: "brand" },
  COMPLETED: { etiket: "Tamamlandı", ton: "ok" },
  STOPPED: { etiket: "Kapıda durdu", ton: "warn" },
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
        checkupSessions: {
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

  const aktifHaklar = ogrenci.entitlements.filter(
    (e) => !e.revokedAt && (e.expiresAt === null || e.expiresAt > now)
  );
  const gecmisHaklar = ogrenci.entitlements.filter((e) => !aktifHaklar.includes(e));

  const bilgiler = [
    ogrenci.email,
    ogrenci.phone,
    gradeLabel(ogrenci.grade),
    ogrenci.targetExam ? "hedef " + examLabel(ogrenci.targetExam) : null,
    "kayıt " + trDate(ogrenci.createdAt),
    ogrenci.lastLoginAt ? "son giriş " + relativeDay(ogrenci.lastLoginAt, now) : "hiç giriş yapmadı",
  ].filter(Boolean);

  const [buHafta, ...oncekiHaftalar] = ogrenci.studyPlans;
  // Öğrenci yalnızca İÇİNDE BULUNULAN haftanın planını görüyor (app/lib/plan.ts
  // aktifPlan); koç notu da yalnızca ona yazılabilir. Hafta sınırı uygulamanınki.
  const guncelHafta = Boolean(buHafta && buHafta.weekStart.getTime() === haftaBasi(now).getTime());

  /** Testin türüne göre ikinci satır: kontrol testinin konusu, seviyeli aşamanın seviyesi. */
  const testTuru = (s: (typeof ogrenci.checkupSessions)[number]) => {
    if (s.kind === "TOPIC_RETEST") return "Kontrol testi" + (s.focusTopic ? " · " + s.focusTopic.name : "");
    if (s.kind === "LEVEL_STAGE" && s.stageLevel) {
      return "Seviye " + s.stageLevel + (s.stageKind === "REMEDIAL" ? " · telafi turu" : "");
    }
    return null;
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/ogrenciler", label: "Öğrenciler" },
        ]}
        title={ogrenci.name}
        description={bilgiler.join(" · ")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tamamlanan test" value={ozet.testCount} tone="brand" />
        <StatCard
          label="Genel başarı"
          value={ozet.testCount ? percent(ozet.avgRatio) : "—"}
          sub="tüm testlerde doğru / sorulan"
          tone="ok"
        />
        <StatCard
          label="Son net"
          value={ozet.lastNet === null ? "—" : trNumber(ozet.lastNet, 2)}
          sub={
            ozet.trend === null
              ? "karşılaştıracak önceki test yok"
              : "başarı önceki teste göre " + (ozet.trend > 0 ? "+" : "") + ozet.trend + " puan"
          }
          tone={ozet.trend === null ? "neutral" : ozet.trend >= 0 ? "ok" : "bad"}
        />
        <StatCard label="Toplam çalışma" value={ozet.totalMinutes + " dk"} sub="testlerde geçen süre" tone="info" />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {/* ── Test geçmişi ─────────────────── */}
          <Card>
            <CardHeader title="Test geçmişi" description="Yarım kalan ve süresi dolanlar dahil." />
            {ogrenci.checkupSessions.length === 0 ? (
              <EmptyState title="Henüz test başlatmadı" />
            ) : (
              <div className="scroll-x">
                <table className="data-table min-w-[30rem]">
                  <thead>
                    <tr>
                      <th scope="col">Paket</th>
                      <th scope="col">Durum</th>
                      <th scope="col" className="text-end">
                        D / Y / B
                      </th>
                      <th scope="col" className="text-end">
                        Net
                      </th>
                      <th scope="col" className="text-end">
                        Başarı
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ogrenci.checkupSessions.map((s) => {
                      // Süresi geçmiş ama henüz "süresi doldu"ya çekilmemiş oturum
                      // (öğrenci uygulaması bunu tembelce, bir sonraki ziyarette yapıyor).
                      const durum =
                        s.status === "IN_PROGRESS" && s.expiresAt < now ? "EXPIRED" : s.status;
                      const r = s.result;
                      const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                      const tur = testTuru(s);
                      return (
                        <tr key={s.id}>
                          <td>
                            <p className="font-medium text-ink">{s.package.name}</p>
                            <p className="text-micro text-ink-faint">
                              {tur ? tur + " · " : ""}
                              {trDate(s.submittedAt ?? s.startedAt, { time: true })}
                              {r ? " · " + durationMinutes(r.totalTimeMs) : ""}
                            </p>
                          </td>
                          <td>
                            <Pill tone={SESSION_TONE[durum]}>{SESSION_STATUS_LABEL[durum]}</Pill>
                          </td>
                          <td className="whitespace-nowrap text-end tabular">
                            {r ? r.correctCount + " / " + r.wrongCount + " / " + r.blankCount : "—"}
                          </td>
                          <td className="text-end font-medium tabular text-ink">
                            {r ? trNumber(Number(r.netScore), 2) : "—"}
                          </td>
                          <td className="text-end tabular text-ink">
                            {r && toplam > 0 ? percent(r.correctCount / toplam) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Konu haritası ────────────────── */}
          <Card>
            <CardHeader
              title="Konu haritası"
              description="Tüm testler birlikte. Seviye için bir konuda en az 3 soru görülmüş olmalı."
            />
            {konular.length === 0 ? (
              <EmptyState title="Henüz veri yok" description="Öğrenci bir test tamamladığında konular burada görünür." />
            ) : (
              <ul className="divide-y divide-line">
                {konular.map((k) => (
                  <li
                    key={k.topicId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-caption font-medium text-ink">{k.name}</p>
                      <p className="text-micro tabular text-ink-faint">
                        {k.correct}/{k.asked} doğru · {percent(k.ratio)}
                      </p>
                    </div>
                    <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                      <Meter ratio={k.ratio} tone={levelTone(k.level)} />
                    </div>
                    <Pill tone={levelTone(k.level)}>{k.level ? LEVEL_LABEL[k.level] : "Az veri"}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {/* ── Haftalık plan ──────────────────── */}
          <Card>
            <CardHeader
              title="Çalışma planı"
              description="Test sonucundan üretilen haftalık plan ve uygulanışı."
            />
            {!buHafta ? (
              <EmptyState
                title="Henüz plan yok"
                description="Öğrenci bir paket testini tamamlayınca o haftanın planı oluşur."
              />
            ) : (
              <div className="space-y-4 p-5 sm:p-6">
                {!guncelHafta ? (
                  <Notice tone="info">
                    Bu hafta plan yok: öğrenci bu hafta paket testi çözmedi. Aşağıda en son plan görünüyor (
                    {haftaEtiketi(buHafta.weekStart)}). Koç notu yalnızca bu haftanın planına yazılabilir.
                  </Notice>
                ) : null}
                <PlanOzeti plan={buHafta} baslik={(guncelHafta ? "Bu hafta · " : "") + haftaEtiketi(buHafta.weekStart)} />
                <ul className="space-y-2">
                  {buHafta.items.map((i) => {
                    const bitti = isBitti(i);
                    const dogrulandi = Boolean(i.verifiedBySessionId);
                    return (
                      <li key={i.id} className="flex items-start gap-2.5 text-caption">
                        <span
                          className={clsx(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                            bitti ? "bg-ok-fill text-white" : "text-ink-muted"
                          )}
                        >
                          {bitti ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={clsx("block", bitti ? "text-ink-soft" : "text-ink")}>
                            <span className="sr-only">{bitti ? "Tamamlandı: " : "Bekliyor: "}</span>
                            {i.title}
                          </span>
                          <span className="block text-micro text-ink-faint">
                            {PLAN_IS_ETIKETI[i.kind] ?? i.kind}
                            {dogrulandi ? (
                              <span className="ms-1 inline-flex items-center gap-0.5 text-ok">
                                · <ShieldCheck className="size-3" aria-hidden /> sistem doğruladı
                              </span>
                            ) : null}
                            {i.carriedFrom ? <span className="text-warn"> · geçen haftadan devretti</span> : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {guncelHafta ? (
                  <div className="border-t border-line pt-4">
                    <CoachNoteEditor planId={buHafta.id} note={buHafta.coachNote} />
                  </div>
                ) : buHafta.coachNote ? (
                  <p className="rounded-xl bg-surface-sunk px-3 py-2 text-caption text-ink-soft">
                    <span className="font-semibold text-ink">Koç notu:</span> {buHafta.coachNote}
                  </p>
                ) : null}
                {oncekiHaftalar.length > 0 ? (
                  <div className="space-y-2 border-t border-line pt-4">
                    <p className="text-micro font-semibold uppercase tracking-wide text-ink-faint">Önceki haftalar</p>
                    {oncekiHaftalar.map((p) => (
                      <PlanOzeti key={p.id} plan={p} baslik={haftaEtiketi(p.weekStart)} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {/* ── Seviyeli koşular ──────────────── */}
          {ogrenci.levelRuns.length > 0 ? (
            <Card>
              <CardHeader title="Seviyeli check-up" description="Kapı kararları öğrenci uygulamasında verilir." />
              <ul className="divide-y divide-line">
                {ogrenci.levelRuns.map((k) => {
                  const d = KOSU_DURUMU[k.status] ?? { etiket: k.status, ton: "neutral" as Tone };
                  return (
                    <li key={k.id} className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6">
                      <div className="min-w-0">
                        <p className="text-caption font-medium text-ink">
                          {examLabel(k.examScope)} ·{" "}
                          {k.status === "STOPPED"
                            ? "Seviye " + k.stoppedAtLevel + " kapısında durdu"
                            : "Seviye " + (SEVIYEYE[k.reachedLevel] ?? k.reachedLevel) + " ulaştı"}
                        </p>
                        <p className="text-micro text-ink-faint">
                          {trDate(k.startedAt)}
                          {k.finishedAt ? " → " + trDate(k.finishedAt) : ""}
                          {k.pendingRemedialIds.length
                            ? " · telafi bekliyor (" + k.pendingRemedialIds.length + " kazanım)"
                            : ""}
                        </p>
                      </div>
                      <Pill tone={d.ton}>{d.etiket}</Pill>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {/* ── Erişim hakları ────────────────── */}
          <Card>
            <CardHeader
              title="Erişim hakları"
              description="Ücretli paketleri açar. Geri alınan hak silinmez, kayıt olarak kalır."
            />
            <div className="space-y-5 p-5 sm:p-6">
              {aktifHaklar.length === 0 ? (
                <p className="text-caption text-ink-faint">Aktif erişim hakkı yok.</p>
              ) : (
                <ul className="space-y-3">
                  {aktifHaklar.map((e) => {
                    const kapsam = e.package?.name ?? "Tüm paketler";
                    return (
                      <li key={e.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-caption font-medium text-ink">{kapsam}</p>
                            <p className="mt-0.5 text-micro text-ink-faint">
                              {e.expiresAt ? trDate(e.expiresAt) + " tarihine kadar" : "Süresiz"}
                              {" · "}
                              {e.source}
                            </p>
                          </div>
                          <RevokeButton id={e.id} label={kapsam} />
                        </div>
                        {e.note || e.grantedByStaff ? (
                          <p className="mt-2 border-t border-line pt-2 text-micro text-ink-faint">
                            {e.note ? <span className="text-ink-soft">{e.note} · </span> : null}
                            {trDate(e.createdAt)}
                            {e.grantedByStaff ? " · veren: " + e.grantedByStaff : ""}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="border-t border-line pt-5">
                <p className="mb-3 text-caption font-semibold text-ink">Hak ver</p>
                {ucretliPaketler.length === 0 ? (
                  <Notice tone="info" className="mb-4">
                    Şu an tüm paketler ücretsiz; tek tek hak vermeye gerek yok. Abonelik yine de
                    önceden verilebilir — paket ücretliye çevrildiğinde geçerli olur.
                  </Notice>
                ) : null}
                <GrantForm userId={ogrenci.id} packages={ucretliPaketler} />
              </div>

              {gecmisHaklar.length > 0 ? (
                <details className="border-t border-line pt-4">
                  <summary className="cursor-pointer select-none text-caption font-medium text-ink-soft hover:text-brand">
                    Geçmiş haklar ({gecmisHaklar.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {gecmisHaklar.map((e) => (
                      <li key={e.id} className="text-micro text-ink-faint">
                        <span className="font-medium text-ink-soft line-through">
                          {e.package?.name ?? "Tüm paketler"}
                        </span>
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
            </div>
          </Card>
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
      <div className="mb-1 flex items-baseline justify-between gap-3 text-caption">
        <span className="truncate font-medium text-ink">
          {baslik} <span className="font-normal text-ink-faint">· {examLabel(plan.examScope)}</span>
        </span>
        <span className="tabular shrink-0 text-ink-soft">
          {biten}/{toplam} iş
        </span>
      </div>
      <Meter ratio={oran} tone={oran >= 0.8 ? "ok" : oran >= 0.4 ? "warn" : toplam ? "bad" : "neutral"} />
    </div>
  );
}
