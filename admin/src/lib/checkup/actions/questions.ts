"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { EXAM_LABEL, EXAM_SCOPES, isExamScope, isQuestionStatus } from "@/lib/checkup/format";
import { loadItemAnalysis } from "@/lib/checkup/item-analysis";
import { onerilenZorluk } from "@/lib/checkup/item-flags";
import { DONEM_SECENEK } from "@/lib/checkup/item-list";
import { listeAdresi, listeSorgusu, soruAdresi } from "@/lib/checkup/question-list";
import { konuSinavdaMi } from "@/lib/checkup/shared/exam-scope";
import { ERROR_TYPES } from "@/lib/checkup/shared/error-types";
import { markupToContent } from "@/lib/checkup/shared/question-markup";
import {
  deriveQuestionFields,
  safeParseQuestionContent,
  validateChoices,
  CHOICE_LABELS,
  type ChoiceDraft,
  type QuestionContent,
} from "@/lib/checkup/shared/question-content";

export interface QuestionFormState {
  error?: string;
  /** Alan bazlı hatalar. */
  fields?: Record<string, string>;
}

const schema = z.object({
  topicId: z.string().min(1, "Konu seçin."),
  stem: z.string().trim().min(5, "Soru metni çok kısa."),
  solution: z.string().trim().optional(),
  difficulty: z.coerce.number().int().min(1).max(5),
  targetTimeSeconds: z.coerce
    .number({ message: "Hedef süre bir sayı olmalı." })
    .int("Hedef süre tam sayı olmalı.")
    .min(10, "Hedef süre en az 10 saniye.")
    .max(600, "Hedef süre en fazla 600 saniye."),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
  sourceRef: z.string().trim().max(200, "Kaynak en fazla 200 karakter.").optional(),
  /** Seviyeli check-up: boş = seviyesiz (yalnızca klasik paketler). */
  level: z.enum(["", "L1_TEMEL", "L2_ORTA", "L3_ANALIZ"]).default(""),
  objectiveId: z.string().default(""),
  correctIndex: z.coerce.number().int().min(0).max(4),
  choices: z.array(z.string().trim()).min(4, "En az 4 şık gerekli.").max(5),
  errorTypes: z.array(z.string().optional()),
  /**
   * Hedef sınav (Question.examScopes). Boş = konusunun geçtiği her sınavda —
   * normal durum. Yalnızca kısıtlama gerekiyorsa dolu (SORU-SABLONU "Hedef Sınav").
   */
  examScopes: z.array(z.enum(EXAM_SCOPES, { message: "Geçersiz sınav." })).max(EXAM_SCOPES.length),
});

type QuestionInput = z.infer<typeof schema>;

/** Formdan gelen ham alanları okur. */
function readForm(formData: FormData) {
  const choices: string[] = [];
  const errorTypes: (string | undefined)[] = [];

  for (let i = 0; i < 5; i++) {
    const value = String(formData.get("choice_" + i) ?? "").trim();
    // Boş bırakılan son şık 4 şıklı soru demek. Aradaki boşluk burada
    // sıkıştırılıyor; o yüzden eylemler önce aradakiBosSik() ile reddediyor.
    if (value) {
      choices.push(value);
      errorTypes.push(String(formData.get("errorType_" + i) ?? "") || undefined);
    }
  }

  return {
    topicId: String(formData.get("topicId") ?? ""),
    stem: String(formData.get("stem") ?? ""),
    solution: String(formData.get("solution") ?? "") || undefined,
    difficulty: formData.get("difficulty"),
    targetTimeSeconds: formData.get("targetTimeSeconds"),
    status: String(formData.get("status") ?? "DRAFT"),
    sourceRef: String(formData.get("sourceRef") ?? "") || undefined,
    level: String(formData.get("level") ?? ""),
    objectiveId: String(formData.get("objectiveId") ?? ""),
    correctIndex: formData.get("correctIndex"),
    choices,
    errorTypes,
    examScopes: [...new Set(formData.getAll("examScopes").map(String))],
  };
}

/**
 * Dolu bir şıktan ÖNCE boş şık var mı (ör. C boş, D ve E dolu)?
 *
 * readForm boş şıkları atıp sıkıştırıyor, `correctIndex` ise formdaki
 * konumu taşıyor. Ara boşluk kabul edilseydi D'nin metni "C" olur ve doğru
 * işaretlenen D yerine E'nin metni doğru sayılırdı: cevap anahtarı SESSİZCE
 * kayardı, validateChoices de yakalamazdı (tek doğru, sıralı etiket).
 */
function aradakiBosSik(formData: FormData): string | null {
  const dolu = Array.from({ length: 5 }, (_, i) => String(formData.get("choice_" + i) ?? "").trim() !== "");
  const sonDolu = dolu.lastIndexOf(true);
  const bos = dolu.findIndex((d, i) => !d && i < sonDolu);
  return bos === -1 ? null : CHOICE_LABELS[bos];
}

function bosSikHatasi(harf: string): QuestionFormState {
  return {
    fields: {
      choices:
        harf + " şıkkı boş ama sonrasında dolu şık var. Boş şık yalnızca sonda olabilir " +
        "(4 şıklı soruda E boş kalır); yoksa etiketler kayar ve doğru cevap başka şıkka geçer.",
    },
  };
}

/** Yazım biçimini bloklara çevirir, şıkları kurar ve tüm kuralları uygular. */
function buildQuestion(input: QuestionInput) {
  const stemContent = markupToContent(input.stem);
  const stemParsed = safeParseQuestionContent(stemContent);
  if (!stemParsed.success) {
    return { errors: { stem: "Soru metni çözümlenemedi." } as Record<string, string> };
  }

  if (input.correctIndex >= input.choices.length) {
    return { errors: { correctIndex: "Doğru şık, girilen şıklardan biri olmalı." } };
  }

  const drafts: ChoiceDraft[] = input.choices.map((markup, i) => ({
    label: CHOICE_LABELS[i],
    content: markupToContent(markup),
    isCorrect: i === input.correctIndex,
  }));

  const emptyIndex = drafts.findIndex((d) => d.content.blocks.length === 0);
  if (emptyIndex !== -1) {
    return { errors: { choices: CHOICE_LABELS[emptyIndex] + " şıkkı çözümlenemedi." } };
  }

  // Aynı değerli şık, tek doğru şık, etiket sırası (PLAN §3). Aynı değerli iki
  // şık, doğru değeri işaretleyen öğrenciyi yanlış saydırır — ekranda hiçbir
  // şey ters görünmeden.
  const choiceErrors = validateChoices(drafts);
  if (choiceErrors.length) {
    return { errors: { choices: choiceErrors.join(" ") } };
  }

  // Çözüm isteğe bağlı. Girilmişse aynı yazım biçiminden geçiyor; boşsa null
  // kalıyor ve öğrencinin sonuç ekranında "çözüm eklenmemiş" görünüyor.
  let solution: QuestionContent | null = null;
  if (input.solution) {
    const parsed = safeParseQuestionContent(markupToContent(input.solution));
    if (!parsed.success) return { errors: { solution: "Çözüm metni çözümlenemedi." } };
    solution = parsed.data;
  }

  const derived = deriveQuestionFields(stemParsed.data);

  return {
    data: {
      stem: stemParsed.data,
      solution,
      stemText: derived.stemText,
      fingerprint: derived.fingerprint,
      drafts,
      errorTypes: input.errorTypes,
    },
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function choiceRows(drafts: ChoiceDraft[], errorTypes: (string | undefined)[]) {
  return drafts.map((d, i) => ({
    label: d.label,
    content: d.content,
    isCorrect: d.isCorrect,
    // Doğru şıkta hata tipi olmaz — çeldirici değil.
    errorType: d.isCorrect ? null : normalizeErrorType(errorTypes[i]),
    sortOrder: i,
  }));
}

function normalizeErrorType(value: string | undefined) {
  if (!value) return null;
  return (ERROR_TYPES as readonly string[]).includes(value) ? (value as never) : null;
}

function isDuplicate(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * Kazanım seçildiyse konusuyla aynı konuda olmalı: başka konunun kazanımına
 * bağlanan soru seviye 1'de yanlış konunun altında ölçülür. Seviye verildiyse
 * kazanım ZORUNLU (seviye 1 seçimi kazanım üzerinden gider).
 */
async function levelFieldsError(input: { level: string; objectiveId: string; topicId: string }): Promise<Record<string, string> | null> {
  if (input.level && !input.objectiveId) {
    return { objectiveId: "Seviyeli soru için kazanım seç." };
  }
  if (!input.objectiveId) return null;
  const o = await db.objective.findUnique({ where: { id: input.objectiveId }, select: { topicId: true } });
  if (!o) return { objectiveId: "Kazanım bulunamadı." };
  if (o.topicId !== input.topicId) return { objectiveId: "Kazanım, seçilen konuya ait değil." };
  return null;
}

/**
 * Konu ve hedef sınav denetimi.
 *
 * Soru yalnızca yaprak konuya bağlanır: üst konuya bağlanan soru hiçbir
 * pakette seçilemez (seçim tam eşleşme yapıyor). Form zaten yalnızca
 * yaprakları listeliyor; bu denetim elle kurcalanmış isteğe karşı.
 *
 * Hedef sınav konunun sınavlarından biri olmalı: TYT'ye ait bir konuda
 * "yalnızca LGS" işaretli soru hiçbir teste giremez — sessizce ölü kalır.
 */
async function topicFieldsError(topicId: string, examScopes: string[]): Promise<Record<string, string> | null> {
  const t = await db.topic.findUnique({
    where: { id: topicId },
    select: { examScope: true, examScopes: true, _count: { select: { children: true } } },
  });
  if (!t || t._count.children > 0) return { topicId: "Geçersiz konu." };

  // Öğrenci uygulamasıyla aynı kural (shared/exam-scope.ts).
  const disarida = examScopes.filter((s) => !konuSinavdaMi(t, s));
  const konuSinavlari: string[] = t.examScopes.length ? t.examScopes : [t.examScope];
  if (disarida.length) {
    return {
      examScopes:
        disarida.map((s) => EXAM_LABEL[s] ?? s).join(", ") +
        " bu konunun sınavlarından değil (konu: " +
        konuSinavlari.map((s) => EXAM_LABEL[s] ?? s).join(", ") +
        ").",
    };
  }
  return null;
}

function revalidateQuestionScreens() {
  revalidatePath("/checkup");
  revalidatePath("/checkup/kazanimlar");
  revalidatePath("/checkup/havuz");
  revalidatePath("/checkup/sorular");
}

// ─────────────────────────────────────────────────────────────

export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const bosluk = aradakiBosSik(formData);
  if (bosluk) return bosSikHatasi(bosluk);

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  const konuHatasi = await topicFieldsError(parsed.data.topicId, parsed.data.examScopes);
  if (konuHatasi) return { fields: konuHatasi };
  const seviyeHatasi = await levelFieldsError(parsed.data);
  if (seviyeHatasi) return { fields: seviyeHatasi };

  const damga = staffStamp(auth.staff);
  let yeniId: string;
  try {
    const yeni = await db.question.create({
      select: { id: true },
      data: {
        topicId: parsed.data.topicId,
        stem: built.data.stem,
        stemText: built.data.stemText,
        fingerprint: built.data.fingerprint,
        solution: built.data.solution ?? Prisma.DbNull,
        difficulty: parsed.data.difficulty,
        targetTimeSeconds: parsed.data.targetTimeSeconds,
        status: parsed.data.status,
        sourceRef: parsed.data.sourceRef,
        level: parsed.data.level || null,
        objectiveId: parsed.data.objectiveId || null,
        examScopes: parsed.data.examScopes,
        createdByStaff: damga,
        updatedByStaff: damga,
        choices: { create: choiceRows(built.data.drafts, built.data.errorTypes) },
      },
    });
    yeniId = yeni.id;
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu soru zaten kayıtlı (aynı metin). Havuzda arayın." } };
    }
    throw e;
  }

  revalidateQuestionScreens();

  const geri = listeSorgusu(String(formData.get("geri") ?? ""));

  // redirect() try/catch DIŞINDA olmalı: fırlattığı özel hata yakalanırsa
  // yönlendirme hiç gerçekleşmez.
  if (formData.get("sonra") === "yeni") {
    /*
     * "Kaydet ve yenisini ekle": yazar aynı konudan art arda soru giriyor.
     * Sınıflandırma (konu, seviye, kazanım, zorluk, durum, süre) taşınır;
     * metin, şıklar, çözüm ve kaynak boş gelir.
     */
    const u = new URLSearchParams({
      kaydedildi: yeniId,
      konuId: parsed.data.topicId,
      zorluk: String(parsed.data.difficulty),
      durum: parsed.data.status,
      sure: String(parsed.data.targetTimeSeconds),
    });
    if (parsed.data.level) u.set("seviye", parsed.data.level);
    if (parsed.data.objectiveId) u.set("kazanimId", parsed.data.objectiveId);
    if (parsed.data.examScopes.length) u.set("hedef", parsed.data.examScopes.join(","));
    if (geri) u.set("geri", geri);
    redirect("/checkup/sorular/yeni?" + u.toString());
  }
  redirect(listeAdresi(geri, { kaydedildi: yeniId }));
}

export async function updateQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { error: auth.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Soru kimliği eksik." };

  const bosluk = aradakiBosSik(formData);
  if (bosluk) return bosSikHatasi(bosluk);

  const parsed = schema.safeParse(readForm(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const built = buildQuestion(parsed.data);
  if ("errors" in built) return { fields: built.errors };

  const konuHatasi = await topicFieldsError(parsed.data.topicId, parsed.data.examScopes);
  if (konuHatasi) return { fields: konuHatasi };
  const seviyeHatasi = await levelFieldsError(parsed.data);
  if (seviyeHatasi) return { fields: seviyeHatasi };

  const mevcut = await db.question.findUnique({
    where: { id },
    select: {
      version: true,
      choices: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, isCorrect: true, _count: { select: { answers: true } } },
      },
    },
  });
  if (!mevcut) return { error: "Soru bulunamadı." };

  // Cevap anahtarı değiştiyse sürüm artar: bu soruyu çözmüş öğrencilerin
  // sonucu SessionItem.questionVersion üzerinden ayırt edilebilsin (PLAN §4).
  const eskiDogruIndex = mevcut.choices.findIndex((c) => c.isCorrect);
  const anahtarDegisti = eskiDogruIndex !== parsed.data.correctIndex;

  /*
   * Şıklar YERİNDE güncelleniyor, silinip yeniden kurulmuyor.
   *
   * Öğrenci cevabı şıkka yabancı anahtarla bağlı (Answer → Choice,
   * onDelete: Restrict). Eski yöntem (hepsini sil, yeniden oluştur) bir kez
   * bile cevaplanmış soruda veritabanı hatasıyla patlıyordu — yani yayındaki
   * hiçbir soru düzeltilemiyordu. Konumla eşleştirmek (A→A, B→B) cevapları
   * yerinde bırakıyor; cevabın doğru/yanlış bilgisi cevap anında
   * Answer.isCorrect'e yazıldığı için geçmiş sonuçlar değişmiyor.
   */
  const yeniSiklar = choiceRows(built.data.drafts, built.data.errorTypes);
  const korunan = mevcut.choices.slice(0, yeniSiklar.length);
  const silinen = mevcut.choices.slice(yeniSiklar.length);
  const eklenen = yeniSiklar.slice(mevcut.choices.length);

  const cevapliSilinen = silinen.find((c) => c._count.answers > 0);
  if (cevapliSilinen) {
    return {
      fields: {
        choices:
          cevapliSilinen.label +
          " şıkkını öğrenciler işaretlemiş; şık sayısı azaltılamaz. Şıkkı boş bırakmak " +
          "yerine düzeltin ya da soruyu arşivleyip yenisini ekleyin.",
      },
    };
  }

  try {
    await db.$transaction([
      ...korunan.map((c, i) =>
        db.choice.update({
          where: { id: c.id },
          data: {
            label: yeniSiklar[i].label,
            content: yeniSiklar[i].content,
            isCorrect: yeniSiklar[i].isCorrect,
            errorType: yeniSiklar[i].errorType,
            sortOrder: yeniSiklar[i].sortOrder,
          },
        })
      ),
      ...(silinen.length
        ? [db.choice.deleteMany({ where: { id: { in: silinen.map((c) => c.id) } } })]
        : []),
      ...(eklenen.length
        ? [db.choice.createMany({ data: eklenen.map((r) => ({ ...r, questionId: id })) })]
        : []),
      db.question.update({
        where: { id },
        data: {
          topicId: parsed.data.topicId,
          stem: built.data.stem,
          stemText: built.data.stemText,
          fingerprint: built.data.fingerprint,
          solution: built.data.solution ?? Prisma.DbNull,
          difficulty: parsed.data.difficulty,
          targetTimeSeconds: parsed.data.targetTimeSeconds,
          status: parsed.data.status,
          sourceRef: parsed.data.sourceRef ?? null,
          level: parsed.data.level || null,
          objectiveId: parsed.data.objectiveId || null,
          examScopes: parsed.data.examScopes,
          updatedByStaff: staffStamp(auth.staff),
          version: anahtarDegisti ? mevcut.version + 1 : mevcut.version,
        },
      }),
    ]);
  } catch (e) {
    if (isDuplicate(e)) {
      return { fields: { stem: "Bu metinde başka bir soru zaten var." } };
    }
    // Denetim ile işlem arasında bir öğrenci silinecek şıkkı işaretlediyse.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2003") {
      return { error: "Şıklardan biri az önce cevaplandı; sayfayı yenileyip tekrar deneyin." };
    }
    throw e;
  }

  revalidateQuestionScreens();
  revalidatePath("/checkup/sorular/" + id);
  const geri = listeSorgusu(String(formData.get("geri") ?? ""));
  const sonrakiId = String(formData.get("sonrakiId") ?? "");
  // "Kaydet ve sonrakine geç": listedeki sıradaki soru (form açılırken hesaplandı).
  // Kimlik yalnızca adrese girer; soru yoksa sayfa 404 verir, başka yere gidilmez.
  if (formData.get("sonra") === "sonraki" && /^[a-z0-9]{1,64}$/i.test(sonrakiId)) {
    redirect(soruAdresi(sonrakiId, formData.has("geri") ? geri : undefined, { kaydedildi: id }));
  }
  // Listeden gelindiyse aynı süzgece ve sayfaya dönülür (bkz. lib/checkup/question-list.ts).
  redirect(listeAdresi(geri, { guncellendi: id }));
}

/**
 * Listeden hızlı durum değiştirme. Bir soruyu yayına almak için formu açmak
 * gereksiz sürtünme — inceleme akışının en sık işlemi bu.
 */
export async function setQuestionStatusAction(
  id: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || !isQuestionStatus(status)) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const sonuc = await db.question.updateMany({
    where: { id },
    data: { status, updatedByStaff: staffStamp(auth.staff) },
  });
  if (sonuc.count === 0) return { ok: false, error: "Soru bulunamadı." };

  revalidateQuestionScreens();
  return { ok: true };
}

/** Bir istekte en fazla bu kadar soru (liste sayfası 30 soru gösteriyor). */
const TOPLU_SINIR = 100;

/**
 * Toplu durum değiştirme — içe aktarılan 40 soruyu tek tek yayına almak
 * yerine. Yalnızca durumu gerçekten değişen sorulara dokunur (damga ve
 * güncellenme zamanı boşuna oynamasın). İçerik değişmediği için şık
 * doğrulaması gerekmez: sorular kaydedilirken zaten doğrulandı.
 */
export async function setQuestionsStatusAction(
  ids: unknown,
  status: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > TOPLU_SINIR ||
    !ids.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64) ||
    !isQuestionStatus(status)
  ) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const sonuc = await db.question.updateMany({
    where: { id: { in: [...new Set(ids as string[])] }, status: { not: status } },
    data: { status, updatedByStaff: staffStamp(auth.staff) },
  });

  revalidateQuestionScreens();
  return { ok: true, count: sonuc.count };
}

/** Önerilen zorluğu bir istekte en fazla bu kadar soruya uygula. */
const ZORLUK_SINIR = 300;

/**
 * Madde analizinin önerdiği zorluğu uygular (toplu, onaylı).
 *
 * İstemciden gelen kimliklere ve "şuradan şuraya" bilgisine GÜVENİLMEZ:
 * analiz aynı kapsamla (sınav, dönem) sunucuda yeniden hesaplanır; yalnızca
 * gerçekten "zorluk etiketi uymuyor" bulgusu olan sorular, gözlenen doğru
 * oranının karşılığı olan zorluğa çekilir. İçerik değişmediği için şık
 * doğrulaması ve sürüm artışı gerekmez; personel damgası yazılır.
 */
export async function applySuggestedDifficultyAction(
  ids: unknown,
  kapsam: unknown
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const k = (kapsam ?? {}) as { sinav?: unknown; gun?: unknown };
  const sinav = k.sinav === "" || k.sinav === undefined ? "" : isExamScope(k.sinav) ? k.sinav : null;
  const gun = k.gun === null || k.gun === undefined ? null : DONEM_SECENEK.some((d) => d.gun === k.gun) ? (k.gun as number) : NaN;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > ZORLUK_SINIR ||
    !ids.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64) ||
    sinav === null ||
    Number.isNaN(gun)
  ) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const istenen = new Set(ids as string[]);
  const satirlar = await loadItemAnalysis({ sinav, gun });

  // Hedef zorluğa göre grupla: her grup tek güncelleme.
  const gruplar = new Map<number, string[]>();
  for (const r of satirlar) {
    if (!istenen.has(r.questionId) || !r.bulgular.some((b) => b.key === "zorluk")) continue;
    const hedef = onerilenZorluk(r.p);
    if (hedef === r.difficulty) continue;
    gruplar.set(hedef, [...(gruplar.get(hedef) ?? []), r.questionId]);
  }

  const damga = staffStamp(auth.staff);
  let count = 0;
  for (const [zorluk, liste] of gruplar) {
    const sonuc = await db.question.updateMany({
      where: { id: { in: liste }, difficulty: { not: zorluk } },
      data: { difficulty: zorluk, updatedByStaff: damga },
    });
    count += sonuc.count;
  }

  revalidateQuestionScreens();
  revalidatePath("/checkup/sorular/analiz");
  return { ok: true, count };
}
