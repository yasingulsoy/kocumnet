/**
 * "Hocaya sorular" — içerik ve kural kararlarını hocaya soran ekranın veri tipleri.
 *
 * Sorular KODDA durur (sorular.ts): sürümlenir, gözden geçirilir, Word belgesi
 * de aynı kaynaktan üretilir (app/scripts/hoca-belgesi.mts). Cevaplar
 * veritabanında (TeacherAnswer), soru `anahtar`ına bağlı: soru metni
 * değişse de verilmiş cevap kaybolmaz.
 *
 * Okuyucu yazılımcı değil, matematik öğretmeni. Bu yüzden:
 *  - dosya yolu, tablo adı, İngilizce terim YOK; "öğrenci ekranında şunu görür" dili;
 *  - her soruda sistemin ŞU AN ne yaptığı yazılı — hoca cevap vermezse o kalır;
 *  - cevap çoğunlukla bir işaret: "uygun" ya da bir seçenek; yazmak isteğe bağlı.
 *
 * Bu dosya hiçbir şey içe aktarmaz: hem panel hem belge betiği kullanır.
 */

/** Seçenekli sorularda bir seçenek. */
export interface Secenek {
  /** Kalıcı değer (cevap bununla saklanır). */
  deger: string;
  /** Hocanın gördüğü kısa metin. */
  etiket: string;
  /** İsteğe bağlı bir cümlelik açıklama. */
  aciklama?: string;
  /** Bizim önerimiz: ekranda "önerimiz" rozeti. */
  onerilen?: boolean;
}

/** Tablo sorularında bir sütun (ör. "Yanlış götürme", "Sınav tarihi"). */
export interface TabloSutunu {
  anahtar: string;
  baslik: string;
  /** Hücreye ne yazılır. "metin" serbest; "sayi" yalnızca sayı; "tarih" GG.AA.YYYY. */
  tur: "metin" | "sayi" | "tarih";
  /** Ör. "dakika", "soru". */
  birim?: string;
  /** Sütun başlığının altındaki kısa yardım. */
  yardim?: string;
}

/** Tablo sorularında bir satır (ör. bir sınav). Satırlar sabittir; hoca hücreleri doldurur. */
export interface TabloSatiri {
  anahtar: string;
  baslik: string;
  /**
   * Sistemdeki ŞU ANKİ değerler, sütun anahtarına göre. Hoca hücreyi boş
   * bırakırsa bu değer geçerli kalır; ekranda soluk yazıyla görünür.
   */
  simdiki: Record<string, string | number | null>;
}

/** Cevap alanının türü — ekran buna göre çizilir. */
export type CevapAlani =
  /** "Uygun" ya da "Değişsin". Değişsin seçilirse not alanı öne çıkar. */
  | { tur: "uygunMu" }
  /** Seçeneklerden biri (ya da cokluSecim ise birkaçı). */
  | { tur: "secenek"; secenekler: Secenek[]; cokluSecim?: boolean }
  /** Tek bir sayı (ör. "günde kaç soru"). simdiki: sistemdeki değer. */
  | { tur: "sayi"; birim?: string; enAz?: number; enCok?: number; simdiki?: number }
  /** Satırları sabit, hücreleri doldurulan tablo (ör. sınav sabitleri). */
  | { tur: "tablo"; sutunlar: TabloSutunu[]; satirlar: TabloSatiri[] }
  /** Serbest yazı (ör. "eldeki soruların biçimi"). */
  | { tur: "metin"; ipucu?: string };

export type Oncelik = "acil" | "normal" | "sonra";

export interface HocaSorusu {
  /**
   * Kalıcı kimlik: "bolum.kisa-ad" (ör. "sinav.yanlis-goturme"). Bir kez
   * yayınlandıktan sonra DEĞİŞTİRİLMEZ — cevap buna bağlı.
   */
  anahtar: string;
  /** Kısa başlık (listede görünür). */
  baslik: string;
  /** Asıl soru: düz, kısa cümlelerle. */
  soru: string;
  /** "Şu an sistemde…" — hoca cevap vermezse geçerli olan durum. */
  simdi?: string;
  /** Neden soruyoruz, öğrenci açısından ne değişir. */
  neden?: string;
  /** Somut bir örnek (öğrenci ekranından, sorudan). */
  ornek?: string;
  /** Bizim önerimiz ve gerekçesi. */
  oneri?: string;
  cevap: CevapAlani;
  oncelik?: Oncelik;
}

export interface HocaBolumu {
  anahtar: string;
  baslik: string;
  /** Bölümün başında 2-4 cümlelik giriş: bu bölüm neyle ilgili. */
  giris?: string;
  sorular: HocaSorusu[];
}

// ─── Cevap değerleri (veritabanında TeacherAnswer.value) ─────────────

export type CevapDegeri =
  | { tur: "uygunMu"; karar: "uygun" | "degissin" }
  | { tur: "secenek"; secilen: string[] }
  | { tur: "sayi"; sayi: number }
  | { tur: "tablo"; hucreler: Record<string, Record<string, string>> }
  | { tur: "metin" };

/** Bir sorunun durumu: ekrandaki rozet ve süzgeç. */
export type CevapDurumu = "bekliyor" | "cevaplandi" | "uygulandi";
