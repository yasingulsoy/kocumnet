import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, Plus } from "lucide-react";
import { db } from "@/lib/checkup/db";
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
import {
  Card,
  EmptyState,
  INPUT_CLASS,
  LinkButton,
  MONO,
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
  const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  // Süzgeç ve sıra tek yerde (lib/checkup/question-query.ts): soru ekranındaki
  // önceki/sonraki gezinmesi aynı listeyi izliyor.
  const suzgec = listeSuzgeci(sp);
  const { konu, durum, ara, kazanim, eksik, sayfa } = suzgec;

  const where = listeKosulu(suzgec);

  const [topics, toplam, questions] = await Promise.all([
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
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const suzgecVar = Boolean(konu || durum || ara || eksik || kazanim);
  // Soruyu açıp kaydedince bu süzgece ve sayfaya dönülür.
  const geri = listeSorgusuParams({ ara, konu, durum, eksik, kazanim, sayfa: sayfa > 1 ? String(sayfa) : undefined });

  const kaydedilen = tek(sp.kaydedildi);
  const guncellenen = tek(sp.guncellendi);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Sorular"
        description={trNumber(toplam) + (suzgecVar ? " soru bu süzgeçlere uyuyor." : " soru havuzda.")}
        actions={
          <>
            <LinkButton href="/checkup/sorular/analiz" variant="outline">
              <ChartColumn aria-hidden /> Madde analizi
            </LinkButton>
            {yazabilir ? (
              <LinkButton href={"/checkup/sorular/yeni" + (geri ? "?geri=" + encodeURIComponent(geri) : "")}>
                <Plus aria-hidden /> Yeni soru
              </LinkButton>
            ) : null}
          </>
        }
      />

      {kaydedilen ? (
        <Notice tone="ok" className="mb-4">
          Soru kaydedildi.{" "}
          {kaydedilen !== "1" ? (
            <Link href={soruAdresi(kaydedilen, geri)} className="font-semibold underline underline-offset-2">
              Aç
            </Link>
          ) : null}
        </Notice>
      ) : null}
      {guncellenen ? (
        <Notice tone="ok" className="mb-4">
          Soru güncellendi.{" "}
          {guncellenen !== "1" ? (
            <Link href={soruAdresi(guncellenen, geri)} className="font-semibold underline underline-offset-2">
              Tekrar aç
            </Link>
          ) : null}
        </Notice>
      ) : null}

      <BulkProvider ids={yazabilir ? questions.map((q) => q.id) : []}>
        <Card>
          {/* Süzgeçler — GET formu: seçim adres çubuğunda kalır, paylaşılabilir. */}
          <form method="get" className="flex flex-wrap items-end gap-3 border-b border-line p-5 sm:px-6">
            {kazanim ? <input type="hidden" name="kazanim" value={kazanim} /> : null}
            <label className="min-w-0 flex-1 basis-60">
              <span className="mb-1.5 block text-micro font-medium text-ink-faint">Ara</span>
              <input
                name="ara"
                type="search"
                defaultValue={ara}
                placeholder="Metin, kaynak ya da #kimlik…"
                className={INPUT_CLASS}
              />
            </label>

            <label className="min-w-0 basis-60">
              <span className="mb-1.5 block text-micro font-medium text-ink-faint">Konu</span>
              <select name="konu" defaultValue={konu} className={SELECT_CLASS}>
                <option value="">Tümü</option>
                {topics.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {examLabel(t.examScope)} · {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 basis-40">
              <span className="mb-1.5 block text-micro font-medium text-ink-faint">Durum</span>
              <select name="durum" defaultValue={durum} className={SELECT_CLASS}>
                <option value="">Tümü</option>
                {Object.entries(QUESTION_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 basis-52">
              <span className="mb-1.5 block text-micro font-medium text-ink-faint">Eksik</span>
              <select name="eksik" defaultValue={eksik} className={SELECT_CLASS}>
                <option value="">Hepsi</option>
                {Object.entries(EKSIK).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
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

          {kazanim ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5 text-caption text-ink-soft sm:px-6">
              Kazanım: <code className={MONO + " rounded bg-surface-sunk px-1.5 py-0.5 text-micro text-ink"}>{kazanim}</code>
              <Link
                href={qs("/checkup/sorular", { ara, konu, durum, eksik })}
                className="text-micro font-medium text-brand hover:text-brand-hover"
              >
                kaldır
              </Link>
            </div>
          ) : null}

          {questions.length === 0 ? (
            <EmptyState
              title={suzgecVar ? "Bu süzgeçlere uyan soru yok" : "Havuzda henüz soru yok"}
              description={suzgecVar ? "Süzgeçleri gevşetmeyi dene." : undefined}
              action={
                !suzgecVar && yazabilir ? <LinkButton href="/checkup/sorular/yeni">İlk soruyu ekle</LinkButton> : null
              }
            />
          ) : (
            <>
              {yazabilir ? (
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-sunk px-5 py-2 sm:px-6">
                  <BulkSelectAll />
                  <span className="text-micro text-ink-faint">Seçince toplu durum değiştirme çubuğu açılır.</span>
                </div>
              ) : null}
              <ul className="divide-y divide-line">
                {questions.map((q) => {
                  const ozet = (q.stemText || "metinsiz soru").slice(0, 80);
                  return (
                    <li key={q.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                      {yazabilir ? <BulkCheckbox id={q.id} label={"Seç: " + ozet} /> : null}
                      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2 sm:flex-nowrap">
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <Link
                            href={soruAdresi(q.id, geri)}
                            className="line-clamp-2 text-body font-medium text-ink hover:text-brand"
                          >
                            {q.stemText || "(metinsiz soru)"}
                          </Link>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-faint">
                            <span>
                              {examLabel(q.topic.examScope)} · {q.topic.name}
                            </span>
                            {q.examScopes.length ? (
                              <span className="text-brand-deep">yalnızca {q.examScopes.map(examLabel).join(", ")}</span>
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
                            {q.solution === null ? <span className="text-warn">çözüm yok</span> : null}
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
                          <Pill tone={QUESTION_STATUS_TONE[q.status]}>{QUESTION_STATUS_LABEL[q.status]}</Pill>
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
          page={Math.min(sayfa, sonSayfa)}
          pages={sonSayfa}
          href={(p) => qs("/checkup/sorular", { ara, konu, durum, eksik, kazanim, sayfa: p > 1 ? p : undefined })}
        />
      </BulkProvider>
    </>
  );
}
