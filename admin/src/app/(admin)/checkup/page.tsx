import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight, CircleCheck, ListChecks, PieChart, Plus, UserPlus, Users } from "lucide-react";
import { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { BLUEPRINT_KINDS, PACKAGE_STATE_LABEL, loadPackageHealth } from "@/lib/checkup/pool";
import { loadItemAnalysis } from "@/lib/checkup/item-analysis";
import { examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import type { TopicBreakdown } from "@/lib/checkup/shared/scoring";
import { GateNotice } from "@/components/checkup/GateNotice";
import { TestGrafigi } from "@/components/checkup/Grafikler";
import { PACKAGE_STATE_COLOR } from "@/components/checkup/ui";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { MeterList } from "@/components/tailadmin/charts/MeterList";
import { ApexRadialChart } from "@/components/tailadmin/extras/charts/ApexRadialChart";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Genel bakış" };

const GUN = 86_400_000;
const TZ = "Europe/Istanbul";

/** Bir tarihin Türkiye'deki takvim günü: "2026-09-21". */
const gunAnahtari = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function HepsiBaglantisi({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600">
      {children} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

export default async function CheckupOverviewPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;

  // Öğrenci adı/e-postası yalnızca yönetici ve müdüre (KVKK: en az kişi).
  const kisisel = MANAGE_ROLES.includes(gate.staff.role);
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * GUN);
  const d30 = new Date(now.getTime() - 30 * GUN);
  // Günlük sayımlar 12 haftayı (en eski pazartesiden bugüne en çok 84 gün) kapsasın.
  const d85 = new Date(now.getTime() - 85 * GUN);

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
    tumPaketler,
    analiz,
    gunlukTest,
    gunlukKayit,
    sonuclar30,
    sonTestler,
    sonKayitlar,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: d7 } } }),
    // Alıştırma (PRACTICE) test sayılmaz: ölçüm değil.
    db.checkupSession.count({ where: { status: "SUBMITTED", kind: { not: "PRACTICE" } } }),
    db.checkupSession.count({ where: { status: "SUBMITTED", kind: { not: "PRACTICE" }, submittedAt: { gte: d7 } } }),
    db.checkupSession.count({ where: { status: "IN_PROGRESS", kind: { not: "PRACTICE" }, expiresAt: { gt: now } } }),
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
      WHERE status = 'SUBMITTED' AND kind <> 'PRACTICE' AND "submittedAt" >= ${d85}
      GROUP BY 1
    `,
    db.$queryRaw<{ gun: string; n: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS gun,
             count(*)::int AS n
      FROM "User"
      WHERE role = 'STUDENT' AND "createdAt" >= ${d85}
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
          where: { status: "SUBMITTED", kind: { not: "PRACTICE" } },
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

  // Gizli alıştırma paketleri (PRACTICE, sınav başına bir tane) ölçüm değil ve
  // panelden yönetilmiyor: konu dağılımı olmadığı için "başlatılamaz" görünürdü.
  const health = tumPaketler.filter((p) => (p.kind as string) !== "PRACTICE");

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
    return { k, etiket: trDate(d, { year: false }), test: testMap.get(k) ?? 0, kayit: kayitMap.get(k) ?? 0 };
  });
  const test14 = gunler.reduce((t, g) => t + g.test, 0);
  const kayit14 = gunler.reduce((t, g) => t + g.kayit, 0);

  // ── Son 12 hafta: pazartesi başlar, Türkiye takvimi; son hafta sürüyor ──
  // Takvim günleri UTC gece yarısı olarak hesaplanır (yaz saati yok, kayma yok).
  const bugun = gunAnahtari(now);
  const bugunUtc = Date.UTC(Number(bugun.slice(0, 4)), Number(bugun.slice(5, 7)) - 1, Number(bugun.slice(8, 10)));
  const buPazartesi = bugunUtc - ((new Date(bugunUtc).getUTCDay() + 6) % 7) * GUN;
  const haftalar = Array.from({ length: 12 }, (_, i) => {
    const bas = buPazartesi - (11 - i) * 7 * GUN;
    let test = 0;
    let kayit = 0;
    for (let g = 0; g < 7; g++) {
      const k = new Date(bas + g * GUN).toISOString().slice(0, 10);
      test += testMap.get(k) ?? 0;
      kayit += kayitMap.get(k) ?? 0;
    }
    // Öğlen UTC: Türkiye saatine çevrilince de aynı gün.
    return { etiket: trDate(new Date(bas + GUN / 2), { year: false }), test, kayit };
  });
  const test12h = haftalar.reduce((t, h) => t + h.test, 0);
  const kayit12h = haftalar.reduce((t, h) => t + h.kayit, 0);

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
  const katalogYayinda = yayindakiler.filter((p) => BLUEPRINT_KINDS.includes(p.kind));
  const engelli = katalogYayinda.filter((p) => p.state === "blocked");
  const dar = katalogYayinda.filter((p) => p.state === "narrow").length;
  const hazir = katalogYayinda.filter((p) => p.state === "ready").length;
  const hazirOrani = katalogYayinda.length ? (hazir / katalogYayinda.length) * 100 : 0;
  const dikkat = yayindakiler
    .filter((p) => p.state !== "ready")
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "blocked" ? -1 : 1));

  // ── İçerik kuyruğu: içerik ekibinin "sırada ne var" listesi ──
  const bulgulu = analiz.filter((x) => x.bulgular.length > 0).length;
  const anahtarSupheli = analiz.filter((x) => x.bulgular.some((b) => b.key === "ters")).length;
  const kuyruk: { href: string; label: string; sayi: number; renk: BadgeColor; aciklama: string }[] = [
    {
      href: "/checkup/sorular?durum=REVIEW",
      label: "İncelemede",
      sayi: incelemede,
      renk: "warning",
      aciklama: "Yayına almadan önce ikinci göz",
    },
    {
      href: "/checkup/sorular?durum=DRAFT",
      label: "Taslak",
      sayi: taslak,
      renk: "light",
      aciklama: "Yazımı süren sorular",
    },
    {
      href: "/checkup/sorular?durum=PUBLISHED&eksik=cozumsuz",
      label: "Çözümü olmayan yayındaki soru",
      sayi: cozumsuzYayinda,
      renk: "warning",
      aciklama: "Öğrenci yanlışının nasıl çözüldüğünü göremiyor",
    },
    {
      href: "/checkup/sorular?durum=PUBLISHED&eksik=hatatipsiz",
      label: "Hata tipi eksik çeldirici",
      sayi: hataTipsizYayinda,
      renk: "light",
      aciklama: "Teşhis bu şıklarda çalışmıyor",
    },
    {
      href: "/checkup/sorular/analiz?bulgu=hepsi",
      label: "Madde analizinde bulgulu soru",
      sayi: bulgulu,
      renk: anahtarSupheli > 0 ? "error" : "warning",
      aciklama:
        anahtarSupheli > 0
          ? anahtarSupheli + " soru ters ayırt ediyor — anahtarı kontrol et"
          : "Gerçek cevaplara göre gözden geçirilecekler",
    },
  ];

  return (
    <>
      <PageBreadcrumb
        pageTitle="Matematik Check-up"
        description="Öğrenci uygulamasının özeti — kayıtlar, testler ve soru havuzu."
        actions={
          <>
            <ButtonLink href="/checkup/sorular" variant="outline" size="xs" startIcon={<ListChecks />}>
              Sorular
            </ButtonLink>
            {yazabilir ? (
              <ButtonLink href="/checkup/sorular/yeni" size="xs" startIcon={<Plus />}>
                Yeni soru
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {engelli.length > 0 ? (
        <Alert
          variant="error"
          title={`Yayındaki ${engelli.length} paket başlatılamıyor`}
          className="mb-6"
          action={
            <ButtonLink href="/checkup/paketler" variant="outline" size="xs">
              Paketlere bak
            </ButtonLink>
          }
        >
          {engelli.map((p) => p.name).join(", ")}. Öğrenci katalogda görüyor ama &quot;Başla&quot;ya basınca hata alır.
        </Alert>
      ) : null}

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <MetricCard
              label="Kayıtlı öğrenci"
              value={trNumber(ogrenci)}
              icon={<Users />}
              tone="brand"
              href={kisisel ? "/checkup/ogrenciler" : undefined}
              badge={
                yeniOgrenci > 0 ? (
                  <Badge size="sm" color="success" startIcon={<UserPlus />}>
                    {yeniOgrenci}
                  </Badge>
                ) : undefined
              }
              hint={yeniOgrenci > 0 ? "+" + yeniOgrenci + " son 7 günde" : "Son 7 günde yeni kayıt yok"}
            />
            <MetricCard
              label="Tamamlanan test"
              value={trNumber(tamamlanan)}
              icon={<CircleCheck />}
              tone="success"
              hint={tamamlanan7 + " son 7 günde · " + suruyor + " şu an çözülüyor"}
            />
            <MetricCard
              label="Ortalama başarı · 30 gün"
              value={oran30 === null ? "—" : percent(oran30)}
              icon={<PieChart />}
              tone="brand"
              hint={basari30._count._all > 0 ? basari30._count._all + " testte doğru / sorulan" : "Son 30 günde test yok"}
            />
            <MetricCard
              label="Yayındaki soru"
              value={trNumber(yayinda)}
              icon={<ListChecks />}
              tone="warning"
              href="/checkup/sorular?durum=PUBLISHED"
              hint={incelemede + taslak > 0 ? incelemede + taslak + " taslak / incelemede" : "Bekleyen taslak yok"}
            />
          </div>

          <TestGrafigi
            gorunumler={[
              {
                key: "gun",
                label: "Son 14 gün",
                aciklama: "Günlük · " + test14 + " tamamlanan test, " + kayit14 + " yeni kayıt",
                categories: gunler.map((g) => g.etiket),
                test: gunler.map((g) => g.test),
                kayit: gunler.map((g) => g.kayit),
              },
              {
                key: "hafta",
                label: "Son 12 hafta",
                aciklama: "Haftalık (pazartesi başlar, son hafta sürüyor) · " + test12h + " test, " + kayit12h + " kayıt",
                categories: haftalar.map((h) => h.etiket),
                test: haftalar.map((h) => h.test),
                kayit: haftalar.map((h) => h.kayit),
              },
            ]}
          />
        </div>

        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-5">
          <ChartCard
            title="Paket hazırlığı"
            description="Yayındaki katalog paketlerinden kaçı her konuda yeterli yayında soruyla başlatılabiliyor."
            actions={<HepsiBaglantisi href="/checkup/paketler">Paketler</HepsiBaglantisi>}
            note={
              katalogYayinda.length
                ? katalogYayinda.length + " katalog paketi yayında. Sağlıklı havuz: her konuda ihtiyacın en az iki katı."
                : "Yayında katalog paketi yok."
            }
            stats={[
              { label: "Hazır", value: hazir },
              { label: "Havuz dar", value: dar },
              { label: "Başlatılamaz", value: engelli.length },
            ]}
          >
            <ApexRadialChart value={hazirOrani} ariaLabel="Başlatılabilir katalog paketi oranı" />
          </ChartCard>

          <ComponentCard title="Dikkat isteyen paketler" desc="Yayında ama havuzu dar ya da yetmiyor." flush>
            {dikkat.length === 0 ? (
              <EmptyState
                title="Yayındaki bütün paketler başlatılabilir"
                description="Her konuda ihtiyacın en az iki katı yayında soru var."
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {dikkat.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-theme-sm font-medium text-gray-800">{p.name}</p>
                      <p className="line-clamp-2 text-theme-xs text-gray-500">
                        {examLabel(p.examScope)} · {p.summary}
                      </p>
                    </div>
                    <Badge size="sm" color={PACKAGE_STATE_COLOR[p.state]}>
                      {PACKAGE_STATE_LABEL[p.state]}
                    </Badge>
                  </li>
                ))}
                {dikkat.length > 6 ? (
                  <li className="px-5 py-3 text-theme-xs text-gray-500 sm:px-6">
                    ve {dikkat.length - 6} paket daha —{" "}
                    <Link href="/checkup/paketler" className="font-medium text-brand-500 hover:text-brand-600">
                      tümü
                    </Link>
                  </li>
                ) : null}
              </ul>
            )}
          </ComponentCard>
        </div>

        <ComponentCard
          className="col-span-12 xl:col-span-7"
          title="İçerik kuyruğu"
          desc="Soru havuzunda sırada ne var — her satır süzülmüş listeye açılır."
          flush
        >
          <ul className="divide-y divide-gray-100">
            {kuyruk.map((k) => (
              <li key={k.href}>
                <Link href={k.href} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-theme-sm font-medium text-gray-800 group-hover:text-brand-500">
                      {k.label}
                    </span>
                    <span className="block truncate text-theme-xs text-gray-500">{k.aciklama}</span>
                  </span>
                  <Badge size="sm" color={k.sayi > 0 ? k.renk : "light"} className="tabular">
                    {trNumber(k.sayi)}
                  </Badge>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-gray-400 rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </ComponentCard>

        <ChartCard
          className="col-span-12 xl:col-span-5"
          title="En çok zorlanılan konular"
          description="Son 30 gün, tüm öğrenciler · en az 10 kez sorulmuş konular, doğru oranı"
        >
          {zorKonular.length === 0 ? (
            <EmptyState
              title="Henüz yeterli veri yok"
              description="Bir konunun burada görünmesi için son 30 günde en az 10 kez sorulmuş olması gerekiyor."
            />
          ) : (
            <MeterList
              max={100}
              items={zorKonular.map((k) => ({
                key: k.name,
                label: k.name,
                meta: k.correct + " / " + k.asked + " doğru",
                value: Math.round(k.ratio * 100),
                valueLabel: percent(k.ratio),
                tone: k.ratio >= 0.75 ? "success" : k.ratio >= 0.45 ? "warning" : "error",
              }))}
            />
          )}
        </ChartCard>

        {kisisel ? (
          <>
            <ComponentCard
              className="col-span-12 xl:col-span-7"
              title="Son tamamlanan testler"
              actions={<HepsiBaglantisi href="/checkup/ogrenciler">Öğrenciler</HepsiBaglantisi>}
              flush
            >
              {sonTestler.length === 0 ? (
                <EmptyState icon={<CircleCheck />} title="Henüz tamamlanan test yok" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell isHeader>Öğrenci</TableCell>
                      <TableCell isHeader align="end">
                        Net
                      </TableCell>
                      <TableCell isHeader align="end" nowrap>
                        D / Y / B
                      </TableCell>
                      <TableCell isHeader align="end">
                        Başarı
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sonTestler.map((t) => {
                      const r = t.result;
                      const toplam = r ? r.correctCount + r.wrongCount + r.blankCount : 0;
                      const oran = r && toplam > 0 ? r.correctCount / toplam : null;
                      return (
                        <TableRow key={t.id} hover className="relative">
                          <TableCell className="w-full max-w-0 min-w-48">
                            <Link
                              href={"/checkup/ogrenciler/" + t.user.id}
                              className="block truncate font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
                            >
                              {t.user.name}
                            </Link>
                            <span className="block truncate text-theme-xs text-gray-500">
                              {t.package.name}
                              {t.submittedAt ? " · " + relativeDay(t.submittedAt, now) : ""}
                            </span>
                          </TableCell>
                          <TableCell align="end" nowrap>
                            <span className="tabular font-medium text-gray-800">{r ? trNumber(Number(r.netScore), 2) : "—"}</span>
                          </TableCell>
                          <TableCell align="end" nowrap className="tabular">
                            {r ? r.correctCount + " / " + r.wrongCount + " / " + r.blankCount : "—"}
                          </TableCell>
                          <TableCell align="end" className="tabular">
                            {oran !== null ? percent(oran) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ComponentCard>

            <ComponentCard
              className="col-span-12 xl:col-span-5"
              title="Son kayıtlar"
              actions={<HepsiBaglantisi href="/checkup/ogrenciler">Tümü</HepsiBaglantisi>}
              flush
            >
              {sonKayitlar.length === 0 ? (
                <EmptyState icon={<Users />} title="Henüz kayıtlı öğrenci yok" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sonKayitlar.map((u) => (
                    <li key={u.id}>
                      <Link
                        href={"/checkup/ogrenciler/" + u.id}
                        className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 sm:px-6"
                      >
                        <Avatar name={u.name} size="medium" decorative />
                        <span className="min-w-0">
                          <span className="block truncate text-theme-sm font-medium text-gray-800">{u.name}</span>
                          <span className="block truncate text-theme-xs text-gray-500">
                            {[gradeLabel(u.grade), relativeDay(u.createdAt, now)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ComponentCard>
          </>
        ) : null}
      </div>
    </>
  );
}
