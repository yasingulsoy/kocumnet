/**
 * İçerik alanlarının uzunluk sınırları — SUNUCU/İSTEMCİ ORTAK.
 *
 * Sayılar burada DEĞİL: öğrenci uygulamasının app/lib/content-limits.ts'inde
 * (kopyası shared/content-limits.ts). Toplu içe aktarma (shared/question-import.ts)
 * aynı sabitlerle reddediyor; form ile içe aktarma ayrışmasın diye. Bu dosya
 * yalnızca eski içe aktarma yolunu (`@/lib/checkup/content-limits`) koruyor.
 */
export * from "./shared/content-limits";
