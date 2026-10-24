import "server-only";
import { db } from "../db";
import type { CevapKaydi } from "./cevap";

/**
 * "Hocaya sorular" cevap kayıtları (TeacherAnswer) — okuma. Yetkiyi çağıran
 * denetler (sayfa, genel bakış kutusu, .md dökümü); yazma actions/hoca.ts'te.
 * Soru sayısı 150'yi geçmiyor: hepsi tek sorguda.
 */
export async function hocaCevapKayitlari(): Promise<CevapKaydi[]> {
  return db.teacherAnswer.findMany({
    orderBy: { questionKey: "asc" },
    select: {
      questionKey: true,
      value: true,
      note: true,
      answeredByStaff: true,
      answeredAt: true,
      appliedAt: true,
      appliedByStaff: true,
      appliedNote: true,
    },
  });
}
