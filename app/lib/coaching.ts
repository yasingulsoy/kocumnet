import type { TopicBreakdownEntry } from "./scoring";

/**
 * Koçluk mantığı — saf fonksiyonlar, veritabanı bilmez.
 *
 * Ürünün denemeden farkı burası: ölçüm sonucunu "ne yapmalıyım"a çeviren
 * kurallar. Koçun iki süper gücü var ve ikisi de burada kodlanmış:
 *   1. SIRA vermek (dağınık bir listeyi 1-2-3 yapmak),
 *   2. HAYIR demek (bu hafta diğer beş konuya bakma).
 */

/**
 * Bir haftada kaç konu?
 *
 * İki. Üç ancak üçü de küçükse. Bir koçu rapor üretecinden ayıran kural bu:
 * beş zayıf konuyu aynı hafta vermek, öğrencinin hiçbirini bitirememesi
 * demek — ve bitirilmeyen plan, plan olmaktan çıkıp duvar kâğıdı olur.
 */
export const MAX_TOPICS_PER_WEEK = 2;

/** Bir konu için haftalık iş yükü — koçun gerçekten söyleyeceği süreler. */
export const SURE = {
  konuTekrari: 60,
  soruCozumu: 70,
  yanlisAnalizi: 25,
  kontrolTesti: 8,
} as const;

/** Bir konunun haftalık toplam yükü (dakika). */
export const KONU_HAFTALIK_DAKIKA =
  SURE.konuTekrari + SURE.soruCozumu + SURE.yanlisAnalizi + SURE.kontrolTesti;

/** Bir haftada çözülmesi istenen soru sayısı (konu başına). */
export const HAFTALIK_SORU = 40;

/**
 * Konu haritasındaki bir satırın "şimdi çalışılmalı mı" önceliği.
 *
 * Sıralama kuralı (koçun sırası):
 *   1. KANIT: en az 3 soru sorulmuş olmalı. Tek yanlıştan konu çıkarmak,
 *      öğrenciyi boşa bir hafta çalıştırmak demek.
 *   2. Oran: düşükten yükseğe.
 *   3. Eşitlikte SINAV AĞIRLIĞI: iki konu da %20 ise, sınavda 5 soru
 *      getiren konu 1 soru getirenden önce gelir.
 */
export interface OncelikliKonu {
  topicId: string;
  name: string;
  ratio: number;
  asked: number;
  correct: number;
  /** Bu konudan gerçek sınavda ortalama kaç soru çıkıyor (biliniyorsa). */
  examWeight: number | null;
  /** Sınavda bu konudan kaybedilen tahmini soru sayısı. */
  kayip: number | null;
}

export function oncelikSirasi(
  topics: TopicBreakdownEntry[],
  agirliklar: Map<string, number>,
  enFazla = MAX_TOPICS_PER_WEEK
): OncelikliKonu[] {
  return topics
    .filter((t) => t.level === "WEAK" && t.asked >= 3)
    .map((t) => {
      const w = agirliklar.get(t.topicId) ?? null;
      return {
        topicId: t.topicId,
        name: t.name,
        ratio: t.ratio,
        asked: t.asked,
        correct: t.correct,
        examWeight: w,
        // "Bu konu sana sınavda kaç soru kaybettiriyor" — soyut yüzde yerine
        // sınav parasıyla konuşmak koçun dili.
        kayip: w === null ? null : Math.round(w * (1 - t.ratio) * 10) / 10,
      };
    })
    .sort((a, b) => a.ratio - b.ratio || (b.examWeight ?? 0) - (a.examWeight ?? 0))
    .slice(0, enFazla);
}

/**
 * Sonuç ekranının ilk cümlesi. Bant başına ayrı, HER ZAMAN bir sayı içerir
 * ve tek bir eylem söyler. Genel tebrik cümlesi yok: "harikasın" öğrenciye
 * hiçbir şey öğretmiyor, "Köklü Sayılar'da 6/6" öğretiyor.
 */
export interface Karar {
  baslik: string;
  metin: string;
  ton: "ok" | "warn" | "bad";
}

export function karar(
  oran: number,
  oncelikler: OncelikliKonu[],
  guclu: TopicBreakdownEntry[],
  bosSayisi: number,
  toplamSoru: number
): Karar {
  const yuzde = Math.round(oran * 100);
  const ilk = oncelikler[0];
  const ikinci = oncelikler[1];

  if (oran >= 0.75) {
    const enIyi = guclu[0];
    return {
      ton: "ok",
      baslik: `%${yuzde} — konuların çoğu oturmuş.`,
      metin: ilk
        ? `Tek açığın ${ilk.name}: ${ilk.asked} soruda ${ilk.correct} doğru. Sıradaki adımın kapsamı genişletmek değil, bunu kapatmak.`
        : enIyi
          ? `${enIyi.name} konusunda ${enIyi.correct}/${enIyi.asked} yaptın. Bu paket sana yetmiyor; daha zor bir paketle ölç.`
          : "Bu paket seviyeni ölçmeye yetmiyor; daha zor bir paketle devam et.",
    };
  }

  if (oran >= 0.45) {
    const kayipCumlesi =
      ilk?.kayip && ikinci?.kayip
        ? ` Bu ikisi sınavda ortalama ${Math.round(ilk.kayip + ikinci.kayip)} soru demek.`
        : "";
    return {
      ton: "warn",
      baslik: `%${yuzde} — temelin var, iki konu netini aşağı çekiyor.`,
      metin: ilk
        ? `${ilk.name}${ikinci ? ` ve ${ikinci.name}` : ""}.${kayipCumlesi} Bu hafta sadece bunlar; diğer konulara bakma.`
        : "Konu bazında kanıtlı bir zayıflık çıkmadı. Daha uzun bir paketle ölçümü derinleştir.",
    };
  }

  // Düşük bant: suçlayıcı değil, sıralayıcı bir dil. Öğrenci zaten biliyor.
  const bosUyari =
    bosSayisi >= Math.ceil(toplamSoru * 0.3)
      ? ` ${bosSayisi} soruyu boş bıraktın; bu da başlı başına bir konu.`
      : "";
  return {
    ton: "bad",
    baslik: `%${yuzde} — bu bir yetenek meselesi değil, sıralama meselesi.`,
    metin: ilk
      ? `Aynı anda her yere bakıyorsun.${bosUyari} Aşağıdaki listeden sadece ${ilk.name} ile başla, bir hafta başka hiçbir şeye bakma.`
      : `Ölçüm için yeterli veri çıkmadı.${bosUyari} Daha kısa bir paketle, dinlenmiş kafayla tekrar dene.`,
  };
}

/**
 * Boş bırakma stratejisi — konu bilgisinden bağımsız, saf sınav taktiği.
 * Çoğu öğrenciye herhangi bir konudan daha çok net kazandırır.
 */
export function bosStratejisi(
  bosSayisi: number,
  toplamSoru: number,
  penaltyRatio: number,
  sinavAdi: string
): string | null {
  if (bosSayisi === 0 || toplamSoru === 0) return null;
  const pay = bosSayisi / toplamSoru;
  if (pay < 0.2) return null;

  if (penaltyRatio === 0) {
    return `${bosSayisi} soruyu boş bıraktın. ${sinavAdi}'de yanlış doğruyu götürmüyor — boş bırakmanın matematiksel olarak hiçbir faydası yok. Bilmediğinde de işaretle.`;
  }
  const kacYanlis = Math.round(1 / penaltyRatio);
  return `${bosSayisi} soruyu boş bıraktın. ${sinavAdi}'de ${kacYanlis} yanlış 1 doğruyu götürüyor; iki şıkkı eleyebildiğin soruda işaretlemek uzun vadede kazandırır.`;
}

/**
 * Tekrar ne zaman çözülmeli.
 *
 * Havuz dar olduğunda bunu SÖYLÜYORUZ. "Aynı soruları hatırlayacaksın"
 * uyarısını yapmamak, öğrencinin şişmiş bir sonucu gerçek sanmasına yol
 * açar — ve o sonuca göre çalışmayı bırakır.
 */
export function tekrarTavsiyesi(relaxedExposureCount: number, paketAdi: string): string {
  if (relaxedExposureCount > 0) {
    return `Bu paketin soru havuzu şu an sınırlı: tekrar çözersen bazı sorular tekrar gelebilir ve sonuç seni yanıltır. Onun yerine farklı bir paket dene.`;
  }
  return `${paketAdi} paketini 10 gün sonra tekrar çöz. Daha erken çözersen soruları hatırlarsın, ölçüm gerçeği göstermez.`;
}

// -----------------------------------------------------------
// Hata deseni -> eylem
// -----------------------------------------------------------

/**
 * Bir hata tipini "ne yapmalısın"a çevirir.
 *
 * "İşlem hatası yapıyorsun" teşhis; "her satırı yaz, ara adım atlama"
 * reçete. Koç ikincisini söyler. DIGER için bilerek karşılık yok: uydurma
 * bir tavsiye, hiç tavsiye vermemekten kötü.
 */
const HATA_TAVSIYESI: Record<string, string> = {
  ISLEM_HATASI:
    "Soruyu biliyorsun, dört işlemde kaybediyorsun. Çözerken ara adımları atlama — her satırı yaz. Bu, konu tekrarından daha hızlı net kazandırır.",
  ISARET_HATASI:
    "Eksi işaretinde kaybediyorsun. Parantez açarken işaretleri ayrı bir satırda göster; hız için atladığın adım tam bu.",
  TERS_ISLEM:
    "Doğru yolu kurup ters yöne gidiyorsun. Soruyu okurken “ne isteniyor” kısmını işaretle, çözüm bitince ona geri dön.",
  KAVRAM_YANILGISI:
    "Yanlışların kavramdan geliyor: konuyu bildiğini sanıyorsun ama tanım eksik. Bu konuda soru çözmeyi bırak, önce tanıma ve bir çözümlü örneğe dön.",
  EKSIK_OKUMA:
    "Soruyu tam okumuyorsun. Bu çalışmayla değil alışkanlıkla düzelir: soruyu iki kez oku, verilenleri kenara yaz. En kolay kazanılan netler bunlar.",
  BIRIM_HATASI:
    "Birimde kaybediyorsun (dakika/saat, cm/m). Soruda geçen her birimi işaretle, cevabı yazmadan önce birimi kontrol et.",
  YAKLASIK_DEGER:
    "Erken yuvarlıyorsun. Ara adımlarda kesri ve kökü bozmadan taşı, yuvarlamayı en sona bırak.",
  FORMUL_KARISTIRMA:
    "Benzer formülleri karıştırıyorsun. Bu konunun formüllerini tek bir kâğıda yan yana yaz, farklarını işaretle — ezber değil, ayırt etme çalışması.",
};

export function hataTavsiyesi(
  p: { type: string; label: string; count: number } | null
): { baslik: string; metin: string } | null {
  if (!p) return null;
  const metin = HATA_TAVSIYESI[p.type];
  if (!metin) return null;
  return {
    baslik: `${p.count} yanlışının ortak sebebi: ${p.label.toLocaleLowerCase("tr-TR")}`,
    metin,
  };
}


// ─────────────────────────────────────────────────────────────
// Haftalık plan
// ─────────────────────────────────────────────────────────────

export interface PlanIsi {
  kind: "STUDY" | "SOLVE" | "REVIEW" | "RETEST";
  title: string;
  topicId?: string;
  estimatedMinutes: number;
  targetQuestionCount?: number;
  productId?: string;
}

/**
 * Sonuçtan haftalık plan üretir.
 *
 * Kurallar:
 *  - En fazla MAX_TOPICS_PER_WEEK konu.
 *  - Her konu için: tekrar → soru → yanlış analizi → KONTROL TESTİ.
 *  - Kontrol testi öğrencinin elle işaretleyemediği tek iş: 40 soru
 *    çözdüğünü söylemek kolay, 5 soruluk testi geçmek değil.
 */
export function haftalikPlan(
  oncelikler: OncelikliKonu[],
  urunler: Map<string, string[]>
): PlanIsi[] {
  const isler: PlanIsi[] = [];

  for (const konu of oncelikler) {
    const urun = urunler.get(konu.topicId)?.[0];
    isler.push({
      kind: "STUDY",
      topicId: konu.topicId,
      title: `${konu.name} konu tekrarı`,
      estimatedMinutes: SURE.konuTekrari,
      productId: urun,
    });
    isler.push({
      kind: "SOLVE",
      topicId: konu.topicId,
      title: `${konu.name} ${HAFTALIK_SORU} soru`,
      estimatedMinutes: SURE.soruCozumu,
      targetQuestionCount: HAFTALIK_SORU,
      productId: urun,
    });
    isler.push({
      kind: "REVIEW",
      topicId: konu.topicId,
      title: `${konu.name} yanlışlarını deftere geçir`,
      estimatedMinutes: SURE.yanlisAnalizi,
    });
    isler.push({
      kind: "RETEST",
      topicId: konu.topicId,
      title: `${konu.name} kontrol testi · 5 soru`,
      estimatedMinutes: SURE.kontrolTesti,
    });
  }

  return isler;
}

/**
 * Koçun o haftaki tek cümlesi. Plan ekranının en üstünde durur.
 */
export function kocNotu(oncelikler: OncelikliKonu[], oncekiTamamlama: number | null): string {
  if (oncelikler.length === 0) {
    return "Kanıtlı bir zayıf konun yok. Bu hafta kapsamı genişlet: daha önce ölçmediğin bir paketi çöz.";
  }
  const isimler = oncelikler.map((k) => k.name).join(" ve ");
  const temel = `Sadece ${isimler}. Diğer konulara bakma.`;

  if (oncekiTamamlama !== null && oncekiTamamlama < 0.5) {
    return `${temel} Geçen hafta listenin yarısını bitiremedin, bu yüzden bu hafta daha kısa.`;
  }
  return temel;
}

/**
 * Haftanın başlangıcı (pazartesi 00:00, Türkiye saati).
 *
 * Hafta sınırını sunucunun UTC'sine göre hesaplamak, pazar gecesi 23:30'da
 * planını açan öğrencinin haftasını bir gün erken bitirirdi.
 */
export function haftaBasi(now: Date): Date {
  const trTarih = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = (trTarih.getDay() + 6) % 7; // pazartesi = 0
  trTarih.setDate(trTarih.getDate() - gun);
  const y = trTarih.getFullYear();
  const m = String(trTarih.getMonth() + 1).padStart(2, "0");
  const d = String(trTarih.getDate()).padStart(2, "0");
  // Saat dilimsiz bir "tarih" olarak saklıyoruz (@db.Date).
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/** "18–24 Kasım" biçiminde hafta etiketi. */
export function haftaEtiketi(haftaBasi: Date): string {
  const son = new Date(haftaBasi.getTime() + 6 * 86_400_000);
  const gunAy = (d: Date, ay: boolean) =>
    d.toLocaleDateString("tr-TR", { day: "numeric", ...(ay ? { month: "long" } : {}), timeZone: "UTC" });
  const ayniAy = haftaBasi.getUTCMonth() === son.getUTCMonth();
  return `${gunAy(haftaBasi, !ayniAy)} – ${gunAy(son, true)}`;
}
