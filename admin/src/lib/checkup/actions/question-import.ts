"use server";

import { revalidatePath } from "next/cache";
import { CONTENT_ROLES, staffForAction } from "@/lib/checkup/staff";
import { dosyalariOku, hazirla, iceAktar, partiyiGeriAl } from "@/lib/checkup/question-import";
import type { DenetimYaniti, GeriAlYaniti, KayitYaniti } from "@/lib/checkup/import-report";

/**
 * Toplu içe aktarma eylemleri. Üçü de yazma rollerine (CONTENT) açık;
 * görüntüleyici yalnızca geçmişi görür. "Denetle" hiçbir şey yazmaz ama
 * yükleme işliyor (görsel çevirme), içe aktaramayan rol için gereksiz.
 *
 * Gövde sınırı 10 MB (next.config.ts). Aşılırsa Next isteği eylem çalışmadan
 * reddeder; ekran bunu yakalayıp Türkçe sınır mesajını gösteriyor.
 */

function ekranlariTazele() {
  revalidatePath("/checkup");
  revalidatePath("/checkup/sorular");
  revalidatePath("/checkup/sorular/ice-aktar");
  revalidatePath("/checkup/kazanimlar");
  revalidatePath("/checkup/havuz");
}

/** Kuru çalıştırma: dosyayı çözümler ve denetler, hiçbir şey yazmaz. */
export async function denetleAction(fd: FormData): Promise<DenetimYaniti> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, hata: auth.error };

  const okunan = await dosyalariOku(fd);
  if (!okunan.ok) return okunan;
  const h = await hazirla(okunan.y);
  if (!h.ok) return h;
  return { ok: true, rapor: h.h.rapor };
}

/**
 * Geçerli soruları taslak (ya da `yayinla=1` ile yayında) kaydeder. Dosyalar
 * yeniden gönderilir ve baştan denetlenir: denetimden sonra havuz değişmiş
 * olabilir, istemcideki rapora güvenilmez.
 */
export async function kaydetAction(fd: FormData): Promise<KayitYaniti> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, hata: auth.error };

  const okunan = await dosyalariOku(fd);
  if (!okunan.ok) return okunan;
  const h = await hazirla(okunan.y);
  if (!h.ok) return h;

  // Yayına alma, paneldeki durum değiştirmeyle aynı yetki (CONTENT_ROLES).
  const sonuc = await iceAktar(h.h, auth.staff, fd.get("yayinla") === "1");
  if (sonuc.ok) ekranlariTazele();
  return sonuc;
}

/** Komut satırının `--geri-al`'ı: yalnızca hiçbir teste girmemiş sorular silinir. */
export async function geriAlAction(partiId: unknown): Promise<GeriAlYaniti> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, hata: auth.error };
  if (typeof partiId !== "string" || !/^[a-z0-9]{6,64}$/i.test(partiId)) return { ok: false, hata: "Geçersiz istek." };

  const sonuc = await partiyiGeriAl(partiId, auth.staff);
  if (sonuc.ok) ekranlariTazele();
  return sonuc;
}
