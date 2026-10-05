import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartLine, ClipboardList, History, Play, Target, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { loadCatalog, siradakiPaketler } from "@/lib/catalog";
import { aggregateTopics, type ResultLike } from "@/lib/insights";
import { EXAMS, daysUntilExam, examShort, isExamScope, type ExamScopeValue } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { TopicBar, TrendChart } from "@/components/ui/charts";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  trDate,
  trNumber,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Gelişim" };

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
        where: { userId: user.id, status: "IN_PROGRESS", expiresAt: { gt: simdi } },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      }),
      loadCatalog(user.id, simdi, { scope: user.targetExam }),
    ]);
    const ilk = siradakiPaketler(katalog, 1)[0];

    return (
      <div className="animate-rise space-y-5">
        <PageHeader title="Gelişim" description="Çözdüğün testler burada birikir." />
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
                <LinkButton href={`/checkup/${yarim.id}`}>
                  <Play /> Yarım kalan testine dön
                </LinkButton>
              ) : ilk ? (
                <LinkButton href={`/paketler/${ilk.slug}`}>
                  Teste göz at <ArrowRight />
                </LinkButton>
              ) : (
                <LinkButton href="/paketler">
                  Testlere göz at <ArrowRight />
                </LinkButton>
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
  // 15 soruluk testin düşük neti "geriledin" gibi görünürdü.
  const noktalar = olcumler.map((r) => ({
    label: r.computedAt.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
    value: oran(r) * 100,
    title:
      r.packageName + " · %" + Math.round(oran(r) * 100) + " · " + trNumber(r.netScore) + " net",
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
    <div className="animate-rise space-y-5">
      <PageHeader
        title="Gelişim"
        description="Ölçümlerinin toplamı: nerede ilerledin, nerede duruyorsun."
      />

      {mevcutKapsamlar.length > 1 ? (
        <div className="scroll-x -mx-4 flex gap-1.5 px-4 sm:mx-0 sm:px-0">
          {mevcutKapsamlar.map((s) => (
            <Link
              key={s}
              href={"/gelisim?tur=" + s}
              aria-current={s === secili ? "page" : undefined}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-lg px-3 text-caption font-semibold transition",
                s === secili
                  ? "bg-brand-deep text-white"
                  : "bg-surface text-ink-soft ring-1 ring-inset ring-line"
              )}
            >
              {examShort(s)}
            </Link>
          ))}
        </div>
      ) : null}

      {/* ── Hedef: öğrencinin kendini takip ettiği tek sayı ─────── */}
      {secili && tahmin !== null && hedef ? (
        <Card className="overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{examShort(secili)} matematik</Badge>
              {kalanGun !== null ? (
                <Badge tone="neutral">{kalanGun} gün kaldı</Badge>
              ) : (
                <Badge tone="neutral">{EXAMS[secili].season}</Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-display tabular text-num-lg font-bold leading-none text-ink">
                {trNumber(tahmin, tahmin % 1 === 0 ? 0 : 1)}
              </span>
              <span className="text-caption text-ink-soft">tahmini net</span>
              <span className="tabular ms-auto text-caption font-semibold text-ink-soft">
                hedef {hedef}
              </span>
            </div>

            <div
              className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-sunk ring-1 ring-inset ring-line"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={hedef}
              aria-valuenow={Math.min(tahmin, hedef)}
              aria-label="Hedefe ilerleme"
            >
              <div
                className="bg-brand-gradient h-full rounded-full"
                style={{ width: Math.min(100, (tahmin / hedef) * 100) + "%" }}
              />
            </div>

            <p className="mt-2.5 text-caption leading-relaxed text-ink-soft">
              {tahmin >= hedef ? (
                <>
                  Hedefin üstündesin. Hedefi yükseltmenin zamanı:{" "}
                  <Link href="/profil" className="font-medium text-brand underline">
                    profilden güncelle
                  </Link>
                  .
                </>
              ) : (
                <>
                  Hedefe{" "}
                  <strong className="font-semibold text-ink">
                    {trNumber(hedef - tahmin, 1)} net
                  </strong>{" "}
                  var.
                </>
              )}
            </p>
          </div>

          <p className="border-t border-line bg-surface-sunk px-4 py-2.5 text-micro leading-relaxed text-ink-faint sm:px-6">
            Bu tahmin çözdüğün check-up{"'"}ların oranını {EXAMS[secili].mathQuestionCount} soruluk{" "}
            {examShort(secili)} matematik bölümüne taşır. Gerçek sınav neti değildir — sadece yön
            gösterir.
          </p>
        </Card>
      ) : null}

      {/* ── Eğilim ──────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-6">
        <CardHeader
          icon={<ChartLine />}
          title="Başarı oranın"
          description={
            olcumler.length < 2
              ? "Grafik ikinci check-up'ından sonra anlam kazanır."
              : "Her nokta bir check-up; 5 soruluk kontrol testleri çizgiye girmez."
          }
          action={
            olcumler.length >= 2 ? (
              <span
                className={cn(
                  "tabular flex items-center gap-1 text-caption font-semibold",
                  fark > 0 ? "text-ok" : fark < 0 ? "text-bad" : "text-ink-soft"
                )}
              >
                <TrendingUp className={cn("size-4", fark < 0 && "rotate-180")} />
                {fark > 0 ? "+" : ""}
                {fark} puan
              </span>
            ) : null
          }
        />
        <div className="mt-4">
          {olcumler.length === 0 ? (
            <p className="rounded-xl bg-surface-sunk p-4 text-caption text-ink-soft">
              Bu sınavda henüz bir check-up ölçümün yok. Kontrol testlerin aşağıdaki listede.
            </p>
          ) : olcumler.length < 2 ? (
            <p className="rounded-xl bg-surface-sunk p-4 text-caption text-ink-soft">
              Şimdilik tek bir nokta var: %{Math.round(sonOran * 100)}. İkinci testini çözdüğünde
              eğilimini göreceksin.
            </p>
          ) : (
            <>
              <TrendChart points={noktalar} compact className="sm:hidden" />
              <TrendChart points={noktalar} className="max-sm:hidden" />
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* ── Konu haritası ─────────────────────────────────────── */}
        <Card className="p-4 sm:p-6">
          <CardHeader
            icon={<Target />}
            title="Konu haritan"
            description="Tüm testlerinin toplamı — zayıftan güçlüye"
          />
          <div className="mt-3 divide-y divide-line">
            {konular.map((t) => (
              <TopicBar
                key={t.topicId}
                name={t.name}
                ratio={t.ratio}
                correct={t.correct}
                asked={t.asked}
                level={t.level}
              />
            ))}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-micro text-ink-faint">
            Seviye için bir konuda toplam en az 3 soru gerekir.
          </p>
        </Card>

        {/* ── Geçmiş ────────────────────────────────────────────── */}
        <Card className="p-4 sm:p-6">
          <CardHeader icon={<History />} title="Testlerin" description="En yeniden eskiye" />
          <ul className="-mx-2 mt-3">
            {[...sonuclar].reverse().map((r) => {
              const o = oran(r);
              return (
                <li key={r.sessionId}>
                  <Link
                    href={"/sonuc/" + r.sessionId}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-hover active:bg-surface-sunk"
                  >
                    <span
                      className={cn(
                        "tabular flex size-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold",
                        o >= 0.75
                          ? "bg-ok-wash text-ok"
                          : o >= 0.45
                            ? "bg-warn-wash text-warn"
                            : "bg-bad-wash text-bad"
                      )}
                    >
                      %{Math.round(o * 100)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {r.packageName}
                      </span>
                      <span className="block text-micro text-ink-faint">
                        {trDate(r.computedAt)} · {r.correctCount}D {r.wrongCount}Y {r.blankCount}B
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="font-display tabular block text-[15px] font-bold text-ink">
                        {trNumber(r.netScore)}
                      </span>
                      <span className="block text-[11px] text-ink-faint">net</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <LinkButton href="/paketler" variant="soft" block>
              <ClipboardList /> Yeni test çöz
            </LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
