import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircleIcon, GroupIcon, ListIcon, PieChartIcon } from "@/icons/index";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { PACKAGE_STATE_LABEL, loadPackageHealth, loadTopicPool } from "@/lib/checkup/pool";
import { GRADE_LABEL, QUESTION_STATUS_LABEL, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import type { TopicBreakdown } from "@/lib/checkup/shared/scoring";
import { GateNotice } from "@/components/checkup/GateNotice";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Meter,
  Pill,
  StatCard,
  buttonClass,
  type Tone,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Genel bakış" };

const GUN = 86_400_000;
const TZ = "Europe/Istanbul";

/** Bir tarihin Türkiye'deki takvim günü: "2026-09-21". */
const gunAnahtari = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

const STATE_TONE: Record<string, Tone> = { ready: "ok", narrow: "warn", blocked: "bad" };

export default async function CheckupOverviewPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;

  // Öğrenci adı/e-postası yalnızca yönetici ve müdüre (KVKK: en az kişi).
  const kisisel = MANAGE_ROLES.includes(gate.staff.role);
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * GUN);
  const d14 = new Date(now.getTime() - 14 * GUN);
  const d30 = new Date(now.getTime() - 30 * GUN);

  const [
    ogrenci,
    yeniOgrenci,
    tamamlanan,
    tamamlanan7,
    suruyor,
    basari30,
    soruDurum,
    pool,
    gunlukTest,
    gunlukKayit,
    sonuclar30,
    sonTestler,
    sonKayitlar,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: d7 } } }),
    db.checkupSession.count({ where: { status: "SUBMITTED" } }),
    db.checkupSession.count({ where: { status: "SUBMITTED", submittedAt: { gte: d7 } } }),
    db.checkupSession.count({ where: { status: "IN_PROGRESS", expiresAt: { gt: now } } }),
    db.checkupResult.aggregate({
      where: { computedAt: { gte: d30 } },
      _sum: { correctCount: true, wrongCount: true, blankCount: true },
      _count: { _all: true },
    }),
    db.question.groupBy({ by: ["status"], _count: { _all: true } }),
    loadTopicPool(),
    // Günler Türkiye saatiyle kesiliyor; sunucu UTC'de çalışsa da gece 01:00'deki
    // test "dün"e yazılmasın. (Prisma DateTime = saat dilimsiz UTC.)
    db.$queryRaw<{ gun: string; n: number }[]>`
      SELECT to_char(("submittedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS gun,
             count(*)::int AS n
      FROM "CheckupSession"
      WHERE status = 'SUBMITTED' AND "submittedAt" >= ${d14}
      GROUP BY 1
    `,
    db.$queryRaw<{ gun: string; n: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS gun,
             count(*)::int AS n
      FROM "User"
      WHERE role = 'STUDENT' AND "createdAt" >= ${d14}
      GROUP BY 1
    `,
    db.checkupResult.findMany({
      where: { computedAt: { gte: d30 } },
      orderBy: { computedAt: "desc" },
      take: 2000,
      select: { topicBreakdown: true },
    }),
    kisisel
      ? db.checkupSession.findMany({
          where: { status: "SUBMITTED" },
          orderBy: { submittedAt: "desc" },
          take: 8,
          select: {
            id: true,
            submittedAt: true,
            user: { select: { id: true, name: true } },
            package: { select: { name: true } },
            result: {
              select: { correctCount: true, wrongCount: true, blankCount: true, netScore: true },
            },
          },
        })
      : Promise.resolve([]),
    kisisel
      ? db.user.findMany({
          where: { role: "STUDENT" },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, name: true, email: true, grade: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const health = await loadPackageHealth(pool);

  // ── Özet sayılar ─────────────────────────────────────────
  const soruSayisi = (s: string) => soruDurum.find((r) => r.status === s)?._count._all ?? 0;
  const yayinda = soruSayisi("PUBLISHED");
  const hazirlikta = soruSayisi("DRAFT") + soruSayisi("REVIEW");

  const s = basari30._sum;
  const soru30 = (s.correctCount ?? 0) + (s.wrongCount ?? 0) + (s.blankCount ?? 0);
  const oran30 = soru30 > 0 ? (s.correctCount ?? 0) / soru30 : null;

  // ── Son 14 gün ───────────────────────────────────────────
  const testMap = new Map(gunlukTest.map((r) => [r.gun, Number(r.n)]));
  const kayitMap = new Map(gunlukKayit.map((r) => [r.gun, Number(r.n)]));
  const gunler = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * GUN);
    const k = gunAnahtari(d);
    return {
      k,
      gun: Number(k.slice(8, 10)),
      etiket: trDate(d, { year: false }),
      test: testMap.get(k) ?? 0,
      kayit: kayitMap.get(k) ?? 0,
    };
  });
  const tepe = Math.max(1, ...gunler.map((g) => Math.max(g.test, g.kayit)));
  const yukseklik = (n: number) => (n === 0 ? "0%" : Math.max(4, (n / tepe) * 100) + "%");
  const test14 = gunler.reduce((t, g) => t + g.test, 0);
  const kayit14 = gunler.reduce((t, g) => t + g.kayit, 0);

  // ── En çok zorlanılan konular (son 30 gün, tüm öğrenciler) ──
  const konuMap = new Map<string, { name: string; asked: number; correct: number }>();
  for (const r of sonuclar30) {
    const tb = r.topicBreakdown as unknown as TopicBreakdown | null;
    if (!tb || !Array.isArray(tb.topics)) continue;
    for (const t of tb.topics) {
      const cur = konuMap.get(t.topicId) ?? { name: t.name, asked: 0, correct: 0 };
      cur.asked += t.asked;
      cur.correct += t.correct;
      konuMap.set(t.topicId, cur);
    }
  }
  // Az veriyle "en zor konu" demek gürültü: en az 10 soru görülmüş konular.
  const zorKonular = [...konuMap.values()]
    .filter((k) => k.asked >= 10)
    .map((k) => ({ ...k, ratio: k.correct / k.asked }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 6);

  const sorunluPaket = health.filter((p) => p.status === "PUBLISHED" && p.state !== "ready");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Matematik Check-up
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Öğrenci uygulamasının özeti — kayıtlar, testler ve soru havuzu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/checkup/sorular" variant="outline" size="sm">
            Sorular
          </LinkButton>
          {yazabilir ? (
            <LinkButton href="/checkup/sorular/yeni" size="sm">
              Yeni soru
            </LinkButton>
          ) : null}
        </div>
      </div>

      {sorunluPaket.length > 0 ? (
        <div className="rounded-xl border border-error-500/40 bg-error-50 px-4 py-3 text-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400">
          <strong className="font-semibold">
            Yayındaki {sorunluPaket.length} paketin havuzu yetersiz:
          </strong>{" "}
          {sorunluPaket.map((p) => p.name).join(", ")}.{" "}
          <Link href="/checkup/havuz" className="font-medium underline underline-offset-2">
            Havuz durumuna bak
          </Link>
        </div>
      ) : null}

      {/* ── Göstergeler ───────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kayıtlı öğrenci"
          value={trNumber(ogrenci)}
          sub={yeniOgrenci > 0 ? "+" + yeniOgrenci + " son 7 günde" : "Son 7 günde yeni kayıt yok"}
          icon={<GroupIcon />}
        />
        <StatCard
          label="Tamamlanan test"
          value={trNumber(tamamlanan)}
          sub={tamamlanan7 + " son 7 günde · " + suruyor + " şu an çözülüyor"}
          icon={<CheckCircleIcon />}
          tone="ok"
        />
        <StatCard
          label="Ortalama başarı · 30 gün"
          value={oran30 === null ? "—" : percent(oran30)}
          sub={
            basari30._count._all > 0
              ? basari30._count._all + " testte doğru / sorulan"
              : "Son 30 günde test yok"
          }
          icon={<PieChartIcon />}
          tone="info"
        />
        <StatCard
          label="Yayındaki soru"
          value={trNumber(yayinda)}
          sub={hazirlikta > 0 ? hazirlikta + " taslak / incelemede" : "Bekleyen taslak yok"}
          icon={<ListIcon />}
          tone="warn"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── Son 14 gün ──────────────────────── */}
        <Card>
          <CardHeader
            title="Son 14 gün"
            description={test14 + " tamamlanan test · " + kayit14 + " yeni kayıt"}
            action={
              <div className="flex items-center gap-4 text-theme-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-500" /> Test
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-200 dark:bg-brand-500/40" /> Kayıt
                </span>
              </div>
            }
          />
          <div className="px-5 pb-5 pt-6 sm:px-6">
            <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={`Son 14 günde ${test14} test, ${kayit14} kayıt`}>
              {gunler.map((g) => (
                <div
                  key={g.k}
                  title={g.etiket + ": " + g.test + " test, " + g.kayit + " kayıt"}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <div className="w-full max-w-3 rounded-t bg-brand-500" style={{ height: yukseklik(g.test) }} />
                  <div
                    className="w-full max-w-3 rounded-t bg-brand-200 dark:bg-brand-500/40"
                    style={{ height: yukseklik(g.kayit) }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1 border-t border-gray-100 pt-2 text-[10px] tabular-nums text-gray-400 dark:border-gray-800 sm:gap-2">
              {gunler.map((g, i) => (
                <span key={g.k} className="min-w-0 flex-1 text-center">
                  {i % 2 === 1 || i === 13 ? g.gun : ""}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Paketler ────────────────────────── */}
        <Card>
          <CardHeader
            title="Paketler"
            description="Havuzu yetmeyen paket öğrenciye açılmaz."
            action={
              <Link href="/checkup/paketler" className="text-theme-sm font-medium text-brand-500 hover:text-brand-600">
                Yönet
              </Link>
            }
          />
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {health.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{p.name}</p>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {p.examScope} · {QUESTION_STATUS_LABEL[p.status]} · {p.isFree ? "ücretsiz" : "ücretli"}
                  </p>
                </div>
                <Pill tone={STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Zorlanılan konular ──────────────── */}
        <Card>
          <CardHeader
            title="En çok zorlanılan konular"
            description="Son 30 gün, tüm öğrenciler · en az 10 kez sorulmuş konular"
          />
          {zorKonular.length === 0 ? (
            <EmptyState
              title="Henüz yeterli veri yok"
              description="Bir konunun burada görünmesi için son 30 günde en az 10 kez sorulmuş olması gerekiyor."
            />
          ) : (
            <ul className="space-y-4 px-5 py-5 sm:px-6">
              {zorKonular.map((k) => (
                <li key={k.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-gray-700 dark:text-gray-300">{k.name}</span>
                    <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                      <strong className="font-semibold text-gray-800 dark:text-white/90">{percent(k.ratio)}</strong>{" "}
                      · {k.correct}/{k.asked}
                    </span>
                  </div>
                  <Meter ratio={k.ratio} tone={k.ratio >= 0.75 ? "ok" : k.ratio >= 0.45 ? "warn" : "bad"} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Son testler (kişisel veri) ──────── */}
        {kisisel ? (
          <Card>
            <CardHeader
              title="Son tamamlanan testler"
              action={
                <Link href="/checkup/ogrenciler" className="text-theme-sm font-medium text-brand-500 hover:text-brand-600">
                  Öğrenciler
                </Link>
              }
            />
            {sonTestler.length === 0 ? (
              <EmptyState title="Henüz tamamlanan test yok" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {sonTestler.map((t) => {
                  const r = t.result;
                  const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                  const oran = r && toplam > 0 ? r.correctCount / toplam : null;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={"/checkup/ogrenciler/" + t.user.id}
                          className="block truncate text-sm font-medium text-gray-800 hover:text-brand-500 dark:text-white/90"
                        >
                          {t.user.name}
                        </Link>
                        <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                          {t.package.name}
                          {t.submittedAt ? " · " + relativeDay(t.submittedAt, now) : ""}
                        </p>
                      </div>
                      {r ? (
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                            {trNumber(Number(r.netScore), 2)} net
                          </p>
                          <p className="text-theme-xs tabular-nums text-gray-500 dark:text-gray-400">
                            {r.correctCount}D {r.wrongCount}Y {r.blankCount}B
                            {oran !== null ? " · " + percent(oran) : ""}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : null}
      </div>

      {kisisel ? (
        <Card>
          <CardHeader
            title="Son kayıtlar"
            action={
              <Link href="/checkup/ogrenciler" className={buttonClass("outline", "xs")}>
                Tümü
              </Link>
            }
          />
          {sonKayitlar.length === 0 ? (
            <EmptyState title="Henüz kayıtlı öğrenci yok" />
          ) : (
            <ul className="grid divide-y divide-gray-100 dark:divide-gray-800 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
              {sonKayitlar.map((u) => (
                <li key={u.id}>
                  <Link
                    href={"/checkup/ogrenciler/" + u.id}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:px-6"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      {u.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{u.name}</span>
                      <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                        {u.grade ? GRADE_LABEL[u.grade] + " · " : ""}
                        {relativeDay(u.createdAt, now)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
