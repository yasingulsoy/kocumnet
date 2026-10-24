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
 * En fazla iki. Bir koçu rapor üretecinden ayıran kural bu: beş zayıf konuyu
 * aynı hafta vermek, öğrencinin hiçbirini bitirememesi demek — ve
 * bitirilmeyen plan, plan olmaktan çıkıp duvar kâğıdı olur.
 */
export const MAX_TOPICS_PER_WEEK = 2;

/** Geçen haftanın bu oranından azı bittiyse plan kısalır. */
export const KISA_PLAN_ESIGI = 0.5;

/**
 * Bu haftanın konu sınırı, geçen haftanın tamamlanma oranına göre.
 *
 * Geçen hafta listenin yarısı bitmediyse bu hafta tek konu. Eskiden koç notu
 * "bu hafta daha kısa" diyordu ama plan yine iki konuyla kuruluyordu: söz
 * verilen kısalma hiç olmuyordu. Hiç plan yoksa (null) tam sınır.
 */
export function haftalikKonuSiniri(oncekiTamamlama: number | null): number {
  return oncekiTamamlama !== null && oncekiTamamlama < KISA_PLAN_ESIGI ? 1 : MAX_TOPICS_PER_WEEK;
}

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

/**
 * Konu haritası satırını öncelik satırına çevirir (süzmeden).
 *
 * Ayrı ihraç: sonuç ekranı, plan bu testten çıktıysa listeyi PLANIN
 * konularıyla kuruyor ve satırları aynı biçimde çizmesi gerekiyor.
 */
export function oncelikliKonuyaCevir(
  t: TopicBreakdownEntry,
  agirliklar: Map<string, number>
): OncelikliKonu {
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
}

export function oncelikSirasi(
  topics: TopicBreakdownEntry[],
  agirliklar: Map<string, number>,
  enFazla = MAX_TOPICS_PER_WEEK
): OncelikliKonu[] {
  return topics
    .filter((t) => t.level === "WEAK" && t.asked >= 3)
    .map((t) => oncelikliKonuyaCevir(t, agirliklar))
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

/**
 * Sonucun bu haftanın planıyla bağı.
 *
 * BU_TEST: plan bu testten çıktı. BASKA_TEST: bu haftanın planı başka bir
 * testten. YOK: bu hafta plan yok ya da sonuç eski bir haftanın.
 *
 * Neden karar()'ın parametresi: haftanın ikinci testi "bu hafta sadece C ve
 * D, diğer konulara bakma" diyordu; plan ise A ve B istiyordu. "Sadece
 * bunlar" ve "bakma" yalnızca plan bu testten çıktıysa doğru.
 */
export type PlanBagi = "BU_TEST" | "BASKA_TEST" | "YOK";

export function karar(
  oran: number,
  oncelikler: OncelikliKonu[],
  guclu: TopicBreakdownEntry[],
  bosSayisi: number,
  toplamSoru: number,
  planBagi: PlanBagi
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
    // Tek konuda tekil dil: plan geçen haftanın oranıyla tek konuya inebiliyor.
    const eylem =
      planBagi === "BU_TEST"
        ? `Bu hafta sadece ${ikinci ? "bunlar" : "bu konu"}; diğer konulara bakma.`
        : planBagi === "BASKA_TEST"
          ? `Bu haftanın planı önceki testinden; önce onu bitir, sıradaki ${ikinci ? "konuların bunlar" : "konun bu"}.`
          : `Çalışmaya ${ikinci ? "bunlarla" : "bununla"} başla.`;
    return {
      ton: "warn",
      // Konu sayısı listeyle aynı olsun: plan tek konuya kısaldığında ya da
      // hiç kanıtlı zayıf konu yokken "iki konu" yazmasın.
      baslik: `%${yuzde} — temelin var${ilk ? `, ${ikinci ? "iki konu" : "bir konu"} netini aşağı çekiyor` : ""}.`,
      metin: ilk
        ? `${ilk.name}${ikinci ? ` ve ${ikinci.name}` : ""}.${kayipCumlesi} ${eylem}`
        : "Konu bazında kanıtlı bir zayıflık çıkmadı. Daha uzun bir paketle ölçümü derinleştir.",
    };
  }

  // Düşük bant: suçlayıcı değil, sıralayıcı bir dil. Öğrenci zaten biliyor.
  const bosUyari =
    bosSayisi >= Math.ceil(toplamSoru * 0.3)
      ? ` ${bosSayisi} soruyu boş bıraktın; bu da başlı başına bir konu.`
      : "";
  const ilkEylem = !ilk
    ? ""
    : planBagi === "BU_TEST"
      ? `Aşağıdaki listeden sadece ${ilk.name} ile başla, bir hafta başka hiçbir şeye bakma.`
      : planBagi === "BASKA_TEST"
        ? `Önce bu haftanın planını bitir; sıradaki konun ${ilk.name}.`
        : `Aşağıdaki listeden ${ilk.name} ile başla.`;
  return {
    ton: "bad",
    baslik: `%${yuzde} — bu bir yetenek meselesi değil, sıralama meselesi.`,
    metin: ilk
      ? `Aynı anda her yere bakıyorsun.${bosUyari} ${ilkEylem}`
      : `Ölçüm için yeterli veri çıkmadı.${bosUyari} Daha kısa bir paketle, dinlenmiş kafayla tekrar dene.`,
  };
}

/**
 * Boş bırakma stratejisi — konu bilgisinden bağımsız, saf sınav taktiği.
 * Çoğu öğrenciye herhangi bir konudan daha çok net kazandırır.
 */
/**
 * Konu kontrol testinin karar cümlesi.
 *
 * Paket kararı (karar) burada yanlış konuşuyordu: kontrol testinde 5/5 yapana
 * "bu paket sana yetmiyor, daha zor bir paketle ölç", 2/5 yapana "aynı anda
 * her yere bakıyorsun" diyordu — oysa öğrenci planın istediği TEK konuya
 * bakmıştı. Kontrol testi bir doğrulama; sorduğu tek şey "çalışman işe yaradı
 * mı". Cümle yine her zaman bir sayı içerir; seviye puanlamanın verdiği
 * seviyedir (eşik burada yeniden yazılmıyor).
 */
export function kontrolKarari(
  konu: Pick<TopicBreakdownEntry, "name" | "correct" | "asked" | "level">,
  /** Bu konunun bir önceki ölçümdeki oranı (0-1); hiç ölçülmediyse null. */
  oncekiOran: number | null
): Karar {
  const sayi = `${konu.correct}/${konu.asked}`;
  const yuzde = konu.asked === 0 ? 0 : Math.round((konu.correct / konu.asked) * 100);
  let onceki = "";
  if (oncekiOran !== null) {
    const eski = Math.round(oncekiOran * 100);
    const fark = yuzde - eski;
    onceki = `Önceki ölçümünde %${eski} idi${fark !== 0 ? ` (${fark > 0 ? "+" : ""}${fark} puan)` : ""}. `;
  }

  if (konu.level === "STRONG") {
    return {
      ton: "ok",
      baslik: `${konu.name}: ${sayi} — konu oturmuş.`,
      metin: `${onceki}Çalışman karşılığını verdi; planındaki sıradaki işe geç.`,
    };
  }
  if (konu.level === "MEDIUM") {
    return {
      ton: "warn",
      baslik: `${konu.name}: ${sayi} — yol alınmış, henüz bitmedi.`,
      metin: `${onceki}Yanlışlarının çözümüne bak, aynı tipten birkaç soru daha çöz; birkaç gün sonra yeniden kontrol et.`,
    };
  }
  if (konu.level === "WEAK") {
    return {
      ton: "bad",
      baslik: `${konu.name}: ${sayi} — konu henüz oturmadı.`,
      metin: `${onceki}Bir haftada her konu oturmaz. Çözümleri incele, konu tekrarına dön; birkaç gün sonra yeniden kontrol et.`,
    };
  }
  return {
    ton: "warn",
    baslik: `${konu.name}: ${sayi}`,
    metin: "Bu testten seviye çıkaracak kadar cevap toplanmadı. Biraz daha soru çözüp yeniden kontrol et.",
  };
}

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

/**
 * Tek bir hata tipinin reçetesi — alıştırmada yanlış şıkkın altında.
 * DIGER ve tanımsız tipler için null (uydurma tavsiye yok).
 */
export function hataTipiTavsiyesi(type: string | null | undefined): string | null {
  return type ? (HATA_TAVSIYESI[type] ?? null) : null;
}

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
 *
 * `kisaltildi`: plan geçen haftanın oranı yüzünden GERÇEKTEN kısaldı mı
 * (haftalikKonuSiniri bir konuyu dışarıda bıraktı mı). Tek zayıf konusu olan
 * öğrenciye "bu hafta daha kısa" demek, kısalmayan planı kısa diye sunmaktı.
 */
export function kocNotu(oncelikler: OncelikliKonu[], kisaltildi: boolean): string {
  if (oncelikler.length === 0) {
    return "Kanıtlı bir zayıf konun yok. Bu hafta kapsamı genişlet: daha önce ölçmediğin bir paketi çöz.";
  }
  const isimler = oncelikler.map((k) => k.name).join(" ve ");
  const temel = `Sadece ${isimler}. Diğer konulara bakma.`;

  if (kisaltildi) {
    return `${temel} Geçen hafta listenin yarısını bitiremedin, bu yüzden bu hafta tek konu.`;
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

/** Türkiye yıl boyu UTC+3 (2016'dan beri yaz saati yok). */
const TR_FARK_MS = 3 * 3600_000;

/**
 * Haftanın başladığı AN: pazartesi 00:00 Türkiye = pazar 21:00 UTC.
 *
 * haftaBasi() bir TARİH döndürüyor (StudyPlan.weekStart, @db.Date) ve değeri
 * UTC gece yarısı. Zaman damgalarıyla (computedAt, submittedAt) onunla
 * karşılaştırmak pazartesi 00:00-03:00 arasını önceki haftaya atıyordu:
 * pazartesi gecesi çözülen test "geçen haftanın sonucu" sayılıyordu.
 * Zaman damgası karşılaştırmalarında bu kullanılır.
 */
export function haftaBasiAni(now: Date): Date {
  return new Date(haftaBasi(now).getTime() - TR_FARK_MS);
}

/** "18–24 Kasım" biçiminde hafta etiketi. */
export function haftaEtiketi(haftaBasi: Date): string {
  const son = new Date(haftaBasi.getTime() + 6 * 86_400_000);
  const gunAy = (d: Date, ay: boolean) =>
    d.toLocaleDateString("tr-TR", { day: "numeric", ...(ay ? { month: "long" } : {}), timeZone: "UTC" });
  const ayniAy = haftaBasi.getUTCMonth() === son.getUTCMonth();
  return `${gunAy(haftaBasi, !ayniAy)} – ${gunAy(son, true)}`;
}
