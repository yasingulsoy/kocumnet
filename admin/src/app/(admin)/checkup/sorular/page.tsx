import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartColumn, FileUp, ListChecks, Plus, Search, X } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { partiBilgisi } from "@/lib/checkup/question-import";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import {
  QUESTION_LEVEL_LABEL,
  QUESTION_STATUS_LABEL,
  examLabel,
  percent,
  trDate,
  trNumber,
} from "@/lib/checkup/format";
import { EKSIK, LISTE_SIRASI, listeKosulu, listeSuzgeci } from "@/lib/checkup/question-query";
import { listeSorgusuParams, soruAdresi } from "@/lib/checkup/question-list";
import { GateNotice } from "@/components/checkup/GateNotice";
import { StatusSelect } from "@/components/checkup/StatusSelect";
import { BulkCheckbox, BulkProvider, BulkSelectAll } from "@/components/checkup/BulkStatus";
import { MONO, QUESTION_STATUS_COLOR, qs } from "@/components/checkup/ui";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";

export const metadata: Metadata = { title: "Check-up · Sorular" };

const SAYFA_BOYU = 30;

/** Etkin süzgeç çipi (kazanım, içe aktarma partisi): değer + kaldır. */
function SuzgecCipi({ etiket, children, kaldir }: { etiket: string; children: ReactNode; kaldir: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1 text-theme-xs text-brand-700">
      <span className="min-w-0 truncate">
        <span className="text-gray-600">{etiket}:</span> <span className="font-medium">{children}</span>
      </span>
      <Link
        href={kaldir}
        aria-label={etiket + " süzgecini kaldır"}
        title="Süzgeci kaldır"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-brand-500 transition hover:bg-brand-100"
      >
        <X className="size-3.5" aria-hidden />
      </Link>
    </span>
  );
}

export default async function QuestionsPage({ searchParams }: PageProps<"/checkup/sorular">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  // Süzgeç ve sıra tek yerde (lib/checkup/question-query.ts): soru ekranındaki
  // önceki/sonraki gezinmesi aynı listeyi izliyor.
  const suzgec = listeSuzgeci(sp);
  const { konu, durum, ara, kazanim, eksik, parti, sayfa } = suzgec;

  const where = listeKosulu(suzgec);

  const [topics, toplam, questions, partiKaydi] = await Promise.all([
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, examScope: true },
    }),
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: LISTE_SIRASI,
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        stemText: true,
        difficulty: true,
        status: true,
        version: true,
        level: true,
        examScopes: true,
        shownCount: true,
        correctCount: true,
        sourceRef: true,
        updatedAt: true,
        updatedByStaff: true,
        solution: true,
        topic: { select: { name: true, examScope: true } },
        objective: { select: { code: true } },
      },
    }),
    parti ? partiBilgisi(parti) : Promise.resolve(null),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const suzgecVar = Boolean(konu || durum || ara || eksik || kazanim || parti);
  // Soruyu açıp kaydedince bu süzgece ve sayfaya dönülür.
  const geri = listeSorgusuParams({ ara, konu, durum, eksik, kazanim, parti, sayfa: sayfa > 1 ? String(sayfa) : undefined });

  const kaydedilen = tek(sp.kaydedildi);
  const guncellenen = tek(sp.guncellendi);

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Sorular"
        description={trNumber(toplam) + (suzgecVar ? " soru bu süzgeçlere uyuyor." : " soru havuzda.")}
        actions={
          <>
            <ButtonLink href="/checkup/sorular/analiz" variant="outline" size="xs" startIcon={<ChartColumn />}>
              Madde analizi
            </ButtonLink>
            <ButtonLink href="/checkup/sorular/ice-aktar" variant="outline" size="xs" startIcon={<FileUp />}>
              {yazabilir ? "Toplu içe aktar" : "İçe aktarma geçmişi"}
            </ButtonLink>
            {yazabilir ? (
              <ButtonLink
                href={"/checkup/sorular/yeni" + (geri ? "?geri=" + encodeURIComponent(geri) : "")}
                size="xs"
                startIcon={<Plus />}
              >
                Yeni soru
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {kaydedilen ? (
        <Alert variant="success" compact className="mb-4">
          Soru kaydedildi.{" "}
          {kaydedilen !== "1" ? (
            <Link href={soruAdresi(kaydedilen, geri)} className="font-semibold text-gray-800 underline underline-offset-2">
              Aç
            </Link>
          ) : null}
        </Alert>
      ) : null}
      {guncellenen ? (
        <Alert variant="success" compact className="mb-4">
          Soru güncellendi.{" "}
          {guncellenen !== "1" ? (
            <Link href={soruAdresi(guncellenen, geri)} className="font-semibold text-gray-800 underline underline-offset-2">
              Tekrar aç
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <BulkProvider ids={yazabilir ? questions.map((q) => q.id) : []}>
        <Card>
          {/* Süzgeçler — GET formu: seçim adres çubuğunda kalır, paylaşılabilir. */}
          <form method="get" role="search" className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4 sm:px-6 sm:py-5">
            {kazanim ? <input type="hidden" name="kazanim" value={kazanim} /> : null}
            {parti ? <input type="hidden" name="parti" value={parti} /> : null}
            <Field label="Ara" className="min-w-0 grow basis-60">
              <Input
                name="ara"
                type="search"
                defaultValue={ara}
                placeholder="Metin, kaynak ya da #kimlik…"
                compact
                startIcon={<Search />}
              />
            </Field>

            <Field label="Konu" className="min-w-0 grow basis-60">
              <Select name="konu" defaultValue={konu} compact>
                <option value="">Tümü</option>
                {topics.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {examLabel(t.examScope)} · {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Durum" className="min-w-0 grow basis-40">
              <Select name="durum" defaultValue={durum} compact>
                <option value="">Tümü</option>
                {Object.entries(QUESTION_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Eksik" className="min-w-0 grow basis-52">
              <Select name="eksik" defaultValue={eksik} compact>
                <option value="">Hepsi</option>
                {Object.entries(EKSIK).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex gap-2">
              <Button type="submit" variant="outline" size="xs">
                Süz
              </Button>
              {suzgecVar ? (
                <ButtonLink href="/checkup/sorular" variant="ghost" size="xs">
                  Temizle
                </ButtonLink>
              ) : null}
            </div>
          </form>

          {kazanim || parti ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-6">
              {kazanim ? (
                <SuzgecCipi etiket="Kazanım" kaldir={qs("/checkup/sorular", { ara, konu, durum, eksik, parti })}>
                  <span className={MONO}>{kazanim}</span>
                </SuzgecCipi>
              ) : null}
              {parti ? (
                <>
                  <SuzgecCipi etiket="İçe aktarma" kaldir={qs("/checkup/sorular", { ara, konu, durum, eksik, kazanim })}>
                    {partiKaydi ? (
                      <>
                        {partiKaydi.dosyaAdi} · {trDate(partiKaydi.tarih, { time: true })}
                      </>
                    ) : (
                      <span className="text-warning-700">kaydı bulunamadı (geri alınmış olabilir)</span>
                    )}
                  </SuzgecCipi>
                  <Link href="/checkup/sorular/ice-aktar" className="text-theme-xs font-medium text-brand-500 hover:text-brand-600">
                    İçe aktarma geçmişi
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          {questions.length === 0 ? (
            <EmptyState
              icon={<ListChecks />}
              title={suzgecVar ? "Bu süzgeçlere uyan soru yok" : "Havuzda henüz soru yok"}
              description={suzgecVar ? "Süzgeçleri gevşetmeyi dene." : undefined}
              action={
                !suzgecVar && yazabilir ? (
                  <ButtonLink href="/checkup/sorular/yeni" size="xs" startIcon={<Plus />}>
                    İlk soruyu ekle
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <>
              {yazabilir ? (
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5 sm:px-6">
                  <BulkSelectAll />
                  <span className="hidden text-theme-xs text-gray-500 sm:inline">Seçince toplu durum değiştirme çubuğu açılır.</span>
                </div>
              ) : null}
              <ul className="divide-y divide-gray-100">
                {questions.map((q) => {
                  const ozet = (q.stemText || "metinsiz soru").slice(0, 80);
                  return (
                    <li key={q.id} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                      {yazabilir ? <BulkCheckbox id={q.id} label={"Seç: " + ozet} /> : null}
                      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2 sm:flex-nowrap">
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <Link
                            href={soruAdresi(q.id, geri)}
                            className="line-clamp-2 text-sm font-medium text-gray-800 hover:text-brand-500"
                          >
                            {q.stemText || "(metinsiz soru)"}
                          </Link>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-500">
                            <span>
                              {examLabel(q.topic.examScope)} · {q.topic.name}
                            </span>
                            {q.examScopes.length ? (
                              <span className="text-brand-700">yalnızca {q.examScopes.map(examLabel).join(", ")}</span>
                            ) : null}
                            <span>zorluk {q.difficulty}</span>
                            {q.level ? <span>{QUESTION_LEVEL_LABEL[q.level]?.split(" — ")[0]}</span> : null}
                            {q.objective ? <span className={MONO}>{q.objective.code}</span> : null}
                            {q.version > 1 ? <span>v{q.version}</span> : null}
                            {q.shownCount > 0 ? (
                              <span>
                                {q.shownCount} kez soruldu · {percent(q.correctCount / q.shownCount)} doğru
                              </span>
                            ) : null}
                            {q.solution === null ? <span className="text-warning-700">çözüm yok</span> : null}
                            {q.sourceRef ? <span>{q.sourceRef}</span> : null}
                            <span title={q.updatedByStaff ?? undefined}>
                              güncellendi {trDate(q.updatedAt, { year: false })}
                            </span>
                            <span className={MONO} title={q.id}>
                              #{q.id.slice(-6)}
                            </span>
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge size="sm" color={QUESTION_STATUS_COLOR[q.status]}>
                            {QUESTION_STATUS_LABEL[q.status]}
                          </Badge>
                          {/* key: toplu değişiklikten sonra seçim kutusu yeni durumla yeniden kurulsun. */}
                          {yazabilir ? <StatusSelect key={q.id + q.status} id={q.id} status={q.status} /> : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Pagination
          currentPage={Math.min(sayfa, sonSayfa)}
          totalPages={sonSayfa}
          href={(p) => qs("/checkup/sorular", { ara, konu, durum, eksik, kazanim, parti, sayfa: p > 1 ? p : undefined })}
        />
      </BulkProvider>
    </>
  );
}
