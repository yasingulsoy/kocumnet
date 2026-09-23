import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Brain,
  ChevronDown,
  CircleCheck,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCheckupReview } from "@/lib/checkup";
import { errorPattern, dominantError, compareProgress } from "@/lib/diagnosis";
import {
  bosStratejisi,
  hataTavsiyesi,
  karar,
  oncelikSirasi,
  tekrarTavsiyesi,
  HAFTALIK_SORU,
  KONU_HAFTALIK_DAKIKA,
} from "@/lib/coaching";
import { examShort, hasPenalty } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { PRODUCTS, productUrl } from "@/lib/products";
import { ScoreRing, TopicBar } from "@/components/ui/charts";
import { KonuTekrarButonu } from "@/components/KonuTekrarButonu";
import { Badge, Card, CardHeader, LinkButton, trNumber } from "@/components/ui";
import { cn } from "@/lib/cn";
import { AnswerReview } from "./AnswerReview";

export const metadata: Metadata = { title: "Sonuç" };

export default async function ResultPage({ params }: PageProps<"/sonuc/[sessionId]">) {
  const { sessionId } = await params;
  const user = (await getCurrentUser())!;

  const [result, review] = await Promise.all([
    prisma.checkupResult.findUnique({
      where: { sessionId },
      select: {
        correctCount: true,
        wrongCount: true,
        blankCount: true,
        netScore: true,
        totalTimeMs: true,
        topicBreakdown: true,
        recommendedProductIds: true,
        computedAt: true,
        examScope: true,
        session: {
          select: {
            userId: true,
            durationMinutes: true,
            relaxedExposureCount: true,
            kind: true,
            penaltyRatio: true,
            focusTopic: { select: { name: true } },
            package: { select: { name: true, slug: true, examScope: true } },
          },
        },
      },
    }),
    // Cevap anahtarı içerir; yalnızca BİTMİŞ oturumlarda çalışır.
    getCheckupReview(sessionId, user.id).catch(() => null),
  ]);

  // Başkasının sonucuna "yetkin yok" değil "yok" diyoruz: ilki sonucun var
  // olduğunu doğrular.
  if (!result || result.session.userId !== user.id) notFound();

  const breakdown = result.topicBreakdown as unknown as TopicBreakdown;
  const toplam = result.correctCount + result.wrongCount + result.blankCount;
  const oran = toplam === 0 ? 0 : result.correctCount / toplam;
  const sinav = result.examScope ?? result.session.package.examScope;
  const cezaVar = hasPenalty(sinav);
  const retest = result.session.kind === "TOPIC_RETEST";

  const [onceki, konuBilgileri] = await Promise.all([
    prisma.checkupResult.findFirst({
      where: {
        session: { userId: user.id, package: { slug: result.session.package.slug } },
        computedAt: { lt: result.computedAt },
      },
      orderBy: { computedAt: "desc" },
      select: { topicBreakdown: true, netScore: true },
    }),
    prisma.topic.findMany({
      where: { id: { in: breakdown.topics.map((t) => t.topicId) } },
      select: { id: true, examWeights: true, recommendedProductIds: true },
    }),
  ]);

  const agirliklar = new Map<string, number>();
  for (const k of konuBilgileri) {
    const w = (k.examWeights ?? {}) as Record<string, number>;
    if (typeof w[sinav] === "number") agirliklar.set(k.id, w[sinav]);
  }

  const ilerleme = onceki
    ? compareProgress(
        breakdown,
        onceki.topicBreakdown as unknown as TopicBreakdown,
        Number(result.netScore) - Number(onceki.netScore)
      )
    : null;

  const hata = review ? hataTavsiyesi(dominantError(errorPattern(review))) : null;

  const oncelikler = oncelikSirasi(breakdown.topics, agirliklar);
  const guclular = breakdown.topics
    .filter((t) => t.level === "STRONG")
    .sort((a, b) => b.ratio - a.ratio);

  const sonuc = karar(oran, oncelikler, guclular, result.blankCount, toplam);
  const bosNotu = bosStratejisi(
    result.blankCount,
    toplam,
    Number(result.session.penaltyRatio),
    examShort(sinav)
  );
  const tekrarNotu = tekrarTavsiyesi(
    result.session.relaxedExposureCount,
    result.session.package.name
  );

  const olculemeyen = breakdown.topics.filter((t) => t.level === null).length;
  const urunler = result.recommendedProductIds
    .map((id) => PRODUCTS[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const baslik = retest
    ? `${result.session.focusTopic?.name ?? "Konu"} kontrol testi`
    : result.session.package.name;

  return (
    <div className="animate-fade space-y-5 sm:space-y-6">
      <Link
        href="/gelisim"
        className="inline-flex min-h-9 items-center gap-1.5 text-caption font-medium text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Gelişim
      </Link>

      {/* ── Özet: telefonda yatay, halka küçük ───────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-4 max-sm:bg-brand-wash/40 sm:grid sm:grid-cols-[auto_1fr] sm:gap-0 sm:p-0">
          <div className="flex shrink-0 items-center justify-center sm:bg-brand-wash/60 sm:p-8">
            <ScoreRing
              value={oran * 100}
              size={112}
              stroke={10}
              label={`Yüzde ${Math.round(oran * 100)} başarı`}
              className="sm:hidden"
            >
              <span className="font-display tabular text-num-sm font-bold leading-none text-ink">
                %{Math.round(oran * 100)}
              </span>
            </ScoreRing>
            <ScoreRing
              value={oran * 100}
              size={168}
              label={`Yüzde ${Math.round(oran * 100)} başarı`}
              className="max-sm:hidden"
            >
              <span className="font-display tabular text-num-lg font-bold leading-none text-ink">
                %{Math.round(oran * 100)}
              </span>
              <span className="text-micro text-ink-faint">başarı</span>
            </ScoreRing>
          </div>

          <div className="min-w-0 sm:p-8">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{examShort(sinav)}</Badge>
              {retest ? <Badge tone="ok">Kontrol testi</Badge> : null}
            </div>
            <h1 className="font-display mt-1.5 text-h2 font-bold tracking-tight text-ink text-balance sm:text-[28px]">
              {baslik}
            </h1>
            <p className="mt-1.5 text-caption leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">{sonuc.baslik}</strong>
            </p>
          </div>
        </div>

        {/* Net + D/Y/B tek satır. Cezasız sınavda net = doğru sayısı olduğu
            için "net" bloğunu hiç göstermiyoruz: yan yana iki aynı sayı
            ekranda hata gibi duruyor. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface-sunk px-4 py-3 sm:px-8">
          {cezaVar ? (
            <p className="flex items-baseline gap-1.5">
              <span className="font-display tabular text-num-sm font-bold text-ink">
                {trNumber(Number(result.netScore), 2)}
              </span>
              <span className="text-micro text-ink-faint">net</span>
            </p>
          ) : (
            <p className="flex items-baseline gap-1.5">
              <span className="font-display tabular text-num-sm font-bold text-ink">
                {result.correctCount}/{toplam}
              </span>
              <span className="text-micro text-ink-faint">doğru</span>
            </p>
          )}
          <div className="ms-auto flex gap-1.5">
            <Badge tone="ok">{result.correctCount}D</Badge>
            <Badge tone="bad">{result.wrongCount}Y</Badge>
            <Badge tone="neutral">{result.blankCount}B</Badge>
          </div>
        </div>
      </Card>

      {/* ── Koçun cümlesi ───────────────────────────────── */}
      <Card
        className={cn(
          "p-4 sm:p-6",
          sonuc.ton === "ok" && "border-ok/30 bg-ok-wash/40",
          sonuc.ton === "warn" && "border-warn/30 bg-warn-wash/40",
          sonuc.ton === "bad" && "border-bad/30 bg-bad-wash/40"
        )}
      >
        <p className="text-body leading-relaxed text-ink">{sonuc.metin}</p>
        {bosNotu ? (
          <p className="mt-3 border-t border-line pt-3 text-caption leading-relaxed text-ink-soft">
            <strong className="font-semibold text-ink">Boş bırakma:</strong> {bosNotu}
          </p>
        ) : null}
      </Card>

      {/* ── Şimdi ne çalışmalısın (öncelik sırası) ──────── */}
      {oncelikler.length > 0 ? (
        <Card className="border-brand/25 shadow-raised">
          <CardHeader
            className="p-4 sm:p-6"
            title="Bu hafta sadece bunlar"
            description={`Sırayla. Her konu yaklaşık ${trNumber(
              Math.round(KONU_HAFTALIK_DAKIKA / 30) / 2,
              1
            )} saat: konu tekrarı, ${HAFTALIK_SORU} soru, yanlış analizi — sonunda 5 soruluk kontrol testi.`}
          />
          <ol className="divide-y divide-line">
            {oncelikler.map((k, i) => (
              <li key={k.topicId} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-caption font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-ink">{k.name}</p>
                  <p className="tabular mt-0.5 text-caption text-ink-soft">
                    {k.asked} soruda {k.correct} doğru · %{Math.round(k.ratio * 100)}
                    {k.kayip !== null ? (
                      <>
                        {" · "}
                        <span className="font-medium text-bad">
                          sınavda ~{trNumber(k.kayip, k.kayip % 1 === 0 ? 0 : 1)} soru
                        </span>
                      </>
                    ) : null}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <KonuTekrarButonu topicId={k.topicId} topicName={k.name} />
                    {(() => {
                      const urunId = konuBilgileri.find((t) => t.id === k.topicId)
                        ?.recommendedProductIds[0];
                      const urun = urunId ? PRODUCTS[urunId] : null;
                      return urun ? (
                        <a
                          href={productUrl(urun.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-micro font-medium text-ink-soft hover:text-brand"
                        >
                          {urun.name} <ArrowUpRight className="size-3.5" />
                        </a>
                      ) : null;
                    })()}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-4 py-3 text-caption text-ink-soft sm:px-6">
            Diğer konulara bu hafta bakma. Bunları bitirdiğinde plan kendini güncelleyecek.
          </p>
        </Card>
      ) : null}

      {/* ── Hata deseni ─────────────────────────────────── */}
      {hata ? (
        <Card className="flex gap-3 border-warn/30 bg-warn-wash/40 p-4 sm:p-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warn-wash text-warn">
            <Brain className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-body font-semibold text-ink">{hata.baslik}</h2>
            <p className="mt-1 text-caption leading-relaxed text-ink-soft">{hata.metin}</p>
          </div>
        </Card>
      ) : null}

      {/* ── Önceki denemeye göre ────────────────────────── */}
      {ilerleme && (ilerleme.gelisen.length > 0 || ilerleme.gerileyen.length > 0) ? (
        <Card className="p-4 sm:p-6">
          <h2 className="text-body font-semibold text-ink">Geçen denemene göre</h2>
          <ul className="mt-3 space-y-2">
            {ilerleme.gelisen.map((t) => (
              <li key={t.name} className="flex items-center gap-2 text-caption text-ink-soft">
                <TrendingUp className="size-4 shrink-0 text-ok" />
                <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
                <span className="tabular shrink-0 font-semibold text-ok">+{t.delta} puan</span>
              </li>
            ))}
            {ilerleme.gerileyen.map((t) => (
              <li key={t.name} className="flex items-center gap-2 text-caption text-ink-soft">
                <TrendingDown className="size-4 shrink-0 text-bad" />
                <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
                <span className="tabular shrink-0 font-semibold text-bad">{t.delta} puan</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Konu haritası ───────────────────────────────── */}
      <Card>
        <CardHeader
          className="p-4 sm:p-6"
          title="Konu haritası"
          description={
            olculemeyen > 0
              ? `${olculemeyen} konuda seviye verilmedi: 3'ten az soru soruldu.`
              : undefined
          }
        />
        <div className="divide-y divide-line px-4 sm:px-6">
          {breakdown.topics.slice(0, 3).map((t) => (
            <TopicBar
              key={t.topicId}
              name={t.name}
              ratio={t.ratio}
              correct={t.correct}
              asked={t.asked}
              level={t.level}
              slow={t.slow}
            />
          ))}
        </div>
        {breakdown.topics.length > 3 ? (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 border-t border-line text-caption font-semibold text-brand [&::-webkit-details-marker]:hidden">
              Tüm konuları gör ({breakdown.topics.length})
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-line border-t border-line px-4 sm:px-6">
              {breakdown.topics.slice(3).map((t) => (
                <TopicBar
                  key={t.topicId}
                  name={t.name}
                  ratio={t.ratio}
                  correct={t.correct}
                  asked={t.asked}
                  level={t.level}
                  slow={t.slow}
                />
              ))}
            </div>
          </details>
        ) : null}
      </Card>

      {/* ── Sonraki ölçüm ───────────────────────────────── */}
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:p-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunk text-ink-soft">
          <RotateCcw className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-caption leading-relaxed text-ink-soft">{tekrarNotu}</p>
        <LinkButton href="/paketler" variant="secondary" className="max-sm:w-full">
          Testler
        </LinkButton>
      </Card>

      {/* ── Kaynak (en sonda, araç olarak) ──────────────── */}
      {urunler.length > 0 ? (
        <Card>
          <CardHeader
            className="p-4 sm:p-6"
            title="Bu konuları çalışmak için elindeki kaynak yetmiyorsa"
            description="Koçum.Net yayınları — zayıf çıkan konulara göre seçildi."
          />
          <ul className="divide-y divide-line">
            {urunler.map((u) => (
              <li key={u.id}>
                <a
                  href={productUrl(u.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition active:bg-surface-sunk sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-ink">{u.name}</span>
                    <span className="block text-micro text-ink-faint">
                      {u.questionCount} soru · {u.note}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-faint" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── Cevap incelemesi ────────────────────────────── */}
      {review ? (
        <Card>
          <CardHeader
            className="p-4 sm:p-6"
            title="Cevaplarını incele"
            description="Her sorunun doğrusu, senin işaretin ve varsa adım adım çözümü."
            action={
              <span className="flex items-center gap-1 text-caption text-ok">
                <CircleCheck className="size-4" /> {result.correctCount}
              </span>
            }
          />
          <AnswerReview items={review} />
        </Card>
      ) : null}
    </div>
  );
}
