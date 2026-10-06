import "server-only";
import { z } from "zod";
import { db } from "./db";
import { EXAMS } from "./shared/exams";
import { konuSinavdaMi } from "./shared/exam-scope";
import { QUESTION_STATUSES, isExamScope } from "./format";
import {
  AD_SINIR,
  MAX_KONU,
  MAX_PER_TOPIC,
  MIN_PER_TOPIC,
  OZET_SINIR,
  SLUG_KALIBI,
  SLUG_SINIR,
  SURE_SINIR,
} from "./package-rules";
import { paketHavuzu } from "./pool";

/**
 * Katalog paketi oluşturma / düzenleme — doğrulama ve yazma. Yetki denetimi
 * BURADA DEĞİL, çağıran eylemde (actions/packages.ts, yalnızca MANAGE).
 * Ayrı dosya: tohum testinin "panelde düzenlendi" adımı aynı kodu çalıştırsın.
 *
 * Kurallar:
 * - Yalnızca STANDARD paket. Tanışma, seviyeli ve konu tekrar paketleri
 *   sistemindir (tohumdan gelir), burada düzenlenmez.
 * - Konu başına en az MIN_PER_TOPIC soru; konu yaprak ve paketin sınavında.
 * - Yayında kaydetmek için her konunun havuzu yetmeli (öğrenci uygulamasının
 *   seçim kuralıyla, paketHavuzu). Yetmiyorsa taslak olarak kaydedilir.
 * - Adres (slug) yalnızca oluştururken verilir, sonra DEĞİŞMEZ; sınav da öyle
 *   (yanlış götürme oranı ve kapsam ona bağlı).
 * - Ücretli/ücretsiz (isFree) burada YAZILMAZ: açık karar; yeni paket
 *   şemadaki varsayılanı alır.
 */

export interface PaketGirdisi {
  /** Düzenlenen paket; yoksa yeni paket. */
  id?: string;
  /** Yalnızca yeni pakette. */
  slug?: string;
  /** Yalnızca yeni pakette. */
  examScope?: string;
  name: string;
  summary: string;
  durationMinutes: number;
  status: string;
  topics: { topicId: string; questionCount: number }[];
}

export type PaketKayitSonucu =
  | { ok: true; id: string; slug: string; yeni: boolean }
  | {
      ok: false;
      error?: string;
      /** Alan hataları: name, summary, durationMinutes, slug, examScope, status, topics. */
      fields?: Record<string, string>;
      /** Konu satırı hataları (sıra numarasıyla). */
      satirlar?: Record<number, string>;
    };

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
  durationMinutes: z.coerce
    .number({ message: "Süre bir sayı olmalı." })
    .int("Süre tam dakika olmalı.")
    .min(SURE_SINIR.min, "Süre en az " + SURE_SINIR.min + " dakika.")
    .max(SURE_SINIR.max, "Süre en fazla " + SURE_SINIR.max + " dakika."),
  status: z.enum(QUESTION_STATUSES, { message: "Geçersiz durum." }),
  topics: z
    .array(
      z.object({
        topicId: z.string().min(1, "Konu seç.").max(64),
        questionCount: z.coerce
          .number({ message: "Soru sayısı bir sayı olmalı." })
          .int("Soru sayısı tam sayı olmalı.")
          .min(MIN_PER_TOPIC, "Konu başına en az " + MIN_PER_TOPIC + " soru: daha azıyla konu seviyesi ölçülemez.")
          .max(MAX_PER_TOPIC, "Konu başına en fazla " + MAX_PER_TOPIC + " soru."),
      })
    )
    .min(1, "En az bir konu ekle.")
    .max(MAX_KONU, "Bir pakette en fazla " + MAX_KONU + " konu."),
});

const kopya = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function paketiKaydet(girdi: unknown): Promise<PaketKayitSonucu> {
  const p = sema.safeParse(girdi);
  if (!p.success) {
    const fields: Record<string, string> = {};
    const satirlar: Record<number, string> = {};
    for (const i of p.error.issues) {
      const [alan, sira] = i.path;
      if (alan === "topics" && typeof sira === "number") satirlar[sira] ??= i.message;
      else fields[String(alan ?? "form")] ??= i.message;
    }
    return { ok: false, fields, satirlar };
  }
  const v = p.data;

  // ── Paket: yeni mi, düzenleme mi ─────────────────────────────
  let sinav: string;
  let mevcut: { id: string; slug: string } | null = null;
  if (v.id) {
    const paket = await db.package.findUnique({
      where: { id: v.id },
      select: { id: true, slug: true, kind: true, examScope: true },
    });
    if (!paket) return { ok: false, error: "Paket bulunamadı." };
    if (paket.kind !== "STANDARD") {
      return { ok: false, error: "Bu bir sistem paketi (tanışma, seviyeli ya da konu tekrar testi); panelden düzenlenmez." };
    }
    sinav = paket.examScope;
    mevcut = { id: paket.id, slug: paket.slug };
  } else {
    const slug = v.slug ?? "";
    if (slug.length < SLUG_SINIR.min || slug.length > SLUG_SINIR.max || !SLUG_KALIBI.test(slug)) {
      return {
        ok: false,
        fields: {
          slug: "Adres " + SLUG_SINIR.min + "-" + SLUG_SINIR.max + " karakter; yalnızca küçük harf, rakam ve tire.",
        },
      };
    }
    if (!isExamScope(v.examScope)) return { ok: false, fields: { examScope: "Sınav seç." } };
    sinav = v.examScope;
  }

  // ── Konular: tekil, var, yaprak, paketin sınavında ────────────
  const satirlar: Record<number, string> = {};
  const goruldu = new Map<string, number>();
  v.topics.forEach((t, i) => {
    const ilk = goruldu.get(t.topicId);
    if (ilk !== undefined) satirlar[i] = "Bu konu " + (ilk + 1) + ". satırda zaten var.";
    else goruldu.set(t.topicId, i);
  });
  const konular = await db.topic.findMany({
    where: { id: { in: [...goruldu.keys()] } },
    select: { id: true, name: true, examScope: true, examScopes: true, _count: { select: { children: true } } },
  });
  const konu = new Map(konular.map((k) => [k.id, k]));
  v.topics.forEach((t, i) => {
    if (satirlar[i]) return;
    const k = konu.get(t.topicId);
    if (!k) satirlar[i] = "Konu bulunamadı.";
    else if (k._count.children > 0) satirlar[i] = "Soru yalnızca yaprak konuya bağlanır; alt konulardan birini seç.";
    else if (!konuSinavdaMi(k, sinav)) satirlar[i] = "Bu konu paketin sınavında yok.";
  });
  if (Object.keys(satirlar).length) return { ok: false, satirlar };

  // ── Yayında kaydetmek için havuz yetmeli ──────────────────────
  if (v.status === "PUBLISHED") {
    const havuz = (await paketHavuzu())[sinav] ?? {};
    v.topics.forEach((t, i) => {
      const var_ = havuz[t.topicId]?.have ?? 0;
      if (var_ < t.questionCount) {
        satirlar[i] = "Havuz yetmiyor: bu sınavda " + var_ + " yayında soru var, paket " + t.questionCount + " istiyor.";
      }
    });
    if (Object.keys(satirlar).length) {
      return {
        ok: false,
        satirlar,
        fields: { status: "Havuzu yetmeyen konu varken yayına alınamaz. Taslak olarak kaydedebilirsin." },
      };
    }
  }

  // ── Yaz ───────────────────────────────────────────────────────
  const icerik = {
    name: v.name,
    summary: v.summary || null,
    durationMinutes: v.durationMinutes,
    questionCount: v.topics.reduce((t, x) => t + x.questionCount, 0),
    status: v.status,
  };
  const dagilim = v.topics.map((t, i) => ({ topicId: t.topicId, questionCount: t.questionCount, sortOrder: i }));

  if (mevcut) {
    const paketId = mevcut.id;
    await db.$transaction([
      db.package.update({ where: { id: paketId }, data: icerik }),
      db.packageTopic.deleteMany({ where: { packageId: paketId } }),
      db.packageTopic.createMany({ data: dagilim.map((d) => ({ ...d, packageId: paketId })) }),
    ]);
    return { ok: true, id: paketId, slug: mevcut.slug, yeni: false };
  }

  const sira = await db.package.aggregate({ _max: { sortOrder: true } });
  try {
    const yeni = await db.package.create({
      data: {
        slug: v.slug!,
        kind: "STANDARD",
        examScope: sinav as never,
        // Sınav sabiti (shared/exams.ts): tohumdaki paketlerle aynı kaynak.
        penaltyRatio: EXAMS[sinav as keyof typeof EXAMS].penaltyRatio.toFixed(4),
        sortOrder: (sira._max.sortOrder ?? 0) + 1,
        ...icerik,
        topics: { create: dagilim },
      },
      select: { id: true, slug: true },
    });
    return { ok: true, id: yeni.id, slug: yeni.slug, yeni: true };
  } catch (e) {
    if (kopya(e)) return { ok: false, fields: { slug: "Bu adres başka bir pakette kullanılıyor." } };
    throw e;
  }
}
