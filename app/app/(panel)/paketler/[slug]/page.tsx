import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
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
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkPackageAccess } from "@/lib/entitlements";
import { Badge, Card, trDate, trNumber } from "@/components/ui";
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
  const user = (await getCurrentUser())!;
  const now = new Date();

  const pkg = await prisma.package.findUnique({
    where: { slug },
    select: {
      id: true,
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
      icon: Keyboard,
      t: "Klavye kısayolları",
      d: "A–E ile işaretle, ← → ile sorular arasında gez. Aynı şıkka tekrar basmak işareti kaldırır.",
    },
  ];

  return (
    <div className="animate-rise">
      <Link
        href="/paketler"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Testler
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Sol: paket bilgisi */}
        <div className="space-y-6">
          <div>
            <Badge tone={pkg.examScope === "AYT" ? "dark" : "brand"}>{pkg.examScope}</Badge>
            <h1 className="font-display mt-3 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">
              {pkg.name}
            </h1>
            {pkg.summary ? (
              <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
                {pkg.summary}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ListChecks, v: pkg.questionCount, l: "soru" },
              { icon: Clock, v: pkg.durationMinutes, l: "dakika" },
              { icon: Layers, v: pkg.topics.length, l: "konu" },
            ].map(({ icon: Icon, v, l }) => (
              <Card key={l} className="p-4 text-center">
                <Icon className="mx-auto size-5 text-brand" />
                <p className="font-display tabular mt-2 text-2xl font-bold text-ink">{v}</p>
                <p className="text-xs text-ink-soft">{l}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-[15px] font-semibold text-ink">Ölçülen konular</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Her konudan en az 3 soru — tek soruya bakıp &quot;zayıfsın&quot; demiyoruz.
            </p>
            <ul className="mt-4 divide-y divide-line">
              {pkg.topics.map((t) => (
                <li key={t.topic.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2.5 text-sm text-ink">
                    <CircleCheck className="size-4 shrink-0 text-ok-fill" />
                    {t.topic.name}
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-faint">
                    {t.questionCount} soru
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-[15px] font-semibold text-ink">Başlamadan önce</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {kurallar.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunk text-ink-soft ring-1 ring-line">
                    <Icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Sağ: başlat kartı — masaüstünde kaydırırken yerinde kalır */}
        <div className="space-y-4 lg:sticky lg:top-10">
          <Card className="p-5 sm:p-6">
            {erisim.allowed ? (
              <>
                <h2 className="font-display text-base font-semibold text-ink">
                  {yarim ? "Yarım kalan testin var" : "Hazır mısın?"}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {yarim
                    ? `Süren işlemeye devam ediyor: ${kalanDk} dakika kaldı.`
                    : `${pkg.questionCount} soru, ${pkg.durationMinutes} dakika. Sessiz bir yer ve kağıt kalem yeterli.`}
                </p>
                <div className="mt-5">
                  <StartButton
                    slug={slug}
                    resume={Boolean(yarim)}
                    durationMinutes={pkg.durationMinutes}
                  />
                </div>
              </>
            ) : (
              <>
                <span className="flex size-11 items-center justify-center rounded-xl bg-surface-sunk text-ink-soft ring-1 ring-line">
                  <Lock className="size-5" />
                </span>
                <h2 className="font-display mt-4 text-base font-semibold text-ink">
                  Bu paket kilitli
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Bu pakete erişim için Koçum.Net ile iletişime geç; hesabına tanımlandığında
                  burada açılacak.
                </p>
                <a
                  href="mailto:info@kocum.net"
                  className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-wash text-sm font-semibold text-brand transition hover:bg-brand-wash-strong"
                >
                  <Mail className="size-4" /> info@kocum.net
                </a>
              </>
            )}
          </Card>

          {gecmis.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Önceki denemelerin</h2>
              <ul className="-mx-2 mt-2">
                {gecmis.map((g) => (
                  <li key={g.sessionId}>
                    <Link
                      href={"/sonuc/" + g.sessionId}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-surface-hover"
                    >
                      <span className="text-ink-soft">{trDate(g.computedAt, false)}</span>
                      <span className="font-display tabular font-semibold text-ink">
                        {trNumber(Number(g.netScore))} net
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
