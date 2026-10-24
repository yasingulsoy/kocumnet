import "server-only";
import { z } from "zod";
import { db } from "./db";
import { Prisma, type ExamScope } from "./generated/client";
import { EXAMS } from "./shared/exams";
import { konuSinavdaMi, soruSinavdaKosulu } from "./shared/exam-scope";
import { denemeHazirMi, type DenemeListeDurumu } from "./shared/deneme";
import { QUESTION_STATUSES, isExamScope } from "./format";
import { AD_SINIR, OZET_SINIR, SLUG_KALIBI, SLUG_SINIR, SURE_SINIR } from "./package-rules";
import {
  CEZA_SINIRI,
  DENEME_SORU_SINIRI,
  benzerSec,
  dagilimaGoreDoldur,
  denemeHazirlikEngelleri,
  listeDurumu,
  type Aday,
  type DenemeHedefi,
} from "./mock-rules";

/**
 * Deneme (MOCK paket) — okuma, doldurma, kaydetme (sunucu). Yetki denetimi
 * BURADA DEĞİL, çağıran eylemde (actions/mocks.ts, MANAGE: paket ayarı).
 * Kurallar saf modülde (mock-rules.ts).
 *
 * Kapsam: paket ve sabit soru listesi. Öğrenci tarafındaki başlatma,
 * puanlama ve yüzdelik öğrenci uygulamasının işi; oturum başında liste
 * (sortOrder, id) sırasıyla SessionItem'a kopyalanır.
 *
 * Bir kez başlatılmış denemenin soru listesi ve puanlama ayarları (soru
 * sayısı, süre, yanlış götürme) KİLİTLİ: yüzdelik aynı denemeyi çözenleri
 * karşılaştırıyor; liste değişirse iki farklı testin netleri aynı sıralamaya
 * girerdi. Değişiklik gerekiyorsa kopyası açılır (denemeyiKopyala).
 */

/** Düzenleyicide listenin bir satırı. */
export interface DenemeSorusu {
  id: string;
  /** Soru metninin başı (stemText). */
  ozet: string;
  topicId: string;
  konu: string;
  difficulty: number;
  status: string;
  sourceRef: string | null;
  shownCount: number;
  /** Bu deneme dışında kaç denemenin listesinde. */
  digerDeneme: number;
  /**
   * Paketin sınavında sorulabilir mi (shared/exam-scope.ts). Değilse listeye
   * yeni eklenmesini kayıt reddeder; kayıtlı listede kaldıysa uyarıdır.
   */
  sinavda: boolean;
}

const OZET_UZUNLUGU = 160;
const SORU_ALANLARI = {
  id: true,
  stemText: true,
  topicId: true,
  difficulty: true,
  status: true,
  sourceRef: true,
  shownCount: true,
  topic: { select: { name: true } },
} as const;

type SoruSatiri = Prisma.QuestionGetPayload<{ select: typeof SORU_ALANLARI }>;

/** Sorular başka hangi denemelerde: soru kimliği → deneme sayısı (`haricPaket` sayılmaz). */
async function digerDenemeSayilari(soruIdleri: readonly string[] | null, haricPaket?: string): Promise<Map<string, number>> {
  const satirlar = await db.packageQuestion.groupBy({
    by: ["questionId"],
    where: {
      package: { kind: "MOCK" },
      ...(haricPaket ? { packageId: { not: haricPaket } } : {}),
      ...(soruIdleri ? { questionId: { in: [...soruIdleri] } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(satirlar.map((s) => [s.questionId, s._count._all]));
}

/** Bu kimliklerden hangileri sınavda sorulabilir (öğrenci uygulamasının kuralı). */
async function sinavdakiler(soruIdleri: readonly string[], sinav: string): Promise<Set<string>> {
  if (!soruIdleri.length || !isExamScope(sinav)) return new Set();
  const r = await db.question.findMany({
    where: { AND: [{ id: { in: [...soruIdleri] } }, soruSinavdaKosulu(sinav as ExamScope)] },
    select: { id: true },
  });
  return new Set(r.map((q) => q.id));
}

async function satirlariHazirla(sorular: SoruSatiri[], sinav: string, paketId?: string): Promise<DenemeSorusu[]> {
  const idler = sorular.map((q) => q.id);
  const [diger, sinavda] = await Promise.all([digerDenemeSayilari(idler, paketId), sinavdakiler(idler, sinav)]);
  return sorular.map((q) => ({
    id: q.id,
    ozet: q.stemText.length > OZET_UZUNLUGU ? q.stemText.slice(0, OZET_UZUNLUGU) + "…" : q.stemText,
    topicId: q.topicId,
    konu: q.topic.name,
    difficulty: q.difficulty,
    status: q.status,
    sourceRef: q.sourceRef,
    shownCount: q.shownCount,
    digerDeneme: diger.get(q.id) ?? 0,
    sinavda: sinavda.has(q.id),
  }));
}

/** Denemenin listesi, kitapçık sırasıyla (öğrenci uygulamasıyla aynı: sortOrder, id). */
export async function denemeListesi(paketId: string, sinav: string): Promise<DenemeSorusu[]> {
  const baglar = await db.packageQuestion.findMany({
    where: { packageId: paketId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { question: { select: SORU_ALANLARI } },
  });
  return satirlariHazirla(
    baglar.map((b) => b.question),
    sinav,
    paketId
  );
}

/**
 * Sınav başına hedef ağırlıklar: YAPRAK konular (soru yalnızca yaprağa
 * bağlanır) ve Topic.examWeights[sınav] > 0. Üst konunun ağırlığı (ör.
 * "Problemler": 8) alt konularının toplamı; sayılırsa çift sayılırdı.
 */
export async function denemeHedefleri(): Promise<Record<string, DenemeHedefi[]>> {
  const konular = await db.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, examWeights: true },
  });
  const out: Record<string, DenemeHedefi[]> = {};
  for (const k of konular) {
    const w = (k.examWeights ?? {}) as Record<string, unknown>;
    for (const [sinav, deger] of Object.entries(w)) {
      const n = Number(deger);
      if (!isExamScope(sinav) || !Number.isFinite(n) || n <= 0) continue;
      (out[sinav] ??= []).push({ topicId: k.id, ad: k.name, agirlik: n });
    }
  }
  return out;
}

/**
 * Sınav başına ağırlığı OLMAYAN yaprak konular (adları, konu sırasıyla):
 * konusu o sınavda geçen (shared/exam-scope.ts) ama Topic.examWeights[sınav]
 * boş ya da sıfır. "Dağılıma göre doldur" bunlardan soru koymaz; düzenleyici
 * uyarır (mock-rules.ts agirlikUyarilari). Sayıların kendisi hocada.
 */
export async function agirliksizKonular(): Promise<Record<string, string[]>> {
  const konular = await db.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, examScope: true, examScopes: true, examWeights: true },
  });
  const out: Record<string, string[]> = {};
  for (const sinav of Object.values(EXAMS).map((e) => e.scope as string)) {
    out[sinav] = konular
      .filter((k) => konuSinavdaMi(k, sinav))
      .filter((k) => {
        const n = Number(((k.examWeights ?? {}) as Record<string, unknown>)[sinav]);
        return !(Number.isFinite(n) && n > 0);
      })
      .map((k) => k.name);
  }
  return out;
}

/** Konu sırası (müfredat): "Konu sırasına diz" ve dağılım tablosu bununla sıralar. */
export async function konuSirasi(): Promise<Record<string, number>> {
  const konular = await db.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  return Object.fromEntries(konular.map((k, i) => [k.id, i]));
}

// ─────────────────────────────────────────────────────────────
// Aday havuzu, doldurma, benzer, arama
// ─────────────────────────────────────────────────────────────

/** Kimlik listesi girdisi: istemciden geliyor, sınırlı ve biçimli olmalı. */
export const kimlikListesi = z.array(z.string().regex(/^[a-z0-9]{6,64}$/i)).max(DENEME_SORU_SINIRI.max * 3);

/** Konulardaki adaylar: yayında, sınavda sorulabilen, `haric` dışında. */
async function adaylar(sinav: ExamScope, konuIdleri: string[], haric: readonly string[], paketId?: string): Promise<Aday[]> {
  if (!konuIdleri.length) return [];
  const [sorular, diger] = await Promise.all([
    db.question.findMany({
      where: {
        AND: [
          { status: "PUBLISHED", topicId: { in: konuIdleri }, id: { notIn: [...haric] } },
          soruSinavdaKosulu(sinav),
        ],
      },
      select: { id: true, topicId: true, difficulty: true, shownCount: true },
    }),
    digerDenemeSayilari(null, paketId),
  ]);
  return sorular.map((q) => ({ ...q, digerDeneme: diger.get(q.id) ?? 0 }));
}

export interface DoldurmaYaniti {
  eklenen: DenemeSorusu[];
  eksikler: string[];
  notlar: string[];
}

/** "Dağılıma göre doldur" — mevcut listeyi korur, boş yerleri hedefe göre doldurur. */
export async function denemeyiDoldur(g: {
  sinav: string;
  soruSayisi: number;
  mevcut: readonly string[];
  paketId?: string;
}): Promise<DoldurmaYaniti> {
  if (!isExamScope(g.sinav)) return { eklenen: [], eksikler: ["Önce sınavı seç."], notlar: [] };
  const sinav = g.sinav as ExamScope;
  const hedefler = (await denemeHedefleri())[sinav] ?? [];
  const mevcut = g.mevcut.length
    ? await db.question.findMany({ where: { id: { in: [...g.mevcut] } }, select: { id: true, topicId: true, difficulty: true } })
    : [];
  const havuz = await adaylar(
    sinav,
    hedefler.map((h) => h.topicId),
    g.mevcut,
    g.paketId
  );
  const konuya = new Map<string, Aday[]>();
  for (const a of havuz) konuya.set(a.topicId, [...(konuya.get(a.topicId) ?? []), a]);

  const sonuc = dagilimaGoreDoldur({ soruSayisi: g.soruSayisi, mevcut, hedefler, adaylar: konuya });
  if (!sonuc.eklenen.length) return { eklenen: [], eksikler: sonuc.eksikler, notlar: sonuc.notlar };

  const sorular = await db.question.findMany({ where: { id: { in: sonuc.eklenen.map((a) => a.id) } }, select: SORU_ALANLARI });
  const sira = new Map(sonuc.eklenen.map((a, i) => [a.id, i]));
  sorular.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0));
  return { eklenen: await satirlariHazirla(sorular, sinav, g.paketId), eksikler: sonuc.eksikler, notlar: sonuc.notlar };
}

/** "Benzeriyle değiştir": aynı konu, yakın zorluk, listede ve `haric`te olmayan. */
export async function benzerSoru(g: {
  sinav: string;
  questionId: string;
  haric: readonly string[];
  paketId?: string;
}): Promise<DenemeSorusu | null> {
  if (!isExamScope(g.sinav)) return null;
  const kaynak = await db.question.findUnique({ where: { id: g.questionId }, select: { topicId: true, difficulty: true } });
  if (!kaynak) return null;
  const havuz = await adaylar(g.sinav as ExamScope, [kaynak.topicId], [...g.haric, g.questionId], g.paketId);
  const secilen = benzerSec(kaynak, havuz);
  if (!secilen) return null;
  const soru = await db.question.findUnique({ where: { id: secilen.id }, select: SORU_ALANLARI });
  return soru ? (await satirlariHazirla([soru], g.sinav, g.paketId))[0] : null;
}

/** Kimlik araması: "#a1b2c3" ya da tam kimlik (soru listesindeki aramayla aynı). */
const KIMLIK = /^#?([a-z0-9]{6,32})$/i;

/** Elle ekleme: metin, kimlik ya da kaynak. Arşivdekiler hiç gelmez; `hepsi` değilse yalnızca yayındakiler. */
export async function denemeIcinAra(g: {
  sinav: string;
  ara: string;
  haric: readonly string[];
  hepsi: boolean;
  paketId?: string;
}): Promise<DenemeSorusu[]> {
  if (!isExamScope(g.sinav)) return [];
  const ara = g.ara.trim().slice(0, 200);
  const kimlik = KIMLIK.exec(ara)?.[1]?.toLowerCase();
  const sorular = await db.question.findMany({
    where: {
      AND: [
        { id: { notIn: [...g.haric] } },
        g.hepsi ? { status: { not: "ARCHIVED" } } : { status: "PUBLISHED" },
        soruSinavdaKosulu(g.sinav as ExamScope),
        ...(ara
          ? [
              {
                OR: [
                  { stemText: { contains: ara, mode: "insensitive" as const } },
                  { sourceRef: { contains: ara, mode: "insensitive" as const } },
                  ...(kimlik ? [{ id: kimlik }, { id: { endsWith: kimlik } }] : []),
                ],
              },
            ]
          : []),
      ],
    },
    // Az gösterilmiş önce: yıpranmamış soru denemeye daha uygun.
    orderBy: [{ shownCount: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: 20,
    select: SORU_ALANLARI,
  });
  return satirlariHazirla(sorular, g.sinav, g.paketId);
}

// ─────────────────────────────────────────────────────────────
// Yayın kuralı
// ─────────────────────────────────────────────────────────────

/**
 * Denemenin yayın engelleri (veritabanındaki hâliyle): liste = soru sayısı
 * ve hepsi yayında — öğrenci uygulamasının hazırlık kuralı (shared/deneme.ts
 * denemeHazirMi). Boş liste: öğrenci başlatabilir, yayınlanabilir, ödev
 * verilebilir. Sınav dışı soru engel değil (mock-rules.ts denemeUyarilari).
 * Paket deneme değilse null.
 */
export async function denemeYayinEngelleri(paketId: string): Promise<string[] | null> {
  const paket = await db.package.findUnique({ where: { id: paketId }, select: { kind: true, examScope: true, questionCount: true } });
  if (!paket || paket.kind !== "MOCK") return null;
  const liste = await denemeListesi(paketId, paket.examScope);
  return denemeHazirlikEngelleri(listeDurumu(paket.questionCount, liste));
}

/**
 * Birden çok denemenin hazırlığı tek sorguda: paket kimliği → öğrenci şu an
 * başlatabilir mi. Öğrenci uygulamasının katalog sayımının (app/lib/catalog.ts
 * denemeDurumlari) SQL ikizi; karar ortak kuralda (shared/deneme.ts denemeHazirMi).
 */
export async function denemeHazirliklari(paketler: readonly { id: string; questionCount: number }[]): Promise<Map<string, boolean>> {
  if (!paketler.length) return new Map();
  const satirlar = await db.$queryRaw<{ packageId: string; toplam: number; yayinda: number }[]>`
    SELECT pq."packageId",
           count(*)::int AS toplam,
           count(*) FILTER (WHERE q.status = 'PUBLISHED')::int AS yayinda
    FROM "PackageQuestion" pq
    JOIN "Question" q ON q.id = pq."questionId"
    WHERE pq."packageId" IN (${Prisma.join(paketler.map((p) => p.id))})
    GROUP BY pq."packageId"
  `;
  const durum = new Map<string, DenemeListeDurumu>(satirlar.map((s) => [s.packageId, { toplam: Number(s.toplam), yayinda: Number(s.yayinda) }]));
  return new Map(paketler.map((p) => [p.id, denemeHazirMi(durum.get(p.id), p.questionCount)]));
}

/** Kilitli denemedeki soru (aşağıdaki kilitliDenemeler'in koşulu). */
const KILITLI_DENEME_BAGI: Prisma.PackageQuestionWhereInput = {
  package: { kind: "MOCK", status: "PUBLISHED", sessions: { some: {} } },
};

/**
 * Yayından alınamayacak soru: yayında ve kilitli bir denemenin listesinde.
 * Durum eylemleri bunu güncellemenin KOŞULUNA koyar (`NOT`): denetim ile
 * yazma arasında deneme başlatılsa da soru yayından düşmez.
 */
export const KILITLI_DENEME_SORUSU: Prisma.QuestionWhereInput = {
  status: "PUBLISHED",
  packageLinks: { some: KILITLI_DENEME_BAGI },
};

/**
 * Kilitli denemeler: soru kimliği → listesinde bulunduğu, YAYINDAKİ ve en az
 * bir kez başlatılmış (her durumda oturumu olan) denemelerin adları. Böyle bir
 * sorunun durumu yayından alınamaz, konusu ve hedef sınavı değişmez
 * (mock-rules.ts KILITLI_DENEME_MESAJI). Oturum sayımı deneme
 * düzenleyicisinin kilidiyle aynı (Package._count.sessions).
 */
export async function kilitliDenemeler(soruIdleri: readonly string[]): Promise<Map<string, string[]>> {
  if (!soruIdleri.length) return new Map();
  const baglar = await db.packageQuestion.findMany({
    where: { questionId: { in: [...soruIdleri] }, ...KILITLI_DENEME_BAGI },
    orderBy: { package: { name: "asc" } },
    select: { questionId: true, package: { select: { name: true } } },
  });
  const out = new Map<string, string[]>();
  for (const b of baglar) out.set(b.questionId, [...(out.get(b.questionId) ?? []), b.package.name]);
  return out;
}

// ─────────────────────────────────────────────────────────────
// Kaydet
// ─────────────────────────────────────────────────────────────

export interface DenemeGirdisi {
  id?: string;
  /** Yalnızca yeni denemede. */
  slug?: string;
  /** Yalnızca yeni denemede. */
  examScope?: string;
  name: string;
  summary: string;
  questionCount: number | string;
  durationMinutes: number | string;
  /** "0.25" ya da "0,25" — 4 haneye yuvarlanır. */
  penaltyRatio: number | string;
  status: string;
  questionIds: string[];
}

export type DenemeKayitSonucu =
  | { ok: true; id: string; slug: string; yeni: boolean }
  | {
      ok: false;
      error?: string;
      fields?: Record<string, string>;
      /** Yayın reddinin nedenleri, ayrı satırlar. */
      engeller?: string[];
      /** Liste satırı hataları: soru kimliği → neden. */
      sorular?: Record<string, string>;
    };

const sayi = (mesaj: string) =>
  z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".").trim()) : v), z.number({ message: mesaj }));

const sema = z.object({
  id: z.string().min(1).max(64).optional(),
  slug: z.string().trim().toLowerCase().optional(),
  examScope: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(AD_SINIR.min, "Ad en az " + AD_SINIR.min + " karakter.")
    .max(AD_SINIR.max, "Ad en fazla " + AD_SINIR.max + " karakter."),
  summary: z.string().trim().max(OZET_SINIR, "Özet en fazla " + OZET_SINIR + " karakter."),
  questionCount: sayi("Soru sayısı bir sayı olmalı.").pipe(
    z
      .number()
      .int("Soru sayısı tam sayı olmalı.")
      .min(DENEME_SORU_SINIRI.min, "Deneme en az " + DENEME_SORU_SINIRI.min + " soru.")
      .max(DENEME_SORU_SINIRI.max, "Deneme en fazla " + DENEME_SORU_SINIRI.max + " soru.")
  ),
  durationMinutes: sayi("Süre bir sayı olmalı.").pipe(
    z
      .number()
      .int("Süre tam dakika olmalı.")
      .min(SURE_SINIR.min, "Süre en az " + SURE_SINIR.min + " dakika.")
      .max(SURE_SINIR.max, "Süre en fazla " + SURE_SINIR.max + " dakika.")
  ),
  penaltyRatio: sayi("Yanlış götürme oranı bir sayı olmalı (ör. 0,25).").pipe(
    z.number().min(CEZA_SINIRI.min, "Oran 0'dan küçük olamaz.").max(CEZA_SINIRI.max, "Oran 1'den büyük olamaz.")
  ),
  status: z.enum(QUESTION_STATUSES, { message: "Geçersiz durum." }),
  questionIds: kimlikListesi,
});

const kopya = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const cezaYaz = (n: number) => (Math.round(n * 10000) / 10000).toFixed(4);

export async function denemeyiKaydet(girdi: unknown): Promise<DenemeKayitSonucu> {
  const p = sema.safeParse(girdi);
  if (!p.success) {
    const fields: Record<string, string> = {};
    for (const i of p.error.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
    if (fields.questionIds) fields.questionIds = "Soru listesi geçersiz.";
    return { ok: false, fields };
  }
  const v = p.data;
  const idler = [...new Set(v.questionIds)];
  if (idler.length !== v.questionIds.length) return { ok: false, fields: { questionIds: "Bir soru listede iki kez var." } };
  if (idler.length > v.questionCount) {
    return { ok: false, fields: { questionIds: `Listede ${idler.length} soru var; deneme ${v.questionCount} soruluk. Fazlasını çıkar.` } };
  }

  // ── Yeni mi, düzenleme mi ─────────────────────────────────
  let sinav: string;
  let mevcut: {
    id: string;
    slug: string;
    questionCount: number;
    durationMinutes: number;
    penaltyRatio: string;
    oturum: number;
    liste: string[];
  } | null = null;
  if (v.id) {
    const paket = await db.package.findUnique({
      where: { id: v.id },
      select: {
        id: true,
        slug: true,
        kind: true,
        examScope: true,
        questionCount: true,
        durationMinutes: true,
        penaltyRatio: true,
        _count: { select: { sessions: true } },
        questions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { questionId: true } },
      },
    });
    if (!paket) return { ok: false, error: "Deneme bulunamadı." };
    if (paket.kind !== "MOCK") return { ok: false, error: "Bu paket bir deneme değil." };
    sinav = paket.examScope;
    mevcut = {
      id: paket.id,
      slug: paket.slug,
      questionCount: paket.questionCount,
      durationMinutes: paket.durationMinutes,
      penaltyRatio: paket.penaltyRatio.toFixed(4),
      oturum: paket._count.sessions,
      liste: paket.questions.map((q) => q.questionId),
    };
  } else {
    const slug = v.slug ?? "";
    if (slug.length < SLUG_SINIR.min || slug.length > SLUG_SINIR.max || !SLUG_KALIBI.test(slug)) {
      return {
        ok: false,
        fields: { slug: "Adres " + SLUG_SINIR.min + "-" + SLUG_SINIR.max + " karakter; yalnızca küçük harf, rakam ve tire." },
      };
    }
    if (!isExamScope(v.examScope)) return { ok: false, fields: { examScope: "Sınav seç." } };
    sinav = v.examScope;
  }

  // ── Başlatılmış deneme: liste ve puanlama kilitli ─────────────
  if (mevcut && mevcut.oturum > 0) {
    const degisen = [
      idler.join(",") !== mevcut.liste.join(",") ? "soru listesi" : null,
      v.questionCount !== mevcut.questionCount ? "soru sayısı" : null,
      v.durationMinutes !== mevcut.durationMinutes ? "süre" : null,
      cezaYaz(v.penaltyRatio) !== mevcut.penaltyRatio ? "yanlış götürme oranı" : null,
    ].filter(Boolean);
    if (degisen.length) {
      return {
        ok: false,
        error:
          "Bu deneme " +
          mevcut.oturum +
          " kez başlatıldı: " +
          degisen.join(", ") +
          " değiştirilemez (yüzdelik aynı soruları aynı koşulda çözenleri karşılaştırıyor). Değişiklik için kopyasını oluştur.",
      };
    }
  }

  // ── Sorular: var, sınavda sorulabilir ─────────────────────────
  const satirlar = idler.length
    ? await db.question.findMany({ where: { id: { in: idler } }, select: SORU_ALANLARI })
    : [];
  const bulunan = new Set(satirlar.map((s) => s.id));
  const soruHatalari: Record<string, string> = {};
  for (const id of idler) if (!bulunan.has(id)) soruHatalari[id] = "Soru bulunamadı (silinmiş olabilir).";
  const sira = new Map(idler.map((id, i) => [id, i]));
  satirlar.sort((a, b) => (sira.get(a.id) ?? 0) - (sira.get(b.id) ?? 0));
  const liste = await satirlariHazirla(satirlar, sinav, mevcut?.id);
  /*
   * Sınav dışı soru: listeye YENİ eklenemez (kayıt anındaki denetim). Kayıtlı
   * listede olup sonradan sınav dışı kalmış soru ise kaydı engellemez, uyarı
   * olarak görünür (mock-rules.ts denemeUyarilari): öğrenci uygulaması o
   * denemeyi başlatıyor; kilitli denemede de soru çıkarılamıyor, ad ya da
   * yayın durumu değişikliği bu yüzden takılmamalı.
   */
  const kayitli = new Set(mevcut?.liste ?? []);
  for (const q of liste) {
    if (!q.sinavda && !kayitli.has(q.id)) soruHatalari[q.id] = "Bu soru denemenin sınavında sorulamıyor (hedef sınavı başka).";
  }
  if (Object.keys(soruHatalari).length) return { ok: false, sorular: soruHatalari, error: "Listede kaydedilemeyen sorular var (işaretli)." };

  // ── Yayın kuralı: öğrencinin hazırlık kuralı (shared/deneme.ts) ──
  if (v.status === "PUBLISHED") {
    const engeller = denemeHazirlikEngelleri(listeDurumu(v.questionCount, liste));
    if (engeller.length) {
      return {
        ok: false,
        engeller,
        fields: { status: "Deneme yayına alınamaz; nedenleri aşağıda. Taslak olarak kaydedebilirsin." },
      };
    }
  }

  // ── Yaz ───────────────────────────────────────────────────────
  const icerik = {
    name: v.name,
    summary: v.summary || null,
    questionCount: v.questionCount,
    durationMinutes: v.durationMinutes,
    penaltyRatio: cezaYaz(v.penaltyRatio),
    status: v.status,
  };
  const baglar = idler.map((questionId, i) => ({ questionId, sortOrder: i }));

  if (mevcut) {
    const paketId = mevcut.id;
    const listeDegisti = idler.join(",") !== mevcut.liste.join(",");
    await db.$transaction([
      db.package.update({ where: { id: paketId }, data: icerik }),
      // Liste değişmediyse satırlara dokunma (kilitli denemede de böyle).
      ...(listeDegisti
        ? [
            db.packageQuestion.deleteMany({ where: { packageId: paketId } }),
            db.packageQuestion.createMany({ data: baglar.map((b) => ({ ...b, packageId: paketId })) }),
          ]
        : []),
    ]);
    return { ok: true, id: paketId, slug: mevcut.slug, yeni: false };
  }

  const enSon = await db.package.aggregate({ _max: { sortOrder: true } });
  try {
    const yeni = await db.package.create({
      data: {
        slug: v.slug!,
        kind: "MOCK",
        examScope: sinav as ExamScope,
        sortOrder: (enSon._max.sortOrder ?? 0) + 1,
        ...icerik,
        questions: { create: baglar },
      },
      select: { id: true, slug: true },
    });
    return { ok: true, id: yeni.id, slug: yeni.slug, yeni: true };
  } catch (e) {
    if (kopya(e)) return { ok: false, fields: { slug: "Bu adres başka bir pakette kullanılıyor." } };
    throw e;
  }
}

/**
 * Kopyası: aynı ayarlar ve liste, TASLAK. Başlatılmış (kilitli) denemeyi
 * değiştirmenin yolu. Adres "<eski>-kopya", doluysa "-kopya-2"…
 */
export async function denemeyiKopyala(id: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = await db.package.findUnique({
    where: { id },
    select: {
      kind: true,
      slug: true,
      name: true,
      summary: true,
      description: true,
      examScope: true,
      questionCount: true,
      durationMinutes: true,
      penaltyRatio: true,
      isFree: true,
      questions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { questionId: true } },
    },
  });
  if (!p || p.kind !== "MOCK") return { ok: false, error: "Deneme bulunamadı." };

  const kok = (p.slug.replace(/-kopya(-\d+)?$/, "") + "-kopya").slice(0, SLUG_SINIR.max - 3);
  const dolu = new Set(
    (await db.package.findMany({ where: { slug: { startsWith: kok } }, select: { slug: true } })).map((x) => x.slug)
  );
  let slug = kok;
  for (let n = 2; dolu.has(slug); n++) slug = kok + "-" + n;

  const enSon = await db.package.aggregate({ _max: { sortOrder: true } });
  const yeni = await db.package.create({
    data: {
      slug,
      kind: "MOCK",
      name: (p.name + " (kopya)").slice(0, AD_SINIR.max),
      summary: p.summary,
      description: p.description,
      examScope: p.examScope,
      questionCount: p.questionCount,
      durationMinutes: p.durationMinutes,
      penaltyRatio: p.penaltyRatio,
      isFree: p.isFree,
      status: "DRAFT",
      sortOrder: (enSon._max.sortOrder ?? 0) + 1,
      questions: { create: p.questions.map((q, i) => ({ questionId: q.questionId, sortOrder: i })) },
    },
    select: { id: true },
  });
  return { ok: true, id: yeni.id };
}

/** Yeni denemenin varsayılanları: sınavın matematik soru sayısı, deneme süresi, yanlış götürme oranı. */
export function sinavVarsayilanlari() {
  return Object.fromEntries(
    Object.values(EXAMS).map((e) => [
      e.scope,
      { soruSayisi: e.mathQuestionCount, sure: e.mockDurationMinutes, ceza: Math.round(e.penaltyRatio * 10000) / 10000 },
    ])
  ) as Record<string, { soruSayisi: number; sure: number; ceza: number }>;
}
