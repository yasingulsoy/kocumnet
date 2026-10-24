import type { Metadata } from "next";
import Link from "next/link";
import { Target } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { EXAM_SCOPES, QUESTION_STATUS_LABEL, examLabel, isExamScope } from "@/lib/checkup/format";
import { konuSinavdaMi, soruSinavdaKosulu } from "@/lib/checkup/exam-scope";
import { MIN_L1_PER_OBJECTIVE } from "@/lib/checkup/levels";
import { seviye1Kumesi } from "@/lib/checkup/pool";
import { GateNotice } from "@/components/checkup/GateNotice";
import {
  ObjectiveCreateForm,
  ObjectiveRowEditor,
  ObjectiveSummaryEditor,
  type ObjectiveRow,
} from "@/components/checkup/ObjectiveForms";
import { safeParseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { CODE, ProgressLine, QUESTION_STATUS_COLOR, qs } from "@/components/checkup/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

export const metadata: Metadata = { title: "Check-up · Kazanımlar" };

export default async function KazanimlarPage({ searchParams }: PageProps<"/checkup/kazanimlar">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const sinav = isExamScope(sp.sinav) ? sp.sinav : "";
  // "Özeti olmayanlar": özet kartı yazılacak kazanımlar (içerik ekibinin listesi).
  const ozetYok = sp.ozet === "yok";

  const [topics, objectives, l1Counts, kume] = await Promise.all([
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
        summary: true,
        summaryUpdatedByStaff: true,
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
    // Seviye 1'in öğrenciye gerçekten sorulacak kümesi (sorulabilen kazanımların
    // sıradaki ilk N'i) — paket sağlığıyla aynı sorgu (lib/checkup/pool.ts).
    sinav ? seviye1Kumesi(sinav) : null,
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

  /** Özet kartı → yazım biçimi. Bozuk satır sayfayı düşürmesin: kart yok sayılır. */
  const ozet = (json: unknown) => {
    const p = json == null ? null : safeParseQuestionContent(json);
    return p?.success ? { markup: contentToMarkup(p.data), kilitli: hasUneditableBlocks(p.data) } : { markup: "", kilitli: false };
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
    summaryMarkup: ozet(o.summary).markup,
    summaryStaff: o.summaryUpdatedByStaff,
    summaryLocked: ozet(o.summary).kilitli,
  }));
  const sinavdakiler = sinav ? tumSatirlar.filter((o) => olculurMu(o, sinav)) : tumSatirlar;
  const ozetsizSayisi = sinavdakiler.filter((o) => !o.summaryMarkup).length;
  const satirlar = ozetYok ? sinavdakiler.filter((o) => !o.summaryMarkup) : sinavdakiler;

  /*
   * Sınav bazlı hazırlık: öğrenciye GERÇEKTEN sorulacak kazanımlar üzerinden
   * (seviye1Kumesi). Eskiden ekrandaki satırlardan sayılıyordu: bütün
   * kazanımlar (öğrenciye yalnızca ilk N soruluyor) ve "özet kartı olmayanlar"
   * süzgeci açıkken o süzgecin kalanı. Sayaç artık süzgeçten bağımsız.
   */
  const hedef = kume?.gerekli ?? 0;
  const uygun = kume?.uygun ?? 0;
  const hazir = kume?.hazir ?? 0;
  const tekSorulu = kume?.tekSorulu ?? 0;
  const yayindaKazanim = sinavdakiler.filter((o) => o.status === "PUBLISHED").length;

  // Konuya göre grupla.
  const gruplar = new Map<string, ObjectiveRow[]>();
  for (const o of satirlar) {
    const liste = gruplar.get(o.topicId) ?? [];
    liste.push(o);
    gruplar.set(o.topicId, liste);
  }

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Kazanımlar"
        description="Seviyeli check-up'ın yapı taşı: Seviye 1 her kazanımdan bir soru sorar. Kod kalıcıdır, soru dosyalarında bu geçer."
      />

      <SegmentedTabs
        label="Sınav süzgeci"
        className="mb-4"
        items={[
          {
            key: "hepsi",
            href: qs("/checkup/kazanimlar", { ozet: ozetYok ? "yok" : undefined }),
            label: "Tüm sınavlar",
            active: !sinav,
            count: tumSatirlar.length,
          },
          ...EXAM_SCOPES.map((s) => ({
            key: s,
            href: qs("/checkup/kazanimlar", { sinav: s, ozet: ozetYok ? "yok" : undefined }),
            label: examLabel(s),
            active: s === sinav,
            count: tumSatirlar.filter((o) => olculurMu(o, s)).length,
          })),
        ]}
      />

      <SegmentedTabs
        label="Özet kartı süzgeci"
        className="mb-4"
        items={[
          { key: "hepsi", href: qs("/checkup/kazanimlar", { sinav }), label: "Tüm kazanımlar", active: !ozetYok, count: sinavdakiler.length },
          {
            key: "yok",
            href: qs("/checkup/kazanimlar", { sinav, ozet: "yok" }),
            label: "Özet kartı olmayanlar",
            active: ozetYok,
            count: ozetsizSayisi,
          },
        ]}
      />

      {sinav ? (
        <Card className="mb-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-72">
              <h2 className="font-display text-base font-semibold text-gray-800">{examLabel(sinav)} seviye 1 hazırlığı</h2>
              <p className="mt-1 text-theme-sm text-gray-500">
                {uygun < hedef
                  ? `Seviye 1 ${hedef} kazanım ister; şu an ${uygun} kazanımda bu sınavda sorulabilen yayında temel soru var. Seviye 1 (ve seviyeli check-up) eksik soruyla açılmaz: eksik kazanımları ekle ya da sorusuz kazanımlara temel soru bağla.`
                  : hazir >= hedef
                    ? `Seviye 1 bu sınav için açılabilir: sorulacak ${hedef} kazanımın her birinde en az ${MIN_L1_PER_OBJECTIVE} yayında temel soru var.`
                    : `Seviye 1 bu sınav için açılabilir: sorulacak ${hedef} kazanımın hepsinde temel soru var, ${hazir} tanesinde teyit turu için yedek soru (en az ${MIN_L1_PER_OBJECTIVE}) var.`}
              </p>
              {tekSorulu > 0 ? (
                <p className="mt-1 text-theme-xs text-warning-700">
                  Sorulacak {tekSorulu} kazanımın tek L1 sorusu var: öğrenci o kazanımı kaçırırsa teyit turunda yeni
                  soru gelemez (tur kısmi açılır).
                </p>
              ) : null}
              {uygun > hedef ? (
                <p className="mt-1 text-theme-xs text-gray-500">
                  Bu sınavda {yayindaKazanim} yayında kazanım var, {uygun} tanesinde temel soru var; seviye 1 konu
                  sırasına göre ilk {hedef} tanesini sorar, kalanı hiç sorulmaz (listede &quot;S1 dışı&quot;).
                </p>
              ) : null}
            </div>
            <div className="w-full space-y-3 sm:w-64">
              <ProgressLine label="Sorulabilen kazanım" value={Math.min(uygun, hedef)} target={hedef} />
              <ProgressLine label="Yedek sorusu olan (sorulacaklardan)" value={hazir} target={hedef} />
            </div>
          </div>
        </Card>
      ) : (
        <Alert variant="info" compact className="mb-4">
          Bir sınav seçince o sınavın seviye 1 hazırlığı (hazır kazanım / gereken) burada görünür.
        </Alert>
      )}

      <div className={yazabilir ? "grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <div className="min-w-0 space-y-4 md:space-y-6">
          {gruplar.size === 0 ? (
            <Card>
              <EmptyState
                icon={<Target />}
                title={ozetYok ? "Özet kartı olmayan kazanım yok" : sinav ? "Bu sınavda ölçülen kazanım yok" : "Kazanım yok"}
                description={
                  yazabilir
                    ? "Yandaki formdan ilk kazanımı ekle ya da içe aktarma betiğini çalıştır."
                    : "Kazanımlar içe aktarma betiğiyle ya da içerik ekibince eklenir."
                }
              />
            </Card>
          ) : (
            [...gruplar.entries()].map(([topicId, liste]) => {
              const konu = konuAdi.get(topicId);
              const konuSinavlari = konu ? (konu.examScopes as string[]) : [];
              return (
                <ComponentCard
                  key={topicId}
                  flush
                  title={konu?.name ?? "Konu"}
                  desc={
                    liste.length +
                    " kazanım · " +
                    (konu ? (konuSinavlari.length ? konuSinavlari.map(examLabel).join(", ") : examLabel(konu.examScope)) : "")
                  }
                >
                  <ul className="divide-y divide-gray-100">
                    {liste.map((o) => (
                      <li key={o.id} className="px-4 py-3 sm:px-6">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <code className={CODE}>{o.code}</code>
                          <p className="min-w-0 flex-1 basis-48 text-theme-sm text-gray-800">{o.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge size="sm" color={QUESTION_STATUS_COLOR[o.status]}>
                              {QUESTION_STATUS_LABEL[o.status]}
                            </Badge>
                            <Badge
                              size="sm"
                              color={o.l1Count >= MIN_L1_PER_OBJECTIVE ? "success" : o.l1Count > 0 ? "warning" : "error"}
                              className="tabular"
                              title="Yayındaki seviye 1 (temel) sorusu"
                            >
                              {o.l1Count} L1
                            </Badge>
                            {kume && o.status === "PUBLISHED" && o.l1Count > 0 && !kume.sorulacak.has(o.id) ? (
                              <Badge
                                size="sm"
                                color="light"
                                title={`Seviye 1 sıradaki ilk ${hedef} kazanımı sorar; bu kazanım o sıranın dışında.`}
                              >
                                S1 dışı
                              </Badge>
                            ) : null}
                            {o.questionCount !== o.l1Count ? (
                              <Badge size="sm" color="light" className="tabular">
                                {o.questionCount} soru
                              </Badge>
                            ) : null}
                            {o.summaryMarkup ? (
                              <Badge size="sm" color="info" title="Özet kartı var (sonuç ekranında ve defterde görünür)">
                                özet kartı
                              </Badge>
                            ) : (
                              <Badge size="sm" color="light" title="Özet kartı yazılmamış">
                                özet yok
                              </Badge>
                            )}
                            {o.questionCount > 0 ? (
                              <Link
                                href={qs("/checkup/sorular", { kazanim: o.code })}
                                className="ms-1 text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                              >
                                Sorular
                              </Link>
                            ) : null}
                          </div>
                          <ObjectiveRowEditor row={o} canEdit={yazabilir} />
                          <ObjectiveSummaryEditor row={o} canEdit={yazabilir} />
                        </div>
                        {o.examScopes.length ? (
                          <p className="mt-1 text-theme-xs text-gray-500">{o.examScopes.map(examLabel).join(" · ")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </ComponentCard>
              );
            })
          )}
        </div>

        {yazabilir ? (
          <ComponentCard
            className="self-start xl:sticky xl:top-24"
            title="Yeni kazanım"
            desc="Soru formunda bu listeden seçilir. Kod kalıcı — sonradan değiştirmek içe aktarmayı bozar."
          >
            <ObjectiveCreateForm
              topics={topics
                .filter((t) => t._count.children === 0)
                .map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
            />
          </ComponentCard>
        ) : null}
      </div>
    </>
  );
}
