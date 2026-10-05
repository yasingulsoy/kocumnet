import { Prisma } from "./generated/client";

/**
 * "Bu konu / kazanım / soru şu sınavda sorulabilir mi?"
 *
 * Kuralın TEK tanımı öğrenci uygulamasında: app/lib/exam-scope.ts, panelde
 * kopyası `shared/exam-scope.ts` (`npm run checkup:sync`; CI'daki
 * `checkup:check` kopya eskiyse hata verir). Prisma süzgeçleri oradan gelir:
 *
 *   kendi `examScopes` listesi DOLUYSA o liste karar verir;
 *   BOŞSA konusunun sınavları — Topic.examScopes, o da boşsa Topic.examScope.
 *
 * Bu dosya yalnızca kuralın HAM SQL ikizini taşır: panelin hazırlık sayaçları
 * (Paketler › Seviyeli) toplu sayımı tek sorguda yapıyor, Prisma süzgeci
 * oraya girmiyor. Kural değişirse aşağıdaki iki parça da değişmeli; dev
 * veritabanında karşılaştırma betiği uygulamanın kendi seçim koduyla birebir
 * aynı sayıyı verdiğini gösterdi (rapor, 2. tur).
 */

export {
  kazanimSinavdaKosulu,
  konuSinavdaKosulu,
  konuSinavdaMi,
  soruSinavdaKosulu,
} from "./shared/exam-scope";

// ── Ham SQL parçaları ───────────────────────────────────────────
// Takma adlar yalnızca çağıran koddaki sabitlerdir; kullanıcı girdisi asla
// buraya girmez. Sınav değeri SQL ifadesi olarak verilir (sütun ya da parametre).

/** Konu bu sınavda mı — konuSinavdaKosulu'nun SQL'i. t: Topic takma adı. */
export function sqlKonuSinavda(t: string, sinav: Prisma.Sql): Prisma.Sql {
  const T = Prisma.raw(t);
  return Prisma.sql`(${sinav} = ANY(${T}."examScopes") OR (cardinality(${T}."examScopes") = 0 AND ${T}."examScope" = ${sinav}))`;
}

/**
 * Kazanım ya da soru bu sınavda mı — kazanimSinavdaKosulu / soruSinavdaKosulu'nun
 * SQL'i. x: Objective ya da Question takma adı, t: onun konusu.
 */
export function sqlKendisiYaDaKonusuSinavda(x: string, t: string, sinav: Prisma.Sql): Prisma.Sql {
  const X = Prisma.raw(x);
  return Prisma.sql`(${sinav} = ANY(${X}."examScopes") OR (cardinality(${X}."examScopes") = 0 AND ${sqlKonuSinavda(t, sinav)}))`;
}
