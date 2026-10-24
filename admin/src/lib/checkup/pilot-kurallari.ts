/**
 * Pilot ölçümü — kurallar ve hesaplar. SAF modül: veritabanı bilmez, satırları
 * parametreyle alır ve sayı döndürür. Sorgular pilot.ts'te (server-only),
 * ekranda ve raporda görünen tanımlar pilot-tanimlar.ts'te.
 *
 * Soru tek: 5 haftalık pilot işe yaradı mı? Cevap yalnızca TOPLU sayılarla
 * verilir. Ad, e-posta, öğrenci kimliği bu modülden dışarı çıkmaz; küçük
 * sayılar (beşten az) yazılmaz, çünkü 12 kişilik bir grupta "2 öğrenci hata
 * bildirdi" kimin bildirdiğini neredeyse söyler.
 *
 * Ölçüm kuralı öğrenci uygulamasınınki (shared/insights.ts): bir sonucu
 * ölçüm sayıp saymamak olcumDisi / konuHaritasinaGirer ile; sorgular bu
 * yüzden blankCount ve endedBy seçer.
 *
 * app/scripts/pilot-panel-test.mts bu dosyayı doğrudan yükleyip sınıyor:
 * yalnızca göreli import (tsx çözer), "server-only" yok.
 */

import { percent, trNumber } from "./format";
import { kontrolKarari } from "./shared/coaching";
import { isaretsiz, konuHaritasinaGirer, olcumDisi, yarimKaldi } from "./shared/insights";
import { trTarih } from "./shared/odev";
import type { TopicLevel } from "./shared/scoring";

const GUN = 86_400_000;
const HAFTA = 7 * GUN;

// ─────────────────────────────────────────────────────────────
// Eşikler — tek yer
// ─────────────────────────────────────────────────────────────

/** Bu sayının altındaki her kişi ya da test sayısı "<5" yazılır. */
export const KUCUK_SAYI_SINIRI = 5;
/** Süzgecin varsayılan dönemi: pilotun beş haftası, bugün dahil. */
export const PILOT_VARSAYILAN_GUN = 35;
/** Seçilebilecek en uzun dönem; yanlışlıkla 2016'dan bugüne sorgu atılmasın. */
export const PILOT_EN_UZUN_GUN = 366;
/** Öğrenme kazancı: bir ölçüm o konuda en az bu kadar soru sorduysa eşleşmeye girer. */
export const KAZANC_EN_AZ_SORU = 3;
/** Öğrenme kazancı: bundan az öğrenciyle ortalama yazılmaz ("veri yetersiz"). */
export const KAZANC_EN_AZ_OGRENCI = 10;
/**
 * "Anlamlı artış" eşiği (puan): ilk ölçümden son ölçüme konu doğru oranı en az
 * bu kadar yükselen eşleşme. HOCAYA SORULACAK; karar gelene kadar 10 puan
 * (konu başına 3-5 soruda tek sorunun farkı 20-33 puan, 10'un altı gürültü).
 */
export const ANLAMLI_ARTIS_PUAN = 10;
/** Zorluk algısı: bir paket en az bu kadar cevap aldıysa gösterilir. */
export const ZORLUK_EN_AZ_CEVAP = 5;
/**
 * Havuz tükenmesi: "daha önce gördüğü soru" penceresi. Öğrenci uygulamasının
 * tekrar engeliyle aynı gün sayısı (app/lib/question-selection.ts
 * EXPOSURE_WINDOW_DAYS; paylaşılan modül değil, değişirse burası da).
 */
export const TEKRAR_PENCERESI_GUN = 30;
/** Havuz tükenmesi: oran bu kadar oturumdan azsa "önce yazılacaklar"a girmez (gürültü). */
export const HAVUZ_EN_AZ_OTURUM = 5;
/** "Önce yazılacak konular" listesinin uzunluğu. */
export const HAVUZ_LISTE_UZUNLUGU = 6;

// ─────────────────────────────────────────────────────────────
// Küçük sayı kuralı — ekranda ve raporda gösterilen HER sayı buradan geçer
// ─────────────────────────────────────────────────────────────

export const GIZLI_SAYI = "<" + KUCUK_SAYI_SINIRI;
export const GIZLI_ORAN = "—";

/**
 * Tek kural: beşten küçük sayı yazılmaz. Sıfır da dahil, bilerek: 6 kişilik
 * bir grupta "0 kişi" de herkes hakkında bir şey söyler ve "<5" ile "0"
 * arasındaki fark tek tek kişileri ayırt etmeye yarar.
 */
export function gizlenir(n: number): boolean {
  return n < KUCUK_SAYI_SINIRI;
}

/** Kişi ya da test sayısı: "<5" ya da "12". */
export function sayiMetni(n: number): string {
  return gizlenir(n) ? GIZLI_SAYI : trNumber(n);
}

/**
 * Oran gösterilebilir mi: payda da pay da küçük değilse. Pay gizliyken oran
 * yazılsaydı payı ele verirdi (40 kişide %5 = 2 kişi).
 */
export function oranGosterilir(pay: number, payda: number): boolean {
  return !gizlenir(payda) && !gizlenir(pay);
}

/** "%40" ya da "—". */
export function oranMetni(pay: number, payda: number): string {
  return oranGosterilir(pay, payda) ? percent(pay / payda) : GIZLI_ORAN;
}

/** Puan farkı: "+12 puan", "−3 puan", "0 puan". */
export function puanMetni(puan: number): string {
  const yuvarlak = Math.round(puan);
  if (yuvarlak === 0) return "0 puan";
  return (yuvarlak > 0 ? "+" : "−") + trNumber(Math.abs(yuvarlak)) + " puan";
}

/** Az veride ortalamanın yerine geçen metin. */
export function veriYetersizMetni(ogrenci: number): string {
  return "veri yetersiz (" + sayiMetni(ogrenci) + " öğrenci)";
}

// ─────────────────────────────────────────────────────────────
// Süzgeç: grup ve tarih aralığı (adres parametreleri)
// ─────────────────────────────────────────────────────────────

export interface PilotSuzgeci {
  /** Seçili grup; null = bütün öğrenciler. */
  grupId: string | null;
  /** Türkiye takvim günü, "yyyy-aa-gg"; ikisi de dahil. */
  bas: string;
  bit: string;
  /** Dönemin başladığı an (bas 00:00 Türkiye). */
  basAn: Date;
  /** Dönemin bittiği an, HARİÇ (bit'in ertesi günü 00:00 Türkiye). */
  bitisAn: Date;
  /** Sayımın son anı: bitisAn ile şimdiden erken olanı (bugün henüz bitmedi). */
  gozlemSonu: Date;
  /** Varsayılan dönem mi (adreste tarih yok ya da geçersiz). */
  varsayilan: boolean;
}

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
/** cuid: grup kimliği. Başka biçim süzgece girmez (sorguya ham değer gitmesin). */
const KIMLIK = /^[a-z0-9]{8,40}$/;

/** "yyyy-aa-gg" Türkiye gününün başladığı an; geçersiz tarihte null (31 Şubat). */
export function gunBasiAni(gun: string): Date | null {
  if (!TARIH.test(gun)) return null;
  const an = new Date(gun + "T00:00:00+03:00");
  if (Number.isNaN(an.getTime()) || trTarih(an) !== gun) return null;
  return an;
}

function tek(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Adres parametrelerinden süzgeç. Geçersiz ya da ters tarihte varsayılan
 * döneme (son 35 gün) döner; sessizce boş ekran göstermesin.
 */
export function pilotSuzgeci(sp: Record<string, string | string[] | undefined>, now: Date): PilotSuzgeci {
  const grup = tek(sp.grup);
  const grupId = grup && grup !== "hepsi" && KIMLIK.test(grup) ? grup : null;

  const bugun = trTarih(now);
  const varsayilanBas = trTarih(new Date((gunBasiAni(bugun) as Date).getTime() - (PILOT_VARSAYILAN_GUN - 1) * GUN + 12 * 3600_000));

  let bas = tek(sp.bas);
  let bit = tek(sp.bit);
  let basAn = gunBasiAni(bas);
  let bitAn = gunBasiAni(bit);
  let varsayilan = false;
  const uzunluk = basAn && bitAn ? (bitAn.getTime() - basAn.getTime()) / GUN + 1 : 0;
  if (!basAn || !bitAn || bitAn < basAn || uzunluk > PILOT_EN_UZUN_GUN || bas > bugun) {
    bas = varsayilanBas;
    bit = bugun;
    basAn = gunBasiAni(bas) as Date;
    bitAn = gunBasiAni(bit) as Date;
    varsayilan = true;
  }
  const bitisAn = new Date(bitAn.getTime() + GUN);
  const gozlemSonu = bitisAn.getTime() < now.getTime() ? bitisAn : now;
  return { grupId, bas, bit, basAn, bitisAn, gozlemSonu, varsayilan };
}

/**
 * Süzgeci adrese çevirir (rapor bağlantısı). Tarihler varsayılan dönemde de
 * yazılır: rapordaki adres yarın açılınca aynı dönemi göstersin.
 */
export function pilotParametreleri(s: PilotSuzgeci): Record<string, string | undefined> {
  return { grup: s.grupId ?? undefined, bas: s.bas, bit: s.bit };
}

// ─────────────────────────────────────────────────────────────
// Ortak satır tipleri
// ─────────────────────────────────────────────────────────────

/** Bir oturumun sonucu (CheckupResult'tan); ölçüm kuralı için blankCount şart. */
export interface SonucSayilari {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
}

/** Bir oturum: tür, kapanış ve (varsa) sonuç. endedBy oturumda, sayılar sonuçta. */
export interface OturumSatiri {
  userId: string;
  kind: string;
  status: string;
  endedBy: string | null;
  startedAt: Date;
  /** Sonuç satırı ve bitiş anı (submittedAt, yoksa computedAt). Alıştırmada yok. */
  sonuc: (SonucSayilari & { an: Date }) | null;
}

/** Oturum ölçüm sayılır mı: konu haritasının kuralı (paket, kontrol, seviyeli; boş/yarım değil). */
export function olcumSayilir(o: Pick<OturumSatiri, "kind" | "endedBy" | "sonuc">): boolean {
  return o.sonuc !== null && konuHaritasinaGirer({ kind: o.kind, endedBy: o.endedBy, ...o.sonuc });
}

/**
 * Öğrenci başına ölçüm sayılan ilk testin bitiş anı (gözlem sonuna kadar).
 * Huni ve kayıt kaynağı aynı tanımı kullanır.
 */
export function ilkOlcumAnlari(oturumlar: readonly OturumSatiri[], gozlemSonu: Date): Map<string, Date> {
  const ilk = new Map<string, Date>();
  for (const o of oturumlar) {
    if (!olcumSayilir(o) || !o.sonuc || o.sonuc.an.getTime() > gozlemSonu.getTime()) continue;
    const eski = ilk.get(o.userId);
    if (!eski || o.sonuc.an < eski) ilk.set(o.userId, o.sonuc.an);
  }
  return ilk;
}

// ─────────────────────────────────────────────────────────────
// (a) Huni
// ─────────────────────────────────────────────────────────────

export interface HuniKullanicisi {
  id: string;
  createdAt: Date;
  onboardedAt: Date | null;
  lastSeenAt: Date | null;
}

export const HUNI_ADIMLARI = ["kayit", "tanisma", "ilkOlcum", "hafta2", "hafta3"] as const;
export type HuniAdimAnahtari = (typeof HUNI_ADIMLARI)[number];

export interface HuniAdimi {
  anahtar: HuniAdimAnahtari;
  /** Bu adımı geçen öğrenci. */
  sayi: number;
  /** Önceki adımı geçenlerden bu adıma "gelebilecek" olanlar (oranın paydası). */
  taban: number;
  /** Önceki adımı geçti ama o haftası dönem bitmeden dolmadı: tabana girmez. */
  erken: number;
  /** Kayıt olanlardan bu adıma gelebilecek olan (haftası dolmuş): "kayda göre" oranın paydası. */
  kayitTabani: number;
}

/** Kaydın hafta penceresi [bas, son): 2. hafta = 8.-14. günler. */
function haftaPenceresi(kayit: Date, hafta: 2 | 3, gozlemSonu: Date): { bas: number; son: number } {
  const bas = kayit.getTime() + (hafta - 1) * HAFTA;
  // "3. hafta ve sonrası": 15. günden dönem sonuna kadar.
  const son = hafta === 2 ? bas + HAFTA : gozlemSonu.getTime() + 1;
  return { bas, son };
}

/**
 * Öğrencinin o haftası dönem içinde doldu mu. 3. hafta için tam bir hafta
 * (21. günün sonu) beklenir: 15. gününde olan öğrenciyi "3. haftada etkin
 * değil" saymak haksız olurdu.
 */
export function haftasiDoldu(kayit: Date, hafta: 2 | 3, gozlemSonu: Date): boolean {
  return kayit.getTime() + (hafta === 2 ? 2 : 3) * HAFTA <= gozlemSonu.getTime();
}

/**
 * O hafta etkin mi: penceresinde en az bir oturum başlattı ya da son
 * görülmesi oraya düşüyor. Son görülme tek değer (en son an); geçmiş bir
 * haftada yalnızca uygulamayı açan öğrenciyi göremez, ekranda yazıyor.
 */
export function haftadaEtkin(
  kullanici: Pick<HuniKullanicisi, "createdAt" | "lastSeenAt">,
  baslangiclar: readonly Date[],
  hafta: 2 | 3,
  gozlemSonu: Date
): boolean {
  const { bas, son } = haftaPenceresi(kullanici.createdAt, hafta, gozlemSonu);
  const icinde = (d: Date | null) => d !== null && d.getTime() >= bas && d.getTime() < son && d.getTime() <= gozlemSonu.getTime();
  return icinde(kullanici.lastSeenAt) || baslangiclar.some(icinde);
}

/**
 * Huni: kayıt → tanışma → ilk ölçüm → 2. hafta etkin → 3. hafta ve sonrası
 * etkin. Her adım bir öncekini geçenler arasından sayılır. Haftası dönem
 * içinde dolmamış öğrenci o adımın tabanına girmez ("erken"); yoksa son iki
 * hafta kaydolan herkes "bıraktı" görünürdü.
 */
export function huniHesapla(
  kullanicilar: readonly HuniKullanicisi[],
  oturumlar: readonly OturumSatiri[],
  gozlemSonu: Date
): HuniAdimi[] {
  const ilk = ilkOlcumAnlari(oturumlar, gozlemSonu);
  const baslangiclar = new Map<string, Date[]>();
  for (const o of oturumlar) {
    const l = baslangiclar.get(o.userId);
    if (l) l.push(o.startedAt);
    else baslangiclar.set(o.userId, [o.startedAt]);
  }
  const bitti = (d: Date | null) => d !== null && d.getTime() <= gozlemSonu.getTime();

  const kayit = [...kullanicilar];
  const tanisma = kayit.filter((u) => bitti(u.onboardedAt));
  const olcum = tanisma.filter((u) => ilk.has(u.id));

  const haftaAdimi = (onceki: HuniKullanicisi[], hafta: 2 | 3) => {
    const dolan = onceki.filter((u) => haftasiDoldu(u.createdAt, hafta, gozlemSonu));
    const gecen = dolan.filter((u) => haftadaEtkin(u, baslangiclar.get(u.id) ?? [], hafta, gozlemSonu));
    return { gecen, taban: dolan.length, erken: onceki.length - dolan.length };
  };
  const h2 = haftaAdimi(olcum, 2);
  const h3 = haftaAdimi(h2.gecen, 3);
  const kayitDolan = (hafta: 2 | 3) => kayit.filter((u) => haftasiDoldu(u.createdAt, hafta, gozlemSonu)).length;

  return [
    { anahtar: "kayit", sayi: kayit.length, taban: kayit.length, erken: 0, kayitTabani: kayit.length },
    { anahtar: "tanisma", sayi: tanisma.length, taban: kayit.length, erken: 0, kayitTabani: kayit.length },
    { anahtar: "ilkOlcum", sayi: olcum.length, taban: tanisma.length, erken: 0, kayitTabani: kayit.length },
    { anahtar: "hafta2", sayi: h2.gecen.length, taban: h2.taban, erken: h2.erken, kayitTabani: kayitDolan(2) },
    { anahtar: "hafta3", sayi: h3.gecen.length, taban: h3.taban, erken: h3.erken, kayitTabani: kayitDolan(3) },
  ];
}

// ─────────────────────────────────────────────────────────────
// (b) Testler
// ─────────────────────────────────────────────────────────────

export interface TestDurumlari {
  baslayan: number;
  /** Öğrenci "Bitir"e bastı (eski kayıtta kapanış boş: öğrenci bitirmiş sayılır). */
  ogrenciBitirdi: number;
  /** Süre doldu (bakım işi kapattı; puanlanamayan EXPIRED dahil). */
  suresiDoldu: number;
  /** Öğrenci aynı testi yeniden başlattı, eskisi kapandı. */
  yenidenBaslatildi: number;
  /** Hâlâ açık. */
  suruyor: number;
  /** Seviyeli koşu bırakıldı (ABANDONED). */
  birakildi: number;
  /** Yukarıdakilerin içinden: öğrenci bitirmedi ve soruların yarısından azı işaretli. */
  yarimKaldi: number;
  /** Yukarıdakilerin içinden: tek şık işaretlenmeden kapandı. */
  isaretsiz: number;
  /** Ölçüm sayılan (boş ve yarım olmayan) test. */
  olcumSayilan: number;
}

/** Testlerin kapanış dökümü. Alıştırma oturumları gelmemeli (sorgu süzer). */
export function testDurumlari(oturumlar: readonly Pick<OturumSatiri, "kind" | "status" | "endedBy" | "sonuc">[]): TestDurumlari {
  const d: TestDurumlari = {
    baslayan: 0,
    ogrenciBitirdi: 0,
    suresiDoldu: 0,
    yenidenBaslatildi: 0,
    suruyor: 0,
    birakildi: 0,
    yarimKaldi: 0,
    isaretsiz: 0,
    olcumSayilan: 0,
  };
  for (const o of oturumlar) {
    if (o.kind === "PRACTICE") continue;
    d.baslayan++;
    if (o.status === "IN_PROGRESS") d.suruyor++;
    else if (o.status === "ABANDONED") d.birakildi++;
    else if (o.endedBy === "RESTART") d.yenidenBaslatildi++;
    else if (o.endedBy === "TIMEOUT" || o.status === "EXPIRED") d.suresiDoldu++;
    else if (o.status === "SUBMITTED") d.ogrenciBitirdi++;

    if (o.sonuc) {
      const r = { ...o.sonuc, endedBy: o.endedBy };
      if (isaretsiz(r)) d.isaretsiz++;
      else if (yarimKaldi(r)) d.yarimKaldi++;
      if (olcumSayilir(o)) d.olcumSayilan++;
    }
  }
  return d;
}

/** Yarım testin bir sorusu: testteki sırası, işaretli mi, ilk işaretlenme anı. */
export interface YarimTestKalemi {
  sira: number;
  isaretli: boolean;
  /** Answer.firstAnsweredAt, eski satırda answeredAt; yoksa null. */
  an: Date | null;
}

export interface BirakmaDagilimi {
  /** İlk, ikinci, üçüncü, son çeyrekte bırakılan yarım test. */
  ceyrekler: [number, number, number, number];
  /** Hiç işaret konmadan kapanan yarım test (bırakma yeri yok). */
  hicIsaretsiz: number;
}

/**
 * Öğrencinin bıraktığı yer: EN SON işaretlediği sorunun testteki yeri
 * (1..toplam). Zaman damgası olan cevaplarda en geç işaretlenen; hiç zaman
 * yoksa en ileri sıradaki işaretli soru. Hiç işaret yoksa null.
 */
export function birakmaYeri(kalemler: readonly YarimTestKalemi[]): { yer: number; toplam: number } | null {
  const sirali = [...kalemler].sort((a, b) => a.sira - b.sira);
  const isaretliler = sirali.map((k, i) => ({ k, yer: i + 1 })).filter((x) => x.k.isaretli);
  if (isaretliler.length === 0) return null;
  const zamanli = isaretliler.filter((x) => x.k.an !== null);
  const son = zamanli.length
    ? zamanli.reduce((a, b) => ((b.k.an as Date).getTime() >= (a.k.an as Date).getTime() ? b : a))
    : isaretliler[isaretliler.length - 1];
  return { yer: son.yer, toplam: sirali.length };
}

/** Yarım testlerin bırakıldığı çeyreğin kaba dağılımı. */
export function birakmaDagilimi(testler: readonly (readonly YarimTestKalemi[])[]): BirakmaDagilimi {
  const ceyrekler: [number, number, number, number] = [0, 0, 0, 0];
  let hicIsaretsiz = 0;
  for (const kalemler of testler) {
    const y = birakmaYeri(kalemler);
    if (!y) {
      hicIsaretsiz++;
      continue;
    }
    const c = Math.min(4, Math.max(1, Math.ceil((y.yer / y.toplam) * 4)));
    ceyrekler[c - 1]++;
  }
  return { ceyrekler, hicIsaretsiz };
}

// ─────────────────────────────────────────────────────────────
// (c) Özellik kullanımı: ödev
// ─────────────────────────────────────────────────────────────

export interface OdevOzeti {
  /** Dönemde en az bir ödevi olan öğrenci. */
  odevli: number;
  /** En az bir ödevini (geç de olsa) tamamlayan öğrenci. */
  tamamlayan: number;
  /** Öğrenci × ödev çifti. */
  atama: number;
  tamamlanan: number;
}

/** Öğrenci başına ödev durumu (shared/odev.ts odevIlerlemesi) → özet. */
export function odevOzeti(atamalar: readonly { ogrenci: string; tamamlandi: boolean }[]): OdevOzeti {
  const odevli = new Set<string>();
  const tamamlayan = new Set<string>();
  let tamamlanan = 0;
  for (const a of atamalar) {
    odevli.add(a.ogrenci);
    if (a.tamamlandi) {
      tamamlayan.add(a.ogrenci);
      tamamlanan++;
    }
  }
  return { odevli: odevli.size, tamamlayan: tamamlayan.size, atama: atamalar.length, tamamlanan };
}

// ─────────────────────────────────────────────────────────────
// (d) Öğrenme kazancı
// ─────────────────────────────────────────────────────────────

/** Konu kırılımının kazancın okuduğu kısmı (topicBreakdown.topics). */
export interface KonuSayisi {
  topicId: string;
  name: string;
  asked: number;
  correct: number;
}

export interface KazancSonucu extends SonucSayilari {
  userId: string;
  kind: string;
  endedBy: string | null;
  /** Havuz yetmedi, öğrenciye daha önce gördüğü soru geldi. */
  relaxedExposureCount: number;
  packageId: string;
  packageKind: string;
  an: Date;
  konular: readonly KonuSayisi[];
}

/** Bir plan işinin konusu ve haftası (StudyPlan.weekStart: @db.Date, UTC gece yarısı). */
export interface PlanKonusu {
  userId: string;
  topicId: string;
  weekStart: Date;
}

/**
 * Kazanca giren ölçüm türleri. Seviyeli aşama dışarıda: seviye 1 ile seviye 3
 * soruları farklı zorlukta, oranları kıyaslanırsa her öğrenci "düştü" görünür
 * (eğilim kuralı da aynı sebeple dışlıyor).
 */
const KAZANC_TURLERI = new Set(["PACKAGE", "TOPIC_RETEST"]);

/**
 * Eşleşmeye girebilecek ölçümler: ölçüm sayılan (boş/yarım değil), paket ya da
 * kontrol testi, tekrar soru içermeyen. İki tekrar türü dışarıda, ikisi de
 * öğrenmeyi değil hafızayı ölçer:
 *  - relaxedExposureCount > 0: havuz yetmedi, daha önce görülen soru geldi;
 *  - aynı denemenin (MOCK: herkese aynı sorular) ikinci çözümü. Dönemden önce
 *    çözülmüş denemeler `oncekiDenemeler`le gelir (öğrenci × paket).
 */
export function kazancOlcumleri(
  sonuclar: readonly KazancSonucu[],
  oncekiDenemeler: readonly { userId: string; packageId: string }[] = []
): KazancSonucu[] {
  const sirali = [...sonuclar].sort((a, b) => a.an.getTime() - b.an.getTime());
  const gorulenDeneme = new Set<string>(oncekiDenemeler.map((d) => d.userId + "|" + d.packageId));
  const sonuc: KazancSonucu[] = [];
  for (const r of sirali) {
    const denemeAnahtari = r.userId + "|" + r.packageId;
    const denemeTekrari = r.packageKind === "MOCK" && gorulenDeneme.has(denemeAnahtari);
    if (r.packageKind === "MOCK") gorulenDeneme.add(denemeAnahtari);
    if (!KAZANC_TURLERI.has(r.kind) || !konuHaritasinaGirer(r)) continue;
    if (r.relaxedExposureCount > 0 || denemeTekrari) continue;
    sonuc.push(r);
  }
  return sonuc;
}

export interface KazancEslesmesi {
  userId: string;
  topicId: string;
  name: string;
  ilkOran: number;
  sonOran: number;
  /** Puan: (son − ilk) × 100. */
  fark: number;
  /** İki ölçüm arasında yürürlükte olan bir planın işinde bu konu vardı. */
  planda: boolean;
}

/** Türkiye UTC+3 (yaz saati yok): @db.Date haftanın başlangıç anına. */
const TR_FARK_MS = 3 * 3600_000;

/**
 * Aynı öğrencinin aynı konudaki ilk ve son ölçümü. Yalnızca o konuda en az
 * KAZANC_EN_AZ_SORU soru soran ölçümler sayılır; iki ayrı ölçüm gerekir.
 *
 * "Planda": öğrencinin, haftası iki ölçüm arasına düşen (ilk ölçümün
 * haftasında ya da sonra başlayan, son ölçümden önce başlamış) bir planının
 * işinde bu konu vardı. Son ölçümden sonra kurulan plan o farkı açıklayamaz.
 */
export function kazancEslestir(
  sonuclar: readonly KazancSonucu[],
  planlar: readonly PlanKonusu[],
  oncekiDenemeler: readonly { userId: string; packageId: string }[] = []
): KazancEslesmesi[] {
  const olcumler = kazancOlcumleri(sonuclar, oncekiDenemeler);
  const ciftler = new Map<string, { userId: string; topicId: string; name: string; seri: { an: Date; oran: number }[] }>();
  for (const r of olcumler) {
    for (const t of r.konular) {
      if (t.asked < KAZANC_EN_AZ_SORU) continue;
      const anahtar = r.userId + "|" + t.topicId;
      const c = ciftler.get(anahtar) ?? { userId: r.userId, topicId: t.topicId, name: t.name, seri: [] };
      c.seri.push({ an: r.an, oran: t.correct / t.asked });
      ciftler.set(anahtar, c);
    }
  }

  const planHaftalari = new Map<string, number[]>();
  for (const p of planlar) {
    const anahtar = p.userId + "|" + p.topicId;
    const l = planHaftalari.get(anahtar) ?? [];
    l.push(p.weekStart.getTime() - TR_FARK_MS);
    planHaftalari.set(anahtar, l);
  }

  const sonuc: KazancEslesmesi[] = [];
  for (const [anahtar, c] of ciftler) {
    if (c.seri.length < 2) continue;
    const ilk = c.seri[0];
    const son = c.seri[c.seri.length - 1];
    const planda = (planHaftalari.get(anahtar) ?? []).some(
      (bas) => bas + HAFTA > ilk.an.getTime() && bas < son.an.getTime()
    );
    sonuc.push({
      userId: c.userId,
      topicId: c.topicId,
      name: c.name,
      ilkOran: ilk.oran,
      sonOran: son.oran,
      fark: (son.oran - ilk.oran) * 100,
      planda,
    });
  }
  return sonuc;
}

export interface KazancGrubu {
  /** Farklı öğrenci. */
  ogrenci: number;
  /** Öğrenci × konu eşleşmesi. */
  eslesme: number;
  /** Ortalama yazılacak kadar öğrenci var mı (KAZANC_EN_AZ_OGRENCI). */
  yeterli: boolean;
  /** Ortalama değişim (puan); veri yetersizse null. */
  ortalama: number | null;
  /** En az ANLAMLI_ARTIS_PUAN yükselen eşleşme. */
  anlamliArtis: number;
}

function kazancGrubu(eslesmeler: readonly KazancEslesmesi[]): KazancGrubu {
  const ogrenci = new Set(eslesmeler.map((e) => e.userId)).size;
  const yeterli = ogrenci >= KAZANC_EN_AZ_OGRENCI;
  const toplam = eslesmeler.reduce((s, e) => s + e.fark, 0);
  return {
    ogrenci,
    eslesme: eslesmeler.length,
    yeterli,
    ortalama: yeterli && eslesmeler.length > 0 ? toplam / eslesmeler.length : null,
    anlamliArtis: eslesmeler.filter((e) => e.fark >= ANLAMLI_ARTIS_PUAN).length,
  };
}

export interface KazancOzeti {
  hepsi: KazancGrubu;
  planda: KazancGrubu;
  planDisi: KazancGrubu;
  /** Asıl kanıt: planda − plan dışı ortalama (puan). İki grup da yeterliyse. */
  fark: number | null;
  konular: { topicId: string; name: string; hepsi: KazancGrubu; planda: KazancGrubu; planDisi: KazancGrubu }[];
}

/** Eşleşmelerden toplam ve konu başına özet; az veride ortalama yok. */
export function kazancOzeti(eslesmeler: readonly KazancEslesmesi[]): KazancOzeti {
  const ayir = (l: readonly KazancEslesmesi[]) => ({
    hepsi: kazancGrubu(l),
    planda: kazancGrubu(l.filter((e) => e.planda)),
    planDisi: kazancGrubu(l.filter((e) => !e.planda)),
  });
  const genel = ayir(eslesmeler);
  const konuMap = new Map<string, KazancEslesmesi[]>();
  for (const e of eslesmeler) konuMap.set(e.topicId, [...(konuMap.get(e.topicId) ?? []), e]);
  const konular = [...konuMap.entries()]
    .map(([topicId, l]) => ({ topicId, name: l[0].name, ...ayir(l) }))
    .sort((a, b) => b.hepsi.ogrenci - a.hepsi.ogrenci || a.name.localeCompare(b.name, "tr"));
  return {
    ...genel,
    fark:
      genel.planda.ortalama !== null && genel.planDisi.ortalama !== null
        ? genel.planda.ortalama - genel.planDisi.ortalama
        : null,
    konular,
  };
}

/** Kontrol testinin sonucu ve odak konusu. */
export interface KontrolSonucu extends SonucSayilari {
  userId: string;
  kind: string;
  endedBy: string | null;
  focusTopicId: string | null;
  konular: readonly (KonuSayisi & { level: TopicLevel | null })[];
}

/**
 * Kontrol testini geçen: odak konusunda öğrencinin sonuç ekranında "konu
 * oturmuş" gördüğü karar (shared/coaching.ts kontrolKarari, ton "ok" =
 * puanlamanın "güçlü" seviyesi). Ölçüm sayılmayan (boş/yarım) test sayılmaz.
 */
export function kontrolTestleri(sonuclar: readonly KontrolSonucu[]): { olculen: number; gecen: number; ogrenci: number } {
  let olculen = 0;
  let gecen = 0;
  const ogrenci = new Set<string>();
  for (const r of sonuclar) {
    if (r.kind !== "TOPIC_RETEST" || !konuHaritasinaGirer(r)) continue;
    const odak = r.konular.find((t) => t.topicId === r.focusTopicId);
    if (!odak) continue;
    olculen++;
    ogrenci.add(r.userId);
    if (kontrolKarari(odak, null).ton === "ok") gecen++;
  }
  return { olculen, gecen, ogrenci: ogrenci.size };
}

// ─────────────────────────────────────────────────────────────
// (e) Zorluk algısı
// ─────────────────────────────────────────────────────────────

export const ALGI_ETIKETI: Record<1 | 2 | 3, string> = { 1: "Kolay", 2: "Uygun", 3: "Zor" };

export interface AlgiSatiri extends SonucSayilari {
  userId: string;
  packageId: string;
  paketAdi: string;
  kind: string;
  endedBy: string | null;
  /** CheckupSession.perceivedDifficulty: 1 kolay, 2 uygun, 3 zor. */
  algi: number;
}

export interface AlgiPaketi {
  packageId: string;
  ad: string;
  cevap: number;
  /** Kolay, uygun, zor: kaç cevap ve o testlerin doğru / sorulan toplamı. */
  kategoriler: { algi: 1 | 2 | 3; cevap: number; dogru: number; soru: number }[];
  dogru: number;
  soru: number;
}

/**
 * Paket başına zorluk algısı ve aynı testlerin gerçek doğru oranı. Yalnızca
 * ölçüm sayılan testler (yarım testin oranı boşlarla düşer); en az
 * ZORLUK_EN_AZ_CEVAP cevaplı paketler. `gizlenen`: eşiğin altında kalan paket.
 */
export function zorlukAlgisi(satirlar: readonly AlgiSatiri[]): {
  paketler: AlgiPaketi[];
  gizlenen: number;
  /** Cevabı sayılan farklı öğrenci (bütün paketler). */
  ogrenci: number;
} {
  const map = new Map<string, AlgiPaketi>();
  const ogrenci = new Set<string>();
  for (const r of satirlar) {
    if (r.algi !== 1 && r.algi !== 2 && r.algi !== 3) continue;
    if (olcumDisi(r)) continue;
    ogrenci.add(r.userId);
    const p = map.get(r.packageId) ?? {
      packageId: r.packageId,
      ad: r.paketAdi,
      cevap: 0,
      kategoriler: ([1, 2, 3] as const).map((algi) => ({ algi, cevap: 0, dogru: 0, soru: 0 })),
      dogru: 0,
      soru: 0,
    };
    const soru = r.correctCount + r.wrongCount + r.blankCount;
    const k = p.kategoriler[r.algi - 1];
    k.cevap++;
    k.dogru += r.correctCount;
    k.soru += soru;
    p.cevap++;
    p.dogru += r.correctCount;
    p.soru += soru;
    map.set(r.packageId, p);
  }
  const hepsi = [...map.values()];
  const paketler = hepsi
    .filter((p) => p.cevap >= ZORLUK_EN_AZ_CEVAP)
    .sort((a, b) => b.cevap - a.cevap || a.ad.localeCompare(b.ad, "tr"));
  return { paketler, gizlenen: hepsi.length - paketler.length, ogrenci: ogrenci.size };
}

// ─────────────────────────────────────────────────────────────
// (f) Kayıt kaynağı
// ─────────────────────────────────────────────────────────────

/**
 * kocum.net bağlantılarının izin listesi (app-hesap ajanının listesiyle aynı;
 * öğrenci uygulaması bunun dışını kaydetmez). Sıra ekranın sırası.
 */
export const KAYIT_KAYNAKLARI = ["ust", "hero", "bolum", "altbilgi", "blog", "iletisim", "whatsapp", "instagram", "diger"] as const;
export type KayitKaynagi = (typeof KAYIT_KAYNAKLARI)[number];

export const KAYNAK_ETIKETI: Record<KayitKaynagi | "bilinmiyor", string> = {
  ust: "Site üst menüsü",
  hero: "Ana sayfa giriş bölümü",
  bolum: "Ana sayfa check-up bölümü",
  altbilgi: "Site altbilgisi",
  blog: "Blog yazıları",
  iletisim: "İletişim sayfası",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  diger: "Diğer",
  bilinmiyor: "Etiketsiz (doğrudan ya da bilinmiyor)",
};

export interface KaynakSatiri {
  kaynak: KayitKaynagi | "bilinmiyor";
  ad: string;
  kayit: number;
  olcum: number;
}

/** Kayıt kaynağı başına kayıt ve ilk ölçüm sayısı. İzin listesi dışı ya da boş: "bilinmiyor". */
export function kaynakDagilimi(satirlar: readonly { signupSource: string | null; ilkOlcum: boolean }[]): KaynakSatiri[] {
  const map = new Map<KayitKaynagi | "bilinmiyor", KaynakSatiri>();
  for (const r of satirlar) {
    const kaynak = (KAYIT_KAYNAKLARI as readonly string[]).includes(r.signupSource ?? "")
      ? (r.signupSource as KayitKaynagi)
      : "bilinmiyor";
    const s = map.get(kaynak) ?? { kaynak, ad: KAYNAK_ETIKETI[kaynak], kayit: 0, olcum: 0 };
    s.kayit++;
    if (r.ilkOlcum) s.olcum++;
    map.set(kaynak, s);
  }
  const sira = (k: KaynakSatiri["kaynak"]) => (k === "bilinmiyor" ? 99 : KAYIT_KAYNAKLARI.indexOf(k));
  return [...map.values()].sort((a, b) => b.kayit - a.kayit || sira(a.kaynak) - sira(b.kaynak));
}

// ─────────────────────────────────────────────────────────────
// Havuzun tükenmesi (havuz ekranı)
// ─────────────────────────────────────────────────────────────

export interface HavuzTukenmesi {
  topicId: string;
  /** Son 14 günde bu konudan soru içeren oturum. */
  oturum: number;
  /** Bunlardan bu konuda öğrenciye daha önce gördüğü soru gelen. */
  tekrarli: number;
  /** Yayındaki soru. */
  yayinda: number;
}

/**
 * "Önce yazılacak konular": tekrar soru oranı en yüksek konular. En az
 * HAVUZ_EN_AZ_OTURUM oturumda sorulmamış konu oranı gürültü olduğu için girmez;
 * eşitlikte yayında az sorusu olan öne.
 */
export function onceYazilacaklar<T extends HavuzTukenmesi>(satirlar: readonly T[]): T[] {
  return satirlar
    .filter((r) => r.oturum >= HAVUZ_EN_AZ_OTURUM && r.tekrarli > 0)
    .sort((a, b) => b.tekrarli / b.oturum - a.tekrarli / a.oturum || a.yayinda - b.yayinda)
    .slice(0, HAVUZ_LISTE_UZUNLUGU);
}
