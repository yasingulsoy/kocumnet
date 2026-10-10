import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Hourglass,
  Layers,
  NotebookPen,
  Play,
  Repeat,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { loadCatalog, siradakiPaketler } from "@/lib/catalog";
import { aggregateTopics, greeting, studentStats, type ResultLike } from "@/lib/insights";
import { aktifPlan } from "@/lib/plan";
import { aktifKosu } from "@/lib/level-run";
import { haftaBasi, haftaEtiketi } from "@/lib/coaching";
import { daysUntilExam, examShort } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { PackageCard } from "@/components/PackageCard";
import { PlanCard } from "@/components/PlanCard";
import { PlanOlusturKarti } from "@/components/PlanOlusturKarti";
import { KonuTekrarButonu } from "@/components/KonuTekrarButonu";
import { DefterKarti } from "@/components/DefterKarti";
import { SeviyeRozeti } from "@/components/KonuHaritasi";
import { SonTestlerGrafigi } from "@/components/BasariGrafikleri";
import { grafikTarihleri } from "@/components/grafik-tarihleri";
import { bugunkuTekrarDurumu } from "@/lib/practice";
import { Progress, trDate, trNumber } from "@/components/ui";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { RadialGauge } from "@/components/tailadmin/charts/RadialGauge";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Ana sayfa" };

/** Başarı oranı bandı (grafikteki sütun renkleriyle aynı eşikler: %75 / %45). */
function bant(oran: number): BadgeColor {
  return oran >= 0.75 ? "success" : oran >= 0.45 ? "warning" : "error";
}

/** Kartın başındaki ikon kutusu (vurgulu: marka, sakin: gri). */
function IkonKutusu({ children, sakin = false }: { children: ReactNode; sakin?: boolean }) {
  return (
    <span
      className={
        sakin
          ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 [&_svg]:size-5"
          : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 [&_svg]:size-5"
      }
    >
      {children}
    </span>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/panel">) {
  // Düzen zaten girişi ve tanışmayı denetledi; burada kullanıcı kesin var.
  const user = await requirePageUser();
  const now = new Date();
  const sp = await searchParams;
  const hata = typeof sp.hata === "string" ? sp.hata : null;
  const yeniTanisma = sp.tanisma === "1";

  const [acik, sonuclarHam, katalog, plan, buHaftakiTest, seviyeliKosu, defter] = await Promise.all([
    // Alıştırma "yarım kalan test" değil: süresi yok, kendi kartı var.
    prisma.checkupSession.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS", expiresAt: { gt: now }, kind: { not: "PRACTICE" } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        expiresAt: true,
        kind: true,
        stageLevel: true,
        stageKind: true,
        package: { select: { name: true, questionCount: true } },
        focusTopic: { select: { name: true } },
        _count: { select: { items: true } },
        items: { where: { answer: { choiceId: { not: null } } }, select: { id: true } },
      },
    }),
    /*
     * Sonuçlar ÖĞRENCİNİN SINAVINA göre. LGS, TYT ve KPSS sonuçlarını tek bir
     * "genel başarı" çizgisinde toplamak anlamsız; eski kayıtlarda kapsam
     * yazmıyor (null), onları da alıyoruz.
     */
    prisma.checkupResult.findMany({
      where: {
        session: { userId: user.id },
        ...(user.targetExam
          ? { OR: [{ examScope: user.targetExam }, { examScope: null }] }
          : {}),
      },
      orderBy: { computedAt: "desc" },
      // Panoda son 20 test yeter; sınırsız sorgu her testte biraz daha yavaşlar.
      take: 20,
      select: {
        sessionId: true,
        correctCount: true,
        wrongCount: true,
        blankCount: true,
        netScore: true,
        totalTimeMs: true,
        computedAt: true,
        topicBreakdown: true,
        session: { select: { kind: true, package: { select: { name: true } } } },
      },
    }),
    loadCatalog(user.id, now, { scope: user.targetExam }),
    aktifPlan(user.id, now),
    /*
     * Bu hafta kaç check-up bitirdi?
     *
     * Öğrenci tanışmada "haftada kaç test" diyor ve bu bilgi hiçbir yerde
     * kullanılmıyordu. Toplanan ama karşılığı olmayan her soru, ürünün
     * dinlemediğini gösterir. Kontrol testleri (5 soru) sayılmaz: onlar
     * ölçüm değil, doğrulama.
     */
    prisma.checkupSession.count({
      where: {
        userId: user.id,
        status: "SUBMITTED",
        // Alıştırma da sayılmaz: ölçüm değil.
        kind: { notIn: ["TOPIC_RETEST", "PRACTICE"] },
        submittedAt: { gte: haftaBasi(now) },
      },
    }),
    /* Seviyeli check-up devam ediyor mu — "Seviye 2 seni bekliyor". */
    aktifKosu(user.id),
    /* Yanlış defteri: bugün kaç soru (aralıklı tekrar). */
    bugunkuTekrarDurumu(user.id, now),
  ]);

  const sonuclar: (ResultLike & { sessionId: string; packageName: string; kontrol: boolean })[] =
    sonuclarHam.map((r) => ({
      sessionId: r.sessionId,
      packageName: r.session.package.name,
      kontrol: r.session.kind === "TOPIC_RETEST",
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      blankCount: r.blankCount,
      netScore: Number(r.netScore),
      totalTimeMs: r.totalTimeMs,
      computedAt: r.computedAt,
      topicBreakdown: r.topicBreakdown as unknown as TopicBreakdown,
    }));

  /*
   * Genel başarı, eğilim ve son altı şerit yalnızca ÖLÇÜMLERDEN. 5 soruluk
   * kontrol testi tek zayıf konuyu ölçüyor: plandaki kontrol testini çözen
   * öğrenci "-30 puan" gibi sebepsiz bir düşüş görüyordu. Zayıf konu listesi
   * ise hepsini topluyor (kontrol testi o konunun gerçek ölçümü).
   */
  const olcumler = sonuclar.filter((r) => !r.kontrol);
  const ozet = studentStats(olcumler);
  const konular = aggregateTopics(sonuclar).filter((t) => t.level !== null);
  const zayiflar = [...konular]
    .filter((t) => t.level === "WEAK")
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3);

  const oneriler = siradakiPaketler(katalog);

  const ilkAd = user.name.split(" ")[0];
  const yeni = sonuclar.length === 0;
  const kalanGun = daysUntilExam(user.targetExam, now);
  const haftalikHedef = user.weeklyTestGoal ?? null;
  const temponunDurumu = haftalikHedef !== null && buHaftakiTest >= haftalikHedef;

  /** Bir testin başarı oranı (doğru / soru). */
  const oran = (r: ResultLike) => {
    const t = r.correctCount + r.wrongCount + r.blankCount;
    return t === 0 ? 0 : r.correctCount / t;
  };
  /*
   * Grafik ve tablo yalnızca ÖLÇÜMLERDEN (kontrol testi tek konuyu ölçer).
   * Sütun grafiği son sekiz ölçüm (eskiden altı renkli şerit): biriken
   * toplam değil, HAREKET. Renk eşikleri eski şeridin: %75 / %45.
   */
  const grafikSonuclari = olcumler.slice(0, 8).reverse();
  const grafikEtiketleri = grafikTarihleri(grafikSonuclari.map((r) => r.computedAt));
  const grafikNoktalari = grafikSonuclari.map((r, i) => ({
    etiket: grafikEtiketleri[i],
    deger: oran(r) * 100,
    // Yüzde balonun kendi satırında; burada test ve net.
    ayrinti: `${r.packageName} · ${trNumber(r.netScore)} net`,
  }));
  const sonTestler = olcumler.slice(0, 5);
  const sonOlcum = olcumler[0];
  const toplam = olcumler.reduce(
    (t, r) => ({ d: t.d + r.correctCount, y: t.y + r.wrongCount, b: t.b + r.blankCount }),
    { d: 0, y: 0, b: 0 }
  );
  const tumuBaglantisi = (href: string, metin = "Tümü") => (
    <Link href={href} className="inline-flex min-h-9 items-center text-theme-sm font-medium text-brand-500 transition hover:text-brand-600">
      {metin}
    </Link>
  );

  return (
    <div className="animate-fade">
      {/* Tek satır selamlama: telefonda ilk ekranın beşte birini yiyen bir
          başlık bloğu olmasın. Sınav ve kalan gün başlığın yanında. */}
      <PageBreadcrumb
        pageTitle={`${greeting(now)}, ${ilkAd}`}
        actions={
          user.targetExam || kalanGun !== null ? (
            <>
              {user.targetExam ? <Badge size="sm">{examShort(user.targetExam)}</Badge> : null}
              {kalanGun !== null ? (
                <Badge size="sm" color="light" startIcon={<CalendarDays aria-hidden />}>
                  <span className="tabular">{kalanGun} gün</span>
                </Badge>
              ) : null}
            </>
          ) : undefined
        }
      />

      <div className="space-y-4 md:space-y-6">
        {hata ? <Alert variant="error">{hata}</Alert> : null}
        {yeniTanisma ? (
          <Alert variant="success">
            Hazırız. {examShort(user.targetExam)} için testlerin aşağıda —
            {user.targetNet ? ` hedefin ${trNumber(user.targetNet, 0)} net.` : ""}
          </Alert>
        ) : null}

        {/* ── 1. Bu hafta ─────────────────────────────────── */}
        {plan ? <PlanCard plan={plan} haftaEtiketi={haftaEtiketi(plan.weekStart)} /> : !yeni ? <PlanOlusturKarti /> : null}

        {/* ── Seviyeli check-up devam ediyor ──────────────── */}
        {/* Aşama zaten açıksa aşağıdaki "yarım kalan test" kartı aynı yere
            götürüyor; iki ayrı "Devam et" göstermiyoruz. */}
        {seviyeliKosu && acik?.kind !== "LEVEL_STAGE" ? (
          <Card tone="brand" className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <IkonKutusu>
              <Layers aria-hidden />
            </IkonKutusu>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-gray-800">
                {seviyeliKosu.pendingRemedialIds.length > 0
                  ? "Teyit turun bekliyor"
                  : `Seviye ${seviyeliKosu.unlockedLevel} seni bekliyor`}
              </p>
              <p className="mt-0.5 text-theme-sm text-gray-500">
                {examShort(seviyeliKosu.examScope)} seviyeli check-up · yarım kaldı
              </p>
            </div>
            <ButtonLink
              href={`/seviye/${seviyeliKosu.id}`}
              endIcon={<ArrowRight className="rtl:rotate-180" />}
              className="max-sm:w-full"
            >
              Devam et
            </ButtonLink>
          </Card>
        ) : null}

        {/* ── 2. Tek eylem ────────────────────────────────── */}
        {acik ? (
          <Card tone="dark" className="relative z-1 overflow-hidden p-5 sm:p-6">
            <GridShape />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-theme-xs font-semibold tracking-[0.14em] text-gray-300 uppercase">
                  <Hourglass className="size-3.5" aria-hidden /> Yarım kalan test
                </p>
                <h2 className="mt-1.5 font-display text-xl font-semibold text-balance text-white sm:text-2xl">
                  {acik.kind === "TOPIC_RETEST" && acik.focusTopic
                    ? `${acik.focusTopic.name} kontrol testi`
                    : acik.kind === "LEVEL_STAGE"
                      ? `${acik.stageKind === "REMEDIAL" ? "Teyit turu" : `Seviye ${acik.stageLevel ?? 1}`} · ${acik.package.name}`
                      : acik.package.name}
                </h2>
                <p className="tabular mt-1 text-theme-sm text-gray-300">
                  {acik.items.length}/{acik._count.items} işaretli · süre{" "}
                  {acik.expiresAt.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Istanbul",
                  })}
                  {"'"}e kadar
                </p>
              </div>
              <ButtonLink href={`/checkup/${acik.id}`} variant="outline" size="md" startIcon={<Play />} className="w-full sm:w-auto">
                Devam et
              </ButtonLink>
            </div>
          </Card>
        ) : seviyeliKosu || (yeni && katalog.length === 0) ? null : yeni ? (
          /* Tek sonraki adım: seviyeli koşu yarımsa onun kartı, katalog boşsa
             alttaki boş durum; ikisi yoksa ilk test. */
          <Card tone="brand" className="p-5 sm:p-8">
            <p className="flex items-center gap-1.5 text-theme-xs font-semibold tracking-[0.14em] text-brand-500 uppercase">
              <Sparkles className="size-3.5" aria-hidden /> İlk adım
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold text-balance text-gray-800">
              Kısa bir testle başlayalım
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Sonunda hangi konuda güçlü, hangisinde eksiğin olduğunu ve her yanlışının çözümünü göreceksin.
            </p>
            {oneriler[0] ? (
              <ButtonLink
                href={"/paketler/" + oneriler[0].slug}
                size="md"
                block
                className="mt-5"
                endIcon={<ArrowRight className="rtl:rotate-180" />}
              >
                {oneriler[0].name} · {oneriler[0].durationMinutes} dk
              </ButtonLink>
            ) : (
              <ButtonLink href="/paketler" size="md" block className="mt-5" endIcon={<ArrowRight className="rtl:rotate-180" />}>
                Testleri gör
              </ButtonLink>
            )}
            <ol className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4 text-theme-xs text-gray-500">
              {["Paket seç", "Soruları çöz", "Haritanı gör"].map((t, i) => (
                <li key={t} className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.625rem] font-bold text-brand-500">
                    {i + 1}
                  </span>
                  <span className="truncate">{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        ) : oneriler[0] ? (
          <Card tone="brand" className="p-5 sm:p-6">
            <p className="text-theme-xs font-semibold tracking-[0.14em] text-brand-500 uppercase">Sıradaki adımın</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold text-balance text-gray-800">{oneriler[0].name}</h2>
            <p className="tabular mt-1 text-theme-sm text-gray-500">
              {oneriler[0].questionCount} soru · {oneriler[0].durationMinutes} dk · {oneriler[0].topicCount} konu
            </p>
            <ButtonLink
              href={"/paketler/" + oneriler[0].slug}
              size="md"
              block
              className="mt-4"
              endIcon={<ArrowRight className="rtl:rotate-180" />}
            >
              Teste göz at
            </ButtonLink>
          </Card>
        ) : null}

        {/* ── Yanlış defteri: günlük tekrar ───────────────── */}
        {/* Hiç testi olmayan öğrenciye gösterilmez: boş panoda tek çağrı ilk test. */}
        {!yeni || defter.acikMadde > 0 ? <DefterKarti durum={defter} now={now} /> : null}

        {/* ── 3. İlerleme: sayılar ve grafikler ───────────── */}
        {olcumler.length > 0 && sonOlcum ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
              <MetricCard
                compact
                label="Son ölçüm"
                value={`%${Math.round(oran(sonOlcum) * 100)}`}
                icon={<Target />}
                tone="brand"
                href={`/sonuc/${sonOlcum.sessionId}`}
                hint={
                  // Değişim rozeti sayının yanında değil altında: dar kartta etiketi iki satıra bölüyordu.
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {ozet.trend !== null && ozet.trend !== 0 ? (
                      <Badge
                        size="sm"
                        color={ozet.trend > 0 ? "success" : "error"}
                        startIcon={ozet.trend > 0 ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}
                      >
                        <span className="tabular">
                          {ozet.trend > 0 ? "+" : ""}
                          {ozet.trend} puan
                        </span>
                      </Badge>
                    ) : null}
                    <span className="min-w-0">{sonOlcum.packageName}</span>
                  </span>
                }
              />
              <MetricCard
                compact
                label="Çözülen test"
                value={ozet.testCount}
                icon={<ClipboardList />}
                href="/gelisim"
                hint="Kontrol testleri hariç"
              />
              {/* Haftalık tempo — öğrencinin tanışmada kendi koyduğu hedef. */}
              <MetricCard
                compact
                label="Bu hafta"
                value={haftalikHedef ? `${buHaftakiTest}/${haftalikHedef}` : buHaftakiTest}
                icon={<Repeat />}
                tone={temponunDurumu ? "success" : "gray"}
                hint={
                  haftalikHedef
                    ? temponunDurumu
                      ? "check-up · tempona uydun"
                      : "check-up · kendi hedefin"
                    : "check-up bitirdin"
                }
              />
              <MetricCard
                compact
                label="Yanlış defteri"
                value={defter.acikMadde}
                icon={<NotebookPen />}
                tone={defter.hazir > 0 ? "warning" : "gray"}
                href="/defter"
                hint={defter.hazir > 0 ? `açık madde · bugün ${defter.hazir} soru` : "açık madde"}
              />
            </div>

            <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
              <ChartCard
                className="xl:col-span-4"
                title="Genel başarı"
                description={`${ozet.testCount} check-up'ının toplamı`}
                note={user.targetNet ? `Hedefin ${trNumber(user.targetNet, 0)} net.` : undefined}
                stats={[
                  { label: "Doğru", value: toplam.d },
                  { label: "Yanlış", value: toplam.y },
                  { label: "Boş", value: toplam.b },
                ]}
              >
                <RadialGauge
                  value={ozet.avgRatio * 100}
                  ariaLabel="Genel başarı oranı"
                  tone={bant(ozet.avgRatio) === "success" ? "success" : bant(ozet.avgRatio) === "warning" ? "warning" : "error"}
                />
              </ChartCard>

              <ChartCard
                className="xl:col-span-8"
                title="Son ölçümlerin"
                description="Her sütun bir check-up; 5 soruluk kontrol testleri girmez."
                actions={tumuBaglantisi("/gelisim", "Gelişim")}
              >
                {grafikNoktalari.length >= 2 ? (
                  <SonTestlerGrafigi noktalar={grafikNoktalari} ariaLabel="Son check-up'larının başarı oranı" />
                ) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">
                    Şimdilik tek bir ölçüm var: %{Math.round(oran(sonOlcum) * 100)}. İkinci check-up&apos;ından sonra
                    testlerin burada yan yana görünür.
                  </p>
                )}
              </ChartCard>
            </div>
          </>
        ) : null}

        {/* ── 4. Şimdi ne çalışmalısın + son testler ──────── */}
        {zayiflar.length > 0 || sonTestler.length > 0 ? (
          <div className="grid gap-4 md:gap-6 2xl:grid-cols-12">
            {zayiflar.length > 0 ? (
              <ComponentCard
                className={sonTestler.length > 0 ? "2xl:col-span-5" : "2xl:col-span-12"}
                title="Şimdi ne çalışmalısın"
                desc="Kanıtlı zayıf konular — her biri en az 3 soruda ölçüldü."
                actions={tumuBaglantisi("/gelisim")}
                flush
              >
                <ul className="divide-y divide-gray-100">
                  {zayiflar.map((t) => (
                    <li key={t.topicId} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="min-w-0 text-theme-sm font-semibold break-words text-gray-800">{t.name}</p>
                          <SeviyeRozeti level={t.level} />
                        </div>
                        <p className="tabular mt-0.5 text-theme-xs text-gray-500">
                          {t.correct}/{t.asked} doğru · %{Math.round(t.ratio * 100)}
                        </p>
                        <Progress value={t.ratio * 100} tone="bad" label={`${t.name} başarı oranı`} className="mt-2 h-1.5" />
                      </div>
                      <KonuTekrarButonu topicId={t.topicId} topicName={t.name} />
                    </li>
                  ))}
                </ul>
              </ComponentCard>
            ) : null}

            {sonTestler.length > 0 ? (
              <ComponentCard
                className={zayiflar.length > 0 ? "2xl:col-span-7" : "2xl:col-span-12"}
                title="Son check-up'ların"
                desc="En yeniden eskiye; kontrol testlerin Gelişim'de."
                actions={tumuBaglantisi("/gelisim")}
                flush
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell isHeader>Test</TableCell>
                      <TableCell isHeader className="hidden sm:table-cell">
                        Tarih
                      </TableCell>
                      <TableCell isHeader align="center" className="hidden sm:table-cell">
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
                    {sonTestler.map((r) => {
                      const o = oran(r);
                      return (
                        <TableRow key={r.sessionId} hover className="relative">
                          <TableCell className="w-full max-w-0 min-w-36">
                            <Link
                              href={`/sonuc/${r.sessionId}`}
                              className="block truncate font-medium text-gray-800 after:absolute after:inset-0"
                            >
                              {r.packageName}
                            </Link>
                            <span className="block text-theme-xs sm:hidden">{trDate(r.computedAt, false)}</span>
                          </TableCell>
                          <TableCell nowrap className="hidden sm:table-cell">
                            {trDate(r.computedAt, false)}
                          </TableCell>
                          <TableCell nowrap align="center" className="tabular hidden sm:table-cell">
                            {r.correctCount} / {r.wrongCount} / {r.blankCount}
                          </TableCell>
                          <TableCell nowrap align="end" className="tabular">
                            <span className="font-medium text-gray-800">{trNumber(r.netScore)}</span>
                          </TableCell>
                          <TableCell nowrap align="end">
                            <Badge size="sm" color={bant(o)}>
                              <span className="tabular">%{Math.round(o * 100)}</span>
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ComponentCard>
            ) : null}
          </div>
        ) : null}

        {/* ── 5. Öneriler ─────────────────────────────────── */}
        {!yeni && oneriler.length > 0 ? (
          <section aria-labelledby="siradaki-testler">
            <h2 id="siradaki-testler" className="text-theme-xs font-semibold tracking-[0.14em] text-gray-500 uppercase">
              Sıradaki testler
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6">
              {oneriler.map((p) => (
                <PackageCard key={p.slug} p={p} />
              ))}
            </div>
          </section>
        ) : null}

        {yeni && katalog.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title="Bu sınav için test hazırlanıyor"
              description="Soru havuzu tamamlanınca burada görünecek."
              action={<ButtonLink href="/paketler?tur=TUMU">Diğer sınavların testleri</ButtonLink>}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
