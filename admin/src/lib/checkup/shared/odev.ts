// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/odev.ts · eşitlemek için: npm run checkup:sync

/**
 * Grup ödevi — kurallar. Saf modül: veritabanı bilmez, veri parametreyle gelir.
 *
 * PAYLAŞILAN: panel bu dosyanın kopyasını kullanır (admin/scripts/checkup-sync.mjs
 * → admin/src/lib/checkup/shared/odev.ts). Koçun ilerleme tablosundaki
 * "tamamladı" ile öğrencinin ekranındaki "tamamladın" aynı fonksiyondan
 * çıkmalı; iki ayrı yazım er geç ayrışır ve öğrenci "yaptım ama koç
 * yapmadın diyor" der. Bu yüzden burada `@/` importu YOK ve başka modüle
 * de bağlı değil (Türkiye günü hesabı da kendi içinde).
 *
 * TAMAMLANMA TÜRETİLİR, SAKLANMAZ ve öğrencinin "yaptım" işareti yok
 * (plandaki kontrol testiyle aynı ilke):
 *  - Paket ödevi: ödev açıldıktan (startsAt) sonra o paketin puanlanmış
 *    (SUBMITTED ya da EXPIRED) bir oturumunu bitirmek. Kâğıt oturumu da
 *    sayılır: cevaplar optik formdan işlenince oturum aynı biçimde biter.
 *    Hiç işaret konmadan biten oturum SAYILMAZ ("boş gönderildi"): boş
 *    gönderip cevaplara bakmak ödevi yapmak değil. Yarım kalan oturum da
 *    sayılmaz (öğrenci bitirmedi, soruların yarısından azı işaretli;
 *    uygulamada lib/insights.ts yarimKaldi): 24 sorunun 2'sini işaretleyip
 *    süreyi dolduran öğrenci ödevi yapmış görünüyordu.
 *  - Konu ödevi: startsAt'tan sonra o konunun alıştırma oturumlarında
 *    (CheckupSession.focusTopicId) toplam en az questionCount soru cevaplamak.
 * Bittiği an dueAt'tan sonraysa "geç tamamlandı".
 */

export const ODEV_TURLERI = ["PACKAGE", "TOPIC_PRACTICE"] as const;
export type OdevTuru = (typeof ODEV_TURLERI)[number];

export function isOdevTuru(value: unknown): value is OdevTuru {
  return typeof value === "string" && (ODEV_TURLERI as readonly string[]).includes(value);
}

/** Konu ödevinde istenebilecek soru sayısı. */
export const ODEV_SORU_ALT = 5;
export const ODEV_SORU_UST = 40;

/** Panelin önerdiği son tarih: bugünden bu kadar gün sonra, 23:59. */
export const VARSAYILAN_SURE_GUN = 7;
/** Panelde seçilebilecek en uzak son tarih (yanlışlıkla 2062 yazılmasın). */
export const EN_UZAK_SURE_GUN = 180;

/**
 * Son tarihi geçen ama bitmeyen ödev öğrencinin "açık" listesinde bu kadar
 * gün daha durur ("gecikti" rozetiyle): geç de olsa yapılması istenir,
 * panel onu "geç tamamladı" diye gösterir. Sonra "geçmiş"e düşer; yoksa
 * yapılmamış ödevler açık listede birikip asıl işi gömer.
 */
export const GECIKME_PENCERESI_GUN = 7;

/** "Bugün" kartı: son tarihi bu kadar gün içinde olan bitmemiş ödev öne geçer. */
export const BUGUN_ESIGI_GUN = 3;

export const ODEV_DURUMLARI = ["TAMAMLANDI", "GEC_TAMAMLANDI", "BASLADI", "BASLAMADI"] as const;
export type OdevDurumu = (typeof ODEV_DURUMLARI)[number];

/** Kuralın ödevden okuduğu alanlar (Assignment satırının alt kümesi). */
export interface OdevKurali {
  kind: string;
  packageId: string | null;
  topicId: string | null;
  questionCount: number | null;
  startsAt: Date;
  dueAt: Date;
}

/** Öğrencinin bir paket oturumu (ekranda ya da kâğıtta). */
export interface OdevOturumu {
  id: string;
  packageId: string;
  /** SessionStatus: IN_PROGRESS | SUBMITTED | EXPIRED | ABANDONED */
  status: string;
  /** SessionMode (ONLINE | PAPER). Kural BİLEREK bakmaz; testte kâğıt da sayılsın diye taşınıyor. */
  mode?: string;
  startedAt: Date;
  submittedAt: Date | null;
  expiresAt: Date;
  /** Sonuç satırının neti; sonuç yazılamamışsa (EXPIRED) null. */
  net: number | null;
  /**
   * En az bir soruya şık işaretlendi mi (doğru + yanlış > 0; uygulamada
   * lib/insights.ts isaretsiz). false ise oturum ödevi TAMAMLAMAZ. Sorgular
   * sonuç satırından okur; sonucu yazılamamış EXPIRED oturumda işaretli
   * cevapları sayar. Verilmezse işaretli sayılır (eski çağıranlar).
   */
  isaretli?: boolean;
  /**
   * Yarım kaldı: öğrenci bitirmedi (süre doldu ya da yeniden başlattı) ve
   * soruların yarısından azını işaretledi (uygulamada lib/insights.ts
   * yarimKaldi; bu dosya içe aktarmadığı için kural sorguda uygulanır).
   * true ise oturum ödevi TAMAMLAMAZ. Verilmezse yarım sayılmaz.
   */
  yarim?: boolean;
}

/** Bir alıştırma cevabı: hangi konunun alıştırmasında, ne zaman. */
export interface OdevCevabi {
  /** Oturumun focusTopicId'si. */
  topicId: string;
  answeredAt: Date;
}

export interface OdevIlerlemesi {
  durum: OdevDurumu;
  /** Paket: oturumun bittiği an. Konu: eşiği dolduran cevabın anı. */
  tamamlanmaAni: Date | null;
  /** Konu ödevinde ödev açıldıktan sonra cevaplanan soru; paket ödevinde bitirilen oturum (0/1). */
  cozulen: number;
  /** Konu ödevinde istenen soru; paket ödevinde 1. */
  hedef: number;
  /** Paket ödevi: ödevi tamamlayan İLK oturumun neti (ikinci deneme çözümler görülmüş hâlidir). */
  net: number | null;
  /** Ödevi tamamlayan oturum (sonuç ekranına bağlantı); konu ödevinde null. */
  oturumId: string | null;
  /** Paket ödevi bitmedi ama ödev açıldıktan sonra boş gönderilmiş (işaretsiz) bir oturumu var. */
  bosGonderildi: boolean;
  /** Paket ödevi bitmedi ama ödev açıldıktan sonra yarım kalmış (sayılmayan) bir oturumu var. */
  yarimKaldi: boolean;
}

export function tamamlandiMi(durum: OdevDurumu): boolean {
  return durum === "TAMAMLANDI" || durum === "GEC_TAMAMLANDI";
}

/**
 * Paket oturumunun bittiği an; bitmemişse null.
 * EXPIRED oturumda (puanlama yazılamadı) bitiş süresinin dolduğu an.
 */
export function oturumBitisi(o: Pick<OdevOturumu, "status" | "submittedAt" | "expiresAt">): Date | null {
  if (o.status !== "SUBMITTED" && o.status !== "EXPIRED") return null;
  return o.submittedAt ?? o.expiresAt;
}

/** Konu ödevinin hedefi: kayıttaki sayı, sınırların içine çekilmiş. */
export function konuHedefi(questionCount: number | null): number {
  const n = Math.round(questionCount ?? ODEV_SORU_ALT);
  return Math.min(ODEV_SORU_UST, Math.max(ODEV_SORU_ALT, Number.isFinite(n) ? n : ODEV_SORU_ALT));
}

/**
 * Bir öğrencinin bir ödevdeki durumu. `veri` o öğrencinin kayıtları;
 * başka paketin oturumları ve başka konunun cevapları gelebilir, süzülür.
 */
export function odevIlerlemesi(
  odev: OdevKurali,
  veri: { oturumlar: readonly OdevOturumu[]; cevaplar: readonly OdevCevabi[] }
): OdevIlerlemesi {
  const bas = odev.startsAt.getTime();
  const son = odev.dueAt.getTime();
  const sonuc = (an: Date) => (an.getTime() <= son ? "TAMAMLANDI" : "GEC_TAMAMLANDI") as OdevDurumu;

  if (odev.kind === "TOPIC_PRACTICE") {
    const hedef = konuHedefi(odev.questionCount);
    const cevaplar = odev.topicId
      ? veri.cevaplar
          .filter((c) => c.topicId === odev.topicId && c.answeredAt.getTime() >= bas)
          .sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())
      : [];
    const cozulen = cevaplar.length;
    if (cozulen >= hedef) {
      const an = cevaplar[hedef - 1].answeredAt;
      return {
        durum: sonuc(an),
        tamamlanmaAni: an,
        cozulen,
        hedef,
        net: null,
        oturumId: null,
        bosGonderildi: false,
        yarimKaldi: false,
      };
    }
    return {
      durum: cozulen > 0 ? "BASLADI" : "BASLAMADI",
      tamamlanmaAni: null,
      cozulen,
      hedef,
      net: null,
      oturumId: null,
      bosGonderildi: false,
      yarimKaldi: false,
    };
  }

  // Paket ödevi.
  const ilgili = odev.packageId ? veri.oturumlar.filter((o) => o.packageId === odev.packageId) : [];
  const bitenler = ilgili
    .map((o) => ({ o, an: oturumBitisi(o) }))
    .filter((x): x is { o: OdevOturumu; an: Date } => x.an !== null && x.an.getTime() >= bas)
    .sort((a, b) => a.an.getTime() - b.an.getTime());
  // İşaretsiz (boş gönderilen) ya da yarım kalan oturum ödevi tamamlamaz; "başladı" sayılır.
  const bos = (o: OdevOturumu) => o.isaretli === false;
  const yarim = (o: OdevOturumu) => !bos(o) && o.yarim === true;
  const sayilanlar = bitenler.filter((x) => !bos(x.o) && !yarim(x.o));

  if (sayilanlar.length > 0) {
    const ilk = sayilanlar[0];
    return {
      durum: sonuc(ilk.an),
      tamamlanmaAni: ilk.an,
      cozulen: 1,
      hedef: 1,
      net: ilk.o.net,
      oturumId: ilk.o.id,
      bosGonderildi: false,
      yarimKaldi: false,
    };
  }
  // Ödev açıldıktan sonra başlanmış (bırakılmış olsa da) ya da şu an süren oturum.
  const basladi = ilgili.some((o) => o.status === "IN_PROGRESS" || o.startedAt.getTime() >= bas);
  return {
    durum: basladi || bitenler.length > 0 ? "BASLADI" : "BASLAMADI",
    tamamlanmaAni: null,
    cozulen: 0,
    hedef: 1,
    net: null,
    oturumId: null,
    bosGonderildi: bitenler.some((x) => bos(x.o)),
    yarimKaldi: bitenler.some((x) => yarim(x.o)),
  };
}

/**
 * Öğrenci bu ödevi görür mü: iptal edilen ödev ve arşivlenen grubun ödevleri
 * öğrenciden kalkar (panelde durur). Üyelik ayrıca sorguda denetlenir.
 */
export function ogrenciGorur(
  odev: { cancelledAt: Date | null },
  grup: { archivedAt: Date | null }
): boolean {
  return odev.cancelledAt === null && grup.archivedAt === null;
}

const GUN_MS = 86_400_000;

/**
 * Türkiye saatiyle günün başı. Türkiye 2016'dan beri yıl boyu UTC+3
 * (lib/review.ts gunBasi ile aynı varsayım; o modül paylaşılmadığı için kopya).
 */
function trGunBasi(an: Date): number {
  return Date.parse(trTarih(an) + "T00:00:00+03:00");
}

/** Türkiye takvim günü "yyyy-aa-gg" (tarih alanının değeri de bu biçim). */
export function trTarih(an: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(an);
}

/** Son tarihe kaç Türkiye günü kaldı: bugün 0, yarın 1, dün -1. */
export function kalanGun(dueAt: Date, now: Date): number {
  return Math.round((trGunBasi(dueAt) - trGunBasi(now)) / GUN_MS);
}

/** "bugün", "yarın", "3 gün kaldı", "dün bitti", "2 gün gecikti". */
export function kalanGunMetni(dueAt: Date, now: Date): string {
  const g = kalanGun(dueAt, now);
  if (dueAt.getTime() < now.getTime()) {
    if (g >= 0) return "süresi bugün doldu";
    return g === -1 ? "dün bitti" : `${-g} gün gecikti`;
  }
  if (g === 0) return "bugün son gün";
  if (g === 1) return "yarın son gün";
  return `${g} gün kaldı`;
}

const TARIH = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Tarih alanından (yyyy-aa-gg) son an: o gün 23:59 Türkiye saati. Geçersiz
 * tarihte (31 Şubat, biçim dışı) null.
 */
export function sonTarihAni(gun: string): Date | null {
  const m = TARIH.exec(gun);
  if (!m) return null;
  const an = new Date(`${gun}T23:59:00+03:00`);
  if (Number.isNaN(an.getTime()) || trTarih(an) !== gun) return null;
  return an;
}

/** Panelin varsayılanı: `gun` gün sonrası (Türkiye takvimi), tarih alanı biçiminde. */
export function varsayilanSonTarih(now: Date, gun = VARSAYILAN_SURE_GUN): string {
  return trTarih(new Date(trGunBasi(now) + gun * GUN_MS + 12 * 3_600_000));
}

/** Seçilebilecek en uzak son tarih (tarih alanının `max`'ı da bu). */
export function enGecSonTarih(now: Date): string {
  return varsayilanSonTarih(now, EN_UZAK_SURE_GUN);
}

export type SonTarihSonucu = { ok: true; dueAt: Date } | { ok: false; hata: string };

/**
 * Paneldeki son tarih seçimi — ödev verirken de süre uzatırken de aynı kural:
 * geçerli gün, şimdiden sonra, en geç EN_UZAK_SURE_GUN gün sonra. `eski`
 * verilirse (uzatma) yeni gün eskisinden SONRA olmalı: "uzatma" kısaltmaya
 * dönüşüp zamanında bitirmiş öğrenciyi geriye dönük "geç" yapmasın.
 */
export function sonTarihDenetle(gun: string, now: Date, eski?: Date): SonTarihSonucu {
  const dueAt = sonTarihAni(gun);
  if (!dueAt) return { ok: false, hata: "Geçerli bir tarih seç." };
  // "yyyy-aa-gg" metinleri sözlük sırasıyla tarih sırasında.
  if (eski && gun <= trTarih(eski)) return { ok: false, hata: "Yeni son tarih eskisinden sonra olmalı." };
  if (dueAt.getTime() <= now.getTime()) return { ok: false, hata: "Son tarih bugün ya da sonrası olmalı." };
  if (gun > enGecSonTarih(now)) return { ok: false, hata: `Son tarih en fazla ${EN_UZAK_SURE_GUN} gün sonrası olabilir.` };
  return { ok: true, dueAt };
}

/** Uzatmada seçilebilecek en erken gün: eski son tarihin ertesi ya da bugün, hangisi geçse. */
export function uzatmaEnErken(eski: Date, now: Date): string {
  const ertesi = varsayilanSonTarih(eski, 1);
  const bugun = trTarih(now);
  return ertesi > bugun ? ertesi : bugun;
}

/**
 * Uzatma önerisi: eski son tarih ile bugünden geç olanın VARSAYILAN_SURE_GUN
 * gün sonrası (gecikmiş ödevde bugünden bir hafta), en uzak sınırı aşmadan.
 */
export function uzatmaOnerisi(eski: Date, now: Date): string {
  const oneri = varsayilanSonTarih(eski.getTime() > now.getTime() ? eski : now);
  const sinir = enGecSonTarih(now);
  return oneri > sinir ? sinir : oneri;
}

/** Otomatik başlık: paket adı ya da "Üçgenler: 20 soru alıştırma". Koç değiştirebilir. */
export function odevBasligi(
  g: { kind: "PACKAGE"; paketAdi: string } | { kind: "TOPIC_PRACTICE"; konuAdi: string; soruSayisi: number }
): string {
  return g.kind === "PACKAGE" ? g.paketAdi : `${g.konuAdi}: ${g.soruSayisi} soru alıştırma`;
}

/** Öğrenci ekranı: ödev açık listede mi, geçmişte mi. */
export function odevBolumu(odev: { dueAt: Date }, ilerleme: Pick<OdevIlerlemesi, "durum">, now: Date): "ACIK" | "GECMIS" {
  if (tamamlandiMi(ilerleme.durum)) return "GECMIS";
  return now.getTime() <= odev.dueAt.getTime() + GECIKME_PENCERESI_GUN * GUN_MS ? "ACIK" : "GECMIS";
}

/** Son tarih geçti ve ödev bitmedi. */
export function geciktiMi(odev: { dueAt: Date }, ilerleme: Pick<OdevIlerlemesi, "durum">, now: Date): boolean {
  return !tamamlandiMi(ilerleme.durum) && now.getTime() > odev.dueAt.getTime();
}

/**
 * "Bugün" kartına girecek ödev: son tarihi henüz geçmemiş ve en fazla
 * BUGUN_ESIGI_GUN Türkiye günü sonra olan, bitmemiş ödevlerden son tarihi en
 * yakın olanı. Gecikmiş ödev karta girmez (o, ödevler sayfasında "gecikti").
 */
export function bugunOdevi<T extends { dueAt: Date; ilerleme: Pick<OdevIlerlemesi, "durum"> }>(
  odevler: readonly T[],
  now: Date
): T | null {
  const adaylar = odevler.filter(
    (o) =>
      !tamamlandiMi(o.ilerleme.durum) &&
      o.dueAt.getTime() >= now.getTime() &&
      kalanGun(o.dueAt, now) <= BUGUN_ESIGI_GUN
  );
  if (adaylar.length === 0) return null;
  return [...adaylar].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
}

/** Tamamlanma oranı (0-1): tamamlanan (geç dahil) / hepsi. Boş listede null. */
export function tamamlanmaOrani(ilerlemeler: readonly Pick<OdevIlerlemesi, "durum">[]): number | null {
  if (ilerlemeler.length === 0) return null;
  return ilerlemeler.filter((i) => tamamlandiMi(i.durum)).length / ilerlemeler.length;
}
