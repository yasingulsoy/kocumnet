import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartLine, ClipboardList, Minus, Play, TrendingDown, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { loadCatalog, siradakiPaketler } from "@/lib/catalog";
import { aggregateTopics, type ResultLike } from "@/lib/insights";
import { EXAMS, daysUntilExam, examShort, isExamScope, type ExamScopeValue } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { BasariEgilimi } from "@/components/BasariGrafikleri";
import { grafikTarihleri } from "@/components/grafik-tarihleri";
import { KonuHaritasi } from "@/components/KonuHaritasi";
import { trDate, trNumber } from "@/components/ui";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Gelişim" };

/** Başarı oranı bandı — sonuç ekranı ve grafiklerle aynı eşikler (%75 / %45). */
function bant(oran: number) {
  return oran >= 0.75 ? "success" : oran >= 0.45 ? "warning" : "error";
}

type Sonuc = ResultLike & {
  sessionId: string;
  packageName: string;
  scope: string;
  /** 5 soruluk konu kontrol testi — tek zayıf konuyu ölçer, genel seviyeyi değil. */
  kontrol: boolean;
};

/**
 * Tahmini sınav neti.
 *
 * Check-up'lar 12–25 soruluk; öğrencinin kafasındaki sayı ise "TYT'de kaç
 * net". Oranı gerçek sınavın matematik soru sayısına taşıyoruz. Bu bir
 * TAHMİN ve ekranda da öyle yazıyor: sınav koşulları, süre baskısı ve diğer
 * dersler burada yok.
 */
function tahminiNet(sonuclar: Sonuc[], sinav: ExamScopeValue): number | null {
  const son = sonuclar.slice(-3);
  if (son.length === 0) return null;
  const oranlar = son.map((r) => {
    const toplam = r.correctCount + r.wrongCount + r.blankCount;
    return toplam === 0 ? 0 : r.netScore / toplam;
  });
  const ortalama = oranlar.reduce((a, b) => a + b, 0) / oranlar.length;
  return Math.round(Math.max(0, ortalama) * EXAMS[sinav].mathQuestionCount * 10) / 10;
}

export default async function ProgressPage({ searchParams }: PageProps<"/gelisim">) {
  const user = await requirePageUser();
  const { tur } = await searchParams;

  const ham = await prisma.checkupResult.findMany({
    where: { session: { userId: user.id } },
    orderBy: { computedAt: "asc" },
    select: {
      sessionId: true,
      correctCount: true,
      wrongCount: true,
      blankCount: true,
      netScore: true,
      totalTimeMs: true,
      computedAt: true,
      topicBreakdown: true,
      examScope: true,
      session: {
        select: {
          kind: true,
          focusTopic: { select: { name: true } },
          package: { select: { name: true, examScope: true } },
        },
      },
    },
  });

  if (ham.length === 0) {
    /*
     * Tek ve somut bir sonraki adım: yarım test varsa o, yoksa panodaki
     * "ilk adım"la AYNI öneri. Eskiden düz "bir test seç" bağlantısı vardı ve
     * yeni öğrenciyi 6-7 paketlik listeyle baş başa bırakıyordu.
     */
    const simdi = new Date();
    const [yarim, katalog] = await Promise.all([
      prisma.checkupSession.findFirst({
        where: { userId: user.id, status: "IN_PROGRESS", expiresAt: { gt: simdi }, kind: { not: "PRACTICE" } },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      }),
      loadCatalog(user.id, simdi, { scope: user.targetExam }),
    ]);
    const ilk = siradakiPaketler(katalog, 1)[0];

    return (
      <div className="animate-rise">
        <PageBreadcrumb pageTitle="Gelişim" description="Çözdüğün testler burada birikir." />
        <Card>
          <EmptyState
            icon={<ChartLine />}
            title="Henüz bir sonucun yok"
            description={
              yarim
                ? "Yarım kalan testini bitirdiğinde başarı grafiğin ve konu haritan burada oluşmaya başlar."
                : ilk
                  ? `İlk check-up'ını bitirdiğinde başarı grafiğin ve konu haritan burada oluşur. Önerimiz: ${ilk.name} (${ilk.questionCount} soru, ${ilk.durationMinutes} dk).`
                  : "İlk check-up'ını bitirdiğinde başarı grafiğin ve konu haritan burada oluşmaya başlar."
            }
            action={
              yarim ? (
                <ButtonLink href={`/checkup/${yarim.id}`} startIcon={<Play />}>
                  Yarım kalan testine dön
                </ButtonLink>
              ) : ilk ? (
                <ButtonLink href={`/paketler/${ilk.slug}`} endIcon={<ArrowRight className="rtl:rotate-180" />}>
                  Teste göz at
                </ButtonLink>
              ) : (
                <ButtonLink href="/paketler" endIcon={<ArrowRight className="rtl:rotate-180" />}>
                  Testlere göz at
                </ButtonLink>
              )
            }
          />
        </Card>
      </div>
    );
  }

  const tumu: Sonuc[] = ham.map((r) => ({
    sessionId: r.sessionId,
    kontrol: r.session.kind === "TOPIC_RETEST",
    packageName:
      r.session.kind === "TOPIC_RETEST" && r.session.focusTopic
        ? `${r.session.focusTopic.name} kontrol testi`
        : r.session.package.name,
    scope: r.examScope ?? r.session.package.examScope,
    correctCount: r.correctCount,
    wrongCount: r.wrongCount,
    blankCount: r.blankCount,
    netScore: Number(r.netScore),
    totalTimeMs: r.totalTimeMs,
    computedAt: r.computedAt,
    topicBreakdown: r.topicBreakdown as unknown as TopicBreakdown,
  }));

  /*
   * Hangi sınavın gelişimi?
   *
   * Farklı sınavların sonuçlarını tek grafikte toplamak yanıltıcı: KPSS
   * paketinden %80 alıp AYT'den %40 alan öğrencinin "ortalaması" hiçbir şey
   * anlatmaz. Varsayılan öğrencinin hedef sınavı.
   */
  const mevcutKapsamlar = [...new Set(tumu.map((r) => r.scope))].filter(isExamScope);
  const secili: ExamScopeValue | null =
    (isExamScope(tur) && mevcutKapsamlar.includes(tur) ? tur : null) ??
    (isExamScope(user.targetExam) && mevcutKapsamlar.includes(user.targetExam)
      ? user.targetExam
      : null) ??
    mevcutKapsamlar.at(-1) ??
    null;

  const sonuclar = secili ? tumu.filter((r) => r.scope === secili) : tumu;

  /*
   * Eğilim ve tahmini net yalnızca ÖLÇÜMLERDEN: 5 soruluk kontrol testi tek
   * bir zayıf konuyu yeniden ölçüyor. Çizgiye girince plandaki kontrol
   * testini çözen öğrencinin grafiği ve tahmini neti sebepsiz düşüyordu
   * (koçluk modeli: kontrol testi ölçüm değil, doğrulama). Konu haritası ve
   * test listesi ise hepsini kullanıyor.
   */
  const olcumler = sonuclar.filter((r) => !r.kontrol);

  const oran = (r: ResultLike) => {
    const t = r.correctCount + r.wrongCount + r.blankCount;
    return t === 0 ? 0 : r.correctCount / t;
  };

  // Paketler farklı uzunlukta: netleri değil başarı oranını çiziyoruz, yoksa
  // 15 soruluk testin düşük neti "geriledin" gibi görünürdü. Balonda test adı
  // ve net; yüzde balonun kendi satırında (BasariEgilimi), iki kez yazılmasın.
  // Aynı gün birden çok ölçüm varsa eksende saat de yazar (grafikTarihleri).
  const etiketler = grafikTarihleri(olcumler.map((r) => r.computedAt));
  const noktalar = olcumler.map((r, i) => ({
    etiket: etiketler[i],
    deger: oran(r) * 100,
    ayrinti: r.packageName + " · " + trNumber(r.netScore) + " net",
  }));

  const konular = aggregateTopics(sonuclar).sort((a, b) => {
    // Ölçülebilenler önce, sonra en zayıftan güçlüye.
    if ((a.level === null) !== (b.level === null)) return a.level === null ? 1 : -1;
    return a.ratio - b.ratio;
  });

  const sonOran = olcumler.length > 0 ? oran(olcumler[olcumler.length - 1]) : 0;
  const ilkOran = olcumler.length > 0 ? oran(olcumler[0]) : 0;
  const fark = Math.round((sonOran - ilkOran) * 100);

  const tahmin = secili ? tahminiNet(olcumler, secili) : null;
  const hedef = user.targetNet ?? (secili ? EXAMS[secili].defaultTargetNet : null);
  const kalanGun = secili ? daysUntilExam(secili, new Date()) : null;

  return (
    <div className="animate-rise">
      <PageBreadcrumb
        pageTitle="Gelişim"
        description="Ölçümlerinin toplamı: nerede ilerledin, nerede duruyorsun."
      />

      <div className="space-y-4 md:space-y-6">
        {mevcutKapsamlar.length > 1 ? (
          <SegmentedTabs
            label="Sınav"
            size="md"
            items={mevcutKapsamlar.map((s) => ({
              key: s,
              label: examShort(s),
              href: "/gelisim?tur=" + s,
              active: s === secili,
            }))}
          />
        ) : null}

        {/* ── Hedef: öğrencinin kendini takip ettiği tek sayı ─────── */}
        {secili && tahmin !== null && hedef ? (
          <Card className="overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm">{examShort(secili)} matematik</Badge>
                {kalanGun !== null ? (
                  <Badge size="sm" color="light">
                    {kalanGun} gün kaldı
                  </Badge>
                ) : (
                  <Badge size="sm" color="light">
                    {EXAMS[secili].season}
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="tabular font-display text-title-sm font-bold text-gray-800">
                  {trNumber(tahmin, tahmin % 1 === 0 ? 0 : 1)}
                </span>
                <span className="text-theme-sm text-gray-500">tahmini net</span>
                <span className="tabular ms-auto text-theme-sm font-semibold text-gray-700">hedef {hedef}</span>
              </div>

              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={hedef}
                aria-valuenow={Math.min(tahmin, hedef)}
                aria-label="Hedefe ilerleme"
              >
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: Math.min(100, (tahmin / hedef) * 100) + "%" }}
                />
              </div>

              <p className="mt-3 text-theme-sm leading-relaxed text-gray-500">
                {tahmin >= hedef ? (
                  <>
                    Hedefin üstündesin. Hedefi yükseltmenin zamanı:{" "}
                    <Link href="/profil" className="font-medium text-brand-500 underline hover:text-brand-600">
                      profilden güncelle
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Hedefe{" "}
                    <strong className="font-semibold text-gray-800">{trNumber(hedef - tahmin, 1)} net</strong>{" "}
                    var.
                  </>
                )}
              </p>
            </div>

            <p className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-theme-xs leading-relaxed text-gray-500 sm:px-6">
              Bu tahmin çözdüğün check-up{"'"}ların oranını {EXAMS[secili].mathQuestionCount} soruluk{" "}
              {examShort(secili)} matematik bölümüne taşır. Gerçek sınav neti değildir — sadece yön
              gösterir.
            </p>
          </Card>
        ) : null}

        {/* ── Eğilim ──────────────────────────────────────────────── */}
        <ChartCard
          title="Başarı oranın"
          description={
            olcumler.length < 2
              ? "Grafik ikinci check-up'ından sonra anlam kazanır."
              : "Her nokta bir check-up; 5 soruluk kontrol testleri çizgiye girmez."
          }
          actions={
            olcumler.length >= 2 ? (
              <Badge
                color={fark > 0 ? "success" : fark < 0 ? "error" : "light"}
                startIcon={fark > 0 ? <TrendingUp aria-hidden /> : fark < 0 ? <TrendingDown aria-hidden /> : <Minus aria-hidden />}
              >
                <span className="tabular">
                  {fark > 0 ? "+" : ""}
                  {fark} puan
                </span>
              </Badge>
            ) : undefined
          }
        >
          {olcumler.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">
              Bu sınavda henüz bir check-up ölçümün yok. Kontrol testlerin aşağıdaki listede.
            </p>
          ) : olcumler.length < 2 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">
              Şimdilik tek bir nokta var: %{Math.round(sonOran * 100)}. İkinci testini çözdüğünde
              eğilimini göreceksin.
            </p>
          ) : (
            <BasariEgilimi noktalar={noktalar} ariaLabel="Check-up başarı oranın, eskiden yeniye" />
          )}
        </ChartCard>

        {/* Test listesi tablo: yarım genişlikte sütunları sığmıyordu, geniş ekranda
            konu haritası 5, testler 7 sütun. */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12 lg:items-start">
          {/* ── Konu haritası ─────────────────────────────────────── */}
          <ComponentCard
            title="Konu haritan"
            desc="Tüm testlerinin toplamı — zayıftan güçlüye"
            className="lg:col-span-5"
          >
            <KonuHaritasi konular={konular} />
            <p className="border-t border-gray-100 pt-4 text-theme-xs text-gray-500">
              Seviye için bir konuda toplam en az 3 soru gerekir.
            </p>
          </ComponentCard>

          {/* ── Geçmiş ────────────────────────────────────────────── */}
          {/* Satırın tamamı sonuca bağlantı. Telefonda D/Y/B sütunu yok, tarihin
              yanında yazıyor: tablo yana kaymasın. */}
          <ComponentCard title="Testlerin" desc="En yeniden eskiye" flush className="lg:col-span-7">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Test</TableCell>
                  <TableCell isHeader nowrap className="hidden sm:table-cell">
                    <span aria-hidden>D/Y/B</span>
                    <span className="sr-only">Doğru, yanlış, boş</span>
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
                {[...sonuclar].reverse().map((r) => {
                  const o = oran(r);
                  const dyb = `${r.correctCount}D ${r.wrongCount}Y ${r.blankCount}B`;
                  return (
                    <TableRow key={r.sessionId} hover className="relative">
                      <TableCell className="w-full max-w-0 min-w-36">
                        <Link
                          href={"/sonuc/" + r.sessionId}
                          className="block truncate font-medium text-gray-800 after:absolute after:inset-0"
                        >
                          {r.packageName}
                        </Link>
                        <span className="tabular block truncate text-theme-xs text-gray-500">
                          {trDate(r.computedAt)}
                          <span className="sm:hidden"> · {dyb}</span>
                        </span>
                      </TableCell>
                      <TableCell nowrap className="tabular hidden sm:table-cell">
                        {dyb}
                      </TableCell>
                      <TableCell align="end" nowrap>
                        <span className="tabular font-display font-semibold text-gray-800">
                          {trNumber(r.netScore)}
                        </span>
                      </TableCell>
                      <TableCell align="end">
                        <Badge size="sm" color={bant(o)}>
                          <span className="tabular">%{Math.round(o * 100)}</span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t border-gray-100 p-4 sm:px-6">
              <ButtonLink href="/paketler" variant="soft" block startIcon={<ClipboardList />}>
                Yeni test çöz
              </ButtonLink>
            </div>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}
