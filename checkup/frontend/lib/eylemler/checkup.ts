"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/backend";
import type { HataKodu, TestEkrani } from "@/lib/tipler";

/*
 * Check-up eylemleri: başlatma, cevap kaydetme, bitirme.
 * Her biri jetonla backend'e gider; check-up'ın bu öğrenciye ait olup
 * olmadığını backend denetler (değilse BULUNAMADI). Girdiler burada da
 * sınanır: istemciden gelen her şey güvenilmez.
 * "use server": yalnızca async fonksiyon ihraç edilir.
 */

export type EylemSonucu = { ok: true } | { ok: false; kod: HataKodu; mesaj: string; checkupId?: number };

function pozitifTamsayi(d: unknown): d is number {
  return typeof d === "number" && Number.isSafeInteger(d) && d > 0;
}

const GECERSIZ: EylemSonucu = { ok: false, kod: "DOGRULAMA", mesaj: "Geçersiz istek." };

/**
 * Yeni check-up açar ve test ekranına götürür. Açık bir check-up varsa
 * (ACIK_CHECKUP_VAR) onun kimliğini döndürür: ekran "Devam et" önerir.
 */
export async function checkupBaslat(sinavId: number, turId: number): Promise<EylemSonucu> {
  if (!pozitifTamsayi(sinavId) || !pozitifTamsayi(turId)) return GECERSIZ;

  const sonuc = await api<{ id: number }>("/ogrenci/checkuplar", { method: "POST", govde: { sinavId, turId } });
  if (!sonuc.ok) {
    const { kod, mesaj, ek } = sonuc.hata;
    const acik = ek?.checkupId;
    return { ok: false, kod, mesaj, checkupId: kod === "ACIK_CHECKUP_VAR" && pozitifTamsayi(acik) ? acik : undefined };
  }
  redirect(`/test/${sonuc.veri.id}`);
}

export type TestDurumu =
  | { ok: true; durum: "BITTI" }
  | { ok: true; durum: "DEVAM"; simdi: string; bitisSiniri: string; cevaplar: [number, number | null][] }
  | { ok: false; kod: HataKodu; mesaj: string };

/**
 * Sınav ekranının eşitlemesi: sunucu saati ve kayıtlı cevaplar. Ekran
 * açılınca ve sekmeye uzun aradan sonra dönülünce çağrılır. Tarayıcının
 * geri/ileri tuşu sayfayı istemci önbelleğinden (eski veriyle) geri
 * getirebiliyor; sayaç ve işaretler bununla düzelir. Soru metni gönderilmez.
 */
export async function testDurumu(checkupId: number): Promise<TestDurumu> {
  if (!pozitifTamsayi(checkupId)) return { ok: false, kod: "DOGRULAMA", mesaj: "Geçersiz istek." };

  const sonuc = await api<TestEkrani>(`/ogrenci/checkuplar/${checkupId}`);
  if (!sonuc.ok) return { ok: false, kod: sonuc.hata.kod, mesaj: sonuc.hata.mesaj };
  const v = sonuc.veri;
  if (v.durum !== "DEVAM") return { ok: true, durum: "BITTI" };
  return {
    ok: true,
    durum: "DEVAM",
    simdi: v.simdi,
    bitisSiniri: v.bitisSiniri,
    cevaplar: v.sorular.map((s) => [s.sira, s.secilenSikId]),
  };
}

/** Tek cevabı kaydeder. sikId null: soruyu boş bırakır. */
export async function cevapKaydet(checkupId: number, sira: number, sikId: number | null): Promise<EylemSonucu> {
  if (!pozitifTamsayi(checkupId) || !pozitifTamsayi(sira) || !(sikId === null || pozitifTamsayi(sikId))) return GECERSIZ;

  const sonuc = await api<{ kaydedildi: boolean }>(`/ogrenci/checkuplar/${checkupId}/cevaplar/${sira}`, {
    method: "PUT",
    govde: { sikId },
  });
  if (!sonuc.ok) return { ok: false, kod: sonuc.hata.kod, mesaj: sonuc.hata.mesaj };
  return { ok: true };
}

/**
 * Check-up'ı bitirir ve rapora götürür. Bitirme idempotent; süre dolmuş ya
 * da zaten kapanmışsa da rapor hazırdır.
 */
export async function checkupBitir(checkupId: number): Promise<EylemSonucu> {
  if (!pozitifTamsayi(checkupId)) return GECERSIZ;

  const sonuc = await api<{ id: number; durum: "BITTI" }>(`/ogrenci/checkuplar/${checkupId}/bitir`, { method: "POST" });
  if (!sonuc.ok && sonuc.hata.kod !== "SURE_DOLDU" && sonuc.hata.kod !== "KAPANDI") {
    return { ok: false, kod: sonuc.hata.kod, mesaj: sonuc.hata.mesaj };
  }
  redirect(`/rapor/${checkupId}`);
}
