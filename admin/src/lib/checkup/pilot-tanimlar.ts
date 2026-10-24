/**
 * Pilot ölçümündeki her sayının tanımı — ekran (/checkup/pilot) ve pilot sonu
 * raporu (rapor.md) aynı metni buradan okur. Saf modül. Eşik değişince metin
 * de değişsin diye sayılar pilot-kurallari.ts'teki sabitlerden.
 *
 * Okuyan hoca ve koç: teknik terim yok, "ne sayıldı, ne sayılmadı" açık.
 */

import {
  ANLAMLI_ARTIS_PUAN,
  GIZLI_ORAN,
  GIZLI_SAYI,
  HAVUZ_EN_AZ_OTURUM,
  KAZANC_EN_AZ_OGRENCI,
  KAZANC_EN_AZ_SORU,
  KUCUK_SAYI_SINIRI,
  TEKRAR_PENCERESI_GUN,
  ZORLUK_EN_AZ_CEVAP,
  type HuniAdimAnahtari,
} from "./pilot-kurallari";

export interface Tanim {
  ad: string;
  metin: string;
}

/** Ölçüm sayılan test: bütün bölümlerde aynı. */
export const OLCUM_TANIMI =
  "Ölçüm sayılan test: paket testi (tanışma ve deneme dahil), kontrol testi ya da seviyeli check-up aşaması; " +
  "hiç işaretlenmeden kapanan ya da yarım kalan test sayılmaz. Alıştırma test değildir.";

export const KAPSAM_TANIMLARI: Tanim[] = [
  {
    ad: "Kayıt grubu",
    metin:
      "Huni ve kayıt kaynağı: seçili tarihler arasında hesap açan öğrenciler. Grup seçiliyse yalnızca o grubun üyeleri.",
  },
  {
    ad: "Dönem",
    metin:
      "Testler, özellik kullanımı, öğrenme kazancı ve zorluk algısı: seçili tarihler arasında olanlar, öğrenci ne zaman kayıt olmuş olursa olsun. Grup seçiliyse yalnızca o grubun üyeleri.",
  },
  { ad: "Tarihler", metin: "Gün sınırları Türkiye saatiyle. Bitiş günü bugünse sayılar şu ana kadar." },
  {
    ad: "Küçük sayılar",
    metin:
      KUCUK_SAYI_SINIRI +
      "'ten küçük sayılar " +
      GIZLI_SAYI +
      " yazılır (sıfır dahil): küçük bir grupta kim olduğu tahmin edilmesin. Böyle bir sayıdan hesaplanan oran da yazılmaz (" +
      GIZLI_ORAN +
      ").",
  },
];

export const HUNI_ADI: Record<HuniAdimAnahtari, string> = {
  kayit: "Kayıt",
  tanisma: "Tanışmayı bitiren",
  ilkOlcum: "İlk ölçüm sayılan testi bitiren",
  hafta2: "2. haftasında etkin",
  hafta3: "3. hafta ve sonrasında etkin",
};

export const HUNI_TANIMLARI: Tanim[] = [
  { ad: "Kayıt", metin: "Dönemde hesap açan öğrenci." },
  { ad: "Tanışmayı bitiren", metin: "Sınav, sınıf ve hedef sorularını tamamlayan." },
  { ad: "İlk ölçüm", metin: "Dönem sonuna kadar ölçüm sayılan en az bir test bitiren. " + OLCUM_TANIMI },
  {
    ad: "Etkin",
    metin:
      "O hafta en az bir test ya da alıştırma başlatan, ya da uygulamayı son açışı o haftaya düşen. Uygulama yalnızca son açışı tutuyor; geçmiş bir haftada yalnızca uygulamayı açıp hiçbir şey başlatmayan öğrenci görünmeyebilir.",
  },
  {
    ad: "Haftalar",
    metin:
      "Öğrencinin kendi kayıt anından sayılır: 2. hafta kaydın 8.-14. günleri, 3. hafta ve sonrası 15. günden dönem sonuna kadar.",
  },
  {
    ad: "Oranlar",
    metin:
      "Her adım bir öncekini geçenler arasından sayılır. 2. haftası (son adımda 3. haftası) dönem bitmeden dolmamış öğrenci o adımın tabanına girmez, \"henüz erken\" diye ayrıca yazılır; yoksa son günlerde kayıt olan herkes \"bıraktı\" görünürdü.",
  },
];

export const TEST_ADI = {
  baslayan: "Başlayan test",
  ogrenciBitirdi: "Öğrencinin bitirdiği",
  suresiDoldu: "Süresi dolan",
  yenidenBaslatildi: "Yeniden başlatılarak kapanan",
  suruyor: "Hâlâ açık",
  birakildi: "Bırakılan (seviyeli koşu)",
  isaretsiz: "Hiç işaretlenmeyen",
  yarimKaldi: "Yarım kalan",
  olcumSayilan: "Ölçüm sayılan",
} as const;

export const TEST_TANIMLARI: Tanim[] = [
  { ad: "Başlayan", metin: "Dönemde başlatılan paket testi, kontrol testi, seviyeli aşama ve deneme. Alıştırma sayılmaz." },
  {
    ad: "Kapanış",
    metin:
      "Öğrencinin bitirdiği (\"Bitir\"e bastı; bu bilgiden önceki eski testler de buraya), süresi dolan, yeniden başlatılarak kapanan, hâlâ açık ve bırakılan: her test bunlardan birine girer.",
  },
  { ad: "Hiç işaretlenmeyen", metin: "Tek şık işaretlenmeden kapanan test. Ölçüm sayılmaz." },
  {
    ad: "Yarım kalan",
    metin:
      "Öğrenci bitirmedi (süre doldu ya da testi yeniden başlattı) ve soruların yarısından azını işaretledi; en az bir soru işaretli. Ölçüm sayılmaz. Bu iki sayı kapanış sayılarının içindedir.",
  },
  {
    ad: "Bıraktığı yer",
    metin:
      "Yarım testte öğrencinin en son işaretlediği sorunun testteki yeri: ilk çeyrek soruların ilk dörtte biri, son çeyrek son dörtte biri.",
  },
];

export const OZELLIK_ADI = {
  alistirma: "Alıştırma (herhangi biri)",
  alistirmaSIMILAR: "Alıştırma: benzerini çöz",
  alistirmaTOPIC: "Alıştırma: bu konuda çalış",
  alistirmaREVIEW: "Alıştırma: bugünkü tekrar",
  ipucu: "İpucu açan",
  kagit: "Kâğıtta çözen",
  kontrol: "Kontrol testi çözen",
  seviyeli: "Seviyeli check-up başlatan",
  veliOlusturan: "Veli bağlantısı oluşturan",
  veliGoruntulenen: "Veli bağlantısı açılan",
  kocaSoru: "Koça soru soran",
  hataBildirimi: "Hata bildiren",
  postaKapatan: "Haftalık postayı kapatmış",
} as const;
export type OzellikAnahtari = keyof typeof OZELLIK_ADI;

export const OZELLIK_TANIMLARI: Tanim[] = [
  { ad: "Sayı", metin: "Dönemde özelliği en az bir kez kullanan öğrenci; bir öğrenci her satırda en fazla bir kez." },
  {
    ad: "Oran",
    metin:
      "Dönemde etkin öğrencilere göre: dönemde test ya da alıştırma başlatan, uygulamayı son açışı döneme düşen ya da bu satırlardan birini kullanan.",
  },
  { ad: "İpucu", metin: "Alıştırmada en az bir soruda ipucu açan." },
  { ad: "Kâğıtta çözen", metin: "Testi kitapçık olarak yazdırıp cevapları sonradan işleyen." },
  { ad: "Seviyeli check-up", metin: "Dönemde en az bir seviyeli aşama başlatan." },
  {
    ad: "Veli bağlantısı",
    metin: "Dönemde bağlantı oluşturan; \"açılan\": bu bağlantılardan en az biri en az bir kez görüntülenmiş.",
  },
  { ad: "Hata bildiren", metin: "Bir soruda \"bu soruda hata var\" bildirimi yapan." },
  {
    ad: "Haftalık posta",
    metin: "Pazartesi koçluk postasını kapatmış olan; tarih tutulmadığı için dönem değil şu anki durum.",
  },
  {
    ad: "Ödev",
    metin:
      "Dönemle çakışan (iptal edilmemiş) bir ödevi olan öğrenci ve en az birini tamamlayan. Tamamlama öğrencinin ekranındaki kuralla: ödev açıldıktan sonra paketi bitirmek ya da konuda istenen sayıda alıştırma sorusu çözmek; boş gönderilen test saymaz, geç tamamlanan sayar.",
  },
];

export const KAZANC_TANIMLARI: Tanim[] = [
  {
    ad: "Eşleştirme",
    metin:
      "Aynı öğrencinin aynı konudaki dönem içindeki ilk ve son ölçümü. Yalnızca paket ve kontrol testleri; ikisinde de o konudan en az " +
      KAZANC_EN_AZ_SORU +
      " soru sorulmuş olmalı. Seviyeli aşamalar girmez: seviyelerin soruları farklı zorlukta.",
  },
  {
    ad: "Tekrar soru",
    metin:
      "Havuz yetmediği için öğrenciye daha önce gördüğü soru gelen testler ve aynı denemenin ikinci çözümü dışarıda: bunlar öğrenmeyi değil hafızayı ölçer.",
  },
  { ad: "Değişim", metin: "Son ölçümdeki konu doğru oranı eksi ilk ölçümdeki, puan olarak (%40 → %60 = +20 puan)." },
  {
    ad: "Planına giren konu",
    metin:
      "İki ölçüm arasında yürürlükte olan haftalık planlarından birinin işlerinde bu konu vardı. Son ölçümden sonra kurulan plan sayılmaz.",
  },
  {
    ad: "Anlamlı artış",
    metin: "En az " + ANLAMLI_ARTIS_PUAN + " puan yükselen eşleşme (eşik hocaya sorulacak).",
  },
  {
    ad: "Az veri",
    metin: KAZANC_EN_AZ_OGRENCI + "'dan az öğrenciyle ortalama yazılmaz; yerine \"veri yetersiz\" ve öğrenci sayısı.",
  },
  {
    ad: "Ortalamaya dönüş",
    metin:
      "Zayıf diye seçilen konu hiç çalışılmasa da sonraki ölçümde yükselme eğilimindedir: ilk ölçümdeki düşük sonucun bir kısmı şanssızlıktır. Bu yüzden \"planına giren konular yükseldi\" tek başına kanıt değildir; asıl kanıt planına giren ve girmeyen konular arasındaki farktır.",
  },
];

export const EK_GOSTERGE_ADI = {
  kontrol: "Kontrol testini geçen",
  defter: "Yanlış defterinden çıkan madde",
  ipucuDogru: "İpucuyla gelen doğru",
} as const;

export const EK_GOSTERGE_TANIMLARI: Tanim[] = [
  {
    ad: "Kontrol testini geçen",
    metin:
      "Dönemde ölçüm sayılan kontrol testlerinden, öğrencinin sonuç ekranında \"konu oturmuş\" gördükleri (odak konuda güçlü seviye).",
  },
  {
    ad: "Defterden çıkan",
    metin: "Dönemde yanlış defterine giren maddelerden, üç tekrarı da doğru yapılıp defterden çıkanlar (şu ana kadar).",
  },
  { ad: "İpucuyla gelen doğru", metin: "Dönemdeki alıştırmalarda doğru cevaplanan sorulardan, ipucu açılarak çözülenlerin payı." },
];

export const ALGI_TANIMLARI: Tanim[] = [
  { ad: "Algı", metin: "Öğrencinin sonuç ekranındaki tek dokunuşu: kolay, uygun ya da zor. İsteğe bağlı." },
  {
    ad: "Doğru oranı",
    metin:
      "Aynı testlerin gerçek doğru / sorulan oranı. Yalnızca ölçüm sayılan testler; paket başına en az " +
      ZORLUK_EN_AZ_CEVAP +
      " cevap varsa gösterilir.",
  },
];

export const KAYNAK_TANIMLARI: Tanim[] = [
  {
    ad: "Kaynak",
    metin:
      "Öğrencinin kocum.net'te tıkladığı check-up bağlantısının etiketi. Etiketsiz bağlantıdan, doğrudan adresten ya da etiket tutulmaya başlamadan önce gelenler \"etiketsiz\".",
  },
  { ad: "İlk ölçüm", metin: "Bu kaynaktan gelip dönem sonuna kadar ölçüm sayılan bir test bitiren." },
];

/** Havuz ekranındaki "tekrar soru" sütunu ve "önce yazılacak konular" listesi. */
export const HAVUZ_TUKENME_TANIMI =
  "Son 14 günde bu konudan soru içeren testler ve alıştırmalardan kaçında havuz yetmedi ve öğrenciye bu konudan son " +
  TEKRAR_PENCERESI_GUN +
  " günde gördüğü bir soru geldi. Önce yazılacak konular: en az " +
  HAVUZ_EN_AZ_OTURUM +
  " oturumda sorulmuş, bu oranı en yüksek konular.";
