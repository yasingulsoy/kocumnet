import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Hourglass,
  Play,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { aggregateTopics, greeting, studentStats, type ResultLike } from "@/lib/insights";
import { aktifPlan } from "@/lib/plan";
import { haftaBasi, haftaEtiketi } from "@/lib/coaching";
import { daysUntilExam, examShort } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { PackageCard } from "@/components/PackageCard";
import { PlanCard } from "@/components/PlanCard";
import { PlanOlusturKarti } from "@/components/PlanOlusturKarti";
import { levelMeta } from "@/components/ui/charts";
import { KonuTekrarButonu } from "@/components/KonuTekrarButonu";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Progress,
  trNumber,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Ana sayfa" };

export default async function DashboardPage({ searchParams }: PageProps<"/panel">) {
  // Düzen zaten girişi ve tanışmayı denetledi; burada kullanıcı kesin var.
  const user = (await getCurrentUser())!;
  const now = new Date();
  const sp = await searchParams;
  const hata = typeof sp.hata === "string" ? sp.hata : null;
  const yeniTanisma = sp.tanisma === "1";

  const [acik, sonuclarHam, katalog, plan, buHaftakiTest] = await Promise.all([
    prisma.checkupSession.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS", expiresAt: { gt: now } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        expiresAt: true,
        kind: true,
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
        session: { select: { package: { select: { name: true } } } },
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
        kind: { not: "TOPIC_RETEST" },
        submittedAt: { gte: haftaBasi(now) },
      },
    }),
  ]);

  const sonuclar: (ResultLike & { sessionId: string; packageName: string })[] = sonuclarHam.map(
    (r) => ({
      sessionId: r.sessionId,
      packageName: r.session.package.name,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      blankCount: r.blankCount,
      netScore: Number(r.netScore),
      totalTimeMs: r.totalTimeMs,
      computedAt: r.computedAt,
      topicBreakdown: r.topicBreakdown as unknown as TopicBreakdown,
    })
  );

  const ozet = studentStats(sonuclar);
  const konular = aggregateTopics(sonuclar).filter((t) => t.level !== null);
  const zayiflar = [...konular]
    .filter((t) => t.level === "WEAK")
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3);

  const oneriler = katalog
    .filter((p) => !p.locked && !p.inProgress)
    .sort((a, b) => (a.timesTaken ?? 0) - (b.timesTaken ?? 0) || Number(b.isIntro) - Number(a.isIntro))
    .slice(0, 2);

  const ilkAd = user.name.split(" ")[0];
  const yeni = sonuclar.length === 0;
  const kalanGun = daysUntilExam(user.targetExam, now);
  const haftalikHedef = user.weeklyTestGoal ?? null;
  const temponunDurumu = haftalikHedef !== null && buHaftakiTest >= haftalikHedef;

  /** Son altı testin başarı oranı — biriken sayı değil, HAREKET. */
  const oran = (r: ResultLike) => {
    const t = r.correctCount + r.wrongCount + r.blankCount;
    return t === 0 ? 0 : r.correctCount / t;
  };
  const sonAlti = sonuclar.slice(0, 6).reverse();

  return (
    <div className="animate-fade space-y-5 sm:space-y-6">
      {/* Tek satır selamlama: eski hâlinde 110 piksellik bir başlık bloğuydu
          ve telefonda ilk ekranın beşte birini kaplıyordu. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-caption text-ink-faint">
          {greeting(now)}, <span className="font-semibold text-ink-soft">{ilkAd}</span>
        </p>
        {user.targetExam ? (
          <Badge tone="brand">{examShort(user.targetExam)}</Badge>
        ) : null}
        {kalanGun !== null ? (
          <span className="tabular flex items-center gap-1 text-caption text-ink-faint">
            <CalendarDays className="size-3.5" /> {kalanGun} gün
          </span>
        ) : null}
      </div>

      {hata ? <Alert>{hata}</Alert> : null}
      {yeniTanisma ? (
        <Alert tone="ok">
          Hazırız. {examShort(user.targetExam)} için testlerin aşağıda —
          {user.targetNet ? ` hedefin ${trNumber(user.targetNet, 0)} net.` : ""}
        </Alert>
      ) : null}

      {/* ── 1. Bu hafta ─────────────────────────────────── */}
      {plan ? (
        <PlanCard plan={plan} haftaEtiketi={haftaEtiketi(plan.weekStart)} />
      ) : !yeni ? (
        <PlanOlusturKarti />
      ) : null}

      {/* ── 2. Tek eylem ────────────────────────────────── */}
      {acik ? (
        <Card className="bg-brand-gradient overflow-hidden border-0 p-4 text-white shadow-brand sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-white/90">
                <Hourglass className="size-3.5" /> Yarım kalan test
              </p>
              <h2 className="font-display mt-1.5 text-h2 font-bold text-balance">
                {acik.kind === "TOPIC_RETEST" && acik.focusTopic
                  ? `${acik.focusTopic.name} kontrol testi`
                  : acik.package.name}
              </h2>
              <p className="tabular mt-1 text-caption text-white/90">
                {acik.items.length}/{acik._count.items} işaretli · süre{" "}
                {acik.expiresAt.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Istanbul",
                })}
                {"'"}e kadar
              </p>
            </div>
            <LinkButton
              href={`/checkup/${acik.id}`}
              variant="white"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Play /> Devam et
            </LinkButton>
          </div>
        </Card>
      ) : yeni ? (
        <Card className="border-brand/25 bg-brand-wash/30 p-5 shadow-raised sm:p-8">
          <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-brand">
            <Sparkles className="size-3.5" /> İlk adım
          </p>
          <h2 className="font-display mt-1.5 text-h1 font-bold tracking-tight text-ink text-balance">
            Kısa bir testle başlayalım
          </h2>
          <p className="mt-2 text-body leading-relaxed text-ink-soft">
            Sonunda hangi konuda güçlü, hangisinde eksiğin olduğunu ve her yanlışının
            çözümünü göreceksin.
          </p>
          {oneriler[0] ? (
            <LinkButton href={"/paketler/" + oneriler[0].slug} size="lg" block className="mt-5">
              {oneriler[0].name} · {oneriler[0].durationMinutes} dk <ArrowRight />
            </LinkButton>
          ) : (
            <LinkButton href="/paketler" size="lg" block className="mt-5">
              Testleri gör <ArrowRight />
            </LinkButton>
          )}
          <ol className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-micro text-ink-soft">
            {["Paket seç", "Soruları çöz", "Haritanı gör"].map((t, i) => (
              <li key={t} className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-wash text-[10px] font-bold text-brand">
                  {i + 1}
                </span>
                <span className="truncate">{t}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : oneriler[0] ? (
        <Card className="border-brand/25 bg-brand-wash/30 p-4 shadow-raised sm:p-6">
          <p className="text-micro font-semibold uppercase tracking-[0.14em] text-brand">
            Sıradaki adımın
          </p>
          <h2 className="font-display mt-1.5 text-h2 font-bold text-ink text-balance">
            {oneriler[0].name}
          </h2>
          <p className="tabular mt-1 text-caption text-ink-soft">
            {oneriler[0].questionCount} soru · {oneriler[0].durationMinutes} dk ·{" "}
            {oneriler[0].topicCount} konu
          </p>
          <LinkButton href={"/paketler/" + oneriler[0].slug} size="lg" block className="mt-4">
            Teste göz at <ArrowRight />
          </LinkButton>
        </Card>
      ) : null}

      {/* ── 3. İlerleme şeridi ──────────────────────────── */}
      {!yeni ? (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-display tabular text-num-md font-bold text-ink">
              %{Math.round(ozet.avgRatio * 100)}
            </p>
            <p className="text-caption text-ink-soft">genel başarı</p>
            {ozet.trend !== null && ozet.trend !== 0 ? (
              <span
                className={cn(
                  "tabular ms-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold",
                  ozet.trend > 0 ? "bg-ok-wash text-ok" : "bg-bad-wash text-bad"
                )}
              >
                {ozet.trend > 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {ozet.trend > 0 ? "+" : ""}
                {ozet.trend} puan
              </span>
            ) : null}
          </div>

          {/* Son altı test — biriken toplam değil, hareket. */}
          <div className="mt-3 flex gap-1" aria-hidden>
            {sonAlti.map((r) => (
              <span
                key={r.sessionId}
                title={`${r.packageName}: %${Math.round(oran(r) * 100)}`}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  oran(r) >= 0.75 ? "bg-ok-fill" : oran(r) >= 0.45 ? "bg-warn-fill" : "bg-bad-fill"
                )}
              />
            ))}
            {Array.from({ length: Math.max(0, 6 - sonAlti.length) }).map((_, i) => (
              <span key={i} className="h-2 flex-1 rounded-full bg-line" />
            ))}
          </div>
          <p className="tabular mt-2 flex items-center justify-between gap-2 text-micro text-ink-faint">
            <span>{ozet.testCount} test çözdün · son 6 deneme</span>
            {user.targetNet ? <span>hedef {trNumber(user.targetNet, 0)} net</span> : null}
          </p>

          {/* Haftalık tempo — öğrencinin kendi koyduğu hedef. */}
          {haftalikHedef ? (
            <p
              className={cn(
                "mt-2.5 flex flex-wrap items-center gap-x-1.5 border-t border-line pt-2.5 text-caption",
                temponunDurumu ? "text-ok" : "text-ink-soft"
              )}
            >
              <Repeat className="size-3.5 shrink-0" />
              <span className="tabular whitespace-nowrap font-semibold">
                Bu hafta {buHaftakiTest}/{haftalikHedef} check-up
              </span>
              <span className="whitespace-nowrap text-ink-faint">
                {temponunDurumu ? "· tempona uydun" : "· kendi hedefin"}
              </span>
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* ── 4. Şimdi ne çalışmalısın ────────────────────── */}
      {zayiflar.length > 0 ? (
        <Card>
          <CardHeader
            title="Şimdi ne çalışmalısın"
            description="Kanıtlı zayıf konular — her biri en az 3 soruda ölçüldü."
            action={
              <Link href="/gelisim" className="text-caption font-semibold text-brand">
                Tümü
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {zayiflar.map((t) => {
              const meta = levelMeta(t.level);
              return (
                <li key={t.topicId} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink">{t.name}</p>
                    <p className="tabular text-micro text-ink-faint">
                      {t.correct}/{t.asked} doğru · %{Math.round(t.ratio * 100)}
                    </p>
                    <Progress
                      value={t.ratio * 100}
                      label={`${t.name} başarı oranı`}
                      className="mt-1.5 h-2"
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {meta ? (
                      <span className={cn("text-micro font-semibold", meta.text)}>{meta.label}</span>
                    ) : null}
                    <KonuTekrarButonu topicId={t.topicId} topicName={t.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* ── 5. Öneriler ─────────────────────────────────── */}
      {!yeni && oneriler.length > 0 ? (
        <section>
          <h2 className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Sıradaki testler
          </h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-4">
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
            action={<LinkButton href="/paketler?tur=TUMU">Diğer sınavların testleri</LinkButton>}
          />
        </Card>
      ) : null}
    </div>
  );
}
