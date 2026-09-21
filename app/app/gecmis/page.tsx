import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Geçmişim" };

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const results = await prisma.checkupResult.findMany({
    where: { session: { userId: user.id } },
    orderBy: { computedAt: "desc" },
    take: 50,
    select: {
      sessionId: true,
      netScore: true,
      correctCount: true,
      wrongCount: true,
      blankCount: true,
      computedAt: true,
      session: { select: { package: { select: { name: true, slug: true } } } },
    },
  });


  return (
    <>
      <AppHeader />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Geçmişim</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          Çözdüğün check-up&apos;lar, en yeniden eskiye.
        </p>

        {results.length === 0 ? (
          <Card className="mt-6 p-8 text-center">
            <p className="text-sm text-ink-soft">Henüz bitirdiğin bir check-up yok.</p>
            <div className="mt-5">
              <LinkButton href="/">İlk testini çöz</LinkButton>
            </div>
          </Card>
        ) : (
          <Card className="mt-6 divide-y divide-line">
            {results.map((r) => {
              const slug = r.session.package.slug;
              const net = Number(r.netScore);
              // Liste yeniden eskiye; bu paketin bir SONRAKİ satırı (daha eski)
              // karşılaştırma tabanıdır.
              const older = results.find(
                (o) => o.session.package.slug === slug && o.computedAt < r.computedAt
              );
              const delta = older ? net - Number(older.netScore) : null;

              return (
                <Link
                  key={r.sessionId}
                  href={`/sonuc/${r.sessionId}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-sunk"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {r.session.package.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {r.computedAt.toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {r.correctCount}D · {r.wrongCount}Y · {r.blankCount}B
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="font-mono text-lg font-bold text-brand">
                      {net.toFixed(2).replace(".", ",")}
                    </p>
                    {delta !== null && Math.abs(delta) >= 0.01 ? (
                      <p
                        className={`font-mono text-[11px] font-semibold ${
                          delta > 0 ? "text-ok" : "text-bad"
                        }`}
                      >
                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2).replace(".", ",")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </main>
    </>
  );
}
