import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Bookmark,
  CircleCheck,
  Clock,
  Keyboard,
  Layers,
  ListChecks,
  Lock,
  Mail,
  RotateCcw,
  Scale,
  Timer,
} from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/site";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { checkPackageAccess } from "@/lib/entitlements";
import { examShort } from "@/lib/exams";
import { trDate, trNumber } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { buttonClass } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { StartButton } from "./StartButton";

export async function generateMetadata({
  params,
}: PageProps<"/paketler/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.package.findUnique({ where: { slug }, select: { name: true } });
  return { title: p?.name ?? "Paket" };
}

/** 0.25 → "4 yanlış 1 doğruyu götürür". Oran koda gömülü değil, paketten geliyor. */
function cezaMetni(oran: number) {
  if (oran <= 0) return "Yanlışlar doğruyu götürmez — emin olmasan da işaretle.";
  const n = Math.round(1 / oran);
  return `${n} yanlış 1 doğruyu götürür — emin değilsen boş bırakmak daha iyi olabilir.`;
}

export default async function PackageDetailPage({ params }: PageProps<"/paketler/[slug]">) {
  const { slug } = await params;
  const user = await requirePageUser();
  const now = new Date();

  const pkg = await prisma.package.findUnique({
    where: { slug },
    select: {
      id: true,
      kind: true,
      name: true,
      summary: true,
      description: true,
      examScope: true,
      questionCount: true,
      durationMinutes: true,
      penaltyRatio: true,
      status: true,
      isFree: true,
      topics: {
        orderBy: { sortOrder: "asc" },
        select: { questionCount: true, topic: { select: { name: true } } },
      },
    },
  });

  if (!pkg || pkg.status !== "PUBLISHED") notFound();
  // Katalog dışı türler bu ekrandan başlatılmaz (lib/catalog.ts KATALOG_TURLERI):
  // seviyeli check-up kendi sayfasına, gizli tekrar paketi hiçbir yere.
  if (pkg.kind === "LEVEL") redirect("/seviyeli");
  if (pkg.kind === "RETEST" || pkg.kind === "PRACTICE") notFound();

  const [erisim, yarim, gecmis] = await Promise.all([
    checkPackageAccess(user.id, pkg.id, pkg.isFree),
    prisma.checkupSession.findFirst({
      where: { userId: user.id, packageId: pkg.id, status: "IN_PROGRESS", expiresAt: { gt: now } },
      select: { expiresAt: true },
    }),
    prisma.checkupResult.findMany({
      where: { session: { userId: user.id, packageId: pkg.id } },
      orderBy: { computedAt: "desc" },
      take: 3,
      select: { sessionId: true, netScore: true, computedAt: true, correctCount: true },
    }),
  ]);

  const kalanDk = yarim
    ? Math.max(0, Math.round((yarim.expiresAt.getTime() - now.getTime()) / 60_000))
    : null;

  const kurallar = [
    {
      icon: Timer,
      t: "Süre durmaz",
      d: "Başladıktan sonra sayfayı kapatsan da süre işler. Rahat bir zamanda başla.",
    },
    {
      icon: RotateCcw,
      t: "Cevapların anında kaydedilir",
      d: "Bağlantın kopsa bile kaldığın yerden devam edebilirsin.",
    },
    { icon: Scale, t: "Puanlama", d: cezaMetni(Number(pkg.penaltyRatio)) },
    {
      icon: Bookmark,
      t: "Emin değilsen “Sonra bak”",
      d: "Soruyu işaretle, devam et. Bitirmeden önce boşları ve işaretlediklerini tek listede görürsün.",
    },
    {
      icon: Keyboard,
      t: "Klavye kısayolları",
      d: "A–E ile işaretle, S ile sonra bak, ← → ile sorular arasında gez. Aynı şıkka tekrar basmak işareti kaldırır.",
      // Telefonda klavye yok: kısayol bilgisi orada yalnızca yer kaplar.
      cls: "[@media(pointer:coarse)]:hidden",
    },
  ];

  return (
    <div className="animate-rise mx-auto w-full max-w-5xl">
      {/* Başlık: ad + sınav rozeti (AYT dolu, ötekiler açık — paket kartıyla aynı dil), altında özet. */}
      <PageBreadcrumb
        crumbs={[{ href: "/paketler", label: "Testler" }]}
        currentLabel={pkg.name}
        pageTitle={pkg.name}
        badge={<Badge variant={pkg.examScope === "AYT" ? "solid" : "light"}>{examShort(pkg.examScope)}</Badge>}
        description={pkg.summary ? <span className="block max-w-2xl leading-relaxed">{pkg.summary}</span> : null}
      />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Özet: sayılar */}
        <div className="grid grid-cols-3 gap-4 md:gap-6 lg:col-start-1 lg:row-start-1">
          <MetricCard label="Soru" value={pkg.questionCount} icon={<ListChecks aria-hidden />} tone="brand" />
          <MetricCard label="Dakika" value={pkg.durationMinutes} icon={<Clock aria-hidden />} tone="brand" />
          <MetricCard label="Konu" value={pkg.topics.length} icon={<Layers aria-hidden />} tone="brand" />
        </div>

        {/* Başlat kartı. Telefonda özetin hemen altında: eskiden ölçülen konular
            ve kuralların ARDINDAN, iki ekran aşağıdaydı ve öğrenci düğmeyi
            aramak zorunda kalıyordu. Masaüstünde sağda, kaydırırken yerinde
            kalır (kitin yapışkan üst çubuğunun altında). */}
        <div className="space-y-4 md:space-y-6 lg:sticky lg:top-[calc(var(--ta-header-h)+1.5rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {erisim.allowed ? (
            // Vurgulu kart (kitin Card'ı, marka kenarı).
            <Card tone="brand" className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <Timer className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-gray-800">
                    {yarim ? "Yarım kalan testin var" : "Hazır mısın?"}
                  </h2>
                  <p className="mt-1 text-theme-sm text-gray-500">
                    {yarim
                      ? `Süren işlemeye devam ediyor: ${kalanDk} dakika kaldı.`
                      : `${pkg.questionCount} soru, ${pkg.durationMinutes} dakika. Sessiz bir yer ve kağıt kalem yeterli.`}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <StartButton slug={slug} resume={Boolean(yarim)} durationMinutes={pkg.durationMinutes} />
              </div>
            </Card>
          ) : (
            <Card className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                  <Lock className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-gray-800">Bu paket kilitli</h2>
                  <p className="mt-1 text-theme-sm leading-relaxed text-gray-500">
                    Bu pakete erişim için Koçum.Net ile iletişime geç; hesabına tanımlandığında
                    burada açılacak.
                  </p>
                </div>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className={cx(buttonClass({ variant: "soft", block: true }), "mt-5")}>
                <Mail aria-hidden />
                {SUPPORT_EMAIL}
              </a>
            </Card>
          )}

          {gecmis.length > 0 ? (
            <ComponentCard title="Önceki denemelerin" flush>
              <ul className="p-2 sm:p-3">
                {gecmis.map((g) => (
                  <li key={g.sessionId}>
                    <Link
                      href={"/sonuc/" + g.sessionId}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-theme-sm transition hover:bg-gray-50"
                    >
                      <span className="text-gray-500">{trDate(g.computedAt, false)}</span>
                      <span className="tabular font-display font-semibold text-gray-800">
                        {trNumber(Number(g.netScore))} net
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ComponentCard>
          ) : null}
        </div>

        {/* Ayrıntı: ölçülen konular ve kurallar */}
        <div className="space-y-4 md:space-y-6 lg:col-start-1 lg:row-start-2">
          <ComponentCard
            title="Ölçülen konular"
            desc={<>Her konudan en az 3 soru — tek soruya bakıp &quot;zayıfsın&quot; demiyoruz.</>}
            flush
          >
            <ul className="divide-y divide-gray-100 px-5 py-1 sm:px-6">
              {pkg.topics.map((t) => (
                <li key={t.topic.name} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2.5 text-sm text-gray-800">
                    <CircleCheck className="size-4 shrink-0 text-success-500" aria-hidden />
                    {t.topic.name}
                  </span>
                  <span className="tabular shrink-0 text-theme-xs text-gray-500">{t.questionCount} soru</span>
                </li>
              ))}
            </ul>
          </ComponentCard>

          <ComponentCard title="Başlamadan önce">
            <ul className="grid gap-5 sm:grid-cols-2">
              {kurallar.map(({ icon: Icon, t, d, cls }) => (
                <li key={t} className={cx("flex gap-3", cls)}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{t}</p>
                    <p className="mt-0.5 text-theme-sm leading-relaxed text-gray-500">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ComponentCard>
        </div>
      </div>
    </div>
  );
}
