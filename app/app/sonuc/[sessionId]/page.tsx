import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { TopicBreakdown, TopicBreakdownEntry } from "@/lib/scoring";
import { PRODUCTS, productUrl } from "@/lib/products";
import { getCheckupReview } from "@/lib/checkup";
import { errorPattern, dominantError, compareProgress } from "@/lib/diagnosis";
import { AppHeader } from "@/components/AppHeader";
import { AnswerReview } from "./AnswerReview";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Sonuç" };

const LEVEL_UI = {
  STRONG: { label: "güçlü", bar: "bg-ok", text: "text-ok", wash: "bg-ok-wash" },
  MEDIUM: { label: "orta", bar: "bg-warn", text: "text-warn", wash: "bg-warn-wash" },
  WEAK: { label: "zayıf", bar: "bg-bad", text: "text-bad", wash: "bg-bad-wash" },
} as const;

function trNumber(n: number, digits = 2) {
  return n.toFixed(digits).replace(".", ",");
}

export default async function ResultPage({ params }: PageProps<"/sonuc/[sessionId]">) {
  const { sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");

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
      session: {
        select: {
          userId: true,
          durationMinutes: true,
          startedAt: true,
          submittedAt: true,
          package: { select: { name: true, slug: true, questionCount: true } },
        },
        },
      },
    }),
    // getCheckupReview cevap anahtarını içerir ve yalnızca BİTMİŞ oturumlarda
    // çalışır; hata verirse inceleme bölümünü hiç göstermiyoruz.
    getCheckupReview(sessionId, user.id).catch(() => null),
  ]);

  // Başkasının sonucunu "yetkiniz yok" ile değil "yok" ile karşılıyoruz:
  // ilki sonucun var olduğunu doğrular.
  if (!result || result.session.userId !== user.id) notFound();

  const breakdown = result.topicBreakdown as unknown as TopicBreakdown;
  const total = result.correctCount + result.wrongCount + result.blankCount;

  // Aynı paketin bir ÖNCEKİ denemesi — varsa ilerleme gösterilir.
  const onceki = await prisma.checkupResult.findFirst({
    where: {
      session: { userId: user.id, package: { slug: result.session.package.slug } },
      computedAt: { lt: result.computedAt },
    },
    orderBy: { computedAt: "desc" },
    select: { topicBreakdown: true, netScore: true },
  });

  const ilerleme = onceki
    ? compareProgress(
        breakdown,
        onceki.topicBreakdown as unknown as TopicBreakdown,
        Number(result.netScore) - Number(onceki.netScore)
      )
    : null;

  const hataDeseni = review ? errorPattern(review) : [];
  const baskinHata = dominantError(hataDeseni);

  const elapsedMin = result.session.submittedAt
    ? Math.round(
        (result.session.submittedAt.getTime() - result.session.startedAt.getTime()) / 60_000
      )
    : result.session.durationMinutes;

  // Zayıf ve KANITLI konular: tek soruluk yanlıştan uyarı çıkarmıyoruz.
  const weak = breakdown.topics.filter((t) => t.level === "WEAK" && t.asked >= 3);
  const thin = breakdown.topics.filter((t) => t.level === null);
  const recommended = result.recommendedProductIds
    .map((id) => PRODUCTS[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <>
      <AppHeader />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Check-up sonucu
        </p>
        <h1 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-ink">
          {result.session.package.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {total} soru · {elapsedMin} dakika ·{" "}
          {result.computedAt.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {/* Net */}
        <Card className="mt-6 p-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Net</p>
              <p className="font-mono text-5xl font-bold leading-none text-brand">
                {trNumber(Number(result.netScore))}
              </p>
            </div>
            <dl className="flex gap-6">
              {[
                { label: "Doğru", value: result.correctCount, tone: "text-ok" },
                { label: "Yanlış", value: result.wrongCount, tone: "text-bad" },
                { label: "Boş", value: result.blankCount, tone: "text-ink-faint" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    {s.label}
                  </dt>
                  <dd className={`font-mono text-2xl font-bold ${s.tone}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        {/* İlerleme — yalnızca aynı paketin ikinci ve sonraki denemelerinde */}
        {ilerleme && (ilerleme.gelisen.length > 0 || ilerleme.gerileyen.length > 0) ? (
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-base font-bold text-ink">
                Geçen denemene göre
              </h2>
              <span
                className={
                  "font-mono text-sm font-semibold " +
                  (ilerleme.netDelta > 0 ? "text-ok" : ilerleme.netDelta < 0 ? "text-bad" : "text-ink-faint")
                }
              >
                net {ilerleme.netDelta > 0 ? "+" : ""}
                {trNumber(ilerleme.netDelta)}
              </span>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {ilerleme.gelisen.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-ok">Gelişen konular</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {ilerleme.gelisen.map((t) => (
                      <li key={t.topicId} className="flex justify-between gap-3">
                        <span className="truncate text-ink-soft">{t.name}</span>
                        <span className="shrink-0 font-mono text-ok">+{t.delta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {ilerleme.gerileyen.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-bad">Gerileyen konular</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {ilerleme.gerileyen.map((t) => (
                      <li key={t.topicId} className="flex justify-between gap-3">
                        <span className="truncate text-ink-soft">{t.name}</span>
                        <span className="shrink-0 font-mono text-bad">{t.delta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] text-ink-faint">
              Yalnızca iki denemede de yeterli soru sorulmuş konular karşılaştırılıyor.
            </p>
          </Card>
        ) : null}

        {/* Hata deseni — tek bir yanlıştan desen çıkarmıyoruz */}
        {baskinHata ? (
          <Card className="mt-4 bg-warn-wash p-5">
            <h2 className="font-display text-base font-bold text-warn">
              Yanlışlarının çoğu aynı sebepten
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              Yanlış işaretlediğin şıkların çoğu —{" "}
              <strong className="font-semibold text-ink">{baskinHata.count} soru</strong> —{" "}
              <strong className="font-semibold text-ink">{baskinHata.label}</strong> desenine
              uyuyor. Bu bir bilgi eksiği değil, bir dikkat alışkanlığı: soruyu çözdükten
              sonra işlemini bir kez geri kontrol etmek netini yükseltir.
            </p>
          </Card>
        ) : null}

        {/* Konu haritası */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">Konu haritası</h2>
          <p className="mt-1 text-sm text-ink-soft">
            En zayıf konu üstte. Çubuk, o konudaki doğru oranını gösterir.
          </p>

          <Card className="mt-4 divide-y divide-line">
            {breakdown.topics.map((t) => (
              <TopicRow key={t.topicId} entry={t} />
            ))}
          </Card>

          {thin.length > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              {thin.length} konuda 2&apos;den az soru sorulduğu için seviye belirlenmedi. Tek
              soruya bakarak &quot;bu konuda zayıfsın&quot; demek doğru olmaz — bu konuları
              ölçmek için odaklı bir paket seç.
            </p>
          ) : null}
        </section>

        {/* Öneriler */}
        {weak.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-ink">
              {weak.length} konuda eksiğin var
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Şu konulara ağırlık ver:{" "}
              <strong className="font-semibold text-ink">
                {weak.map((t) => t.name).join(", ")}
              </strong>
              .
            </p>

            {recommended.length > 0 ? (
              <div className="mt-4 space-y-2.5">
                {recommended.map((p) => (
                  <a
                    key={p.id}
                    href={productUrl(p.id)}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-brand/40 hover:bg-brand-wash/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {p.questionCount} soru · {p.note}
                      </p>
                    </div>
                    <span aria-hidden className="shrink-0 text-brand">
                      →
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="mt-8">
            <Card className="bg-ok-wash p-5">
              <p className="text-sm font-semibold text-ok">Kanıtlı zayıf konun yok.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Daha derin bir ölçüm için odaklı bir paket dene.
              </p>
            </Card>
          </section>
        )}

        {review && review.length > 0 ? <AnswerReview items={review} /> : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton href="/">Yeni check-up</LinkButton>
          <LinkButton href="/gecmis" variant="ghost">
            Geçmiş testlerim
          </LinkButton>
        </div>
      </main>
    </>
  );
}

function TopicRow({ entry }: { entry: TopicBreakdownEntry }) {
  const ui = entry.level ? LEVEL_UI[entry.level] : null;
  const pct = Math.round(entry.ratio * 100);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-ink">{entry.name}</span>
          <span className="shrink-0 font-mono text-xs text-ink-faint">
            {entry.correct}/{entry.asked}
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full ${ui ? ui.bar : "bg-line-strong"}`}
            style={{ width: `${Math.max(pct, entry.asked > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>

      <div className="w-24 shrink-0 text-end">
        {ui ? (
          <span className={`text-xs font-semibold ${ui.text}`}>
            {ui.label}
            {entry.confidence === "LOW" ? (
              <span className="ms-1 font-normal text-ink-faint" title="Az soruyla ölçüldü">
                ?
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[11px] text-ink-faint">yeterli soru yok</span>
        )}
        {entry.slow ? (
          <span className="ms-1.5 text-[11px] text-warn" title="Hedef sürenin üstünde">
            yavaş
          </span>
        ) : null}
      </div>
    </div>
  );
}
