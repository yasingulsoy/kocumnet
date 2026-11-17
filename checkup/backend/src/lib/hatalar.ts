/**
 * API hata biçimi (checkup/API.md "Hata biçimi"):
 *   { "hata": { "kod", "mesaj", "alanlar"?, "ek"? } }
 * Kod → HTTP eşlemesi belgedeki tabloyla birebir.
 */

export const HATA_DURUMLARI = {
  SERVIS_ANAHTARI: 401,
  OTURUM_YOK: 401,
  YETKI_YOK: 403,
  BULUNAMADI: 404,
  DOGRULAMA: 400,
  CAKISMA: 409,
  KULLANIMDA: 409,
  HAZIR_DEGIL: 409,
  ACIK_CHECKUP_VAR: 409,
  SURE_DOLDU: 409,
  KAPANDI: 409,
  COK_FAZLA_ISTEK: 429,
  SUNUCU: 500,
} as const;

export type HataKodu = keyof typeof HATA_DURUMLARI;

export class ApiHata extends Error {
  readonly kod: HataKodu;
  readonly alanlar?: Record<string, string>;
  readonly ek?: Record<string, unknown>;

  constructor(kod: HataKodu, mesaj: string, secenek: { alanlar?: Record<string, string>; ek?: Record<string, unknown> } = {}) {
    super(mesaj);
    this.name = "ApiHata";
    this.kod = kod;
    this.alanlar = secenek.alanlar;
    this.ek = secenek.ek;
  }

  get durum(): number {
    return HATA_DURUMLARI[this.kod];
  }

  govde() {
    return {
      hata: {
        kod: this.kod,
        mesaj: this.message,
        ...(this.alanlar && Object.keys(this.alanlar).length ? { alanlar: this.alanlar } : {}),
        ...(this.ek ? { ek: this.ek } : {}),
      },
    };
  }
}

/** Sık kullanılanlar için kısa yollar. */
export const bulunamadi = (mesaj = "Kayıt bulunamadı.") => new ApiHata("BULUNAMADI", mesaj);

export function dogrulama(mesaj: string, alanlar?: Record<string, string>, ek?: Record<string, unknown>) {
  return new ApiHata("DOGRULAMA", mesaj, { alanlar, ek });
}

/** Alan hatalarından DOGRULAMA üretir; mesaj ilk alanın cümlesi olur. */
export function alanHatasi(alanlar: Record<string, string>): ApiHata {
  const ilk = Object.values(alanlar)[0] ?? "Gönderilen bilgilerde hata var.";
  return new ApiHata("DOGRULAMA", ilk, { alanlar });
}
