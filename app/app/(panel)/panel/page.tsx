import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChartLine,
  CircleCheck,
  Clock,
  ClipboardList,
  Hourglass,
  Play,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { aggregateTopics, greeting, studentStats, type ResultLike } from "@/lib/insights";
import type { TopicBreakdown } from "@/lib/scoring";
import { PackageCard } from "@/components/PackageCard";
import { levelMeta } from "@/components/ui/charts";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Progress,
  Stat,
  trDate,
  trNumber,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Ana sayfa" };

export default async function DashboardPage() {
  // Düzen zaten girişi denetledi; burada kullanıcı kesin var.
  const user = (await getCurrentUser())!;
  const now = new Date();

  const [acik, sonuclarHam, katalog] = await Promise.all([
    prisma.checkupSession.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS", expiresAt: { gt: now } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        expiresAt: true,
        package: { select: { name: true, questionCount: true } },
        _count: { select: { items: true } },
        items: { where: { answer: { choiceId: { not: null } } }, select: { id: true } },
      },
    }),
    prisma.checkupResult.findMany({
      where: { session: { userId: user.id } },
      orderBy: { computedAt: "desc" },
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
    loadCatalog(user.id, now),
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
  const zayiflar = [...konular].sort((a, b) => a.ratio - b.ratio).slice(0, 4);
  const guclular = [...konular]
    .filter((t) => t.level === "STRONG")
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  // Öneri: hiç çözülmemiş açık paketler önce, sonra az çözülenler.
  const oneriler = katalog
    .filter((p) => !p.locked && !p.inProgress)
    .sort((a, b) => (a.timesTaken ?? 0) - (b.timesTaken ?? 0))
    .slice(0, 3);

  const ilkAd = user.name.split(" ")[0];
  const yeni = sonuclar.length === 0;

  return (
    <div className="animate-rise space-y-8">
      {/* Selam */}
      <div>
        <p className="text-sm font-medium text-ink-faint">{greeting(now)},</p>
        <h1 className="font-display mt-0.5 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
          {ilkAd} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          {yeni
            ? "İlk check-up'ını çözerek matematikte nerede durduğunu görelim."
            : "Bugün hangi konunu ölçmek istersin?"}
        </p>
      </div>

      {/* Yarım kalan test */}
      {acik ? (
        <div className="bg-brand-gradient relative overflow-hidden rounded-2xl p-5 text-white shadow-pop sm:p-6">
          <div aria-hidden className="bg-grid-fade absolute inset-0" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/75">
                <Hourglass className="size-4" /> Yarım kalan testin var
              </p>
              <p className="font-display mt-1.5 text-xl font-semibold">{acik.package.name}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/80">
                <span className="tabular">
                  {acik.items.length}/{acik._count.items} soru işaretli
                </span>
                <span className="tabular">
                  {Math.max(0, Math.round((acik.expiresAt.getTime() - now.getTime()) / 60_000))} dk
                  kaldı
                </span>
              </div>
            </div>
            <LinkButton href={"/checkup/" + acik.id} variant="white" size="lg">
              <Play /> Devam et
            </LinkButton>
          </div>
        </div>
      ) : null}

      {yeni ? (
        /* İlk kez gelen öğrenci */
        <Card className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            <div className="p-6 sm:p-8">
              <Badge tone="brand">
                <Sparkles /> Başlarken
              </Badge>
              <h2 className="font-display mt-4 text-2xl font-bold tracking-tight text-ink">
                20 dakikada matematik haritanı çıkar
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                Kısa bir test çöz; sonunda hangi konuda güçlü olduğunu, hangisinde eksiğin
                olduğunu ve yanlışlarının nedenini gör. Her yanlışın çözümü de orada.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton
                  href={oneriler[0] ? "/paketler/" + oneriler[0].slug : "/paketler"}
                  size="lg"
                >
                  İlk testine başla <ArrowRight />
                </LinkButton>
                <LinkButton href="/paketler" variant="secondary" size="lg">
                  Tüm testler
                </LinkButton>
              </div>
            </div>
            <ul className="space-y-4 border-t border-line bg-surface-sunk p-6 sm:p-8 md:border-s md:border-t-0">
              {[
                { icon: ClipboardList, t: "Paketini seç", d: "TYT çekirdek, problemler, trigonometri…" },
                { icon: Clock, t: "15-25 soru çöz", d: "Her konudan en az 3 soru gelir." },
                { icon: Target, t: "Haritanı gör", d: "Güçlü, orta ve zayıf konuların tek bakışta." },
              ].map(({ icon: Icon, t, d }, i) => (
                <li key={t} className="flex gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-card ring-1 ring-line">
                    <Icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      <span className="tabular me-1.5 text-ink-faint">{i + 1}.</span>
                      {t}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : (
        <>
          {/* Özet sayılar */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat icon={<ClipboardList />} label="Çözülen test" value={ozet.testCount} />
            <Stat
              icon={<Target />}
              label="Genel başarı"
              value={"%" + Math.round(ozet.avgRatio * 100)}
              tone={ozet.avgRatio >= 0.75 ? "ok" : ozet.avgRatio >= 0.45 ? "warn" : "bad"}
            />
            <Stat
              icon={<CircleCheck />}
              label="Son net"
              value={ozet.lastNet !== null ? trNumber(ozet.lastNet) : "—"}
              hint={
                ozet.trend !== null && ozet.trend !== 0 ? (
                  <span
                    className={cn(
                      "flex items-center gap-1 font-medium",
                      ozet.trend > 0 ? "text-ok" : "text-bad"
                    )}
                  >
                    {ozet.trend > 0 ? (
                      <TrendingUp className="size-3.5" />
                    ) : (
                      <TrendingDown className="size-3.5" />
                    )}
                    önceki teste göre {ozet.trend > 0 ? "+" : ""}
                    {ozet.trend} puan
                  </span>
                ) : undefined
              }
            />
            <Stat icon={<Clock />} label="Toplam süre" value={ozet.totalMinutes + " dk"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
            {/* Genel konu haritası */}
            <Card className="p-5 sm:p-6">
              <CardHeader
                icon={<Target />}
                title="Konu haritan"
                description="Çözdüğün tüm testlerin toplamı"
                action={
                  <Link href="/gelisim" className="text-[13px] font-semibold text-brand hover:underline">
                    Tümü
                  </Link>
                }
              />

              {konular.length === 0 ? (
                <p className="mt-5 rounded-xl bg-surface-sunk p-4 text-sm text-ink-soft">
                  Konu seviyesi için bir konuda en az 3 soru çözmüş olman gerekiyor. Birkaç
                  test daha çözünce haritan burada belirecek.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  {zayiflar.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Çalışman gerekenler
                      </p>
                      <ul className="mt-2.5 space-y-3">
                        {zayiflar.map((t) => {
                          const meta = levelMeta(t.level);
                          return (
                            <li key={t.topicId}>
                              <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate font-medium text-ink">{t.name}</span>
                                <span className={cn("shrink-0 text-xs font-semibold", meta?.text)}>
                                  %{Math.round(t.ratio * 100)}
                                </span>
                              </div>
                              <Progress
                                className="mt-1.5 h-1.5"
                                value={t.ratio * 100}
                                tone={
                                  t.level === "WEAK" ? "bad" : t.level === "MEDIUM" ? "warn" : "ok"
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {guclular.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Güçlü olduğun konular
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {guclular.map((t) => (
                          <Badge key={t.topicId} tone="ok" className="py-1 text-xs">
                            <CircleCheck /> {t.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>

            {/* Son sonuçlar */}
            <Card className="p-5 sm:p-6">
              <CardHeader
                icon={<ChartLine />}
                title="Son sonuçların"
                action={
                  <Link href="/gelisim" className="text-[13px] font-semibold text-brand hover:underline">
                    Gelişim
                  </Link>
                }
              />
              <ul className="-mx-2 mt-4">
                {sonuclar.slice(0, 4).map((r) => {
                  const toplam = r.correctCount + r.wrongCount + r.blankCount;
                  const oran = toplam === 0 ? 0 : r.correctCount / toplam;
                  return (
                    <li key={r.sessionId}>
                      <Link
                        href={"/sonuc/" + r.sessionId}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-hover"
                      >
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold tabular",
                            oran >= 0.75
                              ? "bg-ok-wash text-ok"
                              : oran >= 0.45
                                ? "bg-warn-wash text-warn"
                                : "bg-bad-wash text-bad"
                          )}
                        >
                          %{Math.round(oran * 100)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {r.packageName}
                          </span>
                          <span className="block text-xs text-ink-faint">
                            {trDate(r.computedAt, false)} · {r.correctCount}D {r.wrongCount}Y{" "}
                            {r.blankCount}B
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
            </Card>
          </div>
        </>
      )}

      {/* Öneriler */}
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              {yeni ? "Buradan başlayabilirsin" : "Sıradaki testin"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {yeni ? "Kısa ve odaklı paketler." : "Henüz çözmediğin ya da az çözdüğün paketler."}
            </p>
          </div>
          <Link
            href="/paketler"
            className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            Tüm testler <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {oneriler.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {oneriler.map((p) => (
              <PackageCard key={p.slug} p={p} />
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState
              icon={<ClipboardList />}
              title="Açık paket yok"
              description="Şu an erişebildiğin tüm paketleri çözdün ya da hepsi yarım. Tüm testlere göz at."
              action={<LinkButton href="/paketler">Tüm testler</LinkButton>}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
