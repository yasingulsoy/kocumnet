import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Havuz durumu" };

/**
 * Havuz panosu. Tek bir soruya cevap verir: **hangi paket gerçekten
 * başlatılabiliyor?**
 *
 * Soru sayısını toplam olarak göstermek yanıltıcı: 400 soruluk bir havuzla
 * bile, bir paketin istediği konuda 2 soru varsa o paket başlamaz
 * (startCheckup eksik testi reddeder). Bu yüzden kırılım paket × konu.
 */

interface TopicRow {
  topicId: string;
  slug: string;
  name: string;
  examScope: string;
  published: bigint;
  draft: bigint;
  easy: bigint;
  medium: bigint;
  hard: bigint;
}

export default async function AdminHome() {
  const [topicRows, packages] = await Promise.all([
    prisma.$queryRaw<TopicRow[]>`
      SELECT t.id AS "topicId", t.slug, t.name, t."examScope",
             count(*) FILTER (WHERE q.status = 'PUBLISHED')                        AS published,
             count(*) FILTER (WHERE q.status IN ('DRAFT','REVIEW'))                AS draft,
             count(*) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty <= 2)  AS easy,
             count(*) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty = 3)   AS medium,
             count(*) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty >= 4)  AS hard
      FROM "Topic" t
      LEFT JOIN "Question" q ON q."topicId" = t.id
      WHERE NOT EXISTS (SELECT 1 FROM "Topic" c WHERE c."parentId" = t.id)
      GROUP BY t.id, t.slug, t.name, t."examScope"
      ORDER BY t."examScope", t.name
    `,
    prisma.package.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        status: true,
        questionCount: true,
        topics: {
          select: { questionCount: true, topic: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const byTopicId = new Map(topicRows.map((r) => [r.topicId, r]));

  const packageHealth = packages.map((p) => {
    const gaps = p.topics
      .map((pt) => ({
        name: pt.topic.name,
        need: pt.questionCount,
        have: Number(byTopicId.get(pt.topic.id)?.published ?? 0),
      }))
      // Tekrar engeli nedeniyle "tam yeterli" havuz aslında yeterli değil:
      // öğrenci ikinci kez çözemez. İhtiyacın 2 katını sağlıklı sayıyoruz.
      .filter((g) => g.have < g.need * 2);

    const blocking = gaps.filter((g) => g.have < g.need);
    return { ...p, gaps, blocking };
  });

  const toplamYayinda = topicRows.reduce((s, r) => s + Number(r.published), 0);
  const toplamTaslak = topicRows.reduce((s, r) => s + Number(r.draft), 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Havuz durumu</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        {toplamYayinda} soru yayında, {toplamTaslak} taslak/incelemede.
      </p>

      {/* Paket sağlığı */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Paketler</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Bir paket, istediği her konuda yeterli soru yoksa başlatılamaz.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {packageHealth.map((p) => (
            <Card key={p.slug} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {p.questionCount} soru · {p.topics.length} konu
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold " +
                    (p.blocking.length
                      ? "bg-bad-wash text-bad"
                      : p.gaps.length
                        ? "bg-warn-wash text-warn"
                        : "bg-ok-wash text-ok")
                  }
                >
                  {p.blocking.length
                    ? "başlatılamaz"
                    : p.gaps.length
                      ? "havuz dar"
                      : "hazır"}
                </span>
              </div>

              {p.gaps.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                  {p.gaps.map((g) => (
                    <li key={g.name} className="flex justify-between gap-3">
                      <span className="truncate text-ink-soft">{g.name}</span>
                      <span
                        className={
                          "shrink-0 font-mono " + (g.have < g.need ? "text-bad" : "text-warn")
                        }
                      >
                        {g.have}/{g.need * 2}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {/* Konu havuzu */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">Konular</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Seçim algoritması kolay %30 · orta %50 · zor %20 dağılımı arar; her bantta soru
          olmalı.
        </p>

        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Konu</th>
                <th className="px-3 py-2.5 text-end font-medium">Yayında</th>
                <th className="px-3 py-2.5 text-end font-medium">Kolay</th>
                <th className="px-3 py-2.5 text-end font-medium">Orta</th>
                <th className="px-3 py-2.5 text-end font-medium">Zor</th>
                <th className="px-3 py-2.5 text-end font-medium">Taslak</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topicRows.map((r) => {
                const eksikBant =
                  Number(r.published) > 0 &&
                  (Number(r.easy) === 0 || Number(r.medium) === 0 || Number(r.hard) === 0);

                return (
                  <tr key={r.topicId} className="hover:bg-surface-sunk">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      <span className="me-2 rounded bg-surface-sunk px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                        {r.examScope}
                      </span>
                      {r.name}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono">
                      {Number(r.published) === 0 ? (
                        <span className="text-bad">0</span>
                      ) : (
                        Number(r.published)
                      )}
                    </td>
                    <NumCell value={Number(r.easy)} />
                    <NumCell value={Number(r.medium)} />
                    <NumCell value={Number(r.hard)} />
                    <td className="px-3 py-2.5 text-end font-mono text-ink-faint">
                      {Number(r.draft) || ""}
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      {eksikBant ? (
                        <span className="text-[11px] text-warn">zorluk dengesiz</span>
                      ) : null}
                      <Link
                        href={{ pathname: "/admin/sorular", query: { konu: r.slug } }}
                        className="ms-3 text-xs font-medium text-brand hover:underline"
                      >
                        gör
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}

function NumCell({ value }: { value: number }) {
  return (
    <td
      className={"px-3 py-2.5 text-end font-mono " + (value === 0 ? "text-bad" : "text-ink-soft")}
    >
      {value}
    </td>
  );
}
