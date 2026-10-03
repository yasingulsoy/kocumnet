import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { EXAM_SCOPE_LABEL, ObjectiveCreateForm, ObjectiveRowEditor, type ObjectiveRow } from "@/components/checkup/ObjectiveForms";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Pill, QUESTION_STATUS_TONE, qs } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Kazanımlar" };

/** Seviye 1'in her kazanımdan soru seçebilmesi için en az bu kadar yayında L1 sorusu gerekir. */
const MIN_L1 = 2;
/** Seviye 1 sınavı 50 soru = 50 kazanım (app/lib/levels.ts VARSAYILAN_AYAR). */
const SEVIYE1_SORU = 50;

export default async function KazanimlarPage({ searchParams }: PageProps<"/checkup/kazanimlar">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const sinav = typeof sp.sinav === "string" && sp.sinav in EXAM_SCOPE_LABEL ? sp.sinav : "";

  const [topics, objectives, l1Counts] = await Promise.all([
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true, examScopes: true },
    }),
    db.objective.findMany({
      orderBy: [{ topic: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        topicId: true,
        code: true,
        name: true,
        examScopes: true,
        status: true,
        sortOrder: true,
        _count: { select: { questions: true } },
      },
    }),
    db.question.groupBy({
      by: ["objectiveId"],
      where: { level: "L1_TEMEL", status: "PUBLISHED", objectiveId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const l1 = new Map(l1Counts.map((r) => [r.objectiveId, r._count._all]));
  const konuAdi = new Map(topics.map((t) => [t.id, t]));

  const satirlar: ObjectiveRow[] = objectives
    .map((o) => ({
      id: o.id,
      topicId: o.topicId,
      code: o.code,
      name: o.name,
      examScopes: o.examScopes as string[],
      status: o.status,
      sortOrder: o.sortOrder,
      l1Count: l1.get(o.id) ?? 0,
      questionCount: o._count.questions,
    }))
    .filter((o) => {
      if (!sinav) return true;
      const konu = konuAdi.get(o.topicId);
      const kazanimSinavlari = o.examScopes.length ? o.examScopes : ((konu?.examScopes as string[] | undefined) ?? []);
      return kazanimSinavlari.includes(sinav);
    });

  // Sınav bazlı hazırlık: yayında + yeterli L1 sorusu olan kazanım sayısı.
  const hazir = satirlar.filter((o) => o.status === "PUBLISHED" && o.l1Count >= MIN_L1).length;

  // Konuya göre grupla.
  const gruplar = new Map<string, ObjectiveRow[]>();
  for (const o of satirlar) {
    const liste = gruplar.get(o.topicId) ?? [];
    liste.push(o);
    gruplar.set(o.topicId, liste);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Kazanımlar"
        description="Seviyeli check-up'ın yapı taşı: Seviye 1 her kazanımdan bir soru sorar. Kod kalıcıdır, soru dosyalarında bu geçer."
      />

      <div className="scroll-x mb-4 flex gap-1">
        {["", ...Object.keys(EXAM_SCOPE_LABEL)].map((s) => (
          <Link
            key={s || "hepsi"}
            href={qs("/checkup/kazanimlar", { sinav: s })}
            aria-current={s === sinav ? "page" : undefined}
            className={
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-caption font-medium transition " +
              (s === sinav ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink")
            }
          >
            {s ? EXAM_SCOPE_LABEL[s] : "Tüm sınavlar"}
          </Link>
        ))}
      </div>

      {sinav ? (
        <Notice tone={hazir >= SEVIYE1_SORU ? "ok" : "warn"} className="mb-4" title={`${EXAM_SCOPE_LABEL[sinav]} seviye 1 hazırlığı: ${hazir} / ${SEVIYE1_SORU} kazanım`}>
          {hazir >= SEVIYE1_SORU
            ? "Seviye 1 bu sınav için açılabilir: 50 kazanımın her birinde en az 2 yayında temel soru var."
            : `Seviye 1 ${SEVIYE1_SORU} kazanım ister; şu an ${hazir} tanesi hazır (yayında + en az ${MIN_L1} yayında L1 sorusu). Eksik kazanımları ekle ve her birine en az ${MIN_L1} temel soru bağla.`}
        </Notice>
      ) : null}

      <div className={yazabilir ? "grid gap-6 xl:grid-cols-[1fr_400px]" : ""}>
        <div className="space-y-4">
          {gruplar.size === 0 ? (
            <Card>
              <EmptyState title="Kazanım yok" description="Sağdaki formdan ilk kazanımı ekle ya da içe aktarma betiğini çalıştır." />
            </Card>
          ) : (
            [...gruplar.entries()].map(([topicId, liste]) => {
              const konu = konuAdi.get(topicId);
              return (
                <Card key={topicId}>
                  <CardHeader
                    title={konu?.name ?? "Konu"}
                    description={`${liste.length} kazanım · ${konu ? ((konu.examScopes as string[]).map((s) => EXAM_SCOPE_LABEL[s] ?? s).join(", ") || konu.examScope) : ""}`}
                  />
                  <ul className="divide-y divide-line">
                    {liste.map((o) => (
                      <li key={o.id} className="px-5 py-3 sm:px-6">
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                          <code className="font-mono rounded bg-surface-sunk px-1.5 py-0.5 text-micro text-ink">{o.code}</code>
                          <p className="min-w-0 flex-1 text-caption text-ink">{o.name}</p>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={QUESTION_STATUS_TONE[o.status]}>{QUESTION_STATUS_LABEL[o.status]}</Pill>
                            <Pill tone={o.l1Count >= MIN_L1 ? "ok" : o.l1Count > 0 ? "warn" : "bad"} className="tabular">
                              {o.l1Count} L1
                            </Pill>
                            {o.questionCount !== o.l1Count ? <Pill className="tabular">{o.questionCount} soru</Pill> : null}
                          </div>
                          <ObjectiveRowEditor row={o} canEdit={yazabilir} />
                        </div>
                        {o.examScopes.length ? (
                          <p className="mt-1 text-micro text-ink-faint">{o.examScopes.map((s) => EXAM_SCOPE_LABEL[s] ?? s).join(" · ")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>

        {yazabilir ? (
          <Card className="self-start p-5 xl:sticky xl:top-6">
            <h2 className="font-display text-h3 font-semibold text-ink">Yeni kazanım</h2>
            <p className="mt-0.5 text-caption text-ink-soft">Soru formunda bu listeden seçilir. Kod kalıcı — sonradan değiştirmek içe aktarmayı bozar.</p>
            <div className="mt-4">
              <ObjectiveCreateForm topics={topics.map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))} />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
