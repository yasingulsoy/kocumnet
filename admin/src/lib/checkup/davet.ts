/**
 * Grup davet bağlantısı — panelin kuralları. Saf modül: eylem (sunucu),
 * davet kartı (istemci) ve test betiği (app/scripts/koc-panel-test.mts) aynı
 * sabitleri kullanır.
 *
 * Öğrenci `/katil/<kod>` bağlantısıyla gruba kendisi girer; kodu öğrenci
 * uygulaması doğrular (app/lib/grup-katilim.ts kodGecerliMi). BİÇİM İKİ
 * TARAFTA EŞİT OLMALI: panelin ürettiği kodu uygulama reddederse koçun
 * dağıttığı bağlantı sınıfın önünde "geçersiz" der. Şimdilik elle tutulan
 * ayna: app/scripts/koc-panel-test.mts iki dosyanın alfabesini, uzunluğunu,
 * damgasını ve birbirinin ürettiği kodu kabul ettiğini denetler.
 * grup-katilim.ts checkup-sync MODULLER listesine alınırsa buradaki sabitler
 * shared/ kopyasından okunmalı.
 *
 * Kod tahtaya yazılıp okunacak: karışan karakter yok (0/O, 1/I). 32 karakterli
 * alfabe × 8 hane = 2^40 olasılık; kod tahmin edilemez, kriptografik
 * rastgelelikten üretilir. Koç "Yenile" deyince yeni kod yazılır, eski
 * bağlantı çalışmaz; "Kapat" kodu siler (StudyGroup.joinCode boş = davet kapalı).
 */

export const DAVET_KODU_UZUNLUGU = 8;

/** 24 harf (I ve O yok) + 8 rakam (0 ve 1 yok) = 32: bir baytın son 5 biti eşit dağılır. */
export const DAVET_KODU_ALFABESI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const DAVET_KODU_DESENI = /^[A-HJ-NP-Z2-9]{8}$/;

/** Benzersizlik çakışmasında kaç kez yeniden denenir (2^40'ta çakışma pratikte olmaz). */
export const DAVET_KODU_DENEME = 5;

/**
 * Davetle katılan üyenin `GroupMember.addedByStaff` damgası. Personel değil,
 * öğrencinin kendisi katıldı; alan zorunlu olduğu için sabit bir değer.
 * Öğrenci uygulaması (app/lib/grup-katilim.ts) AYNI değeri yazmalı; üye
 * listesi "davetle katıldı"yı buna bakarak gösterir.
 */
export const DAVET_DAMGASI = "davet bağlantısı";

export function davetleKatildi(addedByStaff: string | null | undefined): boolean {
  return addedByStaff === DAVET_DAMGASI;
}

/**
 * Yeni kod. `rastgele` test içindir; verilmezse Web Crypto (sunucuda Node'un
 * globalThis.crypto'su). Math.random tahmin edilebilir, kullanılmaz.
 */
export function davetKoduUret(rastgele: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const baytlar = rastgele(DAVET_KODU_UZUNLUGU);
  let kod = "";
  for (let i = 0; i < DAVET_KODU_UZUNLUGU; i++) kod += DAVET_KODU_ALFABESI[baytlar[i] & 31];
  return kod;
}

export function davetKoduGecerli(kod: unknown): kod is string {
  return typeof kod === "string" && DAVET_KODU_DESENI.test(kod);
}

/**
 * Elle yazılmış kod: boşluk ve tire atılır, büyük harfe çevrilir. Tahtadan
 * "abcd-2345" diye yazan öğrenci de girebilsin (uygulama tarafının işi; panel
 * yalnızca testte kullanıyor).
 */
export function davetKoduCoz(ham: string): string | null {
  const kod = ham.replace(/[\s-]+/g, "").toUpperCase();
  return davetKoduGecerli(kod) ? kod : null;
}

/** Tahtaya yazmak için: "ABCD 2345". Bağlantıdaki kodda boşluk yok. */
export function davetKoduOkunur(kod: string): string {
  return kod.length === DAVET_KODU_UZUNLUGU ? kod.slice(0, 4) + " " + kod.slice(4) : kod;
}

export function davetBaglantisi(uygulamaKoku: string, kod: string): string {
  return uygulamaKoku.replace(/\/$/, "") + "/katil/" + kod;
}
