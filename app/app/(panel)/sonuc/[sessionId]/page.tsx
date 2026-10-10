import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  NotebookPen,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { getCheckupReview } from "@/lib/checkup";
import { errorPattern, dominantError, compareProgress } from "@/lib/diagnosis";
import {
  bosStratejisi,
  haftaBasi,
  hataTavsiyesi,
  karar,
  kontrolKarari,
  oncelikSirasi,
  tekrarTavsiyesi,
  HAFTALIK_SORU,
  KONU_HAFTALIK_DAKIKA,
} from "@/lib/coaching";
import { examShort, hasPenalty } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { PRODUCTS, productUrl } from "@/lib/products";
import { KonuHaritasi } from "@/components/KonuHaritasi";
import { KonuTekrarButonu } from "@/components/KonuTekrarButonu";
import { KonuCalisButonu } from "@/components/AlistirmaButonlari";
import { alistirmaHakki, benzerDurumlari } from "@/lib/practice";
import { KONU_CALISMA_SORU } from "@/lib/review";
import { trNumber } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { MathContent } from "@/components/MathContent";
import { RadialGauge } from "@/components/tailadmin/charts/RadialGauge";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { AnswerReview, type ReviewItemView } from "./AnswerReview";

export const metadata: Metadata = { title: "Sonuç" };

/*
 * Koçun cümlesinin tonu → kitin anlam renkleri (zemin …-50, kenar …-200).
 * Card'a renk sınıfı EKLENMİYOR: kitte className yalnızca ekler ve Card'ın
 * kendi beyaz zemini/gri kenarı CSS sırasında kazanıyor; ton kutusu düz öğe.
 */
const TON = {
  ok: { kutu: "border-success-200 bg-success-50", cizgi: "border-success-200" },
  warn: { kutu: "border-warning-200 bg-warning-50", cizgi: "border-warning-200" },
  bad: { kutu: "border-error-200 bg-error-50", cizgi: "border-error-200" },
} as const;

/** Başarı bandı — gelişim listesi ve grafiklerle aynı eşikler (%75 / %45). */
function bant(oran: number) {
  return oran >= 0.75 ? "success" : oran >= 0.45 ? "warning" : "error";
}

export default async function ResultPage({ params }: PageProps<"/sonuc/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requirePageUser();

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
            focusTopicId: true,
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

  const odakKonu = retest ? result.session.focusTopicId : null;

  // Bu haftanın sonucuysa haftalık planla bağı: plan bu sonuçtan mı çıktı?
  const buHafta = haftaBasi(new Date());
  const buHaftaninSonucu = !retest && result.computedAt >= buHafta;

  const [onceki, konuBilgileri, eskiSonuclar, kapananIs, haftaninPlani, benzerler, alistirmaKalan, deftereGiren] =
    await Promise.all([
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
    // Kontrol testi: bu konunun bir önceki ölçümü ("çalışman işe yaradı mı").
    odakKonu
      ? prisma.checkupResult.findMany({
          where: { session: { userId: user.id }, computedAt: { lt: result.computedAt } },
          orderBy: { computedAt: "desc" },
          take: 30,
          select: { topicBreakdown: true },
        })
      : Promise.resolve([]),
    // Kontrol testi: plandaki hangi işi kapattı (döngü burada kapanıyor).
    retest
      ? prisma.planItem.findFirst({
          where: { verifiedBySessionId: sessionId, plan: { userId: user.id } },
          select: {
            plan: { select: { items: { select: { kind: true, doneAt: true, verifiedBySessionId: true } } } },
          },
        })
      : Promise.resolve(null),
    buHaftaninSonucu
      ? prisma.studyPlan.findUnique({
          where: { userId_weekStart: { userId: user.id, weekStart: buHafta } },
          select: { sourceSessionId: true },
        })
      : Promise.resolve(null),
    // "Benzerini çöz": her yanlış/boş sorunun havuzda benzeri var mı. Yoksa
    // düğme yerine bunu söylüyoruz (ölü düğme yok).
    benzerDurumlari(user.id, sessionId).catch(() => new Map<string, boolean>()),
    alistirmaHakki(user.id),
    // Bu testin yanlış/boşlarından kaçı yanlış defterine yazıldı (lib/notebook.ts).
    prisma.notebookItem.count({ where: { userId: user.id, lastSessionId: sessionId, resolvedAt: null } }),
  ]);

  const oncekiOran = (() => {
    for (const r of eskiSonuclar) {
      const t = (r.topicBreakdown as unknown as TopicBreakdown).topics.find(
        (x) => x.topicId === odakKonu && x.asked > 0
      );
      if (t) return t.ratio;
    }
    return null;
  })();

  const planDurumu = kapananIs
    ? {
        toplam: kapananIs.plan.items.length,
        biten: kapananIs.plan.items.filter((i) =>
          i.kind === "RETEST" ? i.verifiedBySessionId !== null : i.doneAt !== null
        ).length,
      }
    : null;

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

  // Kontrol testi tek konuyu doğruluyor: paket kararı orada yanlış konuşuyordu.
  const odakSatiri = retest ? breakdown.topics.find((t) => t.topicId === odakKonu) : undefined;
  const sonuc = odakSatiri
    ? kontrolKarari(odakSatiri, oncekiOran)
    : karar(oran, oncelikler, guclular, result.blankCount, toplam);
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

  /*
   * İnceleme içeriği BURADA, sunucuda çiziliyor; istemci bileşenine yalnızca
   * hazır düğümler gidiyor (sınav ekranındaki desenin aynısı). KaTeX JS'i
   * tarayıcıya inmiyor.
   */
  const inceleme: ReviewItemView[] | null = review
    ? review.map((item) => ({
        questionId: item.questionId,
        // Yalnızca yanlış ve boşlarda: true = benzeri var, false = havuzda yok.
        benzer: item.isCorrect === true ? null : (benzerler.get(item.questionId) ?? false),
        order: item.order,
        topicName: item.topicName,
        stem: <MathContent content={item.stem} />,
        solution: item.solution ? <MathContent content={item.solution} /> : null,
        choices: item.choices.map((c) => ({
          id: c.id,
          label: c.label,
          isCorrect: c.isCorrect,
          errorType: c.errorType,
          content: <MathContent content={c.content} compact />,
        })),
        selectedChoiceId: item.selectedChoiceId,
        isCorrect: item.isCorrect,
        timeSpentMs: item.timeSpentMs,
        targetTimeSeconds: item.targetTimeSeconds,
      }))
    : null;

  // Sunum yardımcıları.
  const yuzde = Math.round(oran * 100);
  const ilkKonular = breakdown.topics.slice(0, 3);
  const kalanKonular = breakdown.topics.slice(3);

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade">
      {/* Geri bağlantısı ve yazdırma tek satırda: telefonda iz + başlık +
          ayrı satıra düşen düğme, koçun cümlesini ilk ekrandan itiyordu. */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link
          href="/gelisim"
          className="inline-flex min-h-9 items-center gap-1.5 text-theme-sm font-medium text-gray-500 transition hover:text-gray-800 print:hidden"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> Gelişim
        </Link>
        <PrintButton />
      </div>
      <PageBreadcrumb
        pageTitle={baslik}
        badge={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge size="sm">{examShort(sinav)}</Badge>
            {retest ? (
              <Badge size="sm" color="success">
                Kontrol testi
              </Badge>
            ) : null}
          </span>
        }
      />

      <div className="space-y-4 md:space-y-6">
        {/* ── Özet: telefonda yatay, gösterge küçük ───────── */}
        <Card className="flex items-center gap-4 p-4 sm:gap-6 sm:p-6">
          <div className="w-28 shrink-0 sm:hidden">
            <RadialGauge value={oran * 100} ariaLabel="Başarı oranı" tone={bant(oran)} size="sm" />
          </div>
          <div className="w-44 shrink-0 max-sm:hidden">
            <RadialGauge
              value={oran * 100}
              ariaLabel="Başarı oranı"
              tone={bant(oran)}
              label={
                <>
                  %{yuzde}
                  <span className="block font-sans text-theme-xs font-normal text-gray-500">başarı</span>
                </>
              }
            />
          </div>
          <p className="min-w-0 flex-1 font-display text-base font-semibold text-balance text-gray-800 sm:text-lg">
            {sonuc.baslik}
          </p>
        </Card>

        {/* Net + D/Y/B kartları (telefonda sıkı: karar ve koçun cümlesi ilk
            ekranda kalsın — PLAN §6). Cezasız sınavda net = doğru sayısı
            olduğu için "net" kartını hiç göstermiyoruz, doğru kartı "12/20"
            yazıyor: yan yana iki aynı sayı ekranda hata gibi duruyor. */}
        <div className={cx("grid gap-4 md:gap-6", cezaVar ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          {cezaVar ? <MetricCard compact label="Net" value={trNumber(Number(result.netScore), 2)} /> : null}
          <MetricCard
            compact
            label="Doğru"
            value={
              <>
                <span className="text-success-700">{result.correctCount}</span>
                {cezaVar ? null : <span className="text-base font-semibold text-gray-500">/{toplam}</span>}
              </>
            }
          />
          <MetricCard compact label="Yanlış" value={<span className="text-error-700">{result.wrongCount}</span>} />
          <MetricCard compact label="Boş" value={result.blankCount} />
        </div>

        {/* ── Koçun cümlesi ───────────────────────────────── */}
        <div className={cx("rounded-2xl border p-4 sm:p-6", TON[sonuc.ton].kutu)}>
          <p className="text-base leading-relaxed text-gray-800">{sonuc.metin}</p>
          {bosNotu ? (
            <p className={cx("mt-3 border-t pt-3 text-theme-sm leading-relaxed text-gray-700", TON[sonuc.ton].cizgi)}>
              <strong className="font-semibold text-gray-800">Boş bırakma:</strong> {bosNotu}
            </p>
          ) : null}
        </div>

        {/* ── Kontrol testi: plan döngüsü burada kapanıyor ── */}
        {retest ? (
          <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5 print:hidden">
            <span
              className={cx(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                planDurumu ? "bg-success-50 text-success-600" : "bg-gray-100 text-gray-500"
              )}
            >
              {planDurumu ? (
                <CalendarCheck className="size-5" aria-hidden />
              ) : (
                <CalendarDays className="size-5" aria-hidden />
              )}
            </span>
            <p className="min-w-0 flex-1 text-theme-sm leading-relaxed text-gray-500">
              {planDurumu ? (
                <>
                  <strong className="font-semibold text-gray-800">Planındaki kontrol testi kapandı.</strong>{" "}
                  <span className="tabular">
                    Bu hafta {planDurumu.biten}/{planDurumu.toplam} iş tamam.
                  </span>
                </>
              ) : (
                "Bu konu bu haftaki planında yoktu; sonucun konu haritana eklendi."
              )}
            </p>
            <ButtonLink
              href="/panel"
              variant={planDurumu ? "primary" : "outline"}
              endIcon={<ArrowRight className="rtl:rotate-180" />}
              className="max-sm:w-full"
            >
              {planDurumu ? "Planına dön" : "Ana sayfa"}
            </ButtonLink>
          </Card>
        ) : null}

        {/* ── Şimdi ne çalışmalısın (öncelik sırası) ──────── */}
        {/* Kontrol testinde yok: tek konuluk sonuçtan "bu hafta sadece bunlar"
            demek, haftanın mevcut planıyla çelişiyordu. */}
        {oncelikler.length > 0 && !retest ? (
          <ComponentCard
            title="Bu hafta sadece bunlar"
            desc={`Sırayla. Her konu yaklaşık ${trNumber(
              Math.round(KONU_HAFTALIK_DAKIKA / 30) / 2,
              1
            )} saat: konu tekrarı, ${HAFTALIK_SORU} soru, yanlış analizi — sonunda 5 soruluk kontrol testi.`}
            tone="brand"
            flush
          >
            <ol className="divide-y divide-gray-100">
              {oncelikler.map((k, i) => {
                const urunId = konuBilgileri.find((t) => t.id === k.topicId)?.recommendedProductIds[0];
                const urun = urunId ? PRODUCTS[urunId] : null;
                return (
                  <li key={k.topicId} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                    <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-theme-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-800">{k.name}</p>
                      <p className="tabular mt-0.5 text-theme-sm text-gray-500">
                        {k.asked} soruda {k.correct} doğru · %{Math.round(k.ratio * 100)}
                        {k.kayip !== null ? (
                          <>
                            {" · "}
                            <span className="font-medium text-error-700">
                              sınavda ~{trNumber(k.kayip, k.kayip % 1 === 0 ? 0 : 1)} soru
                            </span>
                          </>
                        ) : null}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <KonuTekrarButonu topicId={k.topicId} topicName={k.name} />
                        {alistirmaKalan > 0 ? (
                          <KonuCalisButonu
                            sessionId={sessionId}
                            topicId={k.topicId}
                            topicName={k.name}
                            soruSayisi={Math.min(KONU_CALISMA_SORU, alistirmaKalan)}
                          />
                        ) : null}
                        {urun ? (
                          <a
                            href={productUrl(urun.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-theme-sm font-medium text-gray-500 transition hover:text-brand-500"
                          >
                            {urun.name} <ArrowUpRight className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {/* Eskiden "bunları bitirdiğinde plan kendini güncelleyecek" yazıyordu;
                plan haftada bir, o haftanın ilk check-up'ından çıkıyor. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 px-5 py-3 sm:px-6">
              <p className="min-w-0 flex-1 text-theme-sm text-gray-500">
                Diğer konulara bu hafta bakma.
                {haftaninPlani
                  ? haftaninPlani.sourceSessionId === sessionId
                    ? " Bu konular haftalık planına eklendi."
                    : " Bu haftanın planı önceki check-up'ından; yeni plan gelecek haftanın ilk check-up'ıyla çıkar."
                  : ""}
              </p>
              {haftaninPlani ? (
                <ButtonLink
                  href="/panel"
                  variant="soft"
                  size="xs"
                  endIcon={<ArrowRight className="rtl:rotate-180" />}
                  className="print:hidden"
                >
                  Planı gör
                </ButtonLink>
              ) : null}
            </div>
          </ComponentCard>
        ) : null}

        {/* ── Hata deseni ─────────────────────────────────── */}
        {hata ? (
          <div className="flex gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 sm:gap-4 sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Brain className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-gray-800">{hata.baslik}</h2>
              <p className="mt-1 text-theme-sm leading-relaxed text-gray-700">{hata.metin}</p>
            </div>
          </div>
        ) : null}

        {/* ── Önceki denemeye göre ────────────────────────── */}
        {!retest && ilerleme && (ilerleme.gelisen.length > 0 || ilerleme.gerileyen.length > 0) ? (
          <ComponentCard title="Geçen denemene göre" flush>
            <ul className="divide-y divide-gray-100">
              {ilerleme.gelisen.map((t) => (
                <li key={t.name} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <TrendingUp className="size-4 shrink-0 text-success-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-800">{t.name}</span>
                  <Badge size="sm" color="success">
                    <span className="tabular">+{t.delta} puan</span>
                  </Badge>
                </li>
              ))}
              {ilerleme.gerileyen.map((t) => (
                <li key={t.name} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <TrendingDown className="size-4 shrink-0 text-error-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-800">{t.name}</span>
                  <Badge size="sm" color="error">
                    <span className="tabular">{t.delta} puan</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </ComponentCard>
        ) : null}

        {/* ── Konu haritası ───────────────────────────────── */}
        {/* Liste yazdırılan biçim: ilk üç konu açık, gerisi katlı (telefonda kısa kalsın). */}
        <ComponentCard
          title="Konu haritası"
          desc={olculemeyen > 0 ? `${olculemeyen} konuda seviye verilmedi: 3'ten az soru soruldu.` : undefined}
          flush
        >
          <div className="p-5 sm:p-6">
            <KonuHaritasi konular={ilkKonular} />
          </div>
          {kalanKonular.length > 0 ? (
            <>
              <details className="group border-t border-gray-100 print:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-theme-sm font-medium text-brand-500 transition hover:text-brand-600 [&::-webkit-details-marker]:hidden">
                  Tüm konuları gör ({breakdown.topics.length})
                  <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-gray-100 p-5 sm:p-6">
                  <KonuHaritasi konular={kalanKonular} />
                </div>
              </details>
              {/* Kâğıtta kalan konular da: tarayıcı kapalı <details>'in içini
                  basmıyor (Chrome), konu haritasının tamamı PDF'te olmalı. */}
              <div className="hidden border-t border-gray-100 p-5 sm:p-6 print:block">
                <KonuHaritasi konular={kalanKonular} />
              </div>
            </>
          ) : null}
        </ComponentCard>

        {/* ── Sonraki ölçüm ───────────────────────────────── */}
        {/* Kontrol testinde yok: katalogda görünmeyen "kontrol testi paketini
            10 gün sonra tekrar çöz" diyordu. */}
        {!retest ? (
          <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
              <RotateCcw className="size-5" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-theme-sm leading-relaxed text-gray-700">{tekrarNotu}</p>
            <ButtonLink href="/paketler" variant="outline" className="max-sm:w-full">
              Testler
            </ButtonLink>
          </Card>
        ) : null}

        {/* ── Kaynak (en sonda, araç olarak) ──────────────── */}
        {urunler.length > 0 ? (
          <ComponentCard
            title="Bu konuları çalışmak için elindeki kaynak yetmiyorsa"
            desc="Koçum.Net yayınları — zayıf çıkan konulara göre seçildi."
            flush
          >
            <ul className="divide-y divide-gray-100">
              {urunler.map((u) => (
                <li key={u.id}>
                  <a
                    href={productUrl(u.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 items-center gap-3 px-5 py-3 transition hover:bg-gray-50 sm:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-theme-sm font-medium text-gray-800">{u.name}</span>
                      <span className="block text-theme-xs text-gray-500">
                        {u.questionCount} soru · {u.note}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-gray-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </ComponentCard>
        ) : null}

        {/* ── Cevap incelemesi ────────────────────────────── */}
        {inceleme ? (
          <ComponentCard
            title="Cevaplarını incele"
            desc="Her sorunun doğrusu, senin işaretin ve varsa adım adım çözümü."
            actions={
              <Badge color="success" startIcon={<CircleCheck aria-hidden />}>
                <span className="tabular">{result.correctCount}</span> doğru
              </Badge>
            }
            flush
          >
            {deftereGiren > 0 ? (
              <div className="mx-5 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-brand-25 px-3.5 py-2.5 sm:mx-6 sm:mt-5 print:hidden">
                <NotebookPen className="size-4 shrink-0 text-brand-500" aria-hidden />
                <p className="min-w-0 flex-1 text-theme-sm text-gray-700">
                  Bu testten <span className="tabular font-semibold text-gray-800">{deftereGiren}</span> soru
                  yanlış defterinde: aralıklarla benzerleriyle geri gelir.
                </p>
                <Link
                  href="/defter"
                  className="inline-flex min-h-9 items-center gap-1 text-theme-sm font-medium text-brand-500 transition hover:text-brand-600"
                >
                  Deftere git <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                </Link>
              </div>
            ) : null}
            <AnswerReview items={inceleme} sessionId={sessionId} alistirmaAcik={alistirmaKalan > 0} />
          </ComponentCard>
        ) : null}
      </div>
    </div>
  );
}
