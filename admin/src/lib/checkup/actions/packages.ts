"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { isQuestionStatus } from "@/lib/checkup/format";
import { loadPackageHealth } from "@/lib/checkup/pool";
import { paketiKaydet, type PaketKayitSonucu } from "@/lib/checkup/package-save";
import { denemeYayinEngelleri } from "@/lib/checkup/mock";

type Result = { ok: boolean; error?: string };

function revalidatePackageScreens() {
  revalidatePath("/checkup");
  revalidatePath("/checkup/paketler");
  revalidatePath("/checkup/havuz");
}

/**
 * Paketin yayın durumu.
 *
 * Havuzu yetmeyen paket yayına ALINMAZ: öğrenci kataloğda görür, "Başla"ya
 * basar ve "yeterli soru yok" hatası alır — bu, hiç görmemesinden kötü.
 *
 * Denetim paketin TÜRÜNE göre (lib/checkup/pool.ts): katalog paketinde konu
 * dağılımı, konu tekrar testinde kontrol testine yeten konu, seviyeli
 * pakette seviye hazırlığı. Eskiden her pakete konu dağılımı soruluyordu;
 * dağılımı olmayan tekrar testi ve seviyeli paketler bir kez taslağa
 * çekilince panelden bir daha yayına alınamıyordu.
 */
export async function setPackageStatusAction(id: string, status: string): Promise<Result> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || !isQuestionStatus(status)) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const once = await db.package.findUnique({ where: { id }, select: { slug: true, kind: true, status: true } });
  if (!once) return { ok: false, error: "Paket bulunamadı." };

  if (status === "PUBLISHED") {
    if (once.kind === "MOCK") {
      // Deneme: öğrencinin hazırlık kuralı (liste = soru sayısı ve hepsi yayında;
      // shared/deneme.ts), her neden ayrı söylenir. Sınav dışı soru engel değil.
      const engeller = await denemeYayinEngelleri(id);
      if (engeller?.length) return { ok: false, error: "Deneme yayına alınamaz: " + engeller.join(" ") };
    } else {
      const paket = (await loadPackageHealth()).find((p) => p.id === id);
      if (!paket) return { ok: false, error: "Paket bulunamadı." };
      if (paket.state === "blocked") {
        return { ok: false, error: "Yayına alınamaz: " + paket.summary };
      }
    }
  }

  const sonuc = await db.package.updateMany({ where: { id }, data: { status } });
  if (sonuc.count === 0) return { ok: false, error: "Paket bulunamadı." };

  // İz: Package'ta personel damgası sütunu yok; kim, ne, kaç açık ödev etkilendi günlüğe.
  if (once.status !== status) {
    console.info(
      "[checkup] paket durumu " + once.slug + ": " + once.status + " → " + status + (await odevEki(id)) + " · " + staffStamp(auth.staff)
    );
  }
  revalidatePackageScreens();
  return { ok: true };
}

/** Günlük satırının eki: paketi veren açık ödev sayısı (paketler sayfasıyla aynı sayım). */
async function odevEki(packageId: string): Promise<string> {
  const n = await db.assignment.count({
    where: { kind: "PACKAGE", packageId, cancelledAt: null, dueAt: { gt: new Date() }, group: { archivedAt: null } },
  });
  return n ? " (" + n + " açık ödev)" : "";
}

/**
 * Ücretsiz / ücretli. Ücretliye çevrilen pakette erişim hakkı olmayan
 * öğrenci YENİ test başlatamaz; tamamlanmış sonuçları durur.
 */
export async function setPackageFreeAction(id: string, isFree: boolean): Promise<Result> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || typeof isFree !== "boolean") {
    return { ok: false, error: "Geçersiz istek." };
  }

  const once = await db.package.findUnique({ where: { id }, select: { slug: true, isFree: true } });
  if (!once) return { ok: false, error: "Paket bulunamadı." };
  const sonuc = await db.package.updateMany({ where: { id }, data: { isFree } });
  if (sonuc.count === 0) return { ok: false, error: "Paket bulunamadı." };

  if (once.isFree !== isFree) {
    console.info(
      "[checkup] paket ücreti " + once.slug + ": " + (isFree ? "ücretli → ücretsiz" : "ücretsiz → ücretli") + (await odevEki(id)) + " · " + staffStamp(auth.staff)
    );
  }
  revalidatePackageScreens();
  revalidatePath("/checkup/ogrenciler");
  return { ok: true };
}

/**
 * Katalog paketi oluştur / düzenle (yalnızca yönetici ve müdür). Kurallar ve
 * yazma lib/checkup/package-save.ts içinde; burada yetki ve önbellek.
 *
 * Paket ayarları test başlarken oturuma kopyalanır (süre, yanlış götürme;
 * sorular o anda seçilir): düzenleme yalnızca bundan sonra başlayan testleri
 * etkiler. Kim değiştirdi: Package tablosunda personel damgası sütunu yok;
 * sunucu günlüğüne yazılıyor.
 */
export async function savePackageAction(girdi: unknown): Promise<PaketKayitSonucu> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };

  const sonuc = await paketiKaydet(girdi);
  if (sonuc.ok) {
    console.info(
      "[checkup] paket " + (sonuc.yeni ? "oluşturuldu" : "güncellendi") + " — " + sonuc.slug + " · " + staffStamp(auth.staff)
    );
    revalidatePackageScreens();
    revalidatePath("/checkup/paketler/" + sonuc.id);
  }
  return sonuc;
}
