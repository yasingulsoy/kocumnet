import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck, ListChecks, PieChart, Plus, Users } from "lucide-react";
import { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { BLUEPRINT_KINDS, PACKAGE_STATE_LABEL, loadPackageHealth } from "@/lib/checkup/pool";
import { loadItemAnalysis } from "@/lib/checkup/item-analysis";
import { examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import type { TopicBreakdown } from "@/lib/checkup/shared/scoring";
import { GateNotice } from "@/components/checkup/GateNotice";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Meter,
  Notice,
  PACKAGE_STATE_TONE,
  PageHeader,
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
    cozumsuzYayinda,
    hataTipsizYayinda,
    health,
    analiz,
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
    db.question.count({ where: { status: "PUBLISHED", solution: { equals: Prisma.DbNull } } }),
    db.question.count({
      where: { status: "PUBLISHED", choices: { some: { isCorrect: false, errorType: null } } },
    }),
    loadPackageHealth(),
    loadItemAnalysis(),
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
          select: { id: true, name: true, grade: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // ── Özet sayılar ─────────────────────────────────────────
  const soruSayisi = (s: string) => soruDurum.find((r) => r.status === s)?._count._all ?? 0;
  const yayinda = soruSayisi("PUBLISHED");
  const incelemede = soruSayisi("REVIEW");
  const taslak = soruSayisi("DRAFT");

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

  // ── Paketler: yalnızca dikkat isteyenler ─────────────────
  // Katalog paketinde "başlatılamaz" kırmızı alarm: öğrenci görüyor ama başlatamıyor.
  // Seviyeli ve tekrar testi paketleri gizli/kilitli; onlar listede, alarmda değil.
  const yayindakiler = health.filter((p) => p.status === "PUBLISHED");
  const engelli = yayindakiler.filter((p) => BLUEPRINT_KINDS.includes(p.kind) && p.state === "blocked");
  const dikkat = yayindakiler
    .filter((p) => p.state !== "ready")
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "blocked" ? -1 : 1));
  const katalogYayinda = yayindakiler.filter((p) => BLUEPRINT_KINDS.includes(p.kind)).length;

  // ── İçerik kuyruğu: içerik ekibinin "sırada ne var" listesi ──
  const bulgulu = analiz.filter((x) => x.bulgular.length > 0).length;
  const anahtarSupheli = analiz.filter((x) => x.bulgular.some((b) => b.key === "ters")).length;
  const kuyruk: { href: string; label: string; sayi: number; tone: Tone; aciklama: string }[] = [
    {
      href: "/checkup/sorular?durum=REVIEW",
      label: "İncelemede",
      sayi: incelemede,
      tone: "warn",
      aciklama: "Yayına almadan önce ikinci göz",
    },
    {
      href: "/checkup/sorular?durum=DRAFT",
      label: "Taslak",
      sayi: taslak,
      tone: "neutral",
      aciklama: "Yazımı süren sorular",
    },
    {
      href: "/checkup/sorular?durum=PUBLISHED&eksik=cozumsuz",
      label: "Çözümü olmayan yayındaki soru",
      sayi: cozumsuzYayinda,
      tone: "warn",
      aciklama: "Öğrenci yanlışının nasıl çözüldüğünü göremiyor",
    },
    {
      href: "/checkup/sorular?durum=PUBLISHED&eksik=hatatipsiz",
      label: "Hata tipi eksik çeldirici",
      sayi: hataTipsizYayinda,
      tone: "neutral",
      aciklama: "Teşhis bu şıklarda çalışmıyor",
    },
    {
      href: "/checkup/sorular/analiz?bulgu=hepsi",
      label: "Madde analizinde bulgulu soru",
      sayi: bulgulu,
      tone: anahtarSupheli > 0 ? "bad" : "warn",
      aciklama:
        anahtarSupheli > 0
          ? anahtarSupheli + " soru ters ayırt ediyor — anahtarı kontrol et"
          : "Gerçek cevaplara göre gözden geçirilecekler",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matematik Check-up"
        description="Öğrenci uygulamasının özeti — kayıtlar, testler ve soru havuzu."
        actions={
          <>
            <LinkButton href="/checkup/sorular" variant="outline" size="sm">
              Sorular
            </LinkButton>
            {yazabilir ? (
              <LinkButton href="/checkup/sorular/yeni" size="sm">
                <Plus aria-hidden /> Yeni soru
              </LinkButton>
            ) : null}
          </>
        }
      />

      {engelli.length > 0 ? (
        <Notice tone="bad" title={`Yayındaki ${engelli.length} paket başlatılamıyor`}>
          {engelli.map((p) => p.name).join(", ")}. Öğrenci katalogda görüyor ama &quot;Başla&quot;ya basınca
          hata alır.{" "}
          <Link href="/checkup/paketler" className="font-semibold underline underline-offset-2">
            Paketlere bak
          </Link>
        </Notice>
      ) : null}

      {/* ── Göstergeler ───────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kayıtlı öğrenci"
          value={trNumber(ogrenci)}
          sub={yeniOgrenci > 0 ? "+" + yeniOgrenci + " son 7 günde" : "Son 7 günde yeni kayıt yok"}
          icon={<Users />}
        />
        <StatCard
          label="Tamamlanan test"
          value={trNumber(tamamlanan)}
          sub={tamamlanan7 + " son 7 günde · " + suruyor + " şu an çözülüyor"}
          icon={<CircleCheck />}
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
          icon={<PieChart />}
          tone="info"
        />
        <StatCard
          label="Yayındaki soru"
          value={trNumber(yayinda)}
          sub={incelemede + taslak > 0 ? incelemede + taslak + " taslak / incelemede" : "Bekleyen taslak yok"}
          icon={<ListChecks />}
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
              <div className="flex items-center gap-4 text-micro text-ink-faint" aria-hidden>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand" /> Test
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-wash-strong" /> Kayıt
                </span>
              </div>
            }
          />
          <div className="px-5 pb-5 pt-6 sm:px-6">
            <div
              className="flex h-44 items-end gap-1 sm:gap-2"
              role="img"
              aria-label={`Son 14 günde ${test14} tamamlanan test, ${kayit14} yeni kayıt`}
            >
              {gunler.map((g) => (
                <div
                  key={g.k}
                  title={g.etiket + ": " + g.test + " test, " + g.kayit + " kayıt"}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-md hover:bg-surface-hover"
                >
                  <div className="w-full max-w-3 rounded-t bg-brand" style={{ height: yukseklik(g.test) }} />
                  <div
                    className="w-full max-w-3 rounded-t bg-brand-wash-strong"
                    style={{ height: yukseklik(g.kayit) }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1 border-t border-line pt-2 text-micro tabular text-ink-faint sm:gap-2" aria-hidden>
              {gunler.map((g, i) => (
                <span key={g.k} className="min-w-0 flex-1 text-center">
                  {i % 2 === 1 || i === 13 ? g.gun : ""}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* ── İçerik kuyruğu ──────────────────── */}
        <Card>
          <CardHeader title="İçerik kuyruğu" description="Soru havuzunda sırada ne var — her satır süzülmüş listeye açılır." />
          <ul className="divide-y divide-line">
            {kuyruk.map((k) => (
              <li key={k.href}>
                <Link
                  href={k.href}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-medium text-ink group-hover:text-brand">
                      {k.label}
                    </span>
                    <span className="block truncate text-micro text-ink-faint">{k.aciklama}</span>
                  </span>
                  <Pill tone={k.sayi > 0 ? k.tone : "neutral"} className="tabular">
                    {trNumber(k.sayi)}
                  </Pill>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Paketler ────────────────────────── */}
        <Card>
          <CardHeader
            title="Paketler"
            description={katalogYayinda + " katalog paketi yayında. Dikkat isteyenler:"}
            action={
              <Link href="/checkup/paketler" className="text-caption font-medium text-brand hover:text-brand-hover">
                Yönet
              </Link>
            }
          />
          {dikkat.length === 0 ? (
            <EmptyState
              title="Yayındaki bütün paketler başlatılabilir"
              description="Her konuda ihtiyacın en az iki katı yayında soru var."
            />
          ) : (
            <ul className="divide-y divide-line">
              {dikkat.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-caption font-medium text-ink">{p.name}</p>
                    <p className="line-clamp-2 text-micro text-ink-faint">
                      {examLabel(p.examScope)} · {p.summary}
                    </p>
                  </div>
                  <Pill tone={PACKAGE_STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
                </li>
              ))}
              {dikkat.length > 6 ? (
                <li className="px-5 py-2.5 text-micro text-ink-faint sm:px-6">
                  ve {dikkat.length - 6} paket daha —{" "}
                  <Link href="/checkup/paketler" className="font-medium text-brand hover:text-brand-hover">
                    tümü
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </Card>

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
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-caption">
                    <span className="truncate font-medium text-ink-soft">{k.name}</span>
                    <span className="shrink-0 tabular text-ink-faint">
                      <strong className="font-semibold text-ink">{percent(k.ratio)}</strong> · {k.correct}/{k.asked}
                    </span>
                  </div>
                  <Meter ratio={k.ratio} tone={k.ratio >= 0.75 ? "ok" : k.ratio >= 0.45 ? "warn" : "bad"} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {kisisel ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── Son testler (kişisel veri) ──────── */}
          <Card>
            <CardHeader
              title="Son tamamlanan testler"
              action={
                <Link href="/checkup/ogrenciler" className="text-caption font-medium text-brand hover:text-brand-hover">
                  Öğrenciler
                </Link>
              }
            />
            {sonTestler.length === 0 ? (
              <EmptyState title="Henüz tamamlanan test yok" />
            ) : (
              <ul className="divide-y divide-line">
                {sonTestler.map((t) => {
                  const r = t.result;
                  const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                  const oran = r && toplam > 0 ? r.correctCount / toplam : null;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={"/checkup/ogrenciler/" + t.user.id}
                          className="block truncate text-caption font-medium text-ink hover:text-brand"
                        >
                          {t.user.name}
                        </Link>
                        <p className="truncate text-micro text-ink-faint">
                          {t.package.name}
                          {t.submittedAt ? " · " + relativeDay(t.submittedAt, now) : ""}
                        </p>
                      </div>
                      {r ? (
                        <div className="shrink-0 text-right">
                          <p className="text-caption font-semibold tabular text-ink">
                            {trNumber(Number(r.netScore), 2)} net
                          </p>
                          <p className="text-micro tabular text-ink-faint">
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
              <ul className="divide-y divide-line">
                {sonKayitlar.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={"/checkup/ogrenciler/" + u.id}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover sm:px-6"
                    >
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-wash text-micro font-semibold text-brand"
                      >
                        {u.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-caption font-medium text-ink">{u.name}</span>
                        <span className="block truncate text-micro text-ink-faint">
                          {[gradeLabel(u.grade), relativeDay(u.createdAt, now)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
