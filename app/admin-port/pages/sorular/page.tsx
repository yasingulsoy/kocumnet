import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Alert, Card, LinkButton } from "@/components/ui";
import { StatusSelect } from "./StatusSelect";

export const metadata: Metadata = { title: "Sorular" };

const SAYFA_BOYU = 30;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  REVIEW: "İncelemede",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşiv",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-surface-sunk text-ink-soft",
  REVIEW: "bg-warn-wash text-warn",
  PUBLISHED: "bg-ok-wash text-ok",
  ARCHIVED: "bg-surface-sunk text-ink-faint",
};

export default async function QuestionsPage({ searchParams }: PageProps<"/admin/sorular">) {
  const sp = await searchParams;
  const konu = typeof sp.konu === "string" ? sp.konu : "";
  const durum = typeof sp.durum === "string" ? sp.durum : "";
  const ara = typeof sp.ara === "string" ? sp.ara.trim() : "";
  const sayfa = Math.max(1, Number(typeof sp.sayfa === "string" ? sp.sayfa : 1) || 1);

  const where = {
    ...(konu ? { topic: { slug: konu } } : {}),
    ...(durum ? { status: durum as never } : {}),
    // stemText tam da bunun için var (PLAN §3): JSONB gövdede arama yapılamaz.
    ...(ara ? { stemText: { contains: ara, mode: "insensitive" as const } } : {}),
  };

  const [topics, toplam, questions] = await Promise.all([
    prisma.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, examScope: true },
    }),
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        stemText: true,
        difficulty: true,
        status: true,
        version: true,
        shownCount: true,
        correctCount: true,
        sourceRef: true,
        topic: { select: { name: true } },
      },
    }),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const query = (extra: Record<string, string | number>) => ({
    pathname: "/admin/sorular",
    query: { ...(konu && { konu }), ...(durum && { durum }), ...(ara && { ara }), ...extra },
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Sorular</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">{toplam} soru bulundu.</p>
        </div>
        <LinkButton href="/admin/sorular/yeni">Yeni soru</LinkButton>
      </div>

      {sp.kaydedildi ? (
        <div className="mt-5">
          <Alert tone="ok">Soru kaydedildi.</Alert>
        </div>
      ) : null}
      {sp.guncellendi ? (
        <div className="mt-5">
          <Alert tone="ok">Soru güncellendi.</Alert>
        </div>
      ) : null}

      {/* Süzgeçler — GET formu: seçim adres çubuğunda kalır, paylaşılabilir. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex-1 basis-56">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Ara</span>
          <input
            name="ara"
            defaultValue={ara}
            placeholder="Soru metninde ara…"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="basis-56">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Konu</span>
          <select
            name="konu"
            defaultValue={konu}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.examScope} · {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="basis-40">
          <span className="mb-1.5 block text-xs font-medium text-ink-soft">Durum</span>
          <select
            name="durum"
            defaultValue={durum}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-sunk"
        >
          Süz
        </button>
        {konu || durum || ara ? (
          <Link
            href="/admin/sorular"
            className="py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Temizle
          </Link>
        ) : null}
      </form>

      {questions.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm text-ink-soft">Bu süzgeçlere uyan soru yok.</p>
        </Card>
      ) : (
        <Card className="mt-6 divide-y divide-line">
          {questions.map((q) => (
            <div key={q.id} className="flex items-start gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link
                  href={"/admin/sorular/" + q.id}
                  className="block truncate text-sm font-medium text-ink hover:text-brand"
                >
                  {q.stemText}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                  <span>{q.topic.name}</span>
                  <span className="font-mono">zorluk {q.difficulty}</span>
                  {q.version > 1 ? <span className="font-mono">v{q.version}</span> : null}
                  {q.shownCount > 0 ? (
                    <span className="font-mono">
                      {q.shownCount} kez soruldu · %
                      {Math.round((q.correctCount / q.shownCount) * 100)} doğru
                    </span>
                  ) : null}
                  {q.sourceRef ? <span>{q.sourceRef}</span> : null}
                </p>
              </div>

              <span
                className={
                  "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold " +
                  STATUS_TONE[q.status]
                }
              >
                {STATUS_LABEL[q.status]}
              </span>

              <StatusSelect id={q.id} status={q.status} />
            </div>
          ))}
        </Card>
      )}

      {sonSayfa > 1 ? (
        <nav className="mt-6 flex items-center justify-between gap-4 text-sm">
          {sayfa > 1 ? (
            <Link href={query({ sayfa: sayfa - 1 })} className="font-medium text-brand">
              ← Önceki
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-faint">
            {sayfa} / {sonSayfa}
          </span>
          {sayfa < sonSayfa ? (
            <Link href={query({ sayfa: sayfa + 1 })} className="font-medium text-brand">
              Sonraki →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
