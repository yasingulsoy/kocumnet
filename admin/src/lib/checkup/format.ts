/**
 * Check-up ekranlarının ortak etiketleri ve biçimlendiricileri.
 * Saf modül: hem sunucu hem istemci bileşenlerinden içe aktarılabilir.
 *
 * ⚠️ Sabitler BURADA durur, bir "use client" bileşen dosyasında DEĞİL: sunucu
 * bileşeni istemci modülünden içe aktardığı nesneyi değil, bir istemci
 * referansını (çağrılamayan bir fonksiyon) görür. `"LGS" in X` her zaman
 * false, `Object.keys(X)` boş döner — hata vermeden. Kazanımlar sayfasının
 * sınav süzgeci ve hazırlık sayacı bu yüzden hiç görünmüyordu.
 */

import { EXAM_SCOPES, GRADE_LABEL as UYGULAMA_SINIF_ADI, isExamScope, type ExamScopeValue } from "./shared/exams";

export const QUESTION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  REVIEW: "İncelemede",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşiv",
};

export const QUESTION_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return typeof value === "string" && (QUESTION_STATUSES as readonly string[]).includes(value);
}

export const SESSION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Devam ediyor",
  SUBMITTED: "Tamamlandı",
  EXPIRED: "Süresi doldu",
  ABANDONED: "Bırakıldı",
};

/*
 * Sınav listesi ve sınıf adları öğrenci uygulamasından (shared/exams.ts —
 * app/lib/exams.ts'in kopyası): yeni bir sınav ya da sınıf eklenince panel
 * ayrıca güncellenmeyi beklemesin.
 */

export { EXAM_SCOPES, isExamScope };
export type ExamScope = ExamScopeValue;

/** Şemadaki Grade enum'ının tamamı, öğrenci uygulamasındaki adlarla. */
export const GRADE_LABEL: Record<string, string> = UYGULAMA_SINIF_ADI;

export function gradeLabel(grade: string | null | undefined): string | null {
  return grade ? (GRADE_LABEL[grade] ?? grade) : null;
}

/**
 * Rozet ve listelerde görünen sınav adı. Ham enum (KPSS_LISANS) ekrana çıkmaz.
 * Uygulamanın kısa adından (EXAMS[x].short) bilerek ayrı: panelde "KPSS" ile
 * "KPSS Ön Lisans" yan yana karışmasın diye "KPSS Lisans". Tür, uygulamadaki
 * sınav listesine bağlı — yeni sınav eklenip burada adı yoksa derleme kırılır.
 */
const SINAV_ADI: Record<ExamScopeValue, string> = {
  LGS: "LGS",
  TYT: "TYT",
  AYT: "AYT",
  KPSS_LISANS: "KPSS Lisans",
  KPSS_ONLISANS: "KPSS Ön Lisans",
  DGS: "DGS",
  ALES: "ALES",
};

export const EXAM_LABEL: Record<string, string> = {
  ...SINAV_ADI,
  // Eski "TYT+AYT" değeri: yeni kayıtlarda yok, eski satırlar okunabilsin.
  BOTH: "TYT + AYT",
};

export function examLabel(scope: string | null | undefined): string {
  return scope ? (EXAM_LABEL[scope] ?? scope) : "—";
}

/** Soru seviyesi (seviyeli check-up). Boş = seviyesiz, yalnızca klasik paketlerde. */
export const QUESTION_LEVEL_LABEL: Record<string, string> = {
  L1_TEMEL: "Seviye 1 — Temel",
  L2_ORTA: "Seviye 2 — Orta",
  L3_ANALIZ: "Seviye 3 — Analiz",
};
export const QUESTION_LEVELS = ["L1_TEMEL", "L2_ORTA", "L3_ANALIZ"] as const;

export const LEVEL_LABEL: Record<string, string> = {
  STRONG: "Güçlü",
  MEDIUM: "Orta",
  WEAK: "Zayıf",
};

export const PACKAGE_KIND_LABEL: Record<string, string> = {
  STANDARD: "Check-up",
  INTRO: "Tanışma",
  RETEST: "Konu tekrar testi",
  LEVEL: "Seviyeli",
};

/** Sunucu UTC'de çalışsa da tarihler Türkiye saatiyle gösterilir. */
const TZ = "Europe/Istanbul";

export function trDate(d: Date, opts: { time?: boolean; year?: boolean } = {}): string {
  return d.toLocaleString("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    ...(opts.year === false ? {} : { year: "numeric" }),
    ...(opts.time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function trNumber(n: number, digits = 0): string {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 0-1 arası oranı "%75" biçiminde yazar (Türkçede yüzde işareti önde). */
export function percent(ratio: number): string {
  return "%" + Math.round(ratio * 100);
}

/** "bugün", "dün", "3 gün önce", "2 ay önce" — Türkiye takvim gününe göre. */
export function relativeDay(d: Date, now: Date): string {
  const gun = (x: Date) => {
    const s = x.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
    return Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  };
  const fark = Math.round((gun(now) - gun(d)) / 86_400_000);
  if (fark <= 0) return "bugün";
  if (fark === 1) return "dün";
  if (fark < 30) return fark + " gün önce";
  if (fark < 365) return Math.round(fark / 30) + " ay önce";
  return Math.round(fark / 365) + " yıl önce";
}

export function durationMinutes(ms: number): string {
  const dk = Math.round(ms / 60_000);
  return dk < 1 ? "1 dk'dan az" : dk + " dk";
}

/** Soru başına süre: "48 sn", "1 dk 12 sn". */
export function secondsLabel(ms: number): string {
  const sn = Math.round(ms / 1000);
  if (sn < 60) return sn + " sn";
  const dk = Math.floor(sn / 60);
  const kalan = sn % 60;
  return kalan ? dk + " dk " + kalan + " sn" : dk + " dk";
}
