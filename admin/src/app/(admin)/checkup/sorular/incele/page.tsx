import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardCheck, MessageSquareText } from "lucide-react";
import type { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { EXAM_SCOPES, QUESTION_LEVEL_LABEL, examLabel, isExamScope, trDate } from "@/lib/checkup/format";
import { soruSinavdaKosulu } from "@/lib/checkup/exam-scope";
import { yazanKosulu, yazanlar } from "@/lib/checkup/question-query";
import { damgaAdi } from "@/lib/checkup/question-note";
import { soruNotlari } from "@/lib/checkup/question-notes";
import {
  KENDI_SORUSUNU_ONAYLAYABILIR,
  kendiSorusuMu,
  kuyrukAdresi,
  kuyrukSorgusu,
} from "@/lib/checkup/soru-akisi";
import { HAZIRLIK_ALANLARI, satirHazirligi } from "@/lib/checkup/yayin-kapisi";
import { ERROR_TYPE_LABELS, type ErrorTypeValue } from "@/lib/checkup/shared/error-types";
import { parseHints, safeParseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { eksikOzeti } from "@/lib/checkup/shared/question-readiness";
import { ContentPreview } from "@/components/checkup/ContentPreview";
import { GateNotice } from "@/components/checkup/GateNotice";
import { IncelemeEkrani } from "@/components/checkup/IncelemeEkrani";
import { CozumOnizleme, IpucuOnizleme, VideoBaglantisi } from "@/components/checkup/SolutionPreview";
import { YayinListesi } from "@/components/checkup/YayinListesi";
import { MONO } from "@/components/checkup/ui";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · İnceleme kuyruğu" };

const HARFLER = ["A", "B", "C", "D", "E"];
/** En eski önce: incelemeye ilk giren ilk bakılır. Eşitlikte kimlik (sıra kararlı, imleç çalışsın). */
const SIRA: Prisma.QuestionOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

/** Blok dizisi → yazım biçimi (önizleme bileşenleri yazım biçimi alıyor). Bozuk içerik boş. */
function yazim(icerik: unknown): string {
  const p = icerik == null ? null : safeParseQuestionContent(icerik);
  return p?.success ? contentToMarkup(p.data) : "";
}

/**
 * İnceleme kuyruğu — hoca soruyu öğrencinin göreceği hâliyle, tek sayfada
 * inceler: doğru şık işaretli, her çeldiricinin altında hata tipi, adım adım
 * çözüm, ipuçları, video, künye ve "yayına hazır mı" listesi.
 *
 * Sıra: durumu İncelemede olanlar, en eskiden (createdAt). Süzgeç: sınav,
 * konu, yazan. Onayla (yayına alır, kapı geçerli), Düzeltme iste (not zorunlu,
 * soru Taslağa döner), Atla; her biri sıradakini açar (`?sonra=<kimlik>`:
 * kuyrukta bu sorudan sonraki). `?id=` belli bir soruyu açar (formdan dönüş).
 *
 * Yetki listedeki durum değiştirmeyle aynı: içerik rolleri (roles.ts).
 */
export default async function IncelemePage({ searchParams }: PageProps<"/checkup/sorular/incele">) {
  const gate = await checkStaff(CONTENT_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={CONTENT_ROLES} />;

  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const sinav = isExamScope(tek(sp.sinav)) ? tek(sp.sinav) : "";
  const konu = /^[a-z0-9-]{1,80}$/.test(tek(sp.konu)) ? tek(sp.konu) : "";
  const yazan = /^\d{1,10}$/.test(tek(sp.yazan)) ? tek(sp.yazan) : "";
  const sorgu = kuyrukSorgusu(new URLSearchParams({ ...(sinav && { sinav }), ...(konu && { konu }), ...(yazan && { yazan }) }).toString());
  const istenen = /^[a-z0-9]{1,64}$/i.test(tek(sp.id)) ? tek(sp.id) : "";
  const sonra = /^[a-z0-9]{1,64}$/i.test(tek(sp.sonra)) ? tek(sp.sonra) : "";

  const kosul: Prisma.QuestionWhereInput = {
    AND: [
      { status: "REVIEW" },
      ...(sinav ? [soruSinavdaKosulu(sinav as Parameters<typeof soruSinavdaKosulu>[0])] : []),
      ...(konu ? [{ topic: { slug: konu } }] : []),
      ...(yazan ? [yazanKosulu(yazan)] : []),
    ],
  };
  const sonrasi = (c: { id: string; createdAt: Date }): Prisma.QuestionWhereInput => ({
    OR: [{ createdAt: { gt: c.createdAt } }, { createdAt: c.createdAt, id: { gt: c.id } }],
  });

  const SECIM = {
    id: true,
    videoUrl: true,
    difficulty: true,
    targetTimeSeconds: true,
    sourceRef: true,
    createdAt: true,
    createdByStaff: true,
    updatedAt: true,
    updatedByStaff: true,
    ...HAZIRLIK_ALANLARI,
    topic: { select: { name: true, examScope: true, examScopes: true } },
    objective: { select: { code: true, name: true, status: true } },
  } satisfies Prisma.QuestionSelect;

  /*
   * Gösterilecek soru: `id` kuyruktaysa o; değilse (onaylandı, taslağa döndü)
   * `id` ya da `sonra` imleçtir ve kuyrukta ondan sonraki gelir. İmleç yoksa
   * ya da silinmişse kuyruğun başı.
   */
  let soru = istenen ? await db.question.findFirst({ where: { AND: [kosul, { id: istenen }] }, select: SECIM }) : null;
  const imlecId = soru ? "" : istenen || sonra;
  const imlec = imlecId ? await db.question.findUnique({ where: { id: imlecId }, select: { id: true, createdAt: true } }) : null;
  if (!soru) {
    soru = await db.question.findFirst({
      where: imlec ? { AND: [kosul, sonrasi(imlec)] } : kosul,
      orderBy: SIRA,
      select: SECIM,
    });
  }
  const sonaGeldi = !soru && Boolean(imlec);

  const [toplam, onceki, topics, yazanListesi, notlar] = await Promise.all([
    db.question.count({ where: kosul }),
    soru ? db.question.count({ where: { AND: [kosul, { NOT: sonrasi(soru) }, { NOT: { id: soru.id } }] } }) : 0,
    db.topic.findMany({
      where: { children: { none: {} }, questions: { some: { status: "REVIEW" } } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, examScope: true, _count: { select: { questions: { where: { status: "REVIEW" } } } } },
    }),
    yazanlar(),
    soru ? soruNotlari(soru.id) : Promise.resolve([]),
  ]);

  const benimKimligim = String(gate.staff.id);
  const suzgecVar = Boolean(sinav || konu || yazan);

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/sorular", label: "Sorular" },
        ]}
        pageTitle="İnceleme kuyruğu"
        description={
          toplam === 0
            ? suzgecVar
              ? "Bu süzgeçlerde incelemede soru yok."
              : "İncelemede soru yok."
            : toplam + " soru incelemede" + (soru ? " · şu an " + (onceki + 1) + ". soru (en eskiden)" : "") + "."
        }
        actions={
          <ButtonLink href={"/checkup/sorular?durum=REVIEW"} variant="outline" size="xs">
            Listede gör
          </ButtonLink>
        }
      />

      {/* Süzgeçler — GET formu: seçim adreste kalır. */}
      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4 sm:px-6">
          <Field label="Sınav" className="min-w-0 grow basis-40">
            <Select name="sinav" defaultValue={sinav} compact>
              <option value="">Tümü</option>
              {EXAM_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {examLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Konu" className="min-w-0 grow basis-60">
            <Select name="konu" defaultValue={konu} compact>
              <option value="">Tümü</option>
              {topics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {examLabel(t.examScope)} · {t.name} ({t._count.questions})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Yazan" className="min-w-0 grow basis-52">
            <Select name="yazan" defaultValue={yazan} compact>
              <option value="">Herkes</option>
              {yazanListesi.map((y) => (
                <option key={y.kimlik} value={y.kimlik}>
                  {y.kimlik === benimKimligim ? "Ben" : y.ad}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="xs">
              Süz
            </Button>
            {suzgecVar ? (
              <ButtonLink href="/checkup/sorular/incele" variant="ghost" size="xs">
                Temizle
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Card>

      {!soru ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck />}
            title={sonaGeldi && toplam > 0 ? "Kuyruğun sonuna geldin" : "İncelenecek soru yok"}
            description={
              sonaGeldi && toplam > 0
                ? toplam + " soru hâlâ incelemede (atladıkların). Baştan başlayabilirsin."
                : suzgecVar
                  ? "Bu süzgeçlerde incelemede soru yok; süzgeci gevşet."
                  : "Yazarlar soruyu İncelemede durumuna alınca burada sıraya girer."
            }
            action={
              sonaGeldi && toplam > 0 ? (
                <ButtonLink href={kuyrukAdresi(sorgu)} size="xs">
                  Baştan başla
                </ButtonLink>
              ) : null
            }
          />
        </Card>
      ) : (
        <SoruIncelemesi soru={soru} notlar={notlar} sorgu={sorgu} staffId={gate.staff.id} />
      )}
    </>
  );
}

type Soru = Prisma.QuestionGetPayload<{
  select: {
    id: true;
    videoUrl: true;
    difficulty: true;
    targetTimeSeconds: true;
    sourceRef: true;
    createdAt: true;
    createdByStaff: true;
    updatedAt: true;
    updatedByStaff: true;
    stem: true;
    solution: true;
    hints: true;
    level: true;
    examScopes: true;
    topic: { select: { name: true; examScope: true; examScopes: true } };
    objective: { select: { code: true; name: true; status: true } };
    choices: { select: { content: true; isCorrect: true; errorType: true } };
  };
}>;

function SoruIncelemesi({
  soru,
  notlar,
  sorgu,
  staffId,
}: {
  soru: Soru;
  notlar: Awaited<ReturnType<typeof soruNotlari>>;
  sorgu: string;
  staffId: number;
}) {
  const hazirlik = satirHazirligi(soru);
  const kendi = kendiSorusuMu(soru.createdByStaff, staffId);
  const stem = safeParseQuestionContent(soru.stem);
  const eksikBlok = stem.success && hasUneditableBlocks(stem.data);
  const ipuclari = parseHints(soru.hints).map(contentToMarkup);
  const acikNotlar = notlar.filter((n) => !n.resolvedAt);
  const sinavlar = soru.examScopes.length ? soru.examScopes : soru.topic.examScopes.length ? soru.topic.examScopes : [soru.topic.examScope];

  const kunye: [string, ReactNode][] = [
    ["Konu", examLabel(soru.topic.examScope) + " · " + soru.topic.name],
    ["Sınav", (soru.examScopes.length ? "yalnızca " : "") + sinavlar.map(examLabel).join(", ")],
    [
      "Kazanım",
      soru.objective ? (
        <>
          <span className={MONO}>{soru.objective.code}</span> · {soru.objective.name}
          {soru.objective.status === "ARCHIVED" ? <span className="text-warning-700"> (arşivde)</span> : null}
        </>
      ) : (
        "—"
      ),
    ],
    ["Seviye", soru.level ? QUESTION_LEVEL_LABEL[soru.level] : "seviyesiz"],
    ["Zorluk", soru.difficulty + " / 5"],
    ["Hedef süre", soru.targetTimeSeconds + " sn"],
    ["Kaynak", soru.sourceRef || "—"],
    ["Yazan", damgaAdi(soru.createdByStaff) + " · " + trDate(soru.createdAt)],
  ];
  if (soru.updatedByStaff && soru.updatedAt.getTime() !== soru.createdAt.getTime()) {
    kunye.push(["Son düzenleme", damgaAdi(soru.updatedByStaff) + " · " + trDate(soru.updatedAt, { time: true })]);
  }

  return (
    <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Sol: öğrencinin göreceği ─────────────────────── */}
      <div className="min-w-0 space-y-4 md:space-y-6">
        <ComponentCard title="Soru" desc="Öğrencinin göreceği hâli. Doğru şık yeşil, her çeldiricinin altında hata tipi.">
          {eksikBlok ? (
            <Alert variant="warning" compact>
              Bu soruda tablo ya da altyazılı şekil var; burada tam görünmez. Soru ekranında kontrol et.
            </Alert>
          ) : null}
          <ContentPreview markup={yazim(soru.stem)} placeholder="(soru metni okunamadı)" />
          <ol className="mt-4 space-y-2" aria-label="Şıklar">
            {soru.choices.map((c, i) => {
              const tip = c.errorType ? (ERROR_TYPE_LABELS[c.errorType as ErrorTypeValue] ?? c.errorType) : null;
              return (
                <li
                  key={i}
                  className={cx(
                    "flex items-start gap-3 rounded-xl border-2 px-3 py-2.5",
                    c.isCorrect ? "border-success-500 bg-success-25" : "border-gray-200 bg-white"
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-theme-sm font-bold",
                      c.isCorrect ? "bg-success-600 text-white" : "bg-gray-100 text-gray-600 ring-1 ring-gray-300 ring-inset"
                    )}
                  >
                    {HARFLER[i]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="sr-only">{HARFLER[i]} şıkkı{c.isCorrect ? " (doğru)" : ""}: </span>
                    <ContentPreview markup={yazim(c.content)} compact placeholder="(boş şık)" />
                    {c.isCorrect ? (
                      <p className="mt-1 text-theme-xs font-medium text-success-700">Doğru cevap</p>
                    ) : tip ? (
                      <p className="mt-1 text-theme-xs text-gray-500">Hata tipi: {tip}</p>
                    ) : (
                      <p className="mt-1 text-theme-xs font-medium text-warning-700">Hata tipi seçilmemiş</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </ComponentCard>

        <ComponentCard title="Çözüm" desc="Öğrenci test bitince adım adım açar.">
          <CozumOnizleme markup={yazim(soru.solution)} placeholder="Çözüm yazılmamış." />
          {soru.videoUrl ? <VideoBaglantisi url={soru.videoUrl} /> : null}
        </ComponentCard>

        {ipuclari.length ? (
          <ComponentCard title="İpuçları" desc="Alıştırmada öğrenci takılınca tek tek açılır.">
            <IpucuOnizleme ipuclari={ipuclari} />
          </ComponentCard>
        ) : null}
      </div>

      {/* ── Sağ: karar, denetim listesi, künye ────────────── */}
      <div className="space-y-4 xl:sticky xl:top-24">
        <Card className="space-y-4 p-4 sm:p-5">
          {kendi ? (
            // Şimdilik engel yok (soru-akisi.ts KENDI_SORUSUNU_ONAYLAYABILIR); hocaya sorulacak.
            <Alert variant="info" compact title="Bu soruyu sen yazdın">
              Mümkünse başka biri onaylasın: yazan kendi hatasını görmekte zorlanır.
            </Alert>
          ) : null}
          <IncelemeEkrani
            // Soru değişince not kutusu ve hata sıfırlansın.
            key={soru.id}
            id={soru.id}
            hazir={hazirlik.hazir}
            eksikMetni={hazirlik.hazir ? null : eksikOzeti(hazirlik.eksikler)}
            sonrakiAdres={kuyrukAdresi(sorgu, { sonra: soru.id })}
            duzenleAdres={"/checkup/sorular/" + encodeURIComponent(soru.id) + "?kuyruk=" + encodeURIComponent(sorgu)}
            onayKapaliSebebi={
              kendi && !KENDI_SORUSUNU_ONAYLAYABILIR ? "Kendi yazdığın soruyu onaylayamazsın; başka bir inceleyici onaylamalı." : undefined
            }
          />
          <YayinListesi maddeler={hazirlik.maddeler} />
        </Card>

        <Card className="p-4 sm:p-5">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-theme-sm">
            {kunye.map(([ad, deger]) => (
              <div key={ad} className="contents">
                <dt className="text-gray-500">{ad}</dt>
                <dd className="min-w-0 text-gray-800">{deger}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {acikNotlar.length ? (
          <Card className="p-4 sm:p-5">
            <p className="mb-2 flex items-center gap-2 text-theme-sm font-medium text-gray-800">
              <MessageSquareText aria-hidden className="size-4 text-warning-600" />
              Açık notlar
              <Badge size="sm" color="warning">
                {acikNotlar.length}
              </Badge>
            </p>
            <ul className="space-y-2">
              {acikNotlar.slice(-3).map((n) => (
                <li key={n.id} className="text-theme-xs text-gray-600">
                  <span className="block whitespace-pre-line text-gray-800">{n.body}</span>
                  {damgaAdi(n.authorStaff)} · {trDate(n.createdAt, { time: true })}
                </li>
              ))}
            </ul>
            <Link
              href={"/checkup/sorular/" + encodeURIComponent(soru.id) + "?kuyruk=" + encodeURIComponent(sorgu) + "#notlar"}
              className="mt-2 inline-block text-theme-xs font-medium text-brand-500 hover:text-brand-600"
            >
              Bütün notlar
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
