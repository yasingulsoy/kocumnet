/**
 * Backend nesneleri — checkup/API.md "Admin" bölümünün TypeScript karşılığı.
 * Hem sunucu hem istemci bileşenleri kullanır (yalnızca tip; çalışma anı kodu yok).
 */

export type Rol = "YONETICI" | "EDITOR";
export type Secim = "KARMA" | "SABIT";

export interface Yonetici {
  id: number;
  adSoyad: string;
  eposta: string;
  rol: Rol;
  aktif: boolean;
}

export interface Sayfali<T> {
  kayitlar: T[];
  toplam: number;
  sayfa: number;
  boyut: number;
}

// ─── Pano ────────────────────────────────────────────────────

export interface PanoTuru {
  turId: number;
  ad: string;
  secim: Secim;
  hazir: boolean;
}

export interface PanoSinavi {
  id: number;
  ad: string;
  aktif: boolean;
  soruSayisi: number;
  aktifSoruSayisi: number;
  turler: PanoTuru[];
}

export interface Pano {
  sinavlar: PanoSinavi[];
  ogrenciSayisi: number;
  checkupSayisi: number;
  bitenCheckupSayisi: number;
  son7GunKayit: number;
  son7GunCheckup: number;
}

// ─── Sınav ve tür ────────────────────────────────────────────

export interface Sinav {
  id: number;
  ad: string;
  aciklama: string | null;
  ucretKurus: number;
  yanlisGoturme: number;
  aktif: boolean;
  sira: number;
  dersSayisi: number;
  soruSayisi: number;
  aktifSoruSayisi: number;
  checkupSayisi: number;
  silinebilir: boolean;
}

export interface Tur {
  id: number;
  ad: string;
  aciklama: string | null;
  soruSayisi: number;
  sureDakika: number;
  aktif: boolean;
  sira: number;
  checkupSayisi: number;
  silinebilir: boolean;
}

/**
 * Sınav ekleme/düzenleme gövdesi (istemci → server action). Düzenlemede
 * yalnızca değişen alanlar gönderilir; boşaltılan açıklama null olur.
 */
export interface SinavFormu {
  ad: string;
  aciklama: string | null;
  ucretKurus: number;
  yanlisGoturme: number;
  aktif: boolean;
  sira: number;
}

export interface TurFormu {
  ad: string;
  aciklama: string | null;
  soruSayisi: number;
  sureDakika: number;
  aktif: boolean;
  sira: number;
}

// ─── Konu ağacı ──────────────────────────────────────────────

/** API'deki `:seviye` yol parçası. */
export type Seviye = "dersler" | "konular" | "kazanimlar" | "alt-kazanimlar";

export interface AltKazanimDugumu {
  id: number;
  kod: string | null;
  ad: string;
  sira: number;
  soruSayisi: number;
  silinebilir: boolean;
}

export interface KazanimDugumu extends AltKazanimDugumu {
  altKazanimlar: AltKazanimDugumu[];
}

export interface KonuDugumu {
  id: number;
  ad: string;
  sira: number;
  soruSayisi: number;
  silinebilir: boolean;
  kazanimlar: KazanimDugumu[];
}

export interface DersDugumu {
  id: number;
  ad: string;
  sira: number;
  soruSayisi: number;
  silinebilir: boolean;
  konular: KonuDugumu[];
}

export interface Agac {
  sinav: { id: number; ad: string };
  dersler: DersDugumu[];
}

// ─── Sorular ─────────────────────────────────────────────────

export interface SoruOzeti {
  id: number;
  /** İlk 160 karakter. */
  metin: string;
  ders: string;
  konu: string;
  kazanim: string;
  altKazanim: string;
  zorluk: number | null;
  aktif: boolean;
  gorselVar: boolean;
  kullanimSayisi: number;
  olusturuldu: string;
}

export interface SoruSikki {
  sira: number;
  harf: string;
  metin: string;
  metinHtml: string;
  dogru: boolean;
  aciklama: string | null;
}

export interface SoruAyrintisi {
  id: number;
  sinavId: number;
  dersId: number;
  konuId: number;
  kazanimId: number;
  altKazanimId: number;
  metin: string;
  metinHtml: string;
  gorselId: string | null;
  cozum: string;
  cozumHtml: string;
  zorluk: number | null;
  aktif: boolean;
  siklar: SoruSikki[];
  kullanimSayisi: number;
  sabitListeSayisi: number;
  olusturuldu: string;
  guncellendi: string;
}

export type Harf = "A" | "B" | "C" | "D" | "E";
export const HARFLER: Harf[] = ["A", "B", "C", "D", "E"];

/** İstemcinin gönderdiği gövde (null: alanı temizle; tanımsız: gönderme). */
export interface SoruYuku {
  sinavId?: number;
  dersId?: number;
  konuId?: number;
  kazanimId?: number;
  altKazanimId?: number;
  metin?: string;
  gorselId?: string | null;
  cozum?: string;
  zorluk?: number | null;
  aktif?: boolean;
  siklar?: { metin: string; aciklama?: string | null }[];
  dogruSik?: Harf;
}

export interface GorselYanit {
  id: string;
  genislik: number;
  yukseklik: number;
}

// ─── Excel içe aktarma ───────────────────────────────────────

export interface DenetimSatiri {
  satir: number;
  durum: "gecerli" | "hatali";
  hatalar: string[];
  ozet: string;
}

export interface DenetimRaporu {
  toplam: number;
  gecerli: number;
  hatali: number;
  satirlar: DenetimSatiri[];
}

export interface KayitYaniti {
  iceAktarmaId: number;
  eklenen: number;
}

// ─── Check-up ayarları ───────────────────────────────────────

export interface ReceteSatiri {
  id?: number;
  konuId: number | null;
  kazanimId: number | null;
  ad: string;
  ustAd: string;
  soruSayisi: number;
  havuz: number;
}

export interface SabitSoru {
  soruId: number;
  sira: number;
  /** İlk 120 karakter. */
  metin: string;
  konu: string;
  aktif: boolean;
}

export interface Hazirlik {
  hazir: boolean;
  sorunlar: string[];
}

export interface CheckupAyari {
  tur: { id: number; ad: string; soruSayisi: number; sureDakika: number; aktif: boolean };
  secim: Secim;
  recete: ReceteSatiri[];
  sabitSorular: SabitSoru[];
  hazirlik: Hazirlik;
}

export interface AyarGovdesi {
  secim: Secim;
  recete: { konuId?: number; kazanimId?: number; soruSayisi: number }[];
  sabitSoruIdleri: number[];
}

// ─── Öğrenciler ve raporlar ──────────────────────────────────

export interface OgrenciOzeti {
  id: number;
  adSoyad: string;
  eposta: string;
  olusturuldu: string;
  kaynak: string | null;
  checkupSayisi: number;
  /** API.md biçimi belirtmiyor: tarih metni ya da özet nesne gelebilir. */
  sonCheckup: string | { baslangic?: string; bitis?: string | null } | null;
}

export interface CheckupOzeti {
  id: number;
  durum: "DEVAM" | "BITTI";
  sinav: { id: number; ad: string };
  tur: { id: number; ad: string };
  soruSayisi: number;
  cevaplanan: number;
  baslangic: string;
  bitisSiniri: string;
  bitis: string | null;
  dogru: number | null;
  yanlis: number | null;
  bos: number | null;
  net: number | null;
}

export interface OgrenciAyrintisi {
  ogrenci: { id: number; adSoyad: string; eposta: string; olusturuldu: string; kaynak: string | null };
  checkuplar: CheckupOzeti[];
}

export interface RaporGrubu {
  id: number;
  ad: string;
  soru: number;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  basari: number;
}

export interface Rapor {
  id: number;
  ogrenci?: { id: number; adSoyad: string };
  sinav: { id: number; ad: string };
  tur: { id: number; ad: string };
  baslangic: string;
  bitis: string | null;
  sureSaniye: number;
  ozet: {
    soruSayisi: number;
    dogru: number;
    yanlis: number;
    bos: number;
    net: number;
    yanlisGoturme: number;
    basari: number;
  };
  dersler: RaporGrubu[];
  konular: (RaporGrubu & { dersAd: string })[];
  kazanimlar: (RaporGrubu & { kod: string | null; konuAd: string })[];
  altKazanimlar: (RaporGrubu & { kod: string | null; kazanimAd: string })[];
  zayiflar: {
    seviye: "kazanim" | "altKazanim";
    id: number;
    kod: string | null;
    ad: string;
    ustAd: string;
    soru: number;
    dogru: number;
    basari: number;
  }[];
  inceleme: {
    sira: number;
    metinHtml: string;
    gorselId: string | null;
    ders: string;
    konu: string;
    kazanim: string;
    altKazanim: string;
    siklar: { id: number; harf: string; metinHtml: string; dogru: boolean; aciklama: string | null }[];
    secilenSikId: number | null;
    sonuc: "dogru" | "yanlis" | "bos";
    cozumHtml: string;
  }[];
}

// ─── Eylem sonucu ────────────────────────────────────────────

/** Server action'ların istemciye döndürdüğü sonuç (serileştirilebilir). */
export type IslemSonucu<T = null> =
  | { ok: true; veri: T }
  | { ok: false; kod: string; mesaj: string; alanlar?: Record<string, string>; ek?: unknown };
