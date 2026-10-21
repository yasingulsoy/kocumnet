/**
 * Süre ve strateji analizi — saf modül, veritabanı bilmez, hiçbir şey import
 * etmez. Veriyi lib/checkup.ts (sureAnaliziGetir) kurar; testleri
 * scripts/deneme-test.mts.
 *
 * Yalnızca EKRANDA, SÜRELİ ve puanlanmış oturumlar için: kâğıtta soru başına
 * süre ve çözüm sırası yok, alıştırma ölçüm değil (çağıran eler).
 *
 * Konu haritası "neyi bilmiyorsun" der; bu analiz "bildiğini sınavda nasıl
 * kaybediyorsun" der. Koçun deneme sonrası ilk sorusu budur: hangi soruda
 * takıldın, sırayla mı gittin, son dakikaya ne bıraktın.
 */

/** Hedef sürenin kaç katı "takıldın" sayılır. */
export const TAKILMA_KATI = 2;

/** Boş bırakılan soruda hedef sürenin kaç katı "uzun süre harcadın" sayılır. */
export const UZUN_BOS_KATI = 1;

/** Sondaki pencere (dakika): "son 10 dakikada kaç soru işaretledin". */
export const SON_DAKIKA_PENCERESI = 10;

/**
 * Son dakika ölçüsü yalnızca bu süreden uzun testlerde: 8 dakikalık kontrol
 * testinde "son 10 dakika" testin tamamıdır, bir şey söylemez.
 */
const SON_DAKIKA_EN_AZ_SURE_DK = 2 * SON_DAKIKA_PENCERESI;

/** Çözüm sırası ancak bu kadar işaretle anlamlı. */
const SIRA_EN_AZ_ISARET = 4;

/**
 * Turlama: ilk tur testin son beşte birine ulaştıysa ve en az bu kadar soruya
 * sonradan dönüldüyse. Tek soruya dönmek turlama değil, atlayıp dönmektir.
 */
const TURLAMA_UC_PAYI = 0.8;
const TURLAMA_EN_AZ_DONUS = 2;

/** Bu sürenin altında kalan sondaki boş soru "hiç ulaşılmadı" sayılır. */
const ULASILMADI_MS = 5_000;

export type MaddeDurumu = "dogru" | "yanlis" | "bos";

export interface SureMaddesi {
  /** Soru sırası (0'dan). */
  sira: number;
  sureMs: number;
  hedefSn: number;
  durum: MaddeDurumu;
  /** İlk işaretleme anı (Answer.firstAnsweredAt). Eski satırlarda yok. */
  ilkIsaret: Date | null;
  /** Son değişiklik anı (Answer.answeredAt); boş maddede verilmez. */
  sonIsaret: Date | null;
}

export interface SureGirdisi {
  baslangic: Date;
  sureDk: number;
  /** Öğrencinin bitirdiği an; süre dolup bakım puanladıysa null. */
  bitis: Date | null;
  maddeler: readonly SureMaddesi[];
}

export type SiraTuru = "SIRALI" | "TURLAMA" | "ATLAMALI";

export interface Tavsiye {
  metin: string;
  ton: "ok" | "warn";
}

export interface SureAnaliziSonucu {
  soruSayisi: number;
  ortalamaMs: number;
  hedefOrtalamaMs: number;
  /** Ortalama süre / ortalama hedef. */
  hedefOrani: number;
  /** Kullanılan süre / izin verilen süre (0-1). */
  kullanilanPay: number;
  takilinanlar: { sira: number; sureMs: number; hedefSn: number; durum: MaddeDurumu }[];
  uzunBoslar: { sira: number; sureMs: number }[];
  /** Eski satırda ilk işaret zamanı yoksa null (sıra analizi atlanır). */
  sira: { tur: SiraTuru; donulen: number; turSayisi: number } | null;
  /** İzin verilen sürenin ilk ve son yarısında işaretlenen soru sayısı. */
  yarilar: { ilk: number; son: number } | null;
  /** Sınav süresinin son 10 dakikasında işaretlenen; kısa testte null. */
  sonDakika: { dakika: number; sayi: number; yanlis: number } | null;
  /** Sondan art arda hiç bakılmamış boş soru sayısı. */
  ulasilmayan: number;
  tavsiyeler: Tavsiye[];
}

/** "3 dk 10 sn", "45 sn". */
export function sureMetni(ms: number): string {
  const sn = Math.max(0, Math.round(ms / 1000));
  const dk = Math.floor(sn / 60);
  const kalan = sn % 60;
  if (dk === 0) return `${kalan} sn`;
  return kalan === 0 ? `${dk} dk` : `${dk} dk ${kalan} sn`;
}

/** Dakika, bir ondalık: 1,5 dk. */
function dakikaMetni(ms: number): string {
  const dk = Math.round(ms / 6_000) / 10;
  return `${dk.toLocaleString("tr-TR")} dk`;
}

function isaretZamani(m: SureMaddesi): Date | null {
  if (m.durum === "bos") return null;
  return m.ilkIsaret ?? m.sonIsaret;
}

/**
 * Çözüm sırası: ilk işaretleme sırası soru sırasından sapıyor mu.
 *
 * Dizi ilk işaret zamanına göre dizilir. Daha büyük numaralı bir soru zaten
 * işaretlenmişken işaretlenen soru "dönülen" sorudur; artan her bölüm bir tur.
 */
function siraAnalizi(maddeler: readonly SureMaddesi[]): SureAnaliziSonucu["sira"] {
  // Eski satır: işaretli bir maddede ilk işaret zamanı yoksa sırayı bilemeyiz.
  if (maddeler.some((m) => m.durum !== "bos" && m.ilkIsaret === null)) return null;
  // Sonradan silinen işaret de "o soruya o an baktı" demek: dizide kalır.
  const dizi = maddeler
    .filter((m): m is SureMaddesi & { ilkIsaret: Date } => m.ilkIsaret !== null)
    .sort((a, b) => a.ilkIsaret.getTime() - b.ilkIsaret.getTime() || a.sira - b.sira);
  if (dizi.length < SIRA_EN_AZ_ISARET) return null;

  let enBuyuk = -1;
  let onceki = -1;
  let donulen = 0;
  let turSayisi = 1;
  let ilkTurSonu = -1;
  let ilkTurBitti = false;
  for (const m of dizi) {
    if (m.sira < onceki) {
      turSayisi += 1;
      ilkTurBitti = true;
    }
    if (!ilkTurBitti) ilkTurSonu = m.sira;
    if (m.sira < enBuyuk) donulen += 1;
    enBuyuk = Math.max(enBuyuk, m.sira);
    onceki = m.sira;
  }

  const n = maddeler.length;
  const tur: SiraTuru =
    donulen === 0
      ? "SIRALI"
      : donulen >= TURLAMA_EN_AZ_DONUS && ilkTurSonu >= Math.floor(TURLAMA_UC_PAYI * (n - 1))
        ? "TURLAMA"
        : "ATLAMALI";
  return { tur, donulen, turSayisi };
}

export function sureAnalizi(g: SureGirdisi): SureAnaliziSonucu | null {
  const maddeler = [...g.maddeler].sort((a, b) => a.sira - b.sira);
  const n = maddeler.length;
  const toplamMs = maddeler.reduce((s, m) => s + Math.max(0, m.sureMs), 0);
  // Süresi hiç kaydedilmemiş oturum (eski kayıt, kâğıt): söylenecek bir şey yok.
  if (n === 0 || toplamMs === 0 || g.sureDk <= 0) return null;

  const hedefToplamMs = maddeler.reduce((s, m) => s + m.hedefSn * 1000, 0);
  const ortalamaMs = Math.round(toplamMs / n);
  const hedefOrtalamaMs = Math.round(hedefToplamMs / n);
  const hedefOrani = hedefToplamMs > 0 ? toplamMs / hedefToplamMs : 0;

  const izinMs = g.sureDk * 60_000;
  const sonAn = Math.min(
    g.baslangic.getTime() + izinMs,
    (g.bitis ?? new Date(g.baslangic.getTime() + izinMs)).getTime()
  );
  const kullanilanPay = Math.min(1, Math.max(0, (sonAn - g.baslangic.getTime()) / izinMs));

  const takilinanlar = maddeler
    .filter((m) => m.hedefSn > 0 && m.sureMs > m.hedefSn * 1000 * TAKILMA_KATI)
    .map((m) => ({ sira: m.sira, sureMs: m.sureMs, hedefSn: m.hedefSn, durum: m.durum }));

  const uzunBoslar = maddeler
    .filter((m) => m.durum === "bos" && m.hedefSn > 0 && m.sureMs >= m.hedefSn * 1000 * UZUN_BOS_KATI)
    .map((m) => ({ sira: m.sira, sureMs: m.sureMs }));

  // İşaret zamanları: ilk işaret, yoksa (eski satır) son değişiklik.
  const zamanli = maddeler
    .map((m) => ({ m, t: isaretZamani(m) }))
    .filter((x): x is { m: SureMaddesi; t: Date } => x.t !== null);

  const yariAn = g.baslangic.getTime() + izinMs / 2;
  const yarilar =
    zamanli.length > 0
      ? {
          ilk: zamanli.filter((x) => x.t.getTime() < yariAn).length,
          son: zamanli.filter((x) => x.t.getTime() >= yariAn).length,
        }
      : null;

  const sonDakika =
    g.sureDk >= SON_DAKIKA_EN_AZ_SURE_DK && zamanli.length > 0
      ? (() => {
          // Pencere SINAV SÜRESİNİN son 10 dakikası: erken bitiren öğrenci
          // için 0 — sıkışmamış demek. Bitişe göre alınsaydı 10 dakikada
          // bitiren herkes "her şeyi son dakikada işaretledi" görünürdü.
          const esik = g.baslangic.getTime() + izinMs - SON_DAKIKA_PENCERESI * 60_000;
          const son = zamanli.filter((x) => x.t.getTime() >= esik);
          return {
            dakika: SON_DAKIKA_PENCERESI,
            sayi: son.length,
            yanlis: son.filter((x) => x.m.durum === "yanlis").length,
          };
        })()
      : null;

  let ulasilmayan = 0;
  for (let i = n - 1; i >= 0; i--) {
    const m = maddeler[i];
    if (m.durum !== "bos" || m.ilkIsaret !== null || m.sureMs >= ULASILMADI_MS) break;
    ulasilmayan += 1;
  }

  const sira = siraAnalizi(maddeler);

  const sonuc: SureAnaliziSonucu = {
    soruSayisi: n,
    ortalamaMs,
    hedefOrtalamaMs,
    hedefOrani,
    kullanilanPay,
    takilinanlar,
    uzunBoslar,
    sira,
    yarilar,
    sonDakika,
    ulasilmayan,
    tavsiyeler: [],
  };
  sonuc.tavsiyeler = tavsiyeler(sonuc, maddeler);
  return sonuc;
}

/** Soru numarası öğrencinin gördüğü gibi (1'den). */
const no = (sira: number) => `${sira + 1}.`;

/**
 * Koçun 1-3 cümlesi. Her biri bir sayı ve tek bir eylem içerir (lib/coaching.ts
 * üslubu); sıra önceliktir: önce net kaybettiren süre hatası, sonra taktik.
 * Söylenecek bir kusur yoksa tek bir olumlu cümle.
 */
function tavsiyeler(a: SureAnaliziSonucu, maddeler: readonly SureMaddesi[]): Tavsiye[] {
  const out: Tavsiye[] = [];
  const esikMetni = dakikaMetni(a.hedefOrtalamaMs * TAKILMA_KATI);

  if (a.takilinanlar.length === 1) {
    const t = a.takilinanlar[0];
    out.push({
      ton: "warn",
      metin: `${no(t.sira)} soruda ${sureMetni(t.sureMs)} kaldın, hedefin iki katından fazla. Bir soruda ${esikMetni} dolunca işaretle ve geç; turun sonunda dönersin.`,
    });
  } else if (a.takilinanlar.length > 1) {
    const toplam = a.takilinanlar.reduce((s, t) => s + t.sureMs, 0);
    // Hedefin üstüne harcanan kısım: bu sorulara zaten ayrılacak süre sayılmaz.
    const fazla = a.takilinanlar.reduce((s, t) => s + Math.max(0, t.sureMs - t.hedefSn * 1000), 0);
    const kac = a.hedefOrtalamaMs > 0 ? Math.floor(fazla / a.hedefOrtalamaMs) : 0;
    out.push({
      ton: "warn",
      metin: `${a.takilinanlar.length} soruda hedefin iki katından fazla kaldın; toplam ${dakikaMetni(toplam)}.${kac >= 2 ? ` Bu sürede ${kac} soru daha çözülürdü.` : ""} Bir soruda ${esikMetni} dolunca işaretle ve geç.`,
    });
  }

  if (a.uzunBoslar.length > 0) {
    const toplam = a.uzunBoslar.reduce((s, t) => s + t.sureMs, 0);
    out.push({
      ton: "warn",
      metin:
        a.uzunBoslar.length === 1
          ? `${no(a.uzunBoslar[0].sira)} soruya ${sureMetni(toplam)} verip boş bıraktın. İlk okumada yol göremediğin soruyu hemen bırakmak da bir beceri.`
          : `${a.uzunBoslar.length} soruda toplam ${dakikaMetni(toplam)} harcayıp boş bıraktın. İlk okumada yol göremediğin soruyu hemen bırak; o süre bildiğin sorulara lazım.`,
    });
  }

  if (a.ulasilmayan >= 2 && a.sira?.tur !== "TURLAMA") {
    out.push({
      ton: "warn",
      metin: `Son ${a.ulasilmayan} soruya hiç ulaşamadın. Turlama dene: ilk turda emin olduklarını çöz, takıldığını atla; ikinci turda dön.`,
    });
  }

  if (a.sonDakika && a.sonDakika.sayi >= 4 && a.sonDakika.sayi >= Math.ceil(a.soruSayisi * 0.3)) {
    out.push({
      ton: "warn",
      metin: `Soruların ${a.sonDakika.sayi} tanesini son ${a.sonDakika.dakika} dakikada işaretledin${a.sonDakika.yanlis > 0 ? `, ${a.sonDakika.yanlis} tanesi yanlış` : ""}. Son dakikaya yığılan soru acele demek; ilk yarıda tempoyu artır.`,
    });
  }

  const dogru = maddeler.filter((m) => m.durum === "dogru").length;
  const yanlis = maddeler.filter((m) => m.durum === "yanlis").length;
  if (a.kullanilanPay < 0.6 && yanlis >= 3 && yanlis * 2 >= dogru) {
    out.push({
      ton: "warn",
      metin: `Sürenin yalnızca %${Math.round(a.kullanilanPay * 100)} kadarını kullanıp bitirdin ve ${yanlis} yanlışın var. Kalan süre kontrol içindir: işaretlediklerini bir tur daha gez.`,
    });
  }

  if (a.yarilar && a.yarilar.ilk + a.yarilar.son >= 6 && a.yarilar.ilk * 2 < a.yarilar.son) {
    out.push({
      ton: "warn",
      metin: `Sürenin ilk yarısında ${a.yarilar.ilk}, ikinci yarısında ${a.yarilar.son} soru işaretledin. Başlangıç yavaş: ilk turda emin olduğun soruları hızla işaretle.`,
    });
  }

  if (a.takilinanlar.length === 0 && a.hedefOrani > 1.3) {
    out.push({
      ton: "warn",
      metin: `Soru başına ortalaman ${sureMetni(a.ortalamaMs)}, hedef ${sureMetni(a.hedefOrtalamaMs)}. Hız konu bilgisinden gelir: yavaş kaldığın konunun temel sorularını süre tutarak çöz.`,
    });
  }

  if (out.length === 0) {
    out.push({
      ton: "ok",
      metin:
        a.sira?.tur === "TURLAMA"
          ? `Turlayarak çözdün ve atladığın ${a.sira.donulen} soruya geri döndün; hiçbir soruda takılı kalmadın. Taktik doğru, böyle devam.`
          : "Süreni dengeli kullandın: hiçbir soruda takılı kalmadın, son dakikaya iş bırakmadın.",
    });
  }

  return out.slice(0, 3);
}
