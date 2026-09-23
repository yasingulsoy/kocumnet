import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL, isQuestionStatus, percent, trDate, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { StatusSelect } from "@/components/checkup/StatusSelect";
import {
  Card,
  EmptyState,
  INPUT_CLASS,
  LinkButton,
  Notice,
  PageHeader,
  Pagination,
  Pill,
  QUESTION_STATUS_TONE,
  SELECT_CLASS,
  buttonClass,
  qs,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Sorular" };

const SAYFA_BOYU = 30;

export default async function QuestionsPage({ searchParams }: PageProps<"/checkup/sorular">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const konu = typeof sp.konu === "string" ? sp.konu : "";
  const durum = typeof sp.durum === "string" && isQuestionStatus(sp.durum) ? sp.durum : "";
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 200) : "";
  const sayfa = Math.max(1, Math.floor(Number(typeof sp.sayfa === "string" ? sp.sayfa : 1)) || 1);

  const where = {
    ...(konu ? { topic: { slug: konu } } : {}),
    ...(durum ? { status: durum } : {}),
    // stemText tam da bunun için var (PLAN §3): JSONB gövdede arama yapılamaz.
    ...(ara ? { stemText: { contains: ara, mode: "insensitive" as const } } : {}),
  };

  const [topics, toplam, questions] = await Promise.all([
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, examScope: true },
    }),
    db.question.count({ where }),
    db.question.findMany({
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
        updatedAt: true,
        updatedByStaff: true,
        solution: true,
        topic: { select: { name: true, examScope: true } },
      },
    }),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const suzgecVar = Boolean(konu || durum || ara);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Sorular"
        description={trNumber(toplam) + (suzgecVar ? " soru bu süzgeçlere uyuyor." : " soru havuzda.")}
        actions={yazabilir ? <LinkButton href="/checkup/sorular/yeni">Yeni soru</LinkButton> : null}
      />

      {sp.kaydedildi ? <Notice tone="ok" className="mb-4">Soru kaydedildi.</Notice> : null}
      {sp.guncellendi ? <Notice tone="ok" className="mb-4">Soru güncellendi.</Notice> : null}

      <Card>
        {/* Süzgeçler — GET formu: seçim adres çubuğunda kalır, paylaşılabilir. */}
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-5 dark:border-gray-800 sm:px-6">
          <label className="min-w-0 flex-1 basis-60">
            <span className="mb-1.5 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">Ara</span>
            <input name="ara" defaultValue={ara} placeholder="Soru metninde ara…" className={INPUT_CLASS} />
          </label>

          <label className="min-w-0 basis-60">
            <span className="mb-1.5 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">Konu</span>
            <select name="konu" defaultValue={konu} className={SELECT_CLASS}>
              <option value="">Tümü</option>
              {topics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.examScope} · {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 basis-40">
            <span className="mb-1.5 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">Durum</span>
            <select name="durum" defaultValue={durum} className={SELECT_CLASS}>
              <option value="">Tümü</option>
              {Object.entries(QUESTION_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button type="submit" className={buttonClass("outline", "md")}>
              Süz
            </button>
            {suzgecVar ? (
              <Link href="/checkup/sorular" className={buttonClass("ghost", "md")}>
                Temizle
              </Link>
            ) : null}
          </div>
        </form>

        {questions.length === 0 ? (
          <EmptyState
            title={suzgecVar ? "Bu süzgeçlere uyan soru yok" : "Havuzda henüz soru yok"}
            description={suzgecVar ? "Süzgeçleri gevşetmeyi dene." : undefined}
            action={
              !suzgecVar && yazabilir ? <LinkButton href="/checkup/sorular/yeni">İlk soruyu ekle</LinkButton> : null
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4 sm:flex-nowrap sm:px-6">
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <Link
                    href={"/checkup/sorular/" + q.id}
                    className="line-clamp-2 text-sm font-medium text-gray-800 hover:text-brand-500 dark:text-white/90"
                  >
                    {q.stemText || "(metinsiz soru)"}
                  </Link>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {q.topic.examScope} · {q.topic.name}
                    </span>
                    <span>zorluk {q.difficulty}</span>
                    {q.version > 1 ? <span>v{q.version}</span> : null}
                    {q.shownCount > 0 ? (
                      <span>
                        {q.shownCount} kez soruldu · {percent(q.correctCount / q.shownCount)} doğru
                      </span>
                    ) : null}
                    {q.solution === null ? <span className="text-warning-600 dark:text-orange-400">çözüm yok</span> : null}
                    {q.sourceRef ? <span>{q.sourceRef}</span> : null}
                    <span title={q.updatedByStaff ?? undefined}>
                      güncellendi {trDate(q.updatedAt, { year: false })}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={QUESTION_STATUS_TONE[q.status]}>{QUESTION_STATUS_LABEL[q.status]}</Pill>
                  {yazabilir ? <StatusSelect id={q.id} status={q.status} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination
        page={Math.min(sayfa, sonSayfa)}
        pages={sonSayfa}
        href={(p) => qs("/checkup/sorular", { konu, durum, ara, sayfa: p > 1 ? p : undefined })}
      />
    </>
  );
}
