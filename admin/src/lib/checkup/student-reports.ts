import "server-only";
import { db } from "./db";
import type { Prisma } from "./generated/client";
import { isBildirimSebebi, type BildirimSebebi } from "./student-report";

/**
 * Öğrenci hata bildirimleri — okuma (sunucu). Yazmayı öğrenci uygulaması
 * yapar; panelde yalnızca çözüldü / yeniden aç (actions/notes.ts).
 *
 * KVKK: bildirenin adı yalnızca `kisisel` (MANAGE rolleri) istendiğinde
 * SORGULANIR. Ötekilerde öğrenci tablosuna hiç gidilmez; sayfaya giden
 * veride ad ya da kimlik bulunmaz ("Bir öğrenci").
 */

export const BILDIRIM: Prisma.QuestionNoteWhereInput = { kind: "STUDENT_REPORT" };

export interface OgrenciBildirimi {
  id: string;
  body: string;
  reason: BildirimSebebi | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByStaff: string | null;
  /** Yalnızca MANAGE için dolu: öğrenci sayfasına bağlantı. */
  bildiren: { id: string; ad: string } | null;
  /** Bildirimin yapıldığı oturumda sorunun sürümü (SessionItem.questionVersion). */
  surum: number | null;
  /** Hangi testten: paket adı ya da "Alıştırma". */
  kaynak: string | null;
}

/** Bir sorunun bildirimleri: açıklar önce, sonra yeniden eskiye. */
export async function soruBildirimleri(questionId: string, kisisel: boolean): Promise<OgrenciBildirimi[]> {
  const satirlar = await db.questionNote.findMany({
    where: { questionId, ...BILDIRIM },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      body: true,
      reason: true,
      createdAt: true,
      resolvedAt: true,
      resolvedByStaff: true,
      sessionId: true,
      reportedById: true,
    },
  });

  const oturumIdleri = [...new Set(satirlar.map((s) => s.sessionId).filter((x): x is string => Boolean(x)))];
  const ogrenciIdleri = kisisel
    ? [...new Set(satirlar.map((s) => s.reportedById).filter((x): x is string => Boolean(x)))]
    : [];

  const [oturumlar, maddeler, ogrenciler] = await Promise.all([
    oturumIdleri.length
      ? db.checkupSession.findMany({
          where: { id: { in: oturumIdleri } },
          select: { id: true, kind: true, package: { select: { name: true } } },
        })
      : Promise.resolve([]),
    oturumIdleri.length
      ? db.sessionItem.findMany({
          where: { questionId, sessionId: { in: oturumIdleri } },
          select: { sessionId: true, questionVersion: true },
        })
      : Promise.resolve([]),
    ogrenciIdleri.length
      ? db.user.findMany({ where: { id: { in: ogrenciIdleri } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const oturum = new Map(oturumlar.map((o) => [o.id, o.kind === "PRACTICE" ? "Alıştırma" : o.package.name]));
  const surum = new Map(maddeler.map((m) => [m.sessionId, m.questionVersion]));
  const ad = new Map(ogrenciler.map((u) => [u.id, u.name]));

  return satirlar
    .map((s) => ({
      id: s.id,
      body: s.body,
      reason: isBildirimSebebi(s.reason) ? s.reason : null,
      createdAt: s.createdAt,
      resolvedAt: s.resolvedAt,
      resolvedByStaff: s.resolvedByStaff,
      bildiren: kisisel && s.reportedById && ad.has(s.reportedById) ? { id: s.reportedById, ad: ad.get(s.reportedById)! } : null,
      surum: s.sessionId ? (surum.get(s.sessionId) ?? null) : null,
      kaynak: s.sessionId ? (oturum.get(s.sessionId) ?? null) : null,
    }))
    .sort((a, b) => Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null));
}

/** Açık bildirim sayısı (genel bakış, menü rozeti). */
export function acikBildirimSayisi(): Promise<number> {
  return db.questionNote.count({ where: { ...BILDIRIM, resolvedAt: null } });
}
