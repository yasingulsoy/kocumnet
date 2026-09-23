import type { Metadata } from "next";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import {
  GRADE_LABEL,
  LEVEL_LABEL,
  SESSION_STATUS_LABEL,
  durationMinutes,
  percent,
  relativeDay,
  trDate,
  trNumber,
} from "@/lib/checkup/format";
import { aggregateTopics, studentStats, type ResultLike } from "@/lib/checkup/shared/insights";
import type { TopicBreakdown } from "@/lib/checkup/shared/scoring";
import { GateNotice } from "@/components/checkup/GateNotice";
import { GrantForm, RevokeButton } from "@/components/checkup/EntitlementControls";
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
            startedAt: true,
            submittedAt: true,
            expiresAt: true,
            package: { select: { name: true, examScope: true } },
            _count: { select: { items: true } },
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
    ogrenci.grade ? GRADE_LABEL[ogrenci.grade] : null,
    ogrenci.targetExam ? "hedef " + ogrenci.targetExam : null,
    "kayıt " + trDate(ogrenci.createdAt),
    ogrenci.lastLoginAt ? "son giriş " + relativeDay(ogrenci.lastLoginAt, now) : "hiç giriş yapmadı",
  ].filter(Boolean);

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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                      <th className="px-5 py-3 font-medium sm:px-6">Paket</th>
                      <th className="px-3 py-3 font-medium">Durum</th>
                      <th className="px-3 py-3 text-end font-medium">D / Y / B</th>
                      <th className="px-3 py-3 text-end font-medium">Net</th>
                      <th className="px-5 py-3 text-end font-medium sm:px-6">Başarı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ogrenci.checkupSessions.map((s) => {
                      // Süresi geçmiş ama henüz "süresi doldu"ya çekilmemiş oturum
                      // (öğrenci uygulaması bunu tembelce, bir sonraki ziyarette yapıyor).
                      const durum =
                        s.status === "IN_PROGRESS" && s.expiresAt < now ? "EXPIRED" : s.status;
                      const r = s.result;
                      const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                      return (
                        <tr key={s.id}>
                          <td className="px-5 py-3 sm:px-6">
                            <p className="font-medium text-gray-800 dark:text-white/90">{s.package.name}</p>
                            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                              {trDate(s.submittedAt ?? s.startedAt, { time: true })}
                              {r ? " · " + durationMinutes(r.totalTimeMs) : ""}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <Pill tone={SESSION_TONE[durum]}>{SESSION_STATUS_LABEL[durum]}</Pill>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-end tabular-nums text-gray-600 dark:text-gray-400">
                            {r ? r.correctCount + " / " + r.wrongCount + " / " + r.blankCount : "—"}
                          </td>
                          <td className="px-3 py-3 text-end font-medium tabular-nums text-gray-800 dark:text-white/90">
                            {r ? trNumber(Number(r.netScore), 2) : "—"}
                          </td>
                          <td className="px-5 py-3 text-end tabular-nums text-gray-800 dark:text-white/90 sm:px-6">
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
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {konular.map((k) => (
                  <li key={k.topicId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{k.name}</p>
                      <p className="text-theme-xs tabular-nums text-gray-500 dark:text-gray-400">
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

        {/* ── Erişim hakları ────────────────── */}
        <Card>
          <CardHeader
            title="Erişim hakları"
            description="Ücretli paketleri açar. Geri alınan hak silinmez, kayıt olarak kalır."
          />
          <div className="space-y-5 p-5 sm:p-6">
            {aktifHaklar.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aktif erişim hakkı yok.</p>
            ) : (
              <ul className="space-y-3">
                {aktifHaklar.map((e) => {
                  const kapsam = e.package?.name ?? "Tüm paketler";
                  return (
                    <li key={e.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{kapsam}</p>
                          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                            {e.expiresAt ? trDate(e.expiresAt) + " tarihine kadar" : "Süresiz"}
                            {" · "}
                            {e.source}
                          </p>
                        </div>
                        <RevokeButton id={e.id} label={kapsam} />
                      </div>
                      {e.note || e.grantedByStaff ? (
                        <p className="mt-2 border-t border-gray-100 pt-2 text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                          {e.note ? <span className="text-gray-700 dark:text-gray-300">{e.note} · </span> : null}
                          {trDate(e.createdAt)}
                          {e.grantedByStaff ? " · veren: " + e.grantedByStaff : ""}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Hak ver</p>
              {ucretliPaketler.length === 0 ? (
                <Notice tone="info" className="mb-4">
                  Şu an tüm paketler ücretsiz; tek tek hak vermeye gerek yok. Abonelik yine de
                  önceden verilebilir — paket ücretliye çevrildiğinde geçerli olur.
                </Notice>
              ) : null}
              <GrantForm userId={ogrenci.id} packages={ucretliPaketler} />
            </div>

            {gecmisHaklar.length > 0 ? (
              <details className="border-t border-gray-100 pt-4 dark:border-gray-800">
                <summary className="cursor-pointer select-none text-theme-sm font-medium text-gray-600 hover:text-brand-500 dark:text-gray-400">
                  Geçmiş haklar ({gecmisHaklar.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {gecmisHaklar.map((e) => (
                    <li key={e.id} className="text-theme-xs text-gray-500 dark:text-gray-400">
                      <span className={clsx("font-medium", "text-gray-700 line-through dark:text-gray-300")}>
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
    </>
  );
}
