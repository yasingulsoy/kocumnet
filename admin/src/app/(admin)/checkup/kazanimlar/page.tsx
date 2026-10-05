import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { EXAM_SCOPES, QUESTION_STATUS_LABEL, examLabel, isExamScope } from "@/lib/checkup/format";
import { konuSinavdaMi, soruSinavdaKosulu } from "@/lib/checkup/exam-scope";
import { MIN_L1_PER_OBJECTIVE, levelSizes } from "@/lib/checkup/levels";
import { GateNotice } from "@/components/checkup/GateNotice";
import { ObjectiveCreateForm, ObjectiveRowEditor, type ObjectiveRow } from "@/components/checkup/ObjectiveForms";
import {
  Card,
  CardHeader,
  EmptyState,
  FilterTabs,
  MONO,
  Notice,
  PageHeader,
  Pill,
  ProgressLine,
  QUESTION_STATUS_TONE,
  qs,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Kazanımlar" };

export default async function KazanimlarPage({ searchParams }: PageProps<"/checkup/kazanimlar">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const sinav = isExamScope(sp.sinav) ? sp.sinav : "";

  const [topics, objectives, l1Counts] = await Promise.all([
    // Bütün konular: kapsam kuralı kazanımın konusuna bakıyor (yaprak olmasa da).
    // Yeni kazanım formu yalnızca yaprakları listeler.
    db.topic.findMany({
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true, examScopes: true, _count: { select: { children: true } } },
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
    // Sınav seçiliyse yalnızca o sınavda sorulabilen L1 soruları sayılır —
    // öğrenci uygulamasının seviye 1 seçimiyle aynı kural (lib/checkup/exam-scope.ts).
    db.question.groupBy({
      by: ["objectiveId"],
      where: {
        level: "L1_TEMEL",
        status: "PUBLISHED",
        objectiveId: { not: null },
        ...(sinav ? soruSinavdaKosulu(sinav) : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const l1 = new Map(l1Counts.map((r) => [r.objectiveId, r._count._all]));
  const konuAdi = new Map(topics.map((t) => [t.id, t]));

  /**
   * Kazanım bu sınavda ölçülür mü — öğrenci uygulamasıyla aynı kural
   * (shared/exam-scope.ts): kendi listesi doluysa o, boşsa konusunun sınavları.
   */
  const olculurMu = (o: { topicId: string; examScopes: string[] }, s: string) => {
    if (o.examScopes.length) return o.examScopes.includes(s);
    const konu = konuAdi.get(o.topicId);
    return konu ? konuSinavdaMi(konu, s) : false;
  };

  const tumSatirlar: ObjectiveRow[] = objectives.map((o) => ({
    id: o.id,
    topicId: o.topicId,
    code: o.code,
    name: o.name,
    examScopes: o.examScopes as string[],
    status: o.status,
    sortOrder: o.sortOrder,
    l1Count: l1.get(o.id) ?? 0,
    questionCount: o._count.questions,
  }));
  const satirlar = sinav ? tumSatirlar.filter((o) => olculurMu(o, sinav)) : tumSatirlar;

  // Sınav bazlı hazırlık: yayında + yeterli L1 sorusu olan kazanım sayısı.
  const hazir = satirlar.filter((o) => o.status === "PUBLISHED" && o.l1Count >= MIN_L1_PER_OBJECTIVE).length;
  const hedef = sinav ? levelSizes(sinav).seviye1 : 0;
  const tekSorulu = satirlar.filter((o) => o.status === "PUBLISHED" && o.l1Count === 1).length;
  const yayindaKazanim = satirlar.filter((o) => o.status === "PUBLISHED").length;

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

      <FilterTabs
        label="Sınav süzgeci"
        className="mb-4"
        items={[
          { href: "/checkup/kazanimlar", label: "Tüm sınavlar", active: !sinav, count: tumSatirlar.length },
          ...EXAM_SCOPES.map((s) => ({
            href: qs("/checkup/kazanimlar", { sinav: s }),
            label: examLabel(s),
            active: s === sinav,
            count: tumSatirlar.filter((o) => olculurMu(o, s)).length,
          })),
        ]}
      />

      {sinav ? (
        <Card className="mb-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-72">
              <h2 className="font-display text-h3 font-semibold text-ink">
                {examLabel(sinav)} seviye 1 hazırlığı
              </h2>
              <p className="mt-0.5 text-caption text-ink-soft">
                {hazir >= hedef
                  ? `Seviye 1 bu sınav için açılabilir: ${hedef} kazanımın her birinde en az ${MIN_L1_PER_OBJECTIVE} yayında temel soru var.`
                  : `Seviye 1 ${hedef} kazanım ister; şu an ${hazir} tanesi hazır (yayında + en az ${MIN_L1_PER_OBJECTIVE} yayında L1 sorusu). Eksik kazanımları ekle ve her birine en az ${MIN_L1_PER_OBJECTIVE} temel soru bağla.`}
              </p>
              {tekSorulu > 0 ? (
                <p className="mt-1 text-micro text-warn">
                  {tekSorulu} kazanımın tek L1 sorusu var: öğrenci o kazanımı kaçırırsa telafi turunda yeni soru gelemez.
                </p>
              ) : null}
              {yayindaKazanim > hedef ? (
                <p className="mt-1 text-micro text-ink-faint">
                  Bu sınavda {yayindaKazanim} yayında kazanım var; seviye 1 konu sırasına göre ilk {hedef} tanesini
                  sorar, kalanı hiç sorulmaz.
                </p>
              ) : null}
            </div>
            <div className="w-full sm:w-64">
              <ProgressLine label="Hazır kazanım" value={hazir} target={hedef} />
            </div>
          </div>
        </Card>
      ) : (
        <Notice tone="info" className="mb-4">
          Bir sınav seçince o sınavın seviye 1 hazırlığı (hazır kazanım / gereken) burada görünür.
        </Notice>
      )}

      <div className={yazabilir ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <div className="min-w-0 space-y-4">
          {gruplar.size === 0 ? (
            <Card>
              <EmptyState
                title={sinav ? "Bu sınavda ölçülen kazanım yok" : "Kazanım yok"}
                description={
                  yazabilir
                    ? "Sağdaki formdan ilk kazanımı ekle ya da içe aktarma betiğini çalıştır."
                    : "Kazanımlar içe aktarma betiğiyle ya da içerik ekibince eklenir."
                }
              />
            </Card>
          ) : (
            [...gruplar.entries()].map(([topicId, liste]) => {
              const konu = konuAdi.get(topicId);
              const konuSinavlari = konu ? (konu.examScopes as string[]) : [];
              return (
                <Card key={topicId}>
                  <CardHeader
                    title={konu?.name ?? "Konu"}
                    description={
                      liste.length +
                      " kazanım · " +
                      (konu ? (konuSinavlari.length ? konuSinavlari.map(examLabel).join(", ") : examLabel(konu.examScope)) : "")
                    }
                  />
                  <ul className="divide-y divide-line">
                    {liste.map((o) => (
                      <li key={o.id} className="px-5 py-3 sm:px-6">
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                          <code className={MONO + " rounded bg-surface-sunk px-1.5 py-0.5 text-micro text-ink"}>{o.code}</code>
                          <p className="min-w-0 flex-1 text-caption text-ink">{o.name}</p>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={QUESTION_STATUS_TONE[o.status]}>{QUESTION_STATUS_LABEL[o.status]}</Pill>
                            <Pill
                              tone={o.l1Count >= MIN_L1_PER_OBJECTIVE ? "ok" : o.l1Count > 0 ? "warn" : "bad"}
                              className="tabular"
                            >
                              <span title="Yayındaki seviye 1 (temel) sorusu">{o.l1Count} L1</span>
                            </Pill>
                            {o.questionCount !== o.l1Count ? (
                              <Pill className="tabular">{o.questionCount} soru</Pill>
                            ) : null}
                            {o.questionCount > 0 ? (
                              <Link
                                href={qs("/checkup/sorular", { kazanim: o.code })}
                                className="ms-1 text-micro font-medium text-brand hover:text-brand-hover"
                              >
                                Sorular
                              </Link>
                            ) : null}
                          </div>
                          <ObjectiveRowEditor row={o} canEdit={yazabilir} />
                        </div>
                        {o.examScopes.length ? (
                          <p className="mt-1 text-micro text-ink-faint">{o.examScopes.map(examLabel).join(" · ")}</p>
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
            <p className="mt-0.5 text-caption text-ink-soft">
              Soru formunda bu listeden seçilir. Kod kalıcı — sonradan değiştirmek içe aktarmayı bozar.
            </p>
            <div className="mt-4">
              <ObjectiveCreateForm
                topics={topics
                  .filter((t) => t._count.children === 0)
                  .map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
