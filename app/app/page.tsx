import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessiblePackageSlugs } from "@/lib/entitlements";
import { AppHeader } from "@/components/AppHeader";
import { LinkButton } from "@/components/ui";
import { PackageCard } from "./PackageCard";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <>
      <AppHeader />
      {user ? <PackageList userId={user.id} firstName={user.name.split(" ")[0]} /> : <Landing />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────

function Landing() {
  const steps = [
    { n: "1", t: "Paketini seç", d: "TYT genel tarama, problemler, trigonometri… Neyi ölçmek istiyorsan." },
    { n: "2", t: "15-25 soru çöz", d: "20-35 dakika. Deneme değil: her konudan yeterli soru gelir." },
    { n: "3", t: "Haritanı gör", d: "Hangi konuda güçlüsün, hangisinde eksiğin var — ve ne çalışman gerek." },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          Matematik Check-up
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl">
          Net kaç değil,
          <br />
          <span className="text-brand">nerede eksiğin var</span>.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          120 soruluk denemede konu başına bir-iki soru düşer; bu, seviyeni ölçmez.
          Check-up sadece matematiğe odaklanır ve her konudan yeterli soru sorar —
          sonuç bir puan değil, bir <strong className="font-semibold text-ink">konu haritası</strong>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href="/kayit">Ücretsiz başla</LinkButton>
          <LinkButton href="/giris" variant="ghost">
            Giriş yap
          </LinkButton>
        </div>
      </div>

      <ol className="mt-20 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="bg-surface p-6">
            <span className="font-mono text-sm font-bold text-brand">{s.n}</span>
            <h2 className="font-display mt-3 text-base font-bold text-ink">{s.t}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.d}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────

async function PackageList({ userId, firstName }: { userId: string; firstName: string }) {
  // Tek bir "şimdi": hem sorgu filtresi hem kalan süre aynı ana göre hesaplansın.
  // Ayrıca Date.now()'ı JSX içinde çağırmak render saflığını bozuyor.
  const now = new Date();

  const [packages, openSessions, lastResult] = await Promise.all([
    prisma.package.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        summary: true,
        questionCount: true,
        durationMinutes: true,
        examScope: true,
        isFree: true,
        _count: { select: { topics: true } },
      },
    }),
    prisma.checkupSession.findMany({
      where: { userId, status: "IN_PROGRESS", expiresAt: { gt: now } },
      select: { id: true, expiresAt: true, package: { select: { slug: true, name: true } } },
    }),
    prisma.checkupResult.findFirst({
      where: { session: { userId } },
      orderBy: { computedAt: "desc" },
      select: {
        netScore: true,
        correctCount: true,
        wrongCount: true,
        blankCount: true,
        session: { select: { id: true, package: { select: { name: true } } } },
      },
    }),
  ]);

  const acikSluglar = await accessiblePackageSlugs(userId);
  const resumableSlugs = new Set(openSessions.map((s) => s.package.slug));
  const acikTestler = openSessions.map((s) => ({
    id: s.id,
    name: s.package.name,
    kalanDk: Math.max(0, Math.round((s.expiresAt.getTime() - now.getTime()) / 60_000)),
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        Merhaba {firstName}
      </h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        Ölçmek istediğin alanı seç. Yarıda bıraktığın test varsa kaldığın yerden devam edersin.
      </p>

      {openSessions.length > 0 ? (
        <div className="mt-6 rounded-xl border border-[color:var(--warn)]/25 bg-warn-wash p-4">
          <p className="text-sm font-semibold text-[color:var(--warn)]">
            Devam eden {openSessions.length === 1 ? "testin" : "testlerin"} var
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {acikTestler.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/checkup/${s.id}`}
                  className="text-sm font-medium text-ink underline-offset-2 hover:underline"
                >
                  {s.name} — kalan süre <span className="font-mono">{s.kalanDk} dk</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastResult ? (
        <Link
          href={`/sonuc/${lastResult.session.id}`}
          className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Son check-up
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{lastResult.session.package.name}</p>
          </div>
          <div className="text-end">
            <p className="font-mono text-xl font-bold text-brand">
              {Number(lastResult.netScore).toFixed(2).replace(".", ",")}
            </p>
            <p className="text-[11px] text-ink-faint">
              {lastResult.correctCount}D · {lastResult.wrongCount}Y · {lastResult.blankCount}B
            </p>
          </div>
        </Link>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {packages.map((p) => (
          <PackageCard
            key={p.slug}
            slug={p.slug}
            name={p.name}
            summary={p.summary}
            questionCount={p.questionCount}
            durationMinutes={p.durationMinutes}
            examScope={p.examScope}
            topicCount={p._count.topics}
            resumable={resumableSlugs.has(p.slug)}
            locked={!acikSluglar.has(p.slug)}
          />
        ))}
      </div>
    </main>
  );
}
