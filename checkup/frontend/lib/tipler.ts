/*
 * checkup/API.md'deki öğrenci uçlarının tipleri. Sözleşme orada; burası
 * yalnızca onun TypeScript karşılığı. Şekil değişirse önce API.md değişir.
 */

export type HataKodu =
  | "SERVIS_ANAHTARI"
  | "OTURUM_YOK"
  | "YETKI_YOK"
  | "BULUNAMADI"
  | "DOGRULAMA"
  | "CAKISMA"
  | "KULLANIMDA"
  | "HAZIR_DEGIL"
  | "ACIK_CHECKUP_VAR"
  | "SURE_DOLDU"
  | "KAPANDI"
  | "COK_FAZLA_ISTEK"
  | "SUNUCU"
  /** Backend'e hiç ulaşılamadı ya da yanıt okunamadı (bizim kodumuz, API'de yok). */
  | "ULASILAMADI";

export interface ApiHata {
  kod: HataKodu;
  mesaj: string;
  alanlar?: Record<string, string>;
  ek?: Record<string, unknown>;
  /** HTTP durum kodu; ulaşılamadıysa 0. */
  durum: number;
}

export type Sonuc<T> = { ok: true; veri: T } | { ok: false; hata: ApiHata };

export interface Ogrenci {
  id: number;
  adSoyad: string;
  eposta: string;
  olusturuldu: string;
}

export interface OturumYaniti {
  jeton: string;
  bitis: string;
  ogrenci: Ogrenci;
}

export interface Ref {
  id: number;
  ad: string;
}

export interface CheckupOzeti {
  id: number;
  durum: "DEVAM" | "BITTI";
  sinav: Ref;
  tur: Ref;
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

export interface KatalogTuru {
  id: number;
  ad: string;
  aciklama: string | null;
  soruSayisi: number;
  sureDakika: number;
  hazir: boolean;
}

export interface KatalogSinavi {
  id: number;
  ad: string;
  aciklama: string | null;
  ucretKurus: number;
  /**
   * API.md'deki katalog örneğinde YOK; kural ekranı "4 yanlış 1 doğruyu
   * götürür" cümlesi için gerekli. Backend gönderirse kullanılır, yoksa
   * kural ekranı genel bir cümleye düşer.
   */
  yanlisGoturme?: number;
  turler: KatalogTuru[];
}

export interface TestSikki {
  id: number;
  harf: string;
  metinHtml: string;
}

export interface TestSorusu {
  sira: number;
  ders: string;
  metinHtml: string;
  gorselId: string | number | null;
  siklar: TestSikki[];
  secilenSikId: number | null;
}

export interface TestDevam {
  id: number;
  durum: "DEVAM";
  sinav: Ref;
  tur: Ref;
  soruSayisi: number;
  sureDakika: number;
  yanlisGoturme: number;
  baslangic: string;
  bitisSiniri: string;
  simdi: string;
  sorular: TestSorusu[];
}

export type TestEkrani = TestDevam | { id: number; durum: "BITTI" };

export interface Grup {
  id: number;
  ad: string;
  soru: number;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  basari: number;
}

export interface KonuGrubu extends Grup {
  dersAd: string;
}

export interface KazanimGrubu extends Grup {
  kod: string | null;
  konuAd: string;
}

export interface AltKazanimGrubu extends Grup {
  kod: string | null;
  kazanimAd: string;
}

export interface Zayif {
  seviye: "kazanim" | "altKazanim";
  id: number;
  kod: string | null;
  ad: string;
  ustAd: string;
  soru: number;
  dogru: number;
  basari: number;
}

export interface IncelemeSikki {
  id: number;
  harf: string;
  metinHtml: string;
  dogru: boolean;
  aciklama: string | null;
  /** Açıklamanın backend'de formülleri çevrilmiş hâli; varsa bu gösterilir. */
  aciklamaHtml?: string | null;
}

export interface IncelemeSorusu {
  sira: number;
  metinHtml: string;
  gorselId: string | number | null;
  ders: string;
  konu: string;
  kazanim: string;
  altKazanim: string;
  siklar: IncelemeSikki[];
  secilenSikId: number | null;
  sonuc: "dogru" | "yanlis" | "bos";
  cozumHtml: string;
}

export interface Rapor {
  id: number;
  sinav: Ref;
  tur: Ref;
  baslangic: string;
  bitis: string;
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
  dersler: Grup[];
  konular: KonuGrubu[];
  kazanimlar: KazanimGrubu[];
  altKazanimlar: AltKazanimGrubu[];
  zayiflar: Zayif[];
  inceleme: IncelemeSorusu[];
}

/**
 * Sunucu eylemlerinin form durumları. Girilen değerler geri yollanmaz:
 * formlar onSubmit ile gönderildiği için React onları sıfırlamaz
 * (components/form-eylemi.ts).
 */
export interface FormDurumu {
  hata?: string;
  alanlar?: Record<string, string>;
  basari?: string;
}
