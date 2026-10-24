import { randomInt } from "node:crypto";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Davet bağlantısıyla gruba katılma: /katil/<kod>.
 *
 * Koç panelde grubun davet kodunu üretir (StudyGroup.joinCode); öğrenci
 * bağlantıya dokunup kayıt olurken ya da girişten sonra gruba kendisi girer.
 * Eskiden yalnızca koç ekliyordu: 30 kişilik sınıfta 30 kez ara-bul-ekle.
 *
 * PAYLAŞILABİLİR modül: veritabanı client'ı parametre (`db`), Prisma'dan
 * yalnızca tip alınıyor. Panel bunu admin/scripts/checkup-sync.mjs MODULLER
 * listesine ekleyip kodu AYNI biçimde üretebilir (kodUret) ve doğrulayabilir
 * (kodGecerliMi). Hız sınırı burada DEĞİL, çağıranda (çerez/IP bilgisi ister).
 */

// ─────────────────────────────────────────────────────────────
// Kod biçimi (panel de bunu kullanır)
// ─────────────────────────────────────────────────────────────

/**
 * Koddaki karakterler: büyük harf ve rakam; karışanlar YOK (0/O, 1/I).
 * Koç kodu tahtaya yazabilir, öğrenci elle girebilir. 32 karakter: her biri
 * tam 5 bit, randomInt eşit dağılır.
 */
export const DAVET_KODU_ALFABESI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uzunluk: 32^8 ≈ 10^12 olasılık; hız sınırıyla tahmin edilemez. */
export const DAVET_KODU_UZUNLUGU = 8;

const KOD_KALIBI = new RegExp(`^[${DAVET_KODU_ALFABESI}]{${DAVET_KODU_UZUNLUGU}}$`);

/** Yeni rastgele kod (kriptografik). Benzersizliği veritabanı denetler (joinCode @unique). */
export function kodUret(): string {
  let kod = "";
  for (let i = 0; i < DAVET_KODU_UZUNLUGU; i++) kod += DAVET_KODU_ALFABESI[randomInt(DAVET_KODU_ALFABESI.length)];
  return kod;
}

/**
 * Karşılaştırma biçimi: büyük harf; boşluk ve tire atılır (elle yazarken
 * "abcd-efgh" de olsun). Türkçe büyütme DEĞİL: "i" → "I" (alfabede yok,
 * reddedilir), "İ"ye dönüşmesin.
 */
export function kodNormalize(girdi: unknown): string {
  if (typeof girdi !== "string") return "";
  return girdi.replace(/[\s-]/g, "").toUpperCase().slice(0, 32);
}

/** Biçim uygun mu (normalize edilmiş koda bakar). Veritabanına sormadan ilk eleme. */
export function kodGecerliMi(kod: string): boolean {
  return KOD_KALIBI.test(kod);
}

// ─────────────────────────────────────────────────────────────
// Katılım
// ─────────────────────────────────────────────────────────────

/**
 * Kendi katılan üyenin GroupMember.addedByStaff damgası. Personel damgası
 * "e-posta (#id)" biçiminde; bu sabit ondan ayrılsın diye kelime. Panel
 * "kim ekledi" sütununda bunu "davet bağlantısıyla katıldı" diye okur.
 * TEK sabit: değiştirilirse eski üyelikler eski damgayla kalır.
 */
export const DAVET_DAMGASI = "davet bağlantısı";

type Db = Pick<Prisma.TransactionClient, "studyGroup" | "groupMember">;

export type DavetDurumu =
  | { durum: "GECERSIZ" }
  | { durum: "ACIK"; grupId: string; grupAdi: string; uye: boolean };

/**
 * Kodun grubu: kod biçime uyuyor, grup arşivlenmemiş ve davet açık
 * (joinCode dolu ve bu kod). Kapanmış, yenilenmiş ya da hiç olmamış kod
 * AYNI cevabı alır ("geçersiz"): hangisi olduğunu söylemek kod tahminine
 * ipucu verir. `userId` verilirse üyelik de söylenir.
 */
export async function davetiBul(db: Db, kodGirdisi: unknown, userId?: string | null): Promise<DavetDurumu> {
  const kod = kodNormalize(kodGirdisi);
  if (!kodGecerliMi(kod)) return { durum: "GECERSIZ" };
  const grup = await db.studyGroup.findFirst({
    where: { joinCode: kod, archivedAt: null },
    select: {
      id: true,
      name: true,
      // Kullanıcı yoksa boş kimlik hiçbir üyeye uymaz: tek sorgu, iki durum.
      members: { where: { userId: userId ?? "" }, select: { id: true }, take: 1 },
    },
  });
  if (!grup) return { durum: "GECERSIZ" };
  return { durum: "ACIK", grupId: grup.id, grupAdi: grup.name, uye: grup.members.length > 0 };
}

export type KatilimSonucu =
  | { sonuc: "GECERSIZ" }
  | { sonuc: "KATILDI" | "ZATEN_UYE"; grupId: string; grupAdi: string };

/**
 * Öğrenciyi koddaki gruba ekler. Zaten üyeyse dokunmaz (ZATEN_UYE): koçun
 * eklediği üyenin damgası "davet bağlantısı"na dönmesin. İki sekmeden aynı
 * anda katılma benzersizlik kuralına takılır, ikisi de sorunsuz biter
 * (skipDuplicates).
 */
export async function grubaKatil(db: Db, kodGirdisi: unknown, userId: string): Promise<KatilimSonucu> {
  const davet = await davetiBul(db, kodGirdisi, userId);
  if (davet.durum === "GECERSIZ") return { sonuc: "GECERSIZ" };
  if (davet.uye) return { sonuc: "ZATEN_UYE", grupId: davet.grupId, grupAdi: davet.grupAdi };
  const { count } = await db.groupMember.createMany({
    data: [{ groupId: davet.grupId, userId, addedByStaff: DAVET_DAMGASI }],
    skipDuplicates: true,
  });
  return { sonuc: count > 0 ? "KATILDI" : "ZATEN_UYE", grupId: davet.grupId, grupAdi: davet.grupAdi };
}

// ─────────────────────────────────────────────────────────────
// Hız sınırı ayarları (çağıran uygular: lib/rate-limit.ts)
// ─────────────────────────────────────────────────────────────

/**
 * Yalnızca GEÇERSİZ kod denemeleri sayılır: aynı Wi-Fi'daki 30 öğrencinin
 * doğru bağlantıyı açması sınıra hiç değmez, tahmin denemesi değer.
 * Pencere bir saat. IP sınırı girişsiz ziyaretçi ve kayıt için, kullanıcı
 * sınırı giriş yapmış öğrenci için (okulda tek IP'yi paylaşanlar birbirini
 * kilitlemesin).
 */
export const DAVET_HATA_SINIRI_IP = 20;
export const DAVET_HATA_SINIRI_KULLANICI = 10;
export const DAVET_HATA_PENCERESI_MS = 60 * 60_000;
