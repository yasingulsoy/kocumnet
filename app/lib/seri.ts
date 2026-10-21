import { prisma } from "@/lib/db";

/**
 * Seri ve günlük hedef.
 *
 * Gün Türkiye takvim günü (Europe/Istanbul): gece 23:50'de çözülen soru o
 * günün, 00:10'da çözülen ertesi günün. Sunucu UTC'de çalışıyor; gün sınırı
 * UTC'ye göre alınsaydı gece 21:00 ile 24:00 arası çalışan öğrencinin serisi
 * sebepsiz kırılırdı.
 *
 * "Çözülen soru" = her tür oturumda (sınav, kontrol testi, seviyeli aşama,
 * alıştırma) verilen cevap. Sınavda boş kalan (şıksız) satır sayılmaz: süre
 * birleştirme o satırları açıyor ama öğrenci soruyu çözmedi. Alıştırmadaki
 * "Bilmiyorum" sayılır: soru kilitlenir ve çözümü okunur, emek verildi.
 *
 * İki parça bilerek ayrı: seriHesapla saf (scripts/ogrenme-test.mts gün
 * sınırlarını onunla dener), gunlukSayimlar tek sorguyla gün bazında toplar.
 */

/** Seri ve en uzun seri bu kadar günlük pencereden hesaplanır. */
export const SERI_PENCERE_GUN = 90;

/** Profildeki günlük hedef seçenekleri. 0 = hedef yok (yalnızca sayı). */
export const GUNLUK_HEDEF_SECENEKLERI = [0, 5, 10, 20, 40] as const;

const GUN_MS = 86_400_000;
const HAFTA_GUNLERI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const HAFTA_GUNLERI_UZUN = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;

// ─────────────────────────────────────────────────────────────
// Saf hesap
// ─────────────────────────────────────────────────────────────

/** `zaman`ın Türkiye takvim günü: "YYYY-AA-GG". */
export function gunAnahtari(zaman: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(zaman);
}

/** "YYYY-AA-GG" → gün numarası (1970'ten beri). Ardışıklık tamsayı farkıyla bakılır. */
function gunNo(anahtar: string): number {
  const [y, a, g] = anahtar.split("-").map(Number);
  return Math.round(Date.UTC(y, a - 1, g) / GUN_MS);
}

function noAnahtar(no: number): string {
  return new Date(no * GUN_MS).toISOString().slice(0, 10);
}

export interface GunlukSayim {
  /** Türkiye günü, "YYYY-AA-GG". */
  gun: string;
  adet: number;
}

export interface SeriGunu {
  gun: string;
  adet: number;
  bugun: boolean;
  /** "Pzt" … "Paz" */
  kisa: string;
  uzun: string;
}

export interface SeriOzeti {
  /** Bugün çözülen soru. */
  bugunAdet: number;
  /** Günlük hedef; 0 = hedef yok. */
  hedef: number;
  hedefTamam: boolean;
  /**
   * Ardışık çalışılan gün. Bugün henüz soru çözülmediyse dünden geriye
   * sayılır: seri gün bitene kadar kırılmış sayılmaz.
   */
  seri: number;
  bugunCalisti: boolean;
  /** Bugün çözmezse kırılacak bir seri var ("seri bugün de sürsün"). */
  seriBekliyor: boolean;
  /** Pencere içindeki en uzun seri (bugünkü dahil). */
  enUzun: number;
  /** Son 7 gün, eskiden yeniye; sonuncusu bugün. */
  son7: SeriGunu[];
  /** Son 7 günün kaçında çalışıldı. */
  son7Calisilan: number;
}

export function seriHesapla(sayimlar: readonly GunlukSayim[], bugun: string, hedef: number): SeriOzeti {
  const calisilan = new Set(sayimlar.filter((s) => s.adet > 0).map((s) => gunNo(s.gun)));
  const adetler = new Map(sayimlar.map((s) => [gunNo(s.gun), s.adet]));
  const b = gunNo(bugun);
  const bugunAdet = adetler.get(b) ?? 0;
  const bugunCalisti = calisilan.has(b);

  let seri = 0;
  for (let g = bugunCalisti ? b : b - 1; calisilan.has(g); g--) seri++;

  let enUzun = 0;
  let suren = 0;
  let onceki: number | null = null;
  for (const g of [...calisilan].filter((g) => g <= b).sort((x, y) => x - y)) {
    suren = onceki !== null && g === onceki + 1 ? suren + 1 : 1;
    enUzun = Math.max(enUzun, suren);
    onceki = g;
  }

  const son7: SeriGunu[] = [];
  for (let i = 6; i >= 0; i--) {
    const g = b - i;
    // 1970-01-01 perşembeydi: (g + 3) % 7 → 0 = pazartesi.
    const hg = (((g + 3) % 7) + 7) % 7;
    son7.push({
      gun: noAnahtar(g),
      adet: adetler.get(g) ?? 0,
      bugun: i === 0,
      kisa: HAFTA_GUNLERI[hg],
      uzun: HAFTA_GUNLERI_UZUN[hg],
    });
  }

  const h = Math.max(0, Math.floor(hedef));
  return {
    bugunAdet,
    hedef: h,
    hedefTamam: h > 0 && bugunAdet >= h,
    seri,
    bugunCalisti,
    seriBekliyor: !bugunCalisti && seri > 0,
    enUzun: Math.max(enUzun, seri),
    son7,
    son7Calisilan: son7.filter((g) => g.adet > 0).length,
  };
}

// ─────────────────────────────────────────────────────────────
// Veritabanı
// ─────────────────────────────────────────────────────────────

/**
 * Son `gun` Türkiye gününde (bugün dahil) gün başına çözülen soru — tek
 * sorgu, veritabanında toplanır. Cevabın günü ilk işaretleme anıdır
 * (firstAnsweredAt; eski satırlarda answeredAt).
 *
 * Saklanan zaman damgaları UTC (saat dilimsiz): önce UTC olarak yorumlanıp
 * sonra İstanbul saatine çevriliyor; tek `AT TIME ZONE` ters yöne çevirirdi.
 * Pencere başı da metin olarak gidip UTC'ye çevriliyor: bağlantının saat
 * dilimi ne olursa olsun karşılaştırma kaymasın.
 */
export async function gunlukSayimlar(userId: string, now = new Date(), gun = SERI_PENCERE_GUN): Promise<GunlukSayim[]> {
  const bugun = gunNo(gunAnahtari(now));
  // Pencerenin ilk gününün Türkiye gece yarısı (UTC+3; lib/review.ts gunBasi ile aynı varsayım).
  const baslangic = new Date(`${noAnahtar(bugun - (gun - 1))}T00:00:00+03:00`);
  const satirlar = await prisma.$queryRaw<{ gun: string; adet: number }[]>`
    SELECT to_char(
             ((COALESCE(a."firstAnsweredAt", a."answeredAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')::date,
             'YYYY-MM-DD'
           ) AS gun,
           COUNT(*)::int AS adet
    FROM "Answer" a
    JOIN "SessionItem" si ON si.id = a."sessionItemId"
    JOIN "CheckupSession" s ON s.id = si."sessionId"
    WHERE s."userId" = ${userId}
      AND COALESCE(a."firstAnsweredAt", a."answeredAt") >= (${baslangic.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND (a."choiceId" IS NOT NULL OR s.kind = 'PRACTICE')
    GROUP BY 1
  `;
  return satirlar.map((s) => ({ gun: s.gun, adet: Number(s.adet) }));
}

/** Ana sayfa kartı: seri, bugünkü hedef ve son 7 gün. */
export async function seriDurumu(userId: string, now = new Date()): Promise<SeriOzeti> {
  const [sayimlar, user] = await Promise.all([
    gunlukSayimlar(userId, now),
    prisma.user.findUnique({ where: { id: userId }, select: { dailyQuestionGoal: true } }),
  ]);
  return seriHesapla(sayimlar, gunAnahtari(now), user?.dailyQuestionGoal ?? 0);
}
