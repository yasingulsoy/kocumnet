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

export const LAST_UPDATED = "22 Ekim 2026";

/**
 * 18 yaş altı beyanı: kayıt kutusu (app/(auth)/kayit/RegisterForm.tsx) ve
 * gizlilik sayfası AYNI cümleyi kullanır; ikisi ayrı yazıldığında biri "veli
 * onayı", öbürü "velimin bilgisi dahilinde" diyordu.
 * HUKUK: bu yalnızca beyan, onay kaydı değil. Velinin açık rızasının nasıl
 * alınıp saklanacağı hukukçuyla netleşmeli (yol haritası E16).
 */
export const VELI_ONAYI_METNI = "18 yaşından küçüksem velimin bilgisi ve onayıyla kayıt oluyorum.";

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
  { field: "Hedef sınav (LGS, TYT, AYT, KPSS, DGS, ALES)", purpose: "Uygun paket önerisi", required: false },
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
  {
    // TASLAK (hukuki inceleme): bkz. /gizlilik "Veli bağlantısı".
    field: "Veli bağlantısı kayıtları (oluşturma, bitiş, kaç kez ve en son ne zaman açıldığı)",
    purpose: "Bağlantılarınızı yönetebilmeniz ve velinizin açıp açmadığını görebilmeniz",
    required: false,
  },
  // 21 Ekim 2026 turu: hedefler, öğrenme döngüsü, koçluk, deneme.
  {
    field: "Hedef net, sınav yılı, haftalık test ve günlük soru hedefi",
    purpose: "Haftalık planı ve günlük hedef kartını size göre kurmak",
    required: false,
  },
  {
    field: "Alıştırmalar, ipucu kullanımı ve yanlış defteri",
    purpose: "Yanlış yaptığınız soruları tekrar zamanında önünüze getirmek",
    required: false,
  },
  {
    field: "Haftalık plan ve koç notu",
    purpose:
      "Haftanın çalışma planı; koçunuzun (ya da planı kuran sistemin) plan kartına yazdığı kısa not",
    required: false,
  },
  {
    field: "Koça yazdığınız sorular ve koçun cevapları",
    purpose: "Sorunuzu yetkili koçun görüp cevaplayabilmesi",
    required: false,
  },
  {
    field: "Hata bildirimleriniz (seçtiğiniz sebep ve yazdığınız açıklama)",
    purpose:
      "Sorudaki hatanın içerik ekibince düzeltilmesi ve bildiriminizin incelendiğini size gösterebilmek",
    required: false,
  },
  {
    field: "Grup üyeliği ve ödevler",
    purpose:
      "Koçunuzun sizi bir gruba ekleyip ödev verebilmesi ve takip etmesi. Ödevi tamamlayıp tamamlamadığınız ayrıca kaydedilmez, çözdüğünüz testlerden hesaplanır",
    required: false,
  },
  {
    field: "Otomatik takip uyarıları (ör. 14 gündür giriş ya da test yok, son iki testte düşüş)",
    purpose:
      "Koçunuzun kime destek gerektiğini görebilmesi. Ayrıca saklanmaz; giriş ve test kayıtlarınızdan hesaplanır ve yalnızca yetkili koçlar görür",
    required: true,
  },
  {
    field: "Deneme karşılaştırması",
    purpose:
      "Denemedeki yerinizi yüzdelik olarak göstermek. Diğer öğrencilerin kimliği gösterilmez; sizin o denemedeki ilk sonucunuz da başkalarının karşılaştırmasına kimliksiz katılır. Karşılaştırma en az 10 kişi çözünce açılır",
    required: false,
  },
];

/** Toplamadığımız şeyler — bunu söylemek de bilgidir. */
export const NOT_COLLECTED = [
  "Uygulama IP adresinizi kalıcı olarak kaydetmez (yalnızca kötüye kullanım sınırlaması için kısa süre bellekte tutulur)",
  "Reklam veya izleme çerezi kullanılmaz; tek çerez oturumunuzu açık tutar",
  "Konum, rehber, kamera veya mikrofon erişimi istenmez",
  "Verileriniz reklam amacıyla üçüncü taraflarla paylaşılmaz",
];
