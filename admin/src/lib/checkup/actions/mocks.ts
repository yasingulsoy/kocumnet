"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import {
  benzerSoru,
  denemeIcinAra,
  denemeyiDoldur,
  denemeyiKaydet,
  denemeyiKopyala,
  kimlikListesi,
  type DenemeKayitSonucu,
  type DenemeSorusu,
  type DoldurmaYaniti,
} from "@/lib/checkup/mock";
import { DENEME_SORU_SINIRI } from "@/lib/checkup/mock-rules";

/**
 * Deneme oluşturucu eylemleri. Hepsi MANAGE (yönetici, müdür): deneme bir
 * paket, paket ayarı (süre, yanlış götürme, yayın) MANAGE'in işi. Kurallar
 * ve yazma lib/checkup/mock.ts'te; burada yetki, girdi biçimi ve önbellek.
 *
 * Doldur / ara / benzer hiçbir şey YAZMAZ: düzenleyicinin listesine öneri
 * döner, kayıt "Kaydet" ile (ve orada her şey yeniden denetlenir).
 */

const KIMLIK = z.string().regex(/^[a-z0-9]{6,64}$/i);
const SINAV = z.string().max(20);

function tazele(id?: string) {
  revalidatePath("/checkup");
  revalidatePath("/checkup/paketler");
  if (id) revalidatePath("/checkup/paketler/" + id);
  // Soru ekranındaki "şu denemelerde kullanılıyor" uyarısı.
  revalidatePath("/checkup/sorular/[id]", "page");
}

export async function saveMockAction(girdi: unknown): Promise<DenemeKayitSonucu> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const sonuc = await denemeyiKaydet(girdi);
  if (sonuc.ok) {
    // Package tablosunda personel damgası sütunu yok (paket düzenleyiciyle aynı): günlüğe.
    console.info("[checkup] deneme " + (sonuc.yeni ? "oluşturuldu" : "güncellendi") + " — " + sonuc.slug + " · " + staffStamp(auth.staff));
    tazele(sonuc.id);
  }
  return sonuc;
}

const doldurSema = z.object({
  sinav: SINAV,
  soruSayisi: z.number().int().min(DENEME_SORU_SINIRI.min).max(DENEME_SORU_SINIRI.max),
  mevcut: kimlikListesi,
  paketId: KIMLIK.optional(),
});

export async function fillMockAction(girdi: unknown): Promise<({ ok: true } & DoldurmaYaniti) | { ok: false; error: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const p = doldurSema.safeParse(girdi);
  if (!p.success) return { ok: false, error: "Geçersiz istek: soru sayısını ve sınavı kontrol et." };
  return { ok: true, ...(await denemeyiDoldur(p.data)) };
}

const araSema = z.object({
  sinav: SINAV,
  ara: z.string().max(200),
  haric: kimlikListesi,
  hepsi: z.boolean(),
  paketId: KIMLIK.optional(),
});

export async function searchMockQuestionsAction(
  girdi: unknown
): Promise<{ ok: true; sorular: DenemeSorusu[] } | { ok: false; error: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const p = araSema.safeParse(girdi);
  if (!p.success) return { ok: false, error: "Geçersiz istek." };
  return { ok: true, sorular: await denemeIcinAra(p.data) };
}

const benzerSema = z.object({
  sinav: SINAV,
  questionId: KIMLIK,
  haric: kimlikListesi,
  paketId: KIMLIK.optional(),
});

export async function similarMockQuestionAction(
  girdi: unknown
): Promise<{ ok: true; soru: DenemeSorusu | null } | { ok: false; error: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const p = benzerSema.safeParse(girdi);
  if (!p.success) return { ok: false, error: "Geçersiz istek." };
  return { ok: true, soru: await benzerSoru(p.data) };
}

/** Kopya: aynı ayarlar ve liste, taslak. Başlatılmış denemeyi değiştirmenin yolu. */
export async function copyMockAction(id: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const p = KIMLIK.safeParse(id);
  if (!p.success) return { ok: false, error: "Geçersiz istek." };
  const sonuc = await denemeyiKopyala(p.data);
  if (sonuc.ok) {
    console.info("[checkup] deneme kopyalandı — " + p.data + " → " + sonuc.id + " · " + staffStamp(auth.staff));
    tazele(sonuc.id);
  }
  return sonuc;
}
