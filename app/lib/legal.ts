/**
 * Yasal metinler.
 *
 * ⚠️ BU BİR TASLAKTIR, HUKUKİ GÖRÜŞ DEĞİLDİR. Yayına çıkmadan önce bir
 * hukukçuya okutulmalı. Buradaki değer, metnin "genel bir gizlilik şablonu"
 * olmaması: uygulamanın GERÇEKTE topladığı alanlar şemadan birebir çıkarıldı.
 * Şemaya yeni bir kişisel veri alanı eklenirse bu liste de güncellenmeli.
 *
 * ⚠️ 18 YAŞ ALTI: hedef kitle ağırlıklı olarak reşit olmayan öğrenciler.
 * KVKK açısından velinin açık rızası gerekir; ücretli satış söz konusu
 * olduğunda mesafeli satış mevzuatı da devreye girer. Bu iki konu
 * hukukçuyla netleşmeden ücretli satışa açılmamalı.
 */

export const LAST_UPDATED = "20 Eylül 2026";

export interface DataItem {
  field: string;
  purpose: string;
  /** Neden toplandığı — "her ihtimale karşı" toplanan veri yok. */
  required: boolean;
}

/** Şemadan birebir: hangi kişisel veriyi neden tutuyoruz. */
export const COLLECTED_DATA: DataItem[] = [
  { field: "Ad soyad", purpose: "Hesabı tanımlamak ve size hitap etmek", required: true },
  { field: "E-posta adresi", purpose: "Giriş, parola sıfırlama ve bilgilendirme", required: true },
  {
    field: "Parola",
    purpose:
      "Yalnızca özeti (scrypt) saklanır; parolanın kendisi hiçbir zaman kaydedilmez ve geri çevrilemez",
    required: true,
  },
  { field: "Sınıf bilgisi", purpose: "Uygun paket önerisi", required: false },
  { field: "Hedef sınav (TYT/AYT)", purpose: "Uygun paket önerisi", required: false },
  {
    field: "Test cevaplarınız ve süreleriniz",
    purpose: "Konu bazlı seviye haritası ve gelişim takibi",
    required: true,
  },
  {
    field: "Tarayıcı bilgisi (user agent)",
    purpose: "Açık oturumlarınızı ayırt etmek ve şüpheli girişleri fark etmek",
    required: true,
  },
];

/** Toplamadığımız şeyler — bunu söylemek de bilgidir. */
export const NOT_COLLECTED = [
  "IP adresiniz kalıcı olarak kaydedilmez (yalnızca kötüye kullanım sınırlaması için geçici olarak bellekte tutulur)",
  "Reklam veya izleme çerezi kullanılmaz; tek çerez oturumunuzu açık tutar",
  "Konum, rehber, kamera veya mikrofon erişimi istenmez",
  "Verileriniz reklam amacıyla üçüncü taraflarla paylaşılmaz",
];
