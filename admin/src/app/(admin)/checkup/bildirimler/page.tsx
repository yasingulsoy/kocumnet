import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Flag } from "lucide-react";
import { db } from "@/lib/checkup/db";
import type { Prisma } from "@/lib/checkup/generated/client";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL, examLabel, trDate, trNumber } from "@/lib/checkup/format";
import { damgaAdi } from "@/lib/checkup/question-note";
import { BILDIRIM_SEBEPLERI, BILDIRIM_SEBEBI, isBildirimSebebi, sebepAdi, sebepRengi } from "@/lib/checkup/student-report";
import { BILDIRIM } from "@/lib/checkup/student-reports";
import { GateNotice } from "@/components/checkup/GateNotice";
import { BildirimDurumDugmesi, BildirimleriCozDugmesi } from "@/components/checkup/StudentReports";
import { QUESTION_STATUS_COLOR, qs } from "@/components/checkup/ui";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

export const metadata: Metadata = { title: "Check-up · Hata bildirimleri" };

const SAYFA_BOYU = 30;
/** Grup başına gösterilen son açıklama. */
const ACIKLAMA_SAYISI = 2;

/**
 * Öğrenci hata bildirimleri (QuestionNote, STUDENT_REPORT). Açıklar soruya
 * göre gruplu (bildirim sayısı, sebep dağılımı, en yeni tarih): içerik ekibi
 * soru düzeltir, bildirimi değil. Çözülenler ayrı sekmede, tek tek.
 *
 * Yetki: okuma herkese, çözme içerik rollerinde (CONTENT; eylem de denetler).
 * Bildirenin kimliği bu sayfada hiç yok — soru ekranında yalnızca MANAGE görür.
 */
export default async function BildirimlerPage({ searchParams }: PageProps<"/checkup/bildirimler">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const cozulen = tek(sp.durum) === "cozulen";
  const sebep = isBildirimSebebi(tek(sp.sebep)) ? (tek(sp.sebep) as (typeof BILDIRIM_SEBEPLERI)[number]) : "";
  const sayfa = Math.max(1, Math.floor(Number(tek(sp.sayfa) || 1)) || 1);

  const temel: Prisma.QuestionNoteWhereInput = { ...BILDIRIM, ...(sebep ? { reason: sebep } : {}) };
  const acikKosul: Prisma.QuestionNoteWhereInput = { ...temel, resolvedAt: null };
  const cozulenKosul: Prisma.QuestionNoteWhereInput = { ...temel, resolvedAt: { not: null } };

  const [acikSayisi, cozulenSayisi, sebepSayilari] = await Promise.all([
    db.questionNote.count({ where: acikKosul }),
    db.questionNote.count({ where: cozulenKosul }),
    // Sebep sekmelerinin sayıları: bulunulan sekmenin durumuna göre, sebep süzgeçsiz.
    db.questionNote.groupBy({
      by: ["reason"],
      where: { ...BILDIRIM, resolvedAt: cozulen ? { not: null } : null },
      _count: { _all: true },
    }),
  ]);
  const sebepSayisi = new Map(sebepSayilari.map((s) => [s.reason, s._count._all]));
  const sebepToplam = sebepSayilari.reduce((t, s) => t + s._count._all, 0);

  const adres = (ek: Record<string, string | number | undefined>) =>
    qs("/checkup/bildirimler", { durum: cozulen ? "cozulen" : undefined, sebep: sebep || undefined, ...ek });

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Hata bildirimleri"
        description={
          trNumber(acikSayisi) +
          " açık bildirim. Öğrencilerin “bu soruda hata var” bildirimleri; çözüldü işaretlenince öğrenci “incelendi” görür."
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <SegmentedTabs
          label="Bildirim durumu"
          items={[
            { key: "acik", href: qs("/checkup/bildirimler", { sebep: sebep || undefined }), label: "Açık", active: !cozulen, count: acikSayisi },
            {
              key: "cozulen",
              href: qs("/checkup/bildirimler", { durum: "cozulen", sebep: sebep || undefined }),
              label: "Çözülen",
              active: cozulen,
              count: cozulenSayisi,
            },
          ]}
        />
        <SegmentedTabs
          label="Sebep süzgeci"
          items={[
            { key: "hepsi", href: qs("/checkup/bildirimler", { durum: cozulen ? "cozulen" : undefined }), label: "Tüm sebepler", active: !sebep, count: sebepToplam },
            ...BILDIRIM_SEBEPLERI.filter((s) => sebepSayisi.get(s) || s === sebep).map((s) => ({
              key: s,
              href: qs("/checkup/bildirimler", { durum: cozulen ? "cozulen" : undefined, sebep: s }),
              label: BILDIRIM_SEBEBI[s],
              active: s === sebep,
              count: sebepSayisi.get(s) ?? 0,
            })),
          ]}
        />
      </div>

      {cozulen ? (
        <CozulenListe kosul={cozulenKosul} toplam={cozulenSayisi} sayfa={sayfa} yazabilir={yazabilir} adres={adres} />
      ) : (
        <AcikGruplar kosul={acikKosul} sayfa={sayfa} yazabilir={yazabilir} adres={adres} />
      )}

      {!yazabilir ? (
        <p className="mt-4 text-theme-xs text-gray-500">Çözüldü işaretlemek yönetici, müdür ve editöre açık.</p>
      ) : null}
    </>
  );
}

/** Açık bildirimler, soruya göre gruplu; en yeni bildirimi olan soru üstte. */
async function AcikGruplar({
  kosul,
  sayfa,
  yazabilir,
  adres,
}: {
  kosul: Prisma.QuestionNoteWhereInput;
  sayfa: number;
  yazabilir: boolean;
  adres: (ek: Record<string, string | number | undefined>) => string;
}) {
  const [gruplar, soruSayisi] = await Promise.all([
    db.questionNote.groupBy({
      by: ["questionId"],
      where: kosul,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: [{ _max: { createdAt: "desc" } }, { questionId: "asc" }],
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
    }),
    db.questionNote.findMany({ where: kosul, distinct: ["questionId"], select: { questionId: true } }).then((r) => r.length),
  ]);
  const ids = gruplar.map((g) => g.questionId);

  const [sebepler, sorular, aciklamalar] = ids.length
    ? await Promise.all([
        db.questionNote.groupBy({ by: ["questionId", "reason"], where: { ...kosul, questionId: { in: ids } }, _count: { _all: true } }),
        db.question.findMany({
          where: { id: { in: ids } },
          select: { id: true, stemText: true, status: true, version: true, topic: { select: { name: true, examScope: true } } },
        }),
        db.questionNote.findMany({
          where: { ...kosul, questionId: { in: ids }, body: { not: "" } },
          orderBy: { createdAt: "desc" },
          take: ids.length * 6,
          select: { questionId: true, body: true },
        }),
      ])
    : [[], [], []];

  const soru = new Map(sorular.map((q) => [q.id, q]));
  const sonAciklama = new Map<string, string[]>();
  for (const a of aciklamalar) {
    const l = sonAciklama.get(a.questionId) ?? [];
    if (l.length < ACIKLAMA_SAYISI) l.push(a.body);
    sonAciklama.set(a.questionId, l);
  }

  if (gruplar.length === 0) {
    return (
      <Card>
        <EmptyState icon={<CircleCheck />} title="Açık bildirim yok" description="Öğrencilerin bildirdiği bütün sorunlar çözülmüş." />
      </Card>
    );
  }

  const sonSayfa = Math.max(1, Math.ceil(soruSayisi / SAYFA_BOYU));
  return (
    <>
      <Card>
        <p className="border-b border-gray-100 px-4 py-3 text-theme-xs text-gray-500 sm:px-6">
          {trNumber(soruSayisi)} soruda açık bildirim · en yeni bildirimi olan üstte
        </p>
        <ul className="divide-y divide-gray-100">
          {gruplar.map((g) => {
            const q = soru.get(g.questionId);
            const dagilim = sebepler
              .filter((s) => s.questionId === g.questionId)
              .sort((a, b) => b._count._all - a._count._all);
            const adet = g._count._all;
            const soruAdresi = "/checkup/sorular/" + encodeURIComponent(g.questionId) + "#bildirimler";
            return (
              <li key={g.questionId} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-64">
                    <Link href={soruAdresi} className="line-clamp-2 text-sm font-medium text-gray-800 hover:text-brand-500">
                      {q?.stemText || "(metinsiz soru)"}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-theme-xs text-gray-500">
                      {q ? (
                        <>
                          <span>
                            {examLabel(q.topic.examScope)} · {q.topic.name}
                          </span>
                          <Badge size="sm" color={QUESTION_STATUS_COLOR[q.status]}>
                            {QUESTION_STATUS_LABEL[q.status]}
                          </Badge>
                          {q.version > 1 ? <span>v{q.version}</span> : null}
                        </>
                      ) : null}
                      <span className="tabular">
                        {adet} bildirim · en yeni {g._max.createdAt ? trDate(g._max.createdAt, { time: true }) : "—"}
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dagilim.map((s) => (
                        <Badge key={String(s.reason)} size="sm" color={sebepRengi(s.reason)}>
                          {sebepAdi(s.reason)}
                          <span className="tabular ms-1 opacity-80">{s._count._all}</span>
                        </Badge>
                      ))}
                    </div>
                    {sonAciklama.get(g.questionId)?.length ? (
                      <ul className="mt-2 space-y-1">
                        {sonAciklama.get(g.questionId)!.map((b, i) => (
                          <li key={i} className="line-clamp-2 border-s-2 border-gray-200 ps-2 text-theme-sm text-gray-600 italic">
                            {b}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ButtonLink href={soruAdresi} variant="outline" size="xs" startIcon={<Flag />}>
                      Soruyu aç
                    </ButtonLink>
                    {yazabilir ? <BildirimleriCozDugmesi questionId={g.questionId} adet={adet} etiket="Çözüldü" /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Pagination currentPage={Math.min(sayfa, sonSayfa)} totalPages={sonSayfa} href={(p) => adres({ sayfa: p > 1 ? p : undefined })} />
    </>
  );
}

/** Çözülen bildirimler, en son çözülen üstte; yeniden açılabilir. */
async function CozulenListe({
  kosul,
  toplam,
  sayfa,
  yazabilir,
  adres,
}: {
  kosul: Prisma.QuestionNoteWhereInput;
  toplam: number;
  sayfa: number;
  yazabilir: boolean;
  adres: (ek: Record<string, string | number | undefined>) => string;
}) {
  const satirlar = await db.questionNote.findMany({
    where: kosul,
    orderBy: [{ resolvedAt: "desc" }, { id: "asc" }],
    skip: (sayfa - 1) * SAYFA_BOYU,
    take: SAYFA_BOYU,
    select: {
      id: true,
      reason: true,
      body: true,
      createdAt: true,
      resolvedAt: true,
      resolvedByStaff: true,
      question: { select: { id: true, stemText: true } },
    },
  });

  if (satirlar.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Flag />} title="Çözülen bildirim yok" />
      </Card>
    );
  }

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  return (
    <>
      <Card>
        <ul className="divide-y divide-gray-100">
          {satirlar.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2 text-theme-xs text-gray-500">
                  <Badge size="sm" color={sebepRengi(b.reason)}>
                    {sebepAdi(b.reason)}
                  </Badge>
                  <span>bildirildi {trDate(b.createdAt, { time: true })}</span>
                  {b.resolvedAt ? (
                    <span title={b.resolvedByStaff ?? undefined}>
                      · çözüldü {trDate(b.resolvedAt, { time: true })} · {damgaAdi(b.resolvedByStaff)}
                    </span>
                  ) : null}
                </div>
                {b.body ? <p className="mt-1.5 line-clamp-3 text-theme-sm text-gray-700">{b.body}</p> : null}
                <Link
                  href={"/checkup/sorular/" + encodeURIComponent(b.question.id) + "#bildirimler"}
                  className="mt-1 line-clamp-1 text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                >
                  {b.question.stemText || "(metinsiz soru)"}
                </Link>
              </div>
              {yazabilir ? <BildirimDurumDugmesi noteId={b.id} cozuldu /> : null}
            </li>
          ))}
        </ul>
      </Card>
      <Pagination currentPage={Math.min(sayfa, sonSayfa)} totalPages={sonSayfa} href={(p) => adres({ sayfa: p > 1 ? p : undefined })} />
    </>
  );
}
