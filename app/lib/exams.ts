/**
 * Sınavlar — tek doğruluk kaynağı.
 *
 * Neden tablo değil de kod: bu bilgiler yılda bir değişir, her satırı bir
 * insanın gözden geçirmesi gerekir ve testlerden erişilebilmelidir. Veritabanına
 * koymak "kim ne zaman değiştirdi" sorusunu zorlaştırır, faydası olmaz.
 *
 * ⚠️ SORU SAYILARI VE YANLIŞ GÖTÜRME ORANLARI ÖSYM/MEB kararıyla yıldan yıla
 * değişebiliyor. Yayına çıkmadan önce Serhat Hoca ile doğrulanmalı; yanlış bir
 * `penaltyRatio` bütün geçmiş netleri sessizce bozar (oturum başında paketten
 * kopyalanıyor, sonradan düzeltmek eski sonuçları düzeltmiyor).
 */

export const EXAM_SCOPES = [
  "LGS",
  "TYT",
  "AYT",
  "KPSS_LISANS",
  "KPSS_ONLISANS",
  "DGS",
  "ALES",
] as const;

export type ExamScopeValue = (typeof EXAM_SCOPES)[number];

/** Eski kayıtlarda geçen ama yeni yazılmayan değer. */
export const LEGACY_EXAM_SCOPE = "BOTH";

export interface ExamInfo {
  scope: ExamScopeValue;
  /** Listelerde ve rozetlerde görünen kısa ad. */
  short: string;
  /** Tam ad — onboarding kartlarında. */
  name: string;
  /** Kime hitap ediyor. */
  audience: string;
  /** Sınavın matematik bölümündeki soru sayısı. */
  mathQuestionCount: number;
  /** Yanlışın doğruyu götürme oranı. 0 = götürmez. */
  penaltyRatio: number;
  /** Boş bırakma konusunda öğrenciye ne söylemeli. */
  blankAdvice: string;
  /** Hedef net kaydırıcısının makul başlangıcı (koçun koyacağı hedef). */
  defaultTargetNet: number;
  /** Bu sınava hazırlanan öğrencinin sınıf seçenekleri. */
  grades: readonly GradeValue[];
  /** Sınav ne zaman yapılır — geri sayım için tarih girilene kadar metin. */
  season: string;
  /**
   * Geri sayım için gerçek tarih. Bilinmiyorsa BOŞ BIRAKILIR: uydurma bir
   * tarihle geri sayım göstermek, hiç göstermemekten kötü.
   * Biçim: "YYYY-MM-DD" (Türkiye saati).
   */
  examDate?: string;
}

export const GRADES = [
  "GRADE_8",
  "GRADE_9",
  "GRADE_10",
  "GRADE_11",
  "GRADE_12",
  "UNIVERSITY",
  "GRADUATE",
] as const;

export type GradeValue = (typeof GRADES)[number];

export const GRADE_LABEL: Record<GradeValue, string> = {
  GRADE_8: "8. sınıf",
  GRADE_9: "9. sınıf",
  GRADE_10: "10. sınıf",
  GRADE_11: "11. sınıf",
  GRADE_12: "12. sınıf",
  UNIVERSITY: "Üniversite öğrencisi",
  GRADUATE: "Mezun",
};

const YKS_GRADES = ["GRADE_9", "GRADE_10", "GRADE_11", "GRADE_12", "GRADUATE"] as const;
const YETISKIN_GRADES = ["UNIVERSITY", "GRADUATE"] as const;

export const EXAMS: Record<ExamScopeValue, ExamInfo> = {
  LGS: {
    scope: "LGS",
    short: "LGS",
    name: "LGS — Liselere Geçiş Sınavı",
    audience: "8. sınıf",
    mathQuestionCount: 20,
    // LGS'de 3 yanlış 1 doğruyu götürür.
    penaltyRatio: 1 / 3,
    blankAdvice: "Hiçbir fikrin yoksa boş bırak — 3 yanlış 1 doğruyu götürüyor.",
    defaultTargetNet: 15,
    grades: ["GRADE_8"],
    season: "Haziran",
  },
  TYT: {
    scope: "TYT",
    short: "TYT",
    name: "TYT — Temel Yeterlilik Testi",
    audience: "YKS adayı",
    mathQuestionCount: 40,
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 25,
    grades: YKS_GRADES,
    season: "Haziran",
  },
  AYT: {
    scope: "AYT",
    short: "AYT",
    name: "AYT — Alan Yeterlilik Testi (Matematik)",
    audience: "Sayısal / Eşit ağırlık",
    mathQuestionCount: 40,
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 20,
    grades: ["GRADE_11", "GRADE_12", "GRADUATE"],
    season: "Haziran",
  },
  KPSS_LISANS: {
    scope: "KPSS_LISANS",
    short: "KPSS",
    name: "KPSS Lisans — Genel Yetenek (Matematik)",
    audience: "Üniversite mezunu / son sınıf",
    mathQuestionCount: 30,
    /*
     * ⚠️ DOĞRULANACAK (Serhat Hoca): ÖSYM'nin klasik "dörtte bir" kuralı mı
     * yürürlükte, yoksa yanlışlar dikkate alınmıyor mu? İkisi arasında
     * seçim yaparken 0.25 alındı, çünkü risk simetrik değil: ceza varken
     * "asla boş bırakma" demek öğrenciye net kaybettirir, tersi kaybettirmez.
     */
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 20,
    grades: YETISKIN_GRADES,
    season: "Temmuz",
  },
  KPSS_ONLISANS: {
    scope: "KPSS_ONLISANS",
    short: "KPSS Ön Lisans",
    name: "KPSS Ön Lisans — Genel Yetenek (Matematik)",
    audience: "Ön lisans mezunu",
    mathQuestionCount: 30,
    /** ⚠️ DOĞRULANACAK — bkz. KPSS_LISANS notu. */
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 18,
    grades: YETISKIN_GRADES,
    season: "Eylül",
  },
  DGS: {
    scope: "DGS",
    short: "DGS",
    name: "DGS — Dikey Geçiş Sınavı (Sayısal)",
    audience: "Ön lisans mezunu / son sınıf",
    mathQuestionCount: 60,
    /** ⚠️ DOĞRULANACAK — bkz. KPSS_LISANS notu. */
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 35,
    grades: YETISKIN_GRADES,
    season: "Temmuz",
  },
  ALES: {
    scope: "ALES",
    short: "ALES",
    name: "ALES — Sayısal Bölüm",
    audience: "Lisans mezunu",
    mathQuestionCount: 50,
    /** ⚠️ DOĞRULANACAK — bkz. KPSS_LISANS notu. */
    penaltyRatio: 0.25,
    blankAdvice: "İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.",
    defaultTargetNet: 30,
    grades: YETISKIN_GRADES,
    season: "Kasım / Nisan",
  },
};

/**
 * Öğrenciye seçtirilen sınavlar. KPSS Ön Lisans şimdilik listede yok:
 * içeriği KPSS Lisans'ın alt kümesi ve ayrı bir paket seti gerektiriyor.
 * Enum değeri duruyor, hazır olunca buraya eklenecek.
 */
export const SECILEBILIR_SINAVLAR: ExamScopeValue[] = [
  "LGS",
  "TYT",
  "AYT",
  "KPSS_LISANS",
  "DGS",
  "ALES",
];

export function isExamScope(value: unknown): value is ExamScopeValue {
  return typeof value === "string" && (EXAM_SCOPES as readonly string[]).includes(value);
}

export function isGrade(value: unknown): value is GradeValue {
  return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}

/** Rozet/metin için güvenli kısa ad — eski BOTH değeri dahil. */
export function examShort(scope: string | null | undefined): string {
  if (isExamScope(scope)) return EXAMS[scope].short;
  if (scope === LEGACY_EXAM_SCOPE) return "TYT + AYT";
  return "—";
}

export function examInfo(scope: string | null | undefined): ExamInfo | null {
  return isExamScope(scope) ? EXAMS[scope] : null;
}

/**
 * Sınava kaç gün kaldı. Tarih tanımlı değilse null döner ve arayüz geri
 * sayımı hiç göstermez — "tahmini geri sayım" güven kaybettirir.
 */
export function daysUntilExam(scope: string | null | undefined, now: Date): number | null {
  const info = examInfo(scope);
  if (!info?.examDate) return null;
  const hedef = new Date(info.examDate + "T00:00:00+03:00").getTime();
  const fark = Math.ceil((hedef - now.getTime()) / 86_400_000);
  return fark >= 0 ? fark : null;
}

/**
 * Bu sınavda yanlışın bedeli var mı? Sonuç ekranı buna göre "net" gösterip
 * göstermeyeceğine karar veriyor: KPSS'de net = doğru sayısı olduğu için
 * yan yana iki aynı sayı yazmak hata gibi görünüyor.
 */
export function hasPenalty(scope: string | null | undefined): boolean {
  const info = examInfo(scope);
  return info ? info.penaltyRatio > 0 : true;
}

/** Sınava uygun sınıf seçenekleri — yoksa hepsi. */
export function gradesForExam(scope: string | null | undefined): readonly GradeValue[] {
  return examInfo(scope)?.grades ?? GRADES;
}
