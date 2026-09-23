/**
 * Check-up ekranlarının ortak etiketleri ve biçimlendiricileri.
 * Saf modül: hem sunucu hem istemci bileşenlerinden içe aktarılabilir.
 */

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

export const GRADE_LABEL: Record<string, string> = {
  GRADE_9: "9. sınıf",
  GRADE_10: "10. sınıf",
  GRADE_11: "11. sınıf",
  GRADE_12: "12. sınıf",
  GRADUATE: "Mezun",
};

export const LEVEL_LABEL: Record<string, string> = {
  STRONG: "Güçlü",
  MEDIUM: "Orta",
  WEAK: "Zayıf",
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
