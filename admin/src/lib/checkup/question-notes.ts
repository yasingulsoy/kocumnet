import "server-only";
import { db } from "./db";

/**
 * Soru inceleme notları — okuma (sunucu). Yazma actions/notes.ts'te,
 * kurallar question-note.ts'te (saf).
 */

export interface SoruNotu {
  id: string;
  body: string;
  /** "e-posta (#id)" */
  authorStaff: string;
  createdAt: Date;
  /** Boşsa not açık. */
  resolvedAt: Date | null;
  resolvedByStaff: string | null;
}

export const NOT_ALANLARI = {
  id: true,
  body: true,
  authorStaff: true,
  createdAt: true,
  resolvedAt: true,
  resolvedByStaff: true,
} as const;

/** Bir sorunun notları, eskiden yeniye (konuşma sırası). */
export async function soruNotlari(questionId: string): Promise<SoruNotu[]> {
  return db.questionNote.findMany({
    where: { questionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: NOT_ALANLARI,
  });
}
