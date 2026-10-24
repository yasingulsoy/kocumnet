import type { HocaBolumu, Secenek, TabloSatiri } from "./tipler";

/**
 * "Hocaya sorular": Matematik Check-up'ın içerik ve kural kararları.
 *
 * Okuyucu Özgür Hoca: deneyimli bir matematik öğretmeni ve koç, yazılımcı
 * değil. Metinlerde dosya yolu, tablo adı ya da İngilizce terim olmaz
 * (app/scripts/hoca-icerik-test.mts yasak kelimeleri tarar).
 *
 * Her sorudaki "simdi" metni KODDAN doğrulandı (24 Ekim 2026). Bir sabit
 * değişirse ilgili metin de burada güncellenmeli; hoca cevap vermezse
 * ekranda o durum geçerli sayılıyor.
 *
 * Anahtarlar ("bolum.kisa-ad") kalıcı: cevap anahtara bağlı. Metni
 * değiştirmek serbest, anahtarı değiştirmek verilmiş cevabı koparır.
 *
 * Word belgesi ve depo kökündeki HOCAYA-SORULAR.md bu dosyadan üretilir:
 *   app/ içinde: npx tsx scripts/hoca-belgesi.mts
 */

// ─────────────────────────────────────────────────────────────
// Küçük yardımcılar (yalnızca bu dosyada)
// ─────────────────────────────────────────────────────────────

/** Satırın şu anki değerleri: sütun anahtarı → değer. */
type Degerler = TabloSatiri["simdiki"];

const satir = (anahtar: string, baslik: string, simdiki: Degerler): TabloSatiri => ({ anahtar, baslik, simdiki });

const secenek = (deger: string, etiket: string, ek: Partial<Omit<Secenek, "deger" | "etiket">> = {}): Secenek => ({
  deger,
  etiket,
  ...ek,
});

const onerilen = { onerilen: true } as const;

/** Konu ağırlığı satırı: TYT, KPSS Lisans, DGS, ALES (null: o sınavda ağırlık yok). */
const agirlik = (
  anahtar: string,
  baslik: string,
  tyt: number | null,
  kpss: number | null,
  dgs: number | null,
  ales: number | null
): TabloSatiri => satir(anahtar, baslik, { tyt, kpss, dgs, ales });

// ─────────────────────────────────────────────────────────────
// Bölümler
// ─────────────────────────────────────────────────────────────

export const HOCA_BOLUMLERI: HocaBolumu[] = [
  // ── 1 ──────────────────────────────────────────────────────
  {
    anahtar: "pilot",
    baslik: "Başlarken ve pilot",
    giris:
      "Matematik Check-up'ta öğrenci kısa, süreli testler çözüyor; sonuç ekranında konu konu nerede olduğunu görüyor, ardından en zayıf konuları için haftalık bir plan alıyor. Ekranlar, puanlama ve plan hazır; eksik olan gerçek sorular ve bir öğretmenin vermesi gereken kararlar. İlk adım, küçük bir öğrenci grubuyla birkaç haftalık ücretsiz bir deneme dönemi, yani pilot. Bu bölüm pilotun çerçevesini ve içerik ekibini soruyor.",
    sorular: [
      {
        anahtar: "pilot.sinav",
        baslik: "Pilot sınavı",
        soru: "Pilot hangi sınavla başlasın?",
        simdi:
          "Karar yok. Sistem altı sınavı destekliyor (LGS, TYT, AYT, KPSS, DGS, ALES) ama hiçbirinin gerçek soru havuzu yok.",
        neden:
          "Kazanım listesi, soru yazımı ve kontrol bu karara göre sıralanacak. Tek sınavla başlamak, az soruyla gerçek bir deneyim sunmanın tek yolu.",
        oneri:
          "TYT: aday sayısı en fazla olan sınav. ALES ve DGS de güçlü bir seçenek: konuları KPSS ve TYT ile büyük ölçüde ortak, bu sınavlar için yazılan soru sonra iki üç sınavda birden kullanılıyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("tyt", "TYT", onerilen),
            secenek("ales-dgs", "ALES ve DGS birlikte"),
            secenek("kpss", "KPSS"),
            secenek("ayt", "AYT"),
            secenek("lgs", "LGS"),
          ],
        },
        oncelik: "acil",
      },
      {
        anahtar: "pilot.ogrenci-sayisi",
        baslik: "Pilot öğrenci sayısı",
        soru: "Pilotta kaç öğrenci olsun?",
        simdi: "Karar yok. Bizim taslağımızda 20-30 öğrenci var.",
        neden:
          "Sistemin bazı ölçüleri ancak yeterli öğrenciyle çalışıyor: bir sorunun istatistiği 20 cevaptan sonra çıkıyor, denemede 'netin çözenlerin yüzde kaçından yüksek' bilgisi 10 kişiden sonra açılıyor.",
        oneri: "25 civarı: soruların çoğu ilk haftalarda 20 cevaba ulaşır, siz de her öğrenciyle tek tek ilgilenebilirsiniz.",
        cevap: { tur: "sayi", birim: "öğrenci", enAz: 5, enCok: 300 },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.zaman",
        baslik: "Pilotun başlangıcı",
        soru: "Pilot ne zaman başlasın?",
        simdi:
          "Tarih yok. Bir paket ancak içindeki her konunun yeterli yayında sorusu olunca öğrenciye açılıyor; havuz dolmadan pilot başlayamıyor.",
        neden: "Soru yazımının ve kontrolün takvimi bu tarihe göre kurulacak.",
        oneri: "Pilot sınavının ilk 2-3 paketi dolar dolmaz başlayalım; kalan paketler pilot sürerken açılabilir.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hazir", "İlk paketler dolar dolmaz", onerilen),
            secenek("tatil", "Yarıyıl tatilinde"),
            secenek("tarih", "Belirli bir tarihte (not olarak yazın)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.sure",
        baslik: "Pilotun süresi",
        soru: "Pilot kaç hafta sürsün?",
        simdi: "Belirlenmedi.",
        neden:
          "Haftalık plan, kontrol testi ve yanlış defterinin etkisi ancak birkaç hafta sonra görünüyor. Çok kısa bir pilot bu döngüyü ölçemiyor, çok uzun bir pilot ücretli açılışı geciktiriyor.",
        oneri: "6 hafta: plan döngüsü birkaç kez dönüyor, pilotun başındaki ve sonundaki denemeyi karşılaştırmak için de yeterli.",
        cevap: { tur: "sayi", birim: "hafta", enAz: 2, enCok: 26 },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.basari",
        baslik: "Pilotun başarı ölçüsü",
        soru: "Pilotun başarılı geçtiğini neyle anlayalım?",
        simdi:
          "Tanımlı bir başarı ölçüsü yok. Paneldeki 'Pilot ölçümü' ekranı bunları sayıyor: kaç öğrencinin kaydolup ilk testini çözdüğü ve 2. ve 3. haftada hâlâ geldiği, testlerin kaçının yarım kaldığı, hangi özelliğin kaç kişi tarafından kullanıldığı, ilk ve son ölçüm arasındaki fark, kontrol testlerini geçme oranı, öğrencilerin testleri kolay mı zor mu bulduğu. Sonunda bunların toplu bir raporu indirilebiliyor.",
        neden:
          "Ölçüyü baştan seçersek pilotun sonunda 'iyi geçti mi' sorusunu sayılarla cevaplarız; sonradan seçilen ölçü hep iyi çıkar.",
        oneri:
          "Üç ölçü: planının yarısından fazlasını bitiren öğrenci oranı, kontrol testlerinde yükselen konu oranı ve pilottan sonra devam etmek isteyen öğrenci oranı.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("plan", "Öğrencilerin çoğu haftalık planının yarısından fazlasını bitiriyor", onerilen),
            secenek("kontrol", "Kontrol testlerinde konuların çoğu bir önceki ölçümden yüksek çıkıyor", onerilen),
            secenek("deneme", "Pilotun başındaki ve sonundaki deneme netleri arasında artış var"),
            secenek("devam", "Öğrencilerin çoğu pilottan sonra devam etmek istiyor", onerilen),
            secenek("veli", "Velilerden olumlu geri dönüş geliyor"),
            secenek("hata", "Sorularda bildirilen hata sayısı haftadan haftaya azalıyor"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.toplanti",
        baslik: "Tanışma toplantısı",
        soru: "Cevaplardan önce kısa bir toplantı yapalım mı?",
        simdi: "Toplantı planlanmadı.",
        neden:
          "Acil soruların bir kısmı (sınav kuralları, kazanım listesi, soru temini) yazışmayla günler sürüyor; birlikte 30-45 dakikada bitebilir.",
        oneri: "Acil sorular için 30-45 dakikalık bir görüşme; kalanları buradan, zamanınız oldukça.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("once", "Evet, önce toplantı yapalım", onerilen),
            secenek("sonra", "Önce yazılı cevaplayayım, sonra görüşelim"),
            secenek("gerek-yok", "Toplantıya gerek yok"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.yazacak",
        baslik: "Soruları kim yazacak",
        soru: "Yeni soruları kim yazacak?",
        simdi:
          "Belirlenmedi. Soru havuzu şu an boş; öğrenciye açılacak her soru ya yeni yazılacak ya da eldeki sorulardan aktarılacak.",
        neden: "Pilot sınavında ilk hedef yaklaşık 80-100 soru; yazacak kişi sayısı takvimi belirliyor.",
        oneri: "Ekibinizden 2-3 öğretmen yazsın; siz kazanım listesini ve yazım standardını belirleyin.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("ben", "Ben yazacağım"),
            secenek("ekip", "Ekibimdeki öğretmenler", onerilen),
            secenek("disaridan", "Dışarıdan soru yazarları"),
            secenek("eldeki", "Çoğunlukla eldeki hazır sorular kullanılacak"),
          ],
        },
        oncelik: "acil",
      },
      {
        anahtar: "pilot.kontrol",
        baslik: "Soruları kim kontrol edecek",
        soru: "Yazılan bir soruyu yayından önce kim kontrol etsin?",
        simdi:
          "Panelde her sorunun bir durumu var: taslak, inceleme, yayında. Ama inceleme zorunlu değil: soru yazma yetkisi olan herkes kendi sorusunu doğrudan yayına alabiliyor.",
        neden:
          "Yazan ile kontrol eden farklı kişi olunca cevap anahtarı ve ifade hataları çok daha sık yakalanıyor. Yayına çıkmış hatalı bir soru, düzeltilene kadar her öğrencinin netini bozuyor.",
        oneri:
          "Her soruyu yazandan başka biri kontrol etsin. Bunu panelde zorunlu yapmayı 'Soru kalitesi ve kontrol' bölümünde ayrıca soruyoruz.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("baska", "Her soruyu yazandan başka biri kontrol etsin", onerilen),
            secenek("hoca", "Bütün soruları ben kontrol edeyim"),
            secenek(
              "yazan",
              "Yazan kendisi kontrol etsin; kalan hataları öğrenci bildirimleri ve soru istatistikleri yakalasın"
            ),
          ],
        },
        oncelik: "acil",
      },
      {
        anahtar: "pilot.ekip-hesaplari",
        baslik: "Ekibin panel hesapları",
        soru: "Ekipte kimler olacak, panelde kime hangi yetkiyi açalım?",
        simdi:
          "Panelde dört yetki var. Yönetici ve müdür check-up'ın bütün ekranlarını kullanabiliyor; öğrenci bilgilerini, riskli öğrenci listesini, grupları ve ödevleri yalnızca onlar görüyor. Editör soru ve kazanım yazıyor, düzenliyor, yayına alıyor ve koça gelen soruları cevaplıyor. Görüntüleyici yalnızca okuyor.",
        neden:
          "Soru yazan bir öğretmenin öğrencilerin adını ve e-postasını görmesi gerekmiyor; kişisel bilgi en az kişiye açık olmalı.",
        oneri: "Soru yazanlara editör, size ve koçlara müdür yetkisi.",
        cevap: { tur: "metin", ipucu: "Her kişi için ad, e-posta adresi ve yetki." },
        oncelik: "normal",
      },
      {
        anahtar: "pilot.kazanc",
        baslik: "Öğrenme kazancının hesabı",
        soru: "Pilot sonunda 'öğrenciler öğrendi mi' sorusunu cevaplarken şu sınırlar uygun mu?",
        simdi:
          "Panelde 'Pilot ölçümü' ekranı var. Aynı öğrencinin aynı konudaki ilk ve son ölçümünü karşılaştırıyor ve planına giren konularla girmeyenleri yan yana gösteriyor. Daha önce gördüğü soruların tekrar geldiği testler hesaba girmiyor, çünkü hatırlanan soru öğrenmeyi değil hafızayı ölçüyor. Sayılar toplu; öğrencinin adı görünmüyor, beşten az kişiden çıkan sayı gizleniyor.",
        neden:
          "Zayıf diye seçilen konu, çalışılmasa da sonraki ölçümde biraz yükselme eğiliminde; şans eseri düşük çıkan puan bir sonraki sefere kendiliğinden düzelir. Asıl kanıt, planına giren konuların girmeyenlerden daha çok yükselmesi. Az sayıda öğrenciyle çıkan fark da tesadüf olabilir.",
        oneri: "Kalsın; pilot sonunda iki grup arasındaki fark artış eşiğini geçiyorsa yöntem işe yarıyor demektir.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "esik", baslik: "Sınır", tur: "sayi" }],
          satirlar: [
            satir("artis", "Anlamlı artış: başarıda en az kaç puanlık yükselme", { esik: 10 }),
            satir("ogrenci", "Ortalama göstermek için en az kaç öğrenci", { esik: 10 }),
            satir("soru", "Bir konuyu karşılaştırmak için iki ölçümde de en az kaç soru", { esik: 3 }),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 2 ──────────────────────────────────────────────────────
  {
    anahtar: "sinav",
    baslik: "Sınavlar ve kuralları",
    giris:
      "Öğrenci kayıt olurken hedef sınavını seçiyor; testlerin soru sayısı, net hesabı, boş bırakma tavsiyesi ve 'sınava X gün kaldı' sayacı bu seçime bağlı. Yanlışın doğruyu götürme kuralı her test başlarken o teste kaydediliyor; kural sonradan düzeltilirse eski sonuçlar düzelmiyor. Bu yüzden bu bölümün, öğrenciler gelmeden kesinleşmesi gerekiyor.",
    sorular: [
      {
        anahtar: "sinav.kurallar",
        baslik: "Sınav kuralları",
        soru: "Her sınav için aşağıdaki değerler doğru mu? Yanlış ya da eksik olanı düzeltin.",
        simdi:
          "LGS, TYT ve AYT'deki yanlış götürme kuralı kesin. KPSS, DGS ve ALES'te '4 yanlış 1 doğruyu götürür' bizim varsayımımız. Hiçbir sınavın tarihi girili değil; öğrenci ekranında yalnızca ay yazıyor (LGS, TYT ve AYT Haziran; KPSS Lisans ve DGS Temmuz; KPSS Ön Lisans Eylül; ALES Kasım ve Nisan). Deneme süresini, matematik ayrı oturum olmadığı için sınavın resmî süresini soru sayısına oranlayarak bulduk: TYT'de 165 dakikada 120 soru var, yani 40 soru için 55 dakika.",
        neden:
          "Yanlış götürme kuralı yanlışsa her net ve 'boş bırak mı, işaretle mi' tavsiyesi yanlış olur. Tarih girilince öğrencinin ana sayfasında ve haftalık e-postasında geri sayım kendiliğinden çıkıyor.",
        oneri:
          "Bilmediğiniz tarihi boş bırakın: yanlış bir geri sayım, hiç olmamasından kötü. DGS sayısalın soru sayısını (bizde 60) ve KPSS matematiğinin 30 olduğunu özellikle kontrol etmenizi rica ederiz.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "soru", baslik: "Matematik soru sayısı", tur: "sayi", birim: "soru" },
            {
              anahtar: "ceza",
              baslik: "Yanlış götürme",
              tur: "metin",
              yardim: "Ör. '4 yanlış 1 doğruyu götürür' ya da 'götürmez'.",
            },
            {
              anahtar: "tarih",
              baslik: "Sıradaki sınav tarihi",
              tur: "tarih",
              yardim: "Bilmiyorsanız boş bırakın. Yılda birkaç kez yapılan sınavda en yakın tarih.",
            },
            {
              anahtar: "sure",
              baslik: "Önerilen deneme süresi",
              tur: "sayi",
              birim: "dakika",
              yardim: "Öğrenciye matematik bölümü için önereceğiniz süre.",
            },
          ],
          satirlar: [
            satir("lgs", "LGS", { soru: 20, ceza: "3 yanlış 1 doğruyu götürür", tarih: null, sure: 40 }),
            satir("tyt", "TYT", { soru: 40, ceza: "4 yanlış 1 doğruyu götürür", tarih: null, sure: 55 }),
            satir("ayt", "AYT", { soru: 40, ceza: "4 yanlış 1 doğruyu götürür", tarih: null, sure: 45 }),
            satir("kpss-lisans", "KPSS Lisans (Genel Yetenek)", {
              soru: 30,
              ceza: "varsayım: 4 yanlış 1 doğruyu götürür",
              tarih: null,
              sure: 35,
            }),
            satir("kpss-onlisans", "KPSS Ön Lisans (Genel Yetenek)", {
              soru: 30,
              ceza: "varsayım: 4 yanlış 1 doğruyu götürür",
              tarih: null,
              sure: 35,
            }),
            satir("dgs", "DGS (sayısal)", { soru: 60, ceza: "varsayım: 4 yanlış 1 doğruyu götürür", tarih: null, sure: 90 }),
            satir("ales", "ALES (sayısal)", { soru: 50, ceza: "varsayım: 4 yanlış 1 doğruyu götürür", tarih: null, sure: 75 }),
          ],
        },
        oncelik: "acil",
      },
      {
        anahtar: "sinav.liste",
        baslik: "Öğrencinin seçebileceği sınavlar",
        soru: "Pilot sürerken öğrenci hangi sınavları seçebilsin?",
        simdi:
          "Öğrenci kayıtta altı sınavdan birini seçebiliyor: LGS, TYT, AYT, KPSS Lisans, DGS, ALES. Soru havuzu dolmamış bir sınavı seçen öğrenci, paket listesinde açılabilecek bir test bulamıyor.",
        neden: "Boş bir ekranla karşılaşan öğrenci ürünü yarım bulup bırakıyor; ilk izlenim pilotun en değerli kazancı.",
        oneri: "Pilotta yalnızca pilot sınavı seçilebilsin; diğerleri soruları hazır oldukça açılsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("pilot", "Yalnızca pilot sınavı; diğerleri soruları hazır oldukça", onerilen),
            secenek("hepsi", "Altısı da açık kalsın (şu an)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "sinav.bos-birakma",
        baslik: "Boş bırakma tavsiyesi",
        soru: "Öğrenciye verdiğimiz boş bırakma tavsiyesi uygun mu?",
        simdi:
          "Öğrenci sınavını seçerken şu cümleyi görüyor. LGS'de: 'Hiçbir fikrin yoksa boş bırak — 3 yanlış 1 doğruyu götürüyor.' Diğer sınavlarda: 'İki şıkkı eleyebiliyorsan işaretle; hiç fikrin yoksa boş bırak.' Kâğıtta çözülen kitapçıkta ise 'emin değilsen boş bırakmak daha iyi olabilir' yazıyor.",
        ornek:
          "Soruların en az beşte birini boş bırakan öğrenci sonuç ekranında şunu görüyor: '8 soruyu boş bıraktın. TYT'de 4 yanlış 1 doğruyu götürüyor; iki şıkkı eleyebildiğin soruda işaretlemek uzun vadede kazandırır.'",
        neden:
          "Doğru boş bırakma alışkanlığı birçok öğrenciye bir konu çalışmasından daha çok net kazandırıyor. Cümle, sizin öğrencilere söylediğinizle aynı olmalı.",
        oneri:
          "Ekran ve sonuç cümleleri kalsın; kitapçıktakini de onlarla aynı yapalım. 5 şıklı, 4 yanlışın 1 doğruyu götürdüğü sınavda hiç fikri olmadan işaretlemek ortalamada ne kazandırır ne kaybettirir; bir şık bile elenebiliyorsa işaretlemek kazandırır.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "sinav.sik-sayisi",
        baslik: "Şık sayısı",
        soru: "LGS'de 4 şık (A-D), diğer sınavlarda 5 şık (A-E) olsun. Doğru mu?",
        simdi: "Böyle. Şık sayısı sınava uymayan soru, uyarıyla da olsa sisteme alınıyor.",
        neden:
          "Şık sayısı şansla doğru yapma oranını değiştiriyor (4 şıkta %25, 5 şıkta %20); soru istatistiklerindeki 'şans düzeyinde' uyarısı buna göre okunuyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "sinav.hedef-net",
        baslik: "Başlangıç hedef neti",
        soru: "Kayıtta öğrenciye önerilen başlangıç hedef neti uygun mu?",
        simdi:
          "Kayıtta öğrenci 'Matematikte hedefin kaç net?' sorusunu bir kaydırıcıyla cevaplıyor; kaydırıcı aşağıdaki değerle açılıyor. Hedef, gelişim grafiğinde bir çizgi olarak görünüyor ve profilden değiştirilebiliyor.",
        neden:
          "Kaydırıcının açıldığı değer çoğu öğrencinin hedefi oluyor. Gerçekçi olmayan bir hedef ilk günden moral bozuyor; çok düşük bir hedef de öğrenciyi gereğinden fazla rahatlatıyor.",
        oneri: "Her sınav için ortalama bir öğrencinin birkaç ayda ulaşabileceği net.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "hedef", baslik: "Başlangıç hedefi", tur: "sayi", birim: "net" }],
          satirlar: [
            satir("lgs", "LGS", { hedef: 15 }),
            satir("tyt", "TYT", { hedef: 25 }),
            satir("ayt", "AYT", { hedef: 20 }),
            satir("kpss-lisans", "KPSS Lisans", { hedef: 20 }),
            satir("kpss-onlisans", "KPSS Ön Lisans", { hedef: 18 }),
            satir("dgs", "DGS", { hedef: 35 }),
            satir("ales", "ALES", { hedef: 30 }),
          ],
        },
        oncelik: "sonra",
      },
      {
        anahtar: "sinav.kpss-onlisans",
        baslik: "KPSS Ön Lisans",
        soru: "KPSS Ön Lisans öğrenciye ayrı bir sınav olarak açılsın mı?",
        simdi:
          "Sistemde tanımlı ama öğrenci seçemiyor. Konuları KPSS Lisans'la aynı kabul ediliyor; kendi paketi ve konu ağırlıkları yok.",
        neden: "Ön lisans adayı şimdilik KPSS Lisans'ı seçmek zorunda; paketler ve hedef net ona göre geliyor.",
        oneri: "Pilotta kapalı kalsın; KPSS Lisans paketleri oturunca aynı sorularla açalım.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("kapali", "Şimdilik kapalı kalsın", onerilen),
            secenek("lisans-paketleri", "KPSS Lisans paketleriyle hemen açılsın"),
            secenek("ayri", "Kendi paketleriyle açılsın"),
          ],
        },
        oncelik: "sonra",
      },
    ],
  },

  // ── 3 ──────────────────────────────────────────────────────
  {
    anahtar: "kazanim",
    baslik: "Konular ve kazanımlar",
    giris:
      "Sistem her soruyu bir konuya bağlıyor; sonuç ekranındaki konu haritası ve haftalık plan bu bağdan çıkıyor. Seviyeli check-up'ın ilk aşaması ise konudan daha ince bir birimle, kazanımla çalışıyor: her kazanımdan bir soru soruyor ve karnede 'şu kazanım eksik' yazıyor. Konu ağacı hazır ama gerçek kazanım listesi yok; seviyeli check-up bu liste olmadan açılamıyor.",
    sorular: [
      {
        anahtar: "kazanim.sorumlu",
        baslik: "Kazanım listesinin sorumlusu",
        soru: "Kazanım listesini kim çıkaracak, ne zamana kadar?",
        simdi: "Liste yok; bu iş için kimse görevlendirilmedi.",
        neden:
          "Seviye 1 soruları kazanıma bağlı yazılıyor: liste gelmeden Seviye 1 için tek soru yazılamıyor. Konu paketleri ise kazanımsız da çalışıyor.",
        oneri:
          "Önce pilot sınavının listesi. ALES ve DGS'nin listesi KPSS ve TYT'nin de büyük kısmını kapsıyor, çünkü konular ortak.",
        cevap: { tur: "metin", ipucu: "Ad ve hedef tarih; ör. 'Ben, 15 Kasım'a kadar'." },
        oncelik: "acil",
      },
      {
        anahtar: "kazanim.bicim",
        baslik: "Kazanım listesinin biçimi",
        soru: "Kazanım listesi için önerdiğimiz biçim uygun mu?",
        simdi:
          "Her kazanımın üç parçası var: bağlı olduğu konu, kısa ve kalıcı bir kazanım kodu (ör. BL-01) ve tek cümlelik adı. Kazanım kodu bir kez kullanıldıktan sonra değişmiyor; sorular kazanıma bu kodla bağlanıyor. Kazanımlar panelden tek tek ya da soru dosyasıyla toplu girilebiliyor.",
        ornek:
          "Bölme ve Bölünebilme · BL-01 · 3 ve 9 ile bölünebilme kuralını uygular. Bölme ve Bölünebilme · BL-02 · 11 ile bölünebilme kuralını uygular. Temel Kavramlar · TK-01 · Pozitif tam sayı koşulu altında en büyük ya da en küçük değeri bulur.",
        neden:
          "Kazanım adı öğrencinin karnesinde aynen yazıyor. Ölçülebilir bir fiille yazılan kazanım ('uygular', 'hesaplar', 'karşılaştırır') öğrenciye ne çalışacağını söylüyor.",
        oneri: "Üç sütunlu bir Excel ya da Word tablosu: konu, kazanım kodu, tek cümlelik kazanım. Panele toplu aktarımı biz yaparız.",
        cevap: { tur: "uygunMu" },
        oncelik: "acil",
      },
      {
        anahtar: "kazanim.konu-basina",
        baslik: "Konu başına kazanım",
        soru: "Bir konuya ortalama kaç kazanım düşsün?",
        simdi:
          "Seviye 1 her sınavda belirli sayıda kazanım soruyor: LGS'de 35, diğer sınavlarda 50. Konu ağacında TYT'de 32, AYT'de 16, KPSS'de 34, DGS ve ALES'te 37, LGS'de 12 alt konu var. Yani 50'ye ulaşmak için TYT'de bazı konulara iki kazanım, AYT ve LGS'de konu başına üç kazanım gerekiyor.",
        neden:
          "Kazanım çok genişse ('Problem çözer') karne öğrenciye bir şey söylemiyor; çok darsa liste yüzlerce satıra çıkıyor ve her kazanıma ayrı soru yazmak imkânsızlaşıyor.",
        oneri: "Konu başına 2-4 kazanım; büyük konulara (Problemler, Geometri) daha çok.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("genis", "1-2 (geniş kazanımlar)"),
            secenek("orta", "2-4", onerilen),
            secenek("ince", "5 ve üstü (ince kazanımlar)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kazanim.konu-agaci",
        baslik: "Konu ağacı",
        soru: "Konu ağacında eksik, fazla ya da yanlış adlandırılmış konu var mı?",
        simdi:
          "Üç ana başlık var. Temel Matematik TYT, KPSS, DGS ve ALES'te ortak: aynı 'Üslü Sayılar' konusu dört sınavda birden kullanılıyor, öğrenci sınav değiştirince geçmişi kaybolmuyor. İleri Matematik yalnızca AYT'de, LGS Matematik yalnızca LGS'de.",
        ornek:
          "Temel Matematik: Temel Kavramlar, Sayı Basamakları, Bölme ve Bölünebilme, EBOB-EKOK, Rasyonel Sayılar, Basit Eşitsizlikler, Mutlak Değer, Üslü Sayılar, Köklü Sayılar, Çarpanlara Ayırma, Oran-Orantı, Denklem Çözme, Problemler (sayı-kesir, yaş, işçi-havuz, hareket-hız, yüzde-kâr-zarar, karışım, faiz, grafik, rutin olmayan), Kümeler, Mantık, Fonksiyonlar, Polinomlar, 2. Dereceden Denklemler, Permütasyon-Kombinasyon-Olasılık, Veri-İstatistik, Sayı Dizileri, Tablo-Grafik Yorumlama, İşlem-Modüler Aritmetik, Sayısal Mantık, Geometri (açılar, üçgenler, dörtgenler ve çokgenler, çember ve daire, katı cisimler). İleri Matematik: Fonksiyonlar, Polinomlar, 2. Dereceden Denklemler ve Eşitsizlikler, Karmaşık Sayılar, Logaritma, Diziler, Limit ve Süreklilik, Türev, İntegral, Trigonometri (4 alt konu), Analitik Geometri (nokta, doğru, çember). LGS: Çarpanlar ve Katlar, Üslü İfadeler, Kareköklü İfadeler, Veri Analizi, Olasılık, Cebirsel İfadeler ve Özdeşlikler, Doğrusal Denklemler, Eşitsizlikler, Üçgenler, Eşlik ve Benzerlik, Dönüşüm Geometrisi, Geometrik Cisimler.",
        neden:
          "Bir konu sonradan bölünürse ya da adı değişirse o konuda biriken sonuçlar ve sorular yeniden düzenlenmek zorunda kalıyor; soru yazımı başlamadan kesinleşmesi en kolayı.",
        oneri:
          "Eksik konuyu adıyla, bölünmesi gereken konuyu da nasıl bölüneceğiyle yazmanız yeterli; ağacı biz güncelleriz.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "kazanim.konu-sirasi",
        baslik: "Konu sırası",
        soru: "Konular hangi sırayla dursun?",
        simdi:
          "Konular yukarıdaki sırayla duruyor; bu sırayı biz koyduk, müfredat sırasıyla birebir aynı değil. Panelin listeleri ve Seviye 1'in hangi kazanımları soracağı bu sıraya bağlı.",
        neden:
          "Seviye 1 sıradaki ilk 50 kazanımı soruyor; sıra yanlışsa bazı üniteler hiç sorulmayabiliyor ('Seviyeli check-up' bölümünde ayrıca soruyoruz).",
        oneri: "Müfredat sırası: içerik ekibinin de öğrencinin de alışık olduğu sıra bu.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("mufredat", "Müfredat (ders kitabı) sırası", onerilen),
            secenek("sinav", "Sınavdaki soru sırası"),
            secenek("simdiki", "Şu anki sıra kalsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kazanim.ozet-karti",
        baslik: "Kazanım özet kartları",
        soru: "Kazanım özet kartlarını kim, ne zaman yazsın?",
        simdi:
          "Her kazanımın kısa bir özet kartı olabiliyor. Öğrenci o kazanımda yanlış yaptığında kartı sonuç ekranında ve yanlış defterinde görüyor. Şu an hiçbir kazanımın kartı yok; kartı olmayan kazanımda bu alan görünmüyor.",
        neden:
          "Yanlışın hemen ardından okunan üç satırlık bir hatırlatma, öğrenciyi baştan konu anlatımına göndermekten çoğu zaman daha etkili.",
        oneri: "Kazanım listesiyle birlikte, aynı kişi yazsın: kazanımı tanımlayan kişi özünü de en iyi bilen kişi.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("birlikte", "Kazanım listesiyle birlikte, aynı kişi", onerilen),
            secenek("sonra", "Liste bittikten sonra, ayrı bir turda"),
            secenek("yok", "Kart olmasın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kazanim.ozet-duzeni",
        baslik: "Özet kartının düzeni",
        soru: "Özet kartı için önerdiğimiz düzen uygun mu: kural, varsa formül, kısa bir örnek?",
        simdi: "Kartın bir düzeni yok; yalnızca uzunluk sınırı var: en fazla 1200 karakter (kabaca 10-12 satır).",
        ornek:
          "Kural: Rakamları toplamı 3'ün katı olan sayı 3'e bölünür; 9'un katıysa 9'a da bölünür. Örnek: 4512 için 4 + 5 + 1 + 2 = 12; 12, 3'ün katı ama 9'un katı değil. 4512, 3'e bölünür, 9'a bölünmez.",
        neden: "Aynı düzen her kartta tekrar ederse öğrenci aradığını hemen buluyor.",
        oneri: "Kural, varsa formül, tek bir kısa örnek; 3-5 satır.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
    ],
  },

  // ── 4 ──────────────────────────────────────────────────────
  {
    anahtar: "kaynak",
    baslik: "Soru kaynakları ve telif",
    giris:
      "Öğrencinin gördüğü her test, havuzdaki yayında sorulardan o an seçiliyor. Havuz şu an boş; bir paketin öğrenciye açılabilmesi için içindeki her konudan yeterli soru gerekiyor. Sorular üç yoldan gelebilir: elinizdeki hazır sorular, yeni yazılan sorular ve bir soru kalıbından sistemin ürettiği sorular.",
    sorular: [
      {
        anahtar: "kaynak.eldeki",
        baslik: "Eldeki hazır sorular",
        soru: "Elinizde hazır soru var mı; varsa hangi biçimde, kaç tane ve hangi konularda?",
        simdi:
          "Sistem soruları iki yoldan alıyor: panelde tek tek giriş ya da belirli bir düzende yazılmış dosyayla toplu aktarım. Sorular Word ya da InDesign dosyasındaysa toplu aktarım için biz dönüştürüyoruz; yalnızca PDF ya da basılı kitap varsa her soru elle giriliyor.",
        neden: "Bu cevap, havuzun dolmasının günler mi haftalar mı süreceğini belirliyor.",
        oneri: "Dizgi dosyası (Word, InDesign) varsa onu gönderin; PDF'ten aktarım hem yavaş hem hataya açık.",
        cevap: {
          tur: "metin",
          ipucu: "Biçim, yaklaşık sayı ve konular; ör. 'Word dosyaları, yaklaşık 800 soru, TYT problemleri ve geometri'.",
        },
        oncelik: "acil",
      },
      {
        anahtar: "kaynak.pilot-hedef",
        baslik: "Pilot için soru hedefi",
        soru: "Pilot için ilk soru hedefi ne olsun?",
        simdi:
          "Bir paketin açılması için pakette istenen kadar yayında soru gerekiyor (çoğu pakette konu başına 3-4). Aynı öğrenci aynı soruyu 30 gün içinde ikinci kez görmesin diye konu başına bundan fazlası lazım. Seviyeli check-up'ın açılması için TYT'de en az 100 soru gerekiyor: Seviye 1'deki 50 kazanımın her birine bir, Seviye 2 ve 3'e 25'er soru.",
        neden:
          "Hedef ne kadar dar olursa pilot o kadar erken başlar; ama sorusu az olan konuda ikinci testte aynı sorular gelmeye başlar.",
        oneri: "Pilot sınavının Çekirdek paketindeki her konuya 10'ar soru (TYT'de 8 konu, 80 soru); seviyeli check-up ikinci aşamada.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("cekirdek", "Çekirdek paketin her konusuna 10 soru (TYT'de 80 soru)", onerilen),
            secenek(
              "tum-paketler",
              "Pilot sınavının bütün konu paketleri, konu başına 10 soru (TYT'de 21 konu, yaklaşık 210 soru)"
            ),
            secenek("seviyeli", "Bunlara ek olarak seviyeli check-up da (100-150 soru daha)"),
          ],
        },
        oncelik: "acil",
      },
      {
        anahtar: "kaynak.yazim-yeri",
        baslik: "Soruların yazılacağı yer",
        soru: "Ekip yeni soruları nerede yazsın?",
        simdi:
          "Panelde tek tek yazılabiliyor: formül önizlemesi, şekil yükleme ve şıkların denetimi hazır. Toplu aktarım şu an Word dosyasını doğrudan almıyor, belirli düzende yazılmış düz metin dosyası istiyor; Word'de yazılan soruları bu düzene biz çeviriyoruz.",
        neden: "Ekip alıştığı araçta daha hızlı ve daha az hatayla yazıyor; ama her çeviri adımı yeni bir hata fırsatı.",
        oneri: "Word'de, bizim vereceğimiz şablonla; haftada bir dosya. Gerekirse Word dosyalarını doğrudan alacak düzeni de kurarız.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("panel", "Panelde tek tek"),
            secenek("word", "Word'de, şablonla; dosyayı siz aktarın", onerilen),
            secenek("karisik", "İkisi de: yeni sorular panelde, eski sorular dosyayla"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kaynak.ornek-dosya",
        baslik: "Deneme dosyası",
        soru: "Başlamadan önce 10-20 soruluk deneme bir dosya gönderebilir misiniz?",
        simdi:
          "Toplu aktarım hazır. Dosya yüklenince sistem önce her soruyu denetleyip sorunları satır satır listeliyor, sonra geçerli soruları taslak olarak kaydediyor. Yanlış bir aktarım geri alınabiliyor.",
        neden: "İlk dosyada çıkan biçim sorunlarını birlikte çözersek sonraki yüzlerce soru sorunsuz giriyor.",
        oneri: "Bu hafta küçük bir dosya; sorunları birlikte ayıklayıp şablonu ona göre sadeleştirelim.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("evet", "Evet, gönderirim", onerilen),
            secenek("birlikte", "Önce birlikte bir soru yazalım"),
            secenek("panel", "Dosya yerine panelden tek tek gireceğiz"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kaynak.telif",
        baslik: "Telif",
        soru: "Soruların kaynağı ne olacak?",
        simdi:
          "Her soruda isteğe bağlı bir kaynak alanı var ('özgün', 'uyarlama' ya da '2023 TYT, 12. soru' gibi). Sistem bu alanı yalnızca not olarak saklıyor; çıkmış soruyu ayrıca işaretlemiyor.",
        neden:
          "ÖSYM ve MEB'in çıkmış sorularını izinsiz birebir kullanmak telif sorunu doğurabilir; ücretli bir üründe bu risk büyüyor.",
        oneri: "Hepsi sınav tarzında özgün sorular; çıkmış sorudan uyarlama yapılırsa kaynak alanına yazılsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("ozgun", "Hepsi özgün, sınav tarzında", onerilen),
            secenek("uyarlama", "Bir kısmı çıkmış sorulardan uyarlama (kaynağı yazılır)"),
            secenek("birebir", "Çıkmış sorular birebir de kullanılacak (izin ayrıca netleşmeli)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kaynak.parametrik",
        baslik: "Soru kalıbından üretim",
        soru: "Seviye 1 soruları için soru kalıbı yöntemini kullanalım mı?",
        simdi:
          "Panelde böyle bir araç henüz yok; her soru tek tek yazılıyor. Sistemi denemek için kullandığımız örnek sorular bu yöntemle üretildi.",
        ornek:
          "Kalıp: 'a ve b farklı pozitif tam sayılar, 2a + 3b = N olduğuna göre a en çok kaçtır?' N, 30 ile 60 arasında bir çift sayı. Doğru cevap formülle bulunuyor; 'b = 0 alınmış' çeldiricisi eksik okuma olarak işaretleniyor. Sistem N'yi değiştirerek onlarca soru üretiyor ve her birinde şıkların birbirinden farklı çıktığını denetliyor.",
        neden:
          "Seviye 1'in teyit turu, öğrencinin eksik çıktığı kazanımdan ilk turda görmediği yeni bir soru istiyor. Kazanım başına tek soru yazılırsa o tur çalışmıyor; kalıpla her kazanıma bol soru çıkıyor ve yanlış şıkların hata türü baştan belli oluyor.",
        oneri: "Seviye 1'de kalıpla ilerleyelim; Seviye 2 ve 3 (çok adımlı ve sınav standardında sorular) elle yazılsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("evet", "Evet: Seviye 1 kalıpla, Seviye 2 ve 3 elle", onerilen),
            secenek("deneme", "Önce birkaç kalıpla deneyelim, sonra karar verelim"),
            secenek("hayir", "Hayır, hepsi elle yazılsın"),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 5 ──────────────────────────────────────────────────────
  {
    anahtar: "yazim",
    baslik: "Soru yazım standardı",
    giris:
      "Bir soru öğrenciye yalnızca soru metni ve şıklarla gitmiyor. Yanlış şıkkın hangi hatadan çıktığı sonuç ekranındaki teşhisi, zorluk ve hedef süre testin dengesini ve 'yavaş kaldın' uyarısını, çözüm de öğrencinin yanlışından öğrenmesini besliyor. Bu bölümde her soruda neyin zorunlu olacağını soruyoruz; ekip yazmaya başlamadan kesinleşmesi iyi olur.",
    sorular: [
      {
        anahtar: "yazim.celdirici",
        baslik: "Yanlış şıkların hata türü",
        soru: "Her yanlış şıkkın hangi hatadan çıktığını yazmak zorunlu kalsın mı? Ekip bunu her soruda yapabilir mi?",
        simdi:
          "Yayın için zorunlu: hata türü eksik soru taslak olarak alınıyor ama yayına çıkamıyor; toplu dosyada da eksik olan soru reddedilmiyor, uyarıyla taslak giriyor. Sonuç ekranındaki 'yanlışlarının ortak sebebi' kartı bu işaretlerden çıkıyor.",
        ornek:
          "2a + 3b = 42 sorusunda doğru cevap 18. 21 şıkkı 'eksik okuma: b = 0 alınmış, pozitif şartı atlanmış', 19 şıkkı 'kavram yanılgısı: 2a tek sayı olamaz' diye işaretleniyor.",
        neden:
          "Öğrenci 'yanlış yaptın' yerine 'kavram eksiğin yok, işlemde kaybediyorsun' cümlesini görüyor; çalışma biçimini değiştiren bilgi bu.",
        oneri: "Zorunlu kalsın. Çeldiriciyi yazarken hangi hatayı yakalamak istediğini düşünmek, iyi çeldiricinin kendisi.",
        cevap: { tur: "uygunMu" },
        oncelik: "acil",
      },
      {
        anahtar: "yazim.cozum",
        baslik: "Çözümsüz soru",
        soru: "Çözümü yazılmamış soru sisteme alınsın mı?",
        simdi:
          "Çözümsüz soru taslak olarak alınıyor ama çözüm eklenene kadar yayına çıkamıyor. Soru formunda 'yayına hazır mı' listesi eksikleri gösteriyor; toplu yayında çözümsüz sorular atlanıyor ve hangileri olduğu söyleniyor. Öğrenci sonuç ekranında ve alıştırmada çözümü görüyor.",
        neden: "Öğrencinin en çok öğrendiği an, yanlışının çözümünü okuduğu an. Çözümsüz soru bu anı boşa harcıyor.",
        oneri: "Kalsın: yazar çözümü sonra ekleyebilir, öğrenci çözümsüz soru görmez.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("yayin-yok", "Alınsın ama çözüm eklenene kadar yayına çıkamasın (şu an)", onerilen),
            secenek("alinmasin", "Hiç alınmasın"),
            secenek("simdiki", "Uyarıyla alınsın, çözümsüz de yayına çıkabilsin"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "yazim.adimlar",
        baslik: "Adım adım çözüm",
        soru: "Çözümlerin 2-5 adıma bölünmesi uygun mu?",
        simdi:
          "Yazar çözümdeki adımları ayırırsa öğrenci çözümü 'Adım 1/3' diye tek tek açıyor; ayırmazsa çözüm tek parça görünüyor. Adım sayısı için bir kural yok.",
        neden:
          "Adım adım açılan çözümde öğrenci her adımdan sonra kendisi devam etmeyi deneyebiliyor; çözümün tamamını bir anda görmek bu fırsatı kaçırıyor.",
        oneri: "2-5 adım: tek adımlık çözüm düşünecek yer bırakmıyor, beşten fazlası dağılıyor.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "yazim.zorluk",
        baslik: "Zorluk ölçeği",
        soru: "Zorluk 1-5 için önerdiğimiz anlam uygun mu?",
        simdi:
          "Yazar her soruya 1 (çok kolay) ile 5 (çok zor) arasında bir zorluk yazıyor; ölçeğin ortak bir tanımı yok. Konu paketleri soruları bu etikete göre seçiyor. Yeterli cevap toplanınca sistem, etiket ile öğrencilerin gerçek doğru oranı iki kademe ayrışırsa uyarıyor.",
        neden: "Her yazarın '3'ü farklıysa testlerin kolay-orta-zor dengesi tutmuyor.",
        oneri:
          "Ölçek, sistemin cevaplardan önerdiği zorlukla aynı olsun: 1, öğrencilerin %85'ten fazlası yapar; 2, %70-85; 3, %45-70; 4, %25-45; 5, %25'ten azı yapar.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "yazim.hedef-sure",
        baslik: "Hedef süre",
        soru: "Her sorunun hedef süresini kim, nasıl belirlesin?",
        simdi:
          "Yazar her soruya saniye olarak bir hedef süre yazıyor (10 ile 600 saniye arası; yazılmazsa soru alınmıyor). Bir konuda öğrencinin harcadığı süre o konunun hedeflerinin 1,3 katını aşarsa sonuç ekranında 'yavaş' deniyor; tek bir soruda hedefin iki katı aşılırsa süre kartında 'takıldığın soru' sayılıyor.",
        neden: "Hedef süreler gerçekçi değilse 'yavaş' uyarısı ya hiç çıkmıyor ya herkese çıkıyor.",
        oneri:
          "Yazar kendi tahminini yazsın; pilotun ilk haftalarından sonra gerçek sürelere bakıp düzeltelim (panel her sorunun ortanca çözüm süresini gösteriyor).",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("yazar", "Yazar kendi tahminini yazsın, pilottan sonra düzeltelim", onerilen),
            secenek("sinav", "Sınava göre sabit bir değer (ör. TYT'de soru başına 80 saniye)"),
            secenek("zorluk", "Zorluğa göre sabit bir değer (ör. zorluk 1 için 45 saniye, zorluk 5 için 150 saniye)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "yazim.kazanim-s23",
        baslik: "Seviye 2 ve 3'te kazanım",
        soru: "Seviye 2 ve 3 sorularının bir kazanıma bağlanmaması uygun mu?",
        simdi:
          "Seviye 1 sorusunda kazanım kodu zorunlu. Seviye 2 ve 3 soruları birden çok kazanımı birleştirdiği için bu sorulara kazanım kodu yazılamıyor; karnede bu seviyeler için kazanım değil konu başarısı görünüyor.",
        neden:
          "Seviye 2 ve 3'teki bir yanlış öğrenciye 'şu kazanım eksik' diyemiyor, yalnızca 'şu konuda çok adımlı sorularda zorlanıyorsun' diyebiliyor.",
        oneri: "Kalsın. Birden çok kazanımı ölçen soruyu tek bir kazanıma bağlamak karneyi yanıltır.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "yazim.sablon",
        baslik: "Soru şablonu",
        soru: "Soru şablonundaki alanlar ekip için uygun mu?",
        simdi:
          "Şablon her soru için şunları istiyor: kalıcı bir soru numarası, konu, Seviye 1'de kazanım kodu, zorluk, seviye, hedef süre, soru metni, şıklar ve doğru şık, her yanlış şıkkın hata türü, çözüm. İsteğe bağlı olanlar: hangi sınavlarda sorulacağı, kaynak, şekil, en fazla 3 ipucu, video bağlantısı. Doğru şık iki ayrı yerde yazılıyor; ikisi çelişirse soru alınmıyor.",
        neden: "Şablon ne kadar sadeyse ekip o kadar hızlı yazıyor; ama çıkarılan her alan öğrenci ekranında bir şeyi eksik bırakıyor.",
        oneri: "Kalsın; ekip ilk dosyada zorlandığı alanı söylesin, gerekirse isteğe bağlı alanları ikinci tura bırakırız.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
    ],
  },

  // ── 6 ──────────────────────────────────────────────────────
  {
    anahtar: "destek",
    baslik: "İpucu, video, formül ve şekil",
    giris:
      "Alıştırmada takılan öğrenci ipuçlarını tek tek açabiliyor. Cevaptan sonra, hem alıştırmada hem sonuç ekranında, çözümü ve varsa video çözümü görüyor. Formüller ve şekiller ekranda ve yazdırılan kitapçıkta aynı biçimde çıkıyor. Bu bölüm bu yardımcıların hangi sorulara ve nasıl yazılacağını soruyor.",
    sorular: [
      {
        anahtar: "destek.ipucu-kapsam",
        baslik: "İpucu hangi sorulara",
        soru: "İpucu hangi sorulara yazılsın?",
        simdi:
          "İpucu zorunlu değil. Bir soruya en fazla 3 ipucu yazılabiliyor, her biri en fazla 600 karakter. İpuçları yalnızca alıştırmada ve yanlış defteri tekrarında, öğrenci isteyince tek tek açılıyor; süreli testte görünmüyor.",
        neden: "İpucu yazmak soru başına birkaç dakika ekliyor; en çok, öğrencinin tek başına çıkamadığı sorularda işe yarıyor.",
        oneri: "Zorluğu 3 ve üstü olan sorulara; kolay soruda ipucu çözümün kendisi oluyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hepsi", "Her soruya"),
            secenek("zor", "Zorluğu 3 ve üstü olan sorulara", onerilen),
            secenek("seviye", "Yalnızca Seviye 1 ve 2 sorularına"),
            secenek("serbest", "Zorunlu olmasın, yazar isterse (şu an)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "destek.ipucu-duzeni",
        baslik: "İpuçlarının sırası",
        soru: "İpuçları için önerdiğimiz sıra uygun mu?",
        simdi: "Sıra için bir kural yok; öğrenci ipuçlarını yazıldıkları sırayla açıyor.",
        ornek:
          "2a + 3b = 42 sorusu için. 1. ipucu yön gösterir: 'a'nın büyük olması için b nasıl seçilmeli?' 2. ipucu ilk adımı kurar: '2a = 42 − 3b çift sayı olmalı; 3b hangi b değerlerinde çifttir?' 3. ipucu sonuca bir adım kala bırakır: 'b = 2 için a kaç olur?'",
        neden:
          "Her ipucu bir öncekinden biraz daha fazlasını verirse öğrenci yalnızca ihtiyacı kadarını açıyor; ilk ipucu cevabı verirse öğrenme orada bitiyor.",
        oneri:
          "1. ipucu hangi kavram ya da formül, 2. ipucu ilk adım, 3. ipucu sonuca bir adım kala. 600 karakter bir iki cümle ve formül için yeterli.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "destek.video",
        baslik: "Video çözüm",
        soru: "Video çözüm hangi sorulara olsun?",
        simdi:
          "Her soruya bir video bağlantısı eklenebiliyor (YouTube'da liste dışı video ya da Vimeo); öğrenci cevaptan sonra yazılı çözümün yanında izliyor. Şu an hiçbir soruda video yok.",
        neden: "Video çekmek yazılı çözümden çok daha pahalı; emeğin nereye harcanacağı baştan belli olmalı.",
        oneri: "Önce zor sorular (4-5): yazılı çözümün yetmediği yer orası.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("yok", "Şimdilik hiçbir soruya; yazılı çözüm yeter"),
            secenek("zor", "Yalnızca zor sorulara (4-5)", onerilen),
            secenek("kazanim", "Her kazanımdan bir örnek soruya"),
            secenek("hepsi", "Her soruya"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "destek.video-kim",
        baslik: "Videoları kim çekecek",
        soru: "Hazır video çözümleriniz var mı; yeni videoları kim çekecek, kanal hesabı kimde olacak?",
        simdi: "Belirlenmedi.",
        neden:
          "Video bağlantısı soruya kalıcı olarak yazılıyor; kanal kapanırsa ya da video kaldırılırsa öğrenci boş bir pencere görüyor. Hesabın kurumda durması bu riski azaltıyor.",
        oneri: "Kanal Koçum.Net adına açılsın; videoları çeken kişi oraya yüklesin.",
        cevap: { tur: "metin", ipucu: "Hazır video sayısı, çekecek kişi ve kanalın kimin adına olacağı." },
        oncelik: "sonra",
      },
      {
        anahtar: "destek.formul",
        baslik: "Hatalı yazılmış formül",
        soru: "Formülü sistemin çizemediği soru sisteme alınsın mı?",
        simdi:
          "Yazımı hatalı formül olan soru uyarıyla alınıyor; öğrenci o formülün yerinde kırmızı bir hata yazısı görüyor.",
        neden: "Öğrencinin bozuk formül görmesi hem soruyu çözülemez yapıyor hem ürüne güveni sarsıyor.",
        oneri: "Hiç alınmasın: sistem hatayı satır numarasıyla gösteriyor, yazar düzeltip yeniden yüklüyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("alinmasin", "Hiç alınmasın", onerilen),
            secenek("yayin-yok", "Alınsın ama düzeltilene kadar yayına çıkamasın"),
            secenek("simdiki", "Şimdiki gibi uyarıyla alınsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "destek.formul-araci",
        baslik: "Formül yazım aracı",
        soru: "Ekip formülleri şu an hangi araçla yazıyor?",
        simdi:
          "Sistem formülleri kendi yazım biçimiyle alıyor; panelde yazarken anında önizleme var. Word'deki formülleri bu biçime biz çeviriyoruz; çevirinin yolu ekibin kullandığı araca göre değişiyor.",
        neden: "Eldeki soruların aktarımı ve yeni soruların yazımı bu cevaba göre planlanacak.",
        oneri: "Hangisini kullanıyorsanız onunla devam edin; dönüşümü biz kurarız.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("word", "Word'ün denklem aracı"),
            secenek("mathtype", "MathType"),
            secenek("latex", "LaTeX"),
            secenek("elle", "Formüller elle, kâğıtta yazılıyor"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "destek.gorsel-kim",
        baslik: "Şekilleri kim hazırlayacak",
        soru: "Şekilli sorularda şekli kim hazırlayacak?",
        simdi:
          "Şekil soru metnine resim olarak ekleniyor (PNG, JPG ya da WebP; kısa kenarı en az 600 piksel). Her şekle, göremeyen bir öğrenciye şekli anlatan kısa bir açıklama yazmak zorunlu.",
        neden: "Geometri ve grafik sorularında şeklin okunaklığı sorunun kendisi kadar önemli; özellikle telefonda.",
        oneri: "Ekip çizip resim olarak göndersin; tutarlı bir görünüm için hepsinin aynı araçla çizilmesini öneririz.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("ekip", "Ekip çizip resim olarak gönderir", onerilen),
            secenek("tarif", "Ekip tarif eder, çizimi bizden ister"),
            secenek("karisik", "Hazır şekiller ekipten, yeni şekiller bizden"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "destek.gorsel-sik",
        baslik: "Şıkta ve çözümde şekil",
        soru: "Şıkları ya da çözümü şekilli sorular olacak mı?",
        simdi: "Şekil yalnızca soru metninde kullanılabiliyor; şıkta ya da çözümde şekil olan soru sisteme alınmıyor.",
        neden:
          "Grafik seçenekli sorular ('hangisi bu fonksiyonun grafiğidir' gibi) ve şekil üzerinde anlatılan çözümler bu kural yüzünden şu an yazılamıyor.",
        oneri: "Bu tip sorular sizin sınavınızda sık çıkıyorsa işaretleyin; şıkta ve çözümde şekli açarız.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("gerek-yok", "Gerek yok"),
            secenek("sik", "Evet, şıklarda (ör. grafik seçenekleri)"),
            secenek("cozum", "Evet, çözümlerde"),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 7 ──────────────────────────────────────────────────────
  {
    anahtar: "kalite",
    baslik: "Soru kalitesi ve kontrol",
    giris:
      "Bir soru yayına çıkmadan önce taslak ve inceleme aşamalarından geçebiliyor. Yayındaki soru öğrencilere sorulduktan sonra sistem cevaplardan istatistik çıkarıyor ve şüpheli soruları panelde işaretliyor. Öğrenci de sonuç ekranında ya da alıştırmada bir soru için 'bu soruda hata var' diyebiliyor. Bu bölüm bu üç denetimin kurallarını soruyor.",
    sorular: [
      {
        anahtar: "kalite.akis",
        baslik: "Yayına alma kuralı",
        soru: "Bir soru yayına çıkmadan önce incelemeden geçmek zorunda olsun mu?",
        simdi:
          "Zorunlu değil. Soru yazma yetkisi olan herkes bir soruyu doğrudan yayına alabiliyor; toplu aktarımda da onay sorularak 'doğrudan yayına al' seçeneği var. Yalnızca eksiksiz soru yayına çıkabiliyor: çözüm, her yanlış şıkkın hata türü, seviye ve formüllerin düzgün görünmesi şart. Panelde ayrıca bir 'İnceleme kuyruğu' var: incelemedeki soruları öğrencinin göreceği hâliyle tek tek gösteriyor; 'Onayla', 'Düzeltme iste' ve 'Atla' düğmeleriyle ilerleniyor. Yazan kendi sorusunu onaylarken bir uyarı görüyor ama engellenmiyor. Her sorunun kim tarafından ve ne zaman yayına alındığı kaydediliyor.",
        neden:
          "İnceleme zorunlu olursa hatalı soru öğrenciye ulaşmadan yakalanıyor; ama yayın hızı ikinci kişinin zamanına bağlanıyor.",
        oneri: "Zorunlu olsun: soruyu yazan kişi kendi sorusunu yayına alamasın, doğrudan yayına alma seçeneği kalksın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("zorunlu", "Zorunlu olsun; yazan kendi sorusunu yayına alamasın", onerilen),
            secenek("yetkili", "Doğrudan yayına almayı yalnızca yönetici ve müdür yapabilsin"),
            secenek("simdiki", "Şimdiki gibi kalsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kalite.madde-analizi",
        baslik: "Sorunlu soru eşikleri",
        soru: "Sistemin bir soruyu 'şüpheli' diye işaretlediği eşikler uygun mu?",
        simdi:
          "Bu işaretler öğrenciye gitmiyor; içerik ekibine panelde 'şu soruya bak' diyor. Hesaba yalnızca bitmiş testler ve sorunun şu anki hâli giriyor; cevap anahtarı değişince sayım baştan başlıyor. Ayırt edicilik, testin geri kalanında başarılı olan öğrencilerin bu soruyu da daha çok yapıp yapmadığını gösteriyor: 1'e yakınsa iyi, 0'a yakınsa soru iyiyi zayıftan ayırmıyor, eksiyse çoğunlukla cevap anahtarı hatalı.",
        neden: "Eşik çok gevşekse hatalı soru uzun süre yayında kalıyor; çok sıkıysa ekip sağlam sorularla vakit kaybediyor.",
        oneri: "Pilotta kalsın; ilk 20 cevaptan sonra işaretlenen sorulara birlikte bakıp gerekirse ayarlayalım.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "esik", baslik: "Eşik", tur: "metin" }],
          satirlar: [
            satir("en-az-cevap", "Bir soruyu işaretlemek için en az cevap", { esik: "20 cevap" }),
            satir("en-az-cevap-ayirt", "Ayırt edicilik işaretleri için en az cevap", { esik: "30 cevap" }),
            satir("sans", "Şans düzeyinde (çok zor ya da hatalı)", { esik: "doğru oranı %25'ten az" }),
            satir("celdirici-onde", "Çeldirici önde", { esik: "bir yanlış şık doğru şıktan daha çok seçiliyor" }),
            satir("ayirt-etmiyor", "Ayırt etmiyor", { esik: "ayırt edicilik 0,15'ten küçük" }),
            satir("ters", "Ters ayırt ediyor (çoğunlukla anahtar hatası)", { esik: "ayırt edicilik −0,05 ya da daha küçük" }),
            satir("iyi", "İyi ayırt ediyor", { esik: "ayırt edicilik 0,30 ve üstü" }),
            satir("olu", "Çalışmayan çeldirici", { esik: "cevapların %5'inden azında seçilen yanlış şık" }),
            satir("bos", "Çok boş bırakılıyor", { esik: "cevapların %30'u ya da fazlası boş" }),
            satir("yavas", "Yavaş", { esik: "ortanca çözüm süresi hedef sürenin 1,3 katından uzun" }),
            satir("zorluk", "Zorluk etiketi uymuyor", { esik: "etiketlenen ile gözlenen zorluk arasında 2 kademe fark" }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kalite.bildirim-kim",
        baslik: "Hata bildirimlerine kim bakacak",
        soru: "Öğrencinin 'bu soruda hata var' bildirimlerine kim bakacak?",
        simdi:
          "Öğrenci gördüğü bir soru için bir sebep seçiyor (doğru cevap yanlış işaretlenmiş, çözümde hata var, yazım ya da sayı hatası, şekil sorunlu, soru anlaşılmıyor, başka bir sorun) ve isterse kısa bir açıklama yazıyor. Günde en fazla 10 bildirim gönderebiliyor. Bildirimler panelde ayrı bir listede; öğrenci yalnızca 'inceleniyor' ya da 'incelendi' görüyor.",
        neden: "Bildirimine bakılmadığını gören öğrenci bir daha bildirmiyor; oysa hatalı soruyu en hızlı yakalayan öğrenci.",
        oneri: "İçerik ekibinden tek bir sorumlu; gerekirse soruyu yazana yönlendirsin.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("sorumlu", "İçerik ekibinden bir sorumlu", onerilen),
            secenek("yazan", "Soruyu yazan kişi"),
            secenek("hoca", "Ben bakacağım"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kalite.bildirim-sure",
        baslik: "Bildirime bakma süresi",
        soru: "Bir bildirime en geç kaç gün içinde bakılsın?",
        simdi: "Sistemde bir süre yok; bildirim kapatılana kadar öğrenci 'inceleniyor' görüyor.",
        neden: "Yanlış işaretlenmiş bir cevap anahtarı, düzeltilene kadar o soruyu çözen her öğrencinin netini bozuyor.",
        oneri: "En geç 2 gün; 'doğru cevap yanlış işaretlenmiş' bildirimlerine aynı gün.",
        cevap: { tur: "sayi", birim: "gün", enAz: 1, enCok: 14 },
        oncelik: "normal",
      },
      {
        anahtar: "kalite.yeniden-puanlama",
        baslik: "Anahtar düzeltilince öğrenciye haber",
        soru: "Cevap anahtarı düzeltildiğinde öğrenciye nasıl haber verilsin?",
        simdi:
          "Sistem o soruyu içeren bitmiş testleri en geç 15 dakika içinde kendiliğinden yeniden puanlıyor. Öğrenci o testin sonuç ekranında bir not görüyor; ayrıca e-posta ya da bildirim gitmiyor.",
        ornek: "'1 sorunun cevap anahtarı 22 Ekim'de düzeltildi; sonucun 12 → 13 doğru olarak yeniden hesaplandı.'",
        neden: "Dün 12 doğru gördüğü testte bugün 13 gören ve sebebini bilmeyen öğrencinin sayılara güveni sarsılıyor.",
        oneri: "Sonuç ekranındaki not yeterli; e-posta, küçük düzeltmeler için gereğinden fazla gürültü.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("not", "Sonuç ekranındaki not yeterli", onerilen),
            secenek("eposta", "Not ve ayrıca e-posta"),
            secenek("koc", "Not ve koçtan kısa bir mesaj"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kalite.geriye-donuk",
        baslik: "Düzeltmenin geçmiş kararlara etkisi",
        soru: "Anahtar düzeltilince, o sonuca dayanarak verilmiş kararların değişmemesi uygun mu?",
        simdi:
          "Net ve konu haritası yeniden hesaplanıyor, yanlış defteri de güncelleniyor. Ama o günkü sonuca göre verilmiş kararlar geriye dönük değişmiyor: haftalık plan, kapanmış kontrol testi, tamamlanmış ödev, seri ve seviyeli check-up'taki geçiş kararı.",
        neden:
          "Kararları geri almak öğrencinin önündeki planı ya da seviyesini bir gecede değiştirir; değiştirmemek ise birkaç öğrencinin yanlış bir kararla devam etmesi demek.",
        oneri: "Kalsın; seviyeli check-up'ta kararı değişecek öğrenciyi panelde gösterelim, koç gerekirse öğrenciyle konuşsun.",
        cevap: { tur: "uygunMu" },
        oncelik: "sonra",
      },
    ],
  },

  // ── 8 ──────────────────────────────────────────────────────
  {
    anahtar: "hata",
    baslik: "Hata türleri",
    giris:
      "Her yanlış şık bir hata türüyle işaretleniyor. Bir testte öğrencinin hata türü işaretli en az 3 yanlışı varsa ve bunların en az %40'ı aynı türdense sonuç ekranında 'yanlışlarının ortak sebebi' kartı çıkıyor; kartta o türün tavsiye cümlesi yazıyor. Alıştırmada da her yanlış şıkkın altında türün adı ve aynı cümle görünüyor.",
    sorular: [
      {
        anahtar: "hata.liste",
        baslik: "Hata türleri listesi",
        soru: "Hata türleri listesi yeterli mi?",
        simdi:
          "Sekiz tür ve bir 'diğer' var: işlem hatası (yol doğru, dört işlemde kayıp), işaret hatası (eksi işareti, parantez açma), ters işlem (toplama yerine çıkarma, oranı ters kurma), kavram yanılgısı (tanımı yanlış biliyor), eksik okuma (soruda verilen bir koşulu atlamış), birim hatası (dakika-saat, santimetre-metre), yaklaşık değer (erken yuvarlama), formül karıştırma (benzer iki formülü karıştırmış). 'Diğer' seçilen şık için öğrenciye tavsiye verilmiyor.",
        neden: "Yanlış şıkların çoğu 'diğer'e düşüyorsa teşhis çalışmıyor; eksik tür, eksik tavsiye demek.",
        oneri: "Eksik gördüğünüz türü adıyla ve bir örnek çeldiriciyle yazın; her yeni türe bir tavsiye cümlesi de gerekecek.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "hata.adlar",
        baslik: "Hata türlerinin adları",
        soru: "Hata türlerinin adları öğrenci için anlaşılır mı?",
        simdi: "Ad öğrencinin ekranında aynen geçiyor: '4 yanlışının ortak sebebi: kavram yanılgısı'.",
        neden: "Öğrenci adı anlamazsa altındaki tavsiyeyi de ciddiye almıyor.",
        oneri: "İki adı değiştirmeyi öneriyoruz: 'ters işlem' yerine 'ters kurma', 'yaklaşık değer' yerine 'erken yuvarlama'. Diğerleri kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "hata.tavsiyeler",
        baslik: "Hata türlerinin tavsiye cümleleri",
        soru: "Her hata türü için öğrenciye verilen tavsiye cümlesi uygun mu? Değiştirmek istediğiniz cümlenin yerine yenisini yazın.",
        simdi:
          "Cümleler yalnızca teşhis koymuyor, 'ne yapmalısın'ı da söylüyor. 'Diğer' için bilerek cümle yok: uydurma bir tavsiye, hiç tavsiye vermemekten kötü.",
        neden: "Bu cümleler öğrencinin en sık okuduğu koçluk metni; bir koçun ağzından çıkmış gibi olmalı.",
        oneri: "Cümleler kısa kalsın: bir teşhis, bir eylem.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "tavsiye", baslik: "Tavsiye cümlesi", tur: "metin" }],
          satirlar: [
            satir("islem", "İşlem hatası", {
              tavsiye:
                "Soruyu biliyorsun, dört işlemde kaybediyorsun. Çözerken ara adımları atlama — her satırı yaz. Bu, konu tekrarından daha hızlı net kazandırır.",
            }),
            satir("isaret", "İşaret hatası", {
              tavsiye:
                "Eksi işaretinde kaybediyorsun. Parantez açarken işaretleri ayrı bir satırda göster; hız için atladığın adım tam bu.",
            }),
            satir("ters", "Ters işlem", {
              tavsiye:
                "Doğru yolu kurup ters yöne gidiyorsun. Soruyu okurken “ne isteniyor” kısmını işaretle, çözüm bitince ona geri dön.",
            }),
            satir("kavram", "Kavram yanılgısı", {
              tavsiye:
                "Yanlışların kavramdan geliyor: konuyu bildiğini sanıyorsun ama tanım eksik. Bu konuda soru çözmeyi bırak, önce tanıma ve bir çözümlü örneğe dön.",
            }),
            satir("okuma", "Eksik okuma", {
              tavsiye:
                "Soruyu tam okumuyorsun. Bu çalışmayla değil alışkanlıkla düzelir: soruyu iki kez oku, verilenleri kenara yaz. En kolay kazanılan netler bunlar.",
            }),
            satir("birim", "Birim hatası", {
              tavsiye:
                "Birimde kaybediyorsun (dakika/saat, cm/m). Soruda geçen her birimi işaretle, cevabı yazmadan önce birimi kontrol et.",
            }),
            satir("yaklasik", "Yaklaşık değer", {
              tavsiye: "Erken yuvarlıyorsun. Ara adımlarda kesri ve kökü bozmadan taşı, yuvarlamayı en sona bırak.",
            }),
            satir("formul", "Formül karıştırma", {
              tavsiye:
                "Benzer formülleri karıştırıyorsun. Bu konunun formüllerini tek bir kâğıda yan yana yaz, farklarını işaretle — ezber değil, ayırt etme çalışması.",
            }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "hata.tek-yanlis",
        baslik: "Tek bir yanlışın açıklaması",
        soru: "Alıştırmada tek bir yanlış şıkkın altında ne yazsın?",
        simdi:
          "Yanlış şıkkın hata türü ve türün genel tavsiyesi (ör. işlem hatası için 'Soruyu biliyorsun, dört işlemde kaybediyorsun...'). Bu cümleler birçok yanlışın ortak deseni için yazıldı. Soru dosyasında yanlış şıkkın yanına yazılan kısa not ('b = 0 alınmış') şu an saklanmıyor, öğrenciye de gitmiyor.",
        neden: "Tek bir yanlışta 'hep işlemde kaybediyorsun' demek abartılı; 'burada b = 0 almışsın' ise tam yerinde.",
        oneri:
          "Yazarın şık notu saklansın ve genel tavsiyenin yerine o gösterilsin; not yoksa genel tavsiye kalsın. Ekibe ek yük getirmiyor, not zaten şablonda var.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("not", "Yazarın şık notu gösterilsin, not yoksa genel tavsiye", onerilen),
            secenek("genel", "Genel tavsiye kalsın (şu an)"),
            secenek("ayri", "Her yanlış şık için ayrı, daha uzun bir açıklama yazılsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "hata.desen-esigi",
        baslik: "Ortak sebep kartının eşiği",
        soru: "'Yanlışlarının ortak sebebi' kartı için eşik uygun mu: en az 3 işaretli yanlış ve en sık türün payı en az %40?",
        simdi: "Bu koşul sağlanmazsa kart hiç çıkmıyor. Hata türü işaretlenmemiş yanlışlar hesaba girmiyor.",
        neden: "Tek yanlıştan 'şu hatayı yapıyorsun' demek, tek sorudan seviye vermek kadar yanıltıcı.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "sonra",
      },
    ],
  },

  // ── 9 ──────────────────────────────────────────────────────
  {
    anahtar: "test",
    baslik: "Testler ve paketler",
    giris:
      "Öğrencinin çözdüğü süreli testlere 'check-up' deniyor. Yeni öğrenci önce 12 soruluk tanışma testini çözüyor, sonra kendi sınavının konu paketlerinden birini seçiyor. Her paket belirli konulardan, konu başına en az 3 soruyla kuruluyor; sorular her seferinde havuzdan yeniden seçiliyor. Haftalık plandaki 5 soruluk kontrol testi de bu bölümde.",
    sorular: [
      {
        anahtar: "test.tanisma",
        baslik: "Tanışma testi",
        soru: "Tanışma testi uygun mu: dört konudan üçer soru, toplam 12 soru, 15-20 dakika?",
        simdi:
          "Kayıttan hemen sonra öğrenciye önerilen tek test. Konular sınava göre: TYT'de Temel Kavramlar, Bölme ve Bölünebilme, Üslü Sayılar, Oran-Orantı (15 dakika); LGS'de Çarpanlar ve Katlar, Üslü İfadeler, Cebirsel İfadeler, Üçgenler (18 dakika); AYT'de Fonksiyonlar, Polinomlar, 2. Dereceden Denklemler, Logaritma (20 dakika); KPSS'de Temel Kavramlar, Bölme ve Bölünebilme, Oran-Orantı, Sayı-Kesir Problemleri (15 dakika); DGS'de Temel Kavramlar, Oran-Orantı, Sayı-Kesir Problemleri, Sayısal Mantık (17 dakika); ALES'te Temel Kavramlar, Oran-Orantı, Sayı-Kesir Problemleri, Sayı Dizileri (16 dakika).",
        neden: "Kısa olmalı ki yeni öğrenci bitirsin; konu başına üç soru olmalı ki o konulara seviye verilebilsin.",
        oneri: "Kalsın; pilot sınavının dört konusunu siz seçin.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "test.paketler",
        baslik: "Konu paketleri",
        soru: "Konu paketlerinin listesi ve uzunlukları uygun mu?",
        simdi:
          "Her sınavın 3-5 konu paketi var. TYT'dekiler: Çekirdek (8 konu, 24 soru, 30 dakika), İlk 15 (5 konu, 15 soru, 18 dakika), Problemler (5 tür, 20 soru, 25 dakika), Sayma, Olasılık ve Veri (4 konu, 16 soru, 20 dakika), Geometri (4 konu, 15 soru, 25 dakika). Paketler panelden düzenlenebiliyor.",
        ornek:
          "Diğer sınavlar (soru, dakika). LGS: Sayılar ve Cebir (19, 36), Geometri (16, 32), Veri ve Olasılık (12, 22). AYT: Cebir Kuşağı (20, 28), Trigonometri (16, 20), Analitik Geometri (15, 20), Analiz (16, 35). KPSS: Çekirdek (18, 24), Problemler (20, 26), Sayısal Mantık ve Veri (15, 22), Geometri (17, 24). DGS: Çekirdek (18, 26), Problemler (20, 28), Sayısal Mantık ve Veri (15, 22). ALES: Çekirdek (15, 23), Problemler (20, 30), Sayısal Mantık ve Veri (15, 23).",
        neden:
          "Paket, öğrencinin bir oturuşta çözdüğü birim: 15-30 dakika telefonda bile bitirilebiliyor, konu başına 3-4 soru seviye çıkarmaya yetiyor.",
        oneri: "Kalsın; pilot sınavında eksik gördüğünüz paket ya da konu varsa yazın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "test.konu-basina",
        baslik: "Konu başına en az 3 soru",
        soru: "Bir pakette her konudan en az 3 soru kuralı kalsın mı?",
        simdi:
          "Kural zorunlu: bir konudan 3'ten az soru isteyen paket kaydedilemiyor. Tek soruyla ölçülen konuya seviye verilmiyor; 2 soruda veriliyor ama haftalık plana ve yayın önerisine ancak 3 soruda ölçülmüş zayıf konu giriyor.",
        neden: "25 soruyu 23 konuya dağıtmak konu başına bir soru demek; tek soruyla 'bu konuda zayıfsın' demek yazı turadan farksız.",
        oneri: "Kalsın. Daha geniş kapsam isteniyorsa konu sayısını değil paket sayısını artıralım.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "test.zorluk-dagilimi",
        baslik: "Paketlerde zorluk dağılımı",
        soru: "Konu paketlerinde kolay, orta ve zor soruların oranı uygun mu?",
        simdi:
          "Sistem bir paketi kurarken her konuda soruların yaklaşık %30'unu kolay, %50'sini orta, %20'sini zor sorulardan seçiyor. Bir zorlukta soru yetmezse eksiği diğer zorluklardan tamamlıyor.",
        neden: "Çok kolay paket öğrenciyi rahatlatıp yanıltıyor, çok zor paket her konuyu 'zayıf' gösteriyor.",
        oneri: "Kalsın; pilottan sonra soruların gerçek zorluğuna bakıp ayarlayalım.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "pay", baslik: "Pay", tur: "sayi", birim: "%" }],
          satirlar: [
            satir("kolay", "Kolay (zorluk 1-2)", { pay: 30 }),
            satir("orta", "Orta (zorluk 3)", { pay: 50 }),
            satir("zor", "Zor (zorluk 4-5)", { pay: 20 }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "test.tekrar-engeli",
        baslik: "Aynı sorunun tekrar gelmesi",
        soru: "Aynı soru aynı öğrenciye en erken kaç gün sonra yeniden gelebilsin?",
        simdi:
          "30 gün. Havuz darsa kural gevşiyor; o zaman sonuç ekranı paketi yeniden çözmek yerine farklı bir paket öneriyor, çünkü bazı sorular tekrar gelebilir.",
        neden: "Hatırlanan soru doğru yapılıyor ve sonuç olduğundan iyi görünüyor; öğrenci o sonuca bakıp çalışmayı bırakabiliyor.",
        oneri: "30 gün kalsın.",
        cevap: { tur: "sayi", birim: "gün", enAz: 7, enCok: 180, simdiki: 30 },
        oncelik: "normal",
      },
      {
        anahtar: "test.ucretsiz",
        baslik: "Ücretsiz kalacak testler",
        soru: "Pilottan sonra hangi testler ücretsiz kalsın?",
        simdi:
          "Bütün konu paketleri, tanışma testleri, kontrol testleri ve denemeler ücretsiz işaretli; yalnızca seviyeli check-up ücretli işaretli. Ücretli ya da ücretsiz olması panelden tek tıkla değişiyor. Ödeme altyapısı henüz yok; ücretli bir testi şimdilik yalnızca panelden erişim verilen öğrenci açabiliyor.",
        neden:
          "Ücretsiz kısım hem öğrencinin ürünü tanıdığı yer hem de satışın kapısı; çok darsa öğrenci değeri göremiyor, çok genişse satılacak bir şey kalmıyor.",
        oneri:
          "Tanışma testi, her sınavın Çekirdek paketi ve kontrol testleri ücretsiz kalsın. Kontrol testi haftalık planın parçası; ücretli olursa plan yarım kalır.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("tanisma", "Tanışma testi", onerilen),
            secenek("cekirdek", "Her sınavın Çekirdek paketi", onerilen),
            secenek("kontrol", "Kontrol testleri", onerilen),
            secenek("paketler", "Bütün konu paketleri"),
            secenek("deneme", "Deneme sınavları"),
            secenek("seviyeli", "Seviyeli check-up"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "test.kontrol",
        baslik: "Kontrol testi",
        soru: "Kontrol testi uygun mu: tek konudan 5 soru, 8 dakika?",
        simdi:
          "Haftalık plandaki her konunun son işi bu test. Öğrenci bu işi elle işaretleyemiyor; testi çözünce iş kendiliğinden kapanıyor. Kontrol testi konu haritasına giriyor ama gelişim grafiğine girmiyor; günde en fazla 8 tane açılabiliyor.",
        neden: "Planın dürüst kalmasının yolu bu: '40 soru çözdüm' demek kolay, 5 soruluk testi geçmek değil.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "test.kontrol-dili",
        baslik: "Kontrol testinin sonuç cümleleri",
        soru: "Kontrol testi bitince öğrencinin gördüğü cümleler uygun mu?",
        simdi:
          "Başlıktaki konu adı ve sayı kendiliğinden yazılıyor. Konu daha önce ölçüldüyse metnin başına 'Önceki ölçümünde %33 idi (+67 puan).' gibi bir cümle ekleniyor.",
        neden:
          "Kontrol testi tek bir şey soruyor: bu hafta çalışman işe yaradı mı? Cümle bunu cevaplamalı, öğrenciyi yeniden genel bir teste göndermemeli.",
        oneri: "Kalsın; dilini değiştirmek istediğiniz hücreye yenisini yazın.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "baslik", baslik: "Başlık", tur: "metin" },
            { anahtar: "metin", baslik: "Metin", tur: "metin" },
          ],
          satirlar: [
            satir("guclu", "Güçlü (5 sorudan 4 ya da 5 doğru)", {
              baslik: "Üslü Sayılar: 5/5 — konu oturmuş.",
              metin: "Çalışman karşılığını verdi; planındaki sıradaki işe geç.",
            }),
            satir("orta", "Orta (3 doğru)", {
              baslik: "Üslü Sayılar: 3/5 — yol alınmış, henüz bitmedi.",
              metin:
                "Yanlışlarının çözümüne bak, aynı tipten birkaç soru daha çöz; birkaç gün sonra yeniden kontrol et.",
            }),
            satir("zayif", "Zayıf (2 ya da daha az doğru)", {
              baslik: "Üslü Sayılar: 2/5 — konu henüz oturmadı.",
              metin:
                "Bir haftada her konu oturmaz. Çözümleri incele, konu tekrarına dön; birkaç gün sonra yeniden kontrol et.",
            }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "test.yarim",
        baslik: "Yarım kalan test",
        soru:
          "Öğrenci testi bitirmeden bırakırsa (süre dolarsa ya da testi baştan başlatırsa), soruların en az yüzde kaçını işaretlemiş olmalı ki test bir ölçüm sayılsın?",
        simdi:
          "Yüzde 50. Bunun altında kalan test puanlanıyor ve öğrenci cevaplarını görebiliyor, ama sonuç ekranında 'Bu test yarım kaldı, ölçüm sayılmadı' yazıyor ve 'Yeniden çöz' düğmesi çıkıyor. Yarım test konu haritasına, gelişim grafiğine, haftalık plana ve deneme sıralamasına girmiyor; ödevi de tamamlamıyor. Yanlış defterine yalnızca işaretleyip yanlış yaptığı sorular giriyor, boşlar girmiyor. Öğrencinin kendisi 'Bitir'e bastıysa test ne kadar boş olursa olsun ölçüm sayılıyor: bilerek boş bırakmak da bir cevap.",
        ornek:
          "24 soruluk testte 2 soru işaretleyip telefonu bırakan öğrencinin bütün konuları 'zayıf' çıkıyordu ve haftanın planı bu testten kuruluyordu.",
        neden:
          "Telefonda kesinti olağan. Eşik çok düşükse yarım test öğrencinin bir haftalık planını bozuyor; çok yüksekse, gerçekten zorlanıp çok soruyu boş bırakan öğrencinin ölçümü kayboluyor.",
        oneri: "Yüzde 50 kalsın.",
        cevap: { tur: "sayi", birim: "%", enAz: 10, enCok: 90, simdiki: 50 },
        oncelik: "normal",
      },
    ],
  },

  // ── 10 ─────────────────────────────────────────────────────
  {
    anahtar: "seviyeli",
    baslik: "Seviyeli check-up",
    giris:
      "Seviyeli check-up üç aşamalı, uzun bir tarama. Seviye 1 her kazanımdan bir soru soruyor; öğrenci %60'ı geçerse Seviye 2'ye (çok adımlı, iki konunun birleştiği sorular), orada da %60'ı geçerse Seviye 3'e (sınav standardında sorular) ilerliyor. Seviye 1'de barajın altında kalan öğrenciye yalnızca eksik çıktığı kazanımlardan, ilk turda görmediği sorularla kısa bir teyit turu açılıyor. Aşamalar yanlış götürmeden, doğru sayısıyla puanlanıyor ve her durakta öğrenci bir karne alıyor.",
    sorular: [
      {
        anahtar: "seviyeli.ayarlar",
        baslik: "Seviyelerin soru sayısı, süresi ve barajı",
        soru: "Her seviyenin soru sayısı, süresi ve geçme barajı uygun mu?",
        simdi:
          "Seviye 2 için ilk tasarımda '30-35 dakika' yazıyordu; 32 seçtik. LGS'de sayılar küçültüldü, çünkü 8. sınıf için 50 soru ve 50 dakika uzun bulundu. Seviye 3'te baraj yok: oraya gelen öğrenci son raporunu alıyor.",
        neden: "Seviye 1'in soru sayısı aynı zamanda sorulacak kazanım sayısı; burada verilecek sayı kazanım listesinin uzunluğunu da belirliyor.",
        oneri: "Kalsın; pilot sonunda aşamaların ortalama bitirme süresine birlikte bakalım.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "soru", baslik: "Soru sayısı", tur: "sayi", birim: "soru" },
            { anahtar: "sure", baslik: "Süre", tur: "sayi", birim: "dakika" },
            { anahtar: "baraj", baslik: "Geçme barajı", tur: "sayi", birim: "%", yardim: "Seviye 3'te baraj yok." },
          ],
          satirlar: [
            satir("s1", "Seviye 1 (LGS dışındaki sınavlar)", { soru: 50, sure: 50, baraj: 60 }),
            satir("s2", "Seviye 2 (LGS dışındaki sınavlar)", { soru: 25, sure: 32, baraj: 60 }),
            satir("s3", "Seviye 3 (LGS dışındaki sınavlar)", { soru: 25, sure: 35, baraj: null }),
            satir("lgs-s1", "LGS Seviye 1", { soru: 35, sure: 35, baraj: 60 }),
            satir("lgs-s2", "LGS Seviye 2", { soru: 20, sure: 26, baraj: 60 }),
            satir("lgs-s3", "LGS Seviye 3", { soru: 20, sure: 28, baraj: null }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.teyit-baraji",
        baslik: "Teyit turu barajı",
        soru: "Teyit turundan sonra Seviye 2'nin açılması için birleşik başarı en az yüzde kaç olsun?",
        simdi:
          "%55. Birleşik başarı, iki turun doğruları toplamının iki turun soruları toplamına oranı; teyit turu ilk turdaki yanlışları silmiyor, üstüne ekleniyor. Teyit turunun süresi soru başına 1 dakika, en az 5 dakika.",
        ornek:
          "50 soruda 26 doğru (%52) yapan öğrenci 24 soruluk teyit turuna giriyor. Teyitte 16 doğru yaparsa (26 + 16) / (50 + 24) = 42 / 74, yani %57: Seviye 2 açılıyor.",
        neden: "Baraj ilk turdakinden (%60) düşük, çünkü teyit turu ikinci bir şans; ama tamamen kalkmıyor.",
        oneri: "%55 kalsın.",
        cevap: { tur: "sayi", birim: "%", enAz: 30, enCok: 100, simdiki: 55 },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.kisa-devre",
        baslik: "Geçemeyecek öğrenciye teyit turu",
        soru: "Teyit turunun tamamını doğru yapsa bile barajı geçemeyecek öğrenciye tur açılsın mı?",
        simdi: "Açılmıyor; öğrenci doğrudan Seviye 1 karnesini alıyor.",
        ornek:
          "50 sorunun 8'ini doğru yapan öğrenci, 42 soruluk teyit turunun hepsini doğru yapsa bile 50 / 92, yani %54'te kalıyor; tur açılmıyor.",
        neden: "Sonucu değiştirmeyecek 40 dakikalık bir tur öğrencinin hem zamanını hem motivasyonunu harcıyor.",
        oneri: "Şimdiki gibi kalsın; karne zaten eksik kazanımları tek tek gösteriyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("acilmasin", "Açılmasın, karne verilsin (şu an)", onerilen),
            secenek("acilsin", "Yine de açılsın; sonuç değişmese de eksikler bir kez daha ölçülsün"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.kazanim-basina-soru",
        baslik: "Kazanım başına Seviye 1 sorusu",
        soru: "Her kazanım için en az kaç Seviye 1 sorusu yazılsın?",
        simdi:
          "Bir kazanımın Seviye 1'e girmesi için tek soru yetiyor, ama o zaman teyit turunda o kazanım için yeni soru kalmıyor. Panel bir kazanımı ancak 2 soruyla 'hazır' sayıyor. Teyit turu hiç açılamazsa karar ilk tura göre veriliyor: %55 ile %60 arasında kalan öğrenci doğrudan Seviye 2'ye geçiyor.",
        neden:
          "Teyit turunun tek anlamı aynı kazanımı farklı bir soruyla yeniden sormak; aynı soru ikinci kez gelirse öğrenci hatırlıyor ve ölçüm çöküyor.",
        oneri: "En az 2, mümkünse 3: biri ilk tur, biri teyit turu, biri seviyeli check-up'ı ikinci kez çözen öğrenci için.",
        cevap: { tur: "sayi", birim: "soru", enAz: 1, enCok: 10, simdiki: 1 },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.ara-verme",
        baslik: "Seviyeler arası ara",
        soru: "Öğrenci seviyeler arasında ara verebilsin mi?",
        simdi:
          "Verebiliyor: Seviye 1'i bugün, Seviye 2'yi bir hafta sonra çözebiliyor; bekleme için bir sınır yok. Süre sınırı yalnızca her aşamanın içinde. Yarım kalan check-up ana sayfadaki 'Bugün' kartında hatırlatılıyor; öğrenci isterse bırakabiliyor.",
        neden:
          "Üç aşama toplam yaklaşık 2 saat; tek oturumda bitirmek yorgunluğu ölçüyor. Ama ara çok uzarsa aşamalar arasında öğrenci değişmiş oluyor.",
        oneri: "Ara verebilsin, ama en fazla 7 gün; sonra check-up baştan başlasın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("serbest", "Sınırsız ara verebilsin (şu an)"),
            secenek("yedi-gun", "Ara verebilsin ama en fazla 7 gün", onerilen),
            secenek("ayni-gun", "Aynı gün içinde bitirmeli"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.s1-kazanimlar",
        baslik: "Seviye 1'de sorulacak kazanımlar",
        soru: "Kazanım sayısı 50'yi (LGS'de 35'i) aşarsa Seviye 1 hangi kazanımları sorsun?",
        simdi:
          "Sıradaki ilk 50'yi. Sıra şu an konu ağacındaki yerlerden kuruluyor ve müfredat sırasını tutmuyor; listenin sonundaki kazanımlar hiç sorulmuyor.",
        neden: "Sıra yalnızca baştan alınırsa ilk ünitelere yığılıyor; ör. TYT'de geometri hiç sorulmayabilir.",
        oneri:
          "Her üniteye sınavdaki ağırlığına göre pay verilsin ya da içerik ekibi bir 'Seviye 1 listesi' işaretlesin. Karar gelene kadar bugünkü sıra kalıyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("mufredat", "Müfredat sırasıyla ilk 50 kazanım"),
            secenek("agirlik", "Her üniteye sınavdaki ağırlığına göre pay", onerilen),
            secenek("liste", "İçerik ekibinin işaretlediği bir Seviye 1 listesi", onerilen),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.karne-dili",
        baslik: "Aşama sonu cümleleri",
        soru: "Her aşamanın sonunda öğrencinin gördüğü cümleler uygun mu?",
        simdi:
          "Yüzde ve soru sayısı kendiliğinden yazılıyor. Karnelerin başlıkları: 'Seviye 1 Eksik Analiz Karnesi', 'Seviye 2 Teşhis Karnesi' ve üç seviyeyi bitirene 'Nihai Check-up Raporu'. Seviye 1 karnesi eksik kazanımları tek tek, Seviye 2 karnesi konu bazında başarıyı gösteriyor.",
        neden: "Seviye 1'de kalan öğrenci için bu cümle ürünün en hassas anı: 'kaldın' değil 'buradan başlıyoruz' demeli.",
        oneri: "Kalsın; değiştirmek istediğiniz hücreye yenisini yazın.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "baslik", baslik: "Başlık", tur: "metin" },
            { anahtar: "metin", baslik: "Metin", tur: "metin" },
          ],
          satirlar: [
            satir("s2", "Seviye 2'ye geçti", {
              baslik: "%64 — Seviye 2'ye geçtin.",
              metin:
                "Temel kazanımların yerinde. Sıradaki testte iki konunun birleştiği ve birden fazla işlem adımı isteyen sorular var.",
            }),
            satir("s3", "Seviye 3'e geçti", {
              baslik: "%68 — Seviye 3'e geçtin.",
              metin: "Çok adımlı sorularda da sağlamsın. Son test sınav standardında.",
            }),
            satir("teyit", "Teyit turu açıldı", {
              baslik: "Temel kazanımlarını teyit ediyoruz.",
              metin:
                "12 soruluk kısa bir tur daha var. Sorular yalnızca eksik çıkan kazanımlardan ve hepsi ilk turda görmediğin sorular.",
            }),
            satir("s1-dur", "Seviye 1'de kaldı", {
              baslik: "%48 — Seviye 1'de kalıyoruz.",
              metin:
                "Üst seviyelere geçmek şu an işine yaramaz: temel kazanımlar oturmadan çok adımlı sorular yanlış ölçer. Aşağıda hangi kazanımların eksik olduğu tek tek yazıyor.",
            }),
            satir("s2-dur", "Seviye 2'de kaldı", {
              baslik: "%52 — Seviye 2'de kalıyoruz.",
              metin:
                "Temel işlemlerin sağlam ama problem kurma ve çoklu işlemlerde eksiklerin var. Aşağıdaki karne hangi tipte takıldığını gösteriyor.",
            }),
            satir("bitti", "Üç seviyeyi bitirdi", {
              baslik: "Üç seviyeyi de tamamladın.",
              metin: "Nihai raporun aşağıda: ulaştığın seviye, eksik kazanımlar ve soru bazlı süre analizi.",
            }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "seviyeli.cift",
        baslik: "Temel soru ile sınav sorusu eşleşmesi",
        soru: "Her temel soruya sınav standardında bir eş soru yazılan 'çift' tasarımı geri gelsin mi?",
        simdi:
          "İlk şablonda her temel sorunun sınav standardında bir eşi vardı; sonuç ekranında 'temeli var ama sınav sorusunu yapamıyor' gibi dört durumlu bir teşhis kuruluyordu. Seviyeli check-up gelince bu tasarım kaldırıldı; şablonda eş soru alanı yok.",
        neden:
          "İki tasarım aynı soruyu farklı yoldan cevaplıyor: temel mi eksik, sınav becerisi mi? İkisini birlikte yürütmek soru yazma yükünü ikiye katlıyor.",
        oneri: "Gelmesin; seviyeli check-up bu ayrımı Seviye 1 ile Seviye 3 arasında zaten yapıyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hayir", "Hayır, seviyeli check-up yeterli", onerilen),
            secenek("evet", "Evet, ikisi birlikte yürüsün"),
          ],
        },
        oncelik: "sonra",
      },
      {
        anahtar: "seviyeli.puanlama",
        baslik: "Seviyeli check-up'ta yanlış götürme",
        soru: "Seviyeli check-up'ta yanlışın doğruyu götürmemesi uygun mu?",
        simdi:
          "Aşamalar ham doğru sayısıyla puanlanıyor. Bu yüzden aşama sonuçları gelişim grafiğine ve tahmini nete girmiyor; konu haritasına giriyor.",
        neden:
          "Burada ölçülen şey sınav taktiği değil, kazanımın olup olmadığı. Yanlış götürme öğrenciyi boş bırakmaya itiyor ve eksik kazanım görünmez oluyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "sonra",
      },
    ],
  },

  // ── 11 ─────────────────────────────────────────────────────
  {
    anahtar: "deneme",
    baslik: "Deneme sınavları ve kâğıtta çözme",
    giris:
      "Deneme, gerçek sınavın matematik bölümünün provası: sınavın soru sayısı, yanlış götürme kuralı ve önerilen süresiyle. Konu paketlerinden farkı soruların sabit olması; denemeyi çözen herkes aynı soruları aynı sırayla görüyor ve en az 10 kişi çözdükten sonra öğrenci netinin çözenler arasındaki yerini görüyor. Denemeler panelde hazırlanıyor. Konu paketleri, tanışma testi ve denemeler kâğıtta da çözülebiliyor: öğrenci kitapçığı yazdırıyor, süreyi kendisi tutuyor, sonra cevaplarını ekrandaki optik forma işliyor.",
    sorular: [
      {
        anahtar: "deneme.siklik",
        baslik: "Deneme sıklığı",
        soru: "Ayda kaç deneme olsun?",
        simdi:
          "Bir kural yok; henüz hiç deneme hazırlanmadı. Panel bir denemeyi konu ağırlıklarına göre kendiliğinden doldurabiliyor; son kontrol ve yayın içerik ekibinde.",
        neden:
          "Deneme soruları ayrı tutulacaksa her deneme için havuza 40-60 yeni soru gerekiyor; sıklık soru yazım takvimini belirliyor.",
        oneri: "Ayda iki: aradaki iki haftada plan ve kontrol testi döngüsü dönüyor, deneme de gelişimi gösteriyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("bir", "Ayda bir"),
            secenek("iki", "Ayda iki", onerilen),
            secenek("dort", "Haftada bir"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.agirlik-temel",
        baslik: "Konuların sınavdaki ağırlığı (TYT, KPSS, DGS, ALES)",
        soru: "Gerçek sınavda her konudan ortalama kaç soru çıkıyor? Bildiğiniz hücreyi düzeltin ya da doldurun.",
        simdi:
          "Bu sayıları biz koyduk. Panel denemeyi bu oranlara göre dolduruyor; haftalık planda iki konu aynı derecede zayıfsa sınavda daha çok soru getiren önce geliyor; sonuç ekranındaki 'bu ikisi sınavda ortalama 3 soru demek' cümlesi de buradan çıkıyor. Bazı yerler eksik: ALES'te faiz dışındaki problem türlerinin ve geometrinin ağırlığı yok; TYT'de sayıların toplamı 58 ediyor, sınavda ise 40 soru var.",
        neden: "Ağırlık yanlışsa deneme gerçek sınava benzemiyor ve plan öğrenciyi az soru getiren konuya yönlendiriyor.",
        oneri:
          "Pilot sınavının sütunu ilk aşama için yeter; bilmediğiniz hücreyi boş bırakın. Sayılar 'ortalama kaç soru' olarak yazılırsa toplam sınavın soru sayısına yakın çıkar.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "tyt", baslik: "TYT", tur: "sayi", birim: "soru", yardim: "Boş hücre: şu an bu sınavda ağırlık yok." },
            { anahtar: "kpss", baslik: "KPSS Lisans", tur: "sayi", birim: "soru" },
            { anahtar: "dgs", baslik: "DGS", tur: "sayi", birim: "soru" },
            { anahtar: "ales", baslik: "ALES", tur: "sayi", birim: "soru" },
          ],
          satirlar: [
            agirlik("temel-kavramlar", "Temel Kavramlar", 3, 2, 2, 2),
            agirlik("sayi-basamaklari", "Sayı Basamakları", 2, 2, 2, 2),
            agirlik("bolunebilme", "Bölme ve Bölünebilme", 3, 2, 2, 2),
            agirlik("ebob-ekok", "EBOB - EKOK", 2, 1, 1, 1),
            agirlik("rasyonel-sayilar", "Rasyonel Sayılar", 2, 2, 2, null),
            agirlik("basit-esitsizlikler", "Basit Eşitsizlikler", 2, 1, 1, null),
            agirlik("mutlak-deger", "Mutlak Değer", 2, 1, null, null),
            agirlik("uslu-sayilar", "Üslü Sayılar", 2, 2, 2, 2),
            agirlik("koklu-sayilar", "Köklü Sayılar", 2, 2, 2, 2),
            agirlik("carpanlara-ayirma", "Çarpanlara Ayırma", 2, 1, 2, null),
            agirlik("oran-oranti", "Oran - Orantı", 2, 3, 3, 3),
            agirlik("denklem-cozme", "Denklem Çözme", 2, 2, 2, null),
            agirlik("sayi-kesir", "Sayı - Kesir Problemleri", 2, 2, 3, null),
            agirlik("yas", "Yaş Problemleri", 1, 1, 1, null),
            agirlik("isci-havuz", "İşçi - Havuz Problemleri", 1, 2, 2, null),
            agirlik("hareket-hiz", "Hareket - Hız Problemleri", 2, 2, 2, null),
            agirlik("yuzde-kar-zarar", "Yüzde - Kâr - Zarar Problemleri", 2, 3, 3, null),
            agirlik("karisim", "Karışım Problemleri", 1, 1, 1, null),
            agirlik("faiz", "Faiz Problemleri", null, 2, 2, 2),
            agirlik("grafik-problemleri", "Grafik Problemleri", 1, 2, 2, null),
            agirlik("rutin-olmayan", "Rutin Olmayan Problemler", 2, null, null, null),
            agirlik("kumeler", "Kümeler", 1, 1, 1, 1),
            agirlik("mantik", "Mantık", 1, null, null, null),
            agirlik("fonksiyonlar", "Fonksiyonlar", 2, null, 2, 2),
            agirlik("polinomlar", "Polinomlar", 1, null, 1, null),
            agirlik("ikinci-derece", "2. Dereceden Denklemler", 1, null, 2, null),
            agirlik("olasilik", "Permütasyon - Kombinasyon - Olasılık", 2, 2, 2, 2),
            agirlik("veri-istatistik", "Veri - İstatistik", 2, 2, null, 2),
            agirlik("sayi-dizileri", "Sayı Dizileri", null, 2, 2, 2),
            agirlik("tablo-grafik", "Tablo - Grafik Yorumlama", null, 3, 3, 3),
            agirlik("islem-moduler", "İşlem - Modüler Aritmetik", null, 2, 2, 2),
            agirlik("sayisal-mantik", "Sayısal Mantık", null, 2, 4, 3),
            agirlik("geo-acilar", "Doğruda ve Üçgende Açılar", 2, 1, null, null),
            agirlik("geo-ucgenler", "Üçgenler", 3, 2, 2, null),
            agirlik("geo-dortgenler", "Dörtgenler ve Çokgenler", 2, 1, 1, null),
            agirlik("geo-cember", "Çember ve Daire", 2, 1, 1, null),
            agirlik("geo-kati", "Katı Cisimler", 1, 1, 1, null),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.agirlik-ayt-lgs",
        baslik: "Konuların sınavdaki ağırlığı (AYT ve LGS)",
        soru: "AYT ve LGS'de her konudan ortalama kaç soru çıkıyor?",
        simdi:
          "AYT'de trigonometri ve analitik geometrinin alt konularında ağırlık yok; panel bir AYT denemesine bu konulardan soru önermiyor. AYT'de sayıların toplamı 24 ediyor, sınavda 40 soru var. LGS'de toplam sınavın 20 sorusuna eşit.",
        neden: "Ağırlık yanlışsa deneme gerçek sınava benzemiyor ve plan öğrenciyi az soru getiren konuya yönlendiriyor.",
        oneri: "Bildiğiniz hücreleri doldurun; özellikle AYT'nin trigonometri ve analitik geometri satırlarını.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "soru", baslik: "Ortalama soru", tur: "sayi", birim: "soru", yardim: "Boş hücre: şu an ağırlık yok." },
          ],
          satirlar: [
            satir("ayt-fonksiyonlar", "AYT · Fonksiyonlar (İleri)", { soru: 3 }),
            satir("ayt-polinomlar", "AYT · Polinomlar", { soru: 2 }),
            satir("ayt-ikinci-derece", "AYT · 2. Dereceden Denklemler ve Eşitsizlikler", { soru: 2 }),
            satir("ayt-karmasik", "AYT · Karmaşık Sayılar", { soru: 2 }),
            satir("ayt-logaritma", "AYT · Logaritma", { soru: 2 }),
            satir("ayt-diziler", "AYT · Diziler", { soru: 2 }),
            satir("ayt-limit", "AYT · Limit ve Süreklilik", { soru: 2 }),
            satir("ayt-turev", "AYT · Türev", { soru: 5 }),
            satir("ayt-integral", "AYT · İntegral", { soru: 4 }),
            satir("ayt-birim-cember", "AYT · Birim Çember", { soru: null }),
            satir("ayt-trig-fonksiyonlar", "AYT · Trigonometrik Fonksiyonlar", { soru: null }),
            satir("ayt-toplam-fark", "AYT · Toplam - Fark Formülleri", { soru: null }),
            satir("ayt-trig-denklemler", "AYT · Trigonometrik Denklemler", { soru: null }),
            satir("ayt-nokta", "AYT · Noktanın Analitiği", { soru: null }),
            satir("ayt-dogru", "AYT · Doğrunun Analitiği", { soru: null }),
            satir("ayt-cember", "AYT · Çemberin Analitiği", { soru: null }),
            satir("lgs-carpanlar", "LGS · Çarpanlar ve Katlar", { soru: 2 }),
            satir("lgs-uslu", "LGS · Üslü İfadeler", { soru: 2 }),
            satir("lgs-karekoklu", "LGS · Kareköklü İfadeler", { soru: 2 }),
            satir("lgs-veri", "LGS · Veri Analizi", { soru: 1 }),
            satir("lgs-olasilik", "LGS · Basit Olayların Olma Olasılığı", { soru: 1 }),
            satir("lgs-cebirsel", "LGS · Cebirsel İfadeler ve Özdeşlikler", { soru: 2 }),
            satir("lgs-dogrusal", "LGS · Doğrusal Denklemler", { soru: 2 }),
            satir("lgs-esitsizlik", "LGS · Eşitsizlikler", { soru: 1 }),
            satir("lgs-ucgenler", "LGS · Üçgenler", { soru: 3 }),
            satir("lgs-eslik", "LGS · Eşlik ve Benzerlik", { soru: 1 }),
            satir("lgs-donusum", "LGS · Dönüşüm Geometrisi", { soru: 1 }),
            satir("lgs-cisimler", "LGS · Geometrik Cisimler", { soru: 2 }),
          ],
        },
        oncelik: "sonra",
      },
      {
        anahtar: "deneme.zorluk",
        baslik: "Denemede zorluk dağılımı",
        soru: "Denemede zorluk dağılımı nasıl olsun?",
        simdi: "Panel bir denemeyi doldururken soruları beş zorluğa eşit dağıtıyor (40 soruda her zorluktan 8).",
        neden: "Gerçek sınav çoğunlukla orta zorlukta; eşit dağılım denemeyi gerçek sınavdan zor gösterebilir.",
        oneri: "Orta zorluk ağırlıklı olsun, konu paketlerindeki gibi: %30 kolay, %50 orta, %20 zor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("esit", "Eşit kalsın (şu an)"),
            secenek("orta", "Orta zorluk ağırlıklı (%30 kolay, %50 orta, %20 zor)", onerilen),
            secenek("sinav", "Gerçek sınavın dağılımına göre (not olarak yazın)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.ayri-havuz",
        baslik: "Deneme sorularının ayrı tutulması",
        soru: "Deneme soruları genel havuzdan ayrılsın mı?",
        simdi:
          "Ayrılmıyor: bir denemenin soruları konu paketlerinde, alıştırmada ve 'Benzerini çöz'de de çıkabiliyor. Denemeyi henüz çözmemiş bir öğrenci soruyu önceden görebiliyor ve karşılaştırma bozuluyor. Panel aynı soruyu iki denemeye birden koymamaya çalışıyor.",
        neden: "Deneme sonucunun değeri, herkesin soruları ilk kez gördüğü bir sınav olmasında.",
        oneri: "Ayrılsın; o zaman denemeler için ayrıca soru yazmak gerekiyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("ayrilsin", "Ayrılsın; denemeler için ayrıca soru yazılsın", onerilen),
            secenek("ayrilmasin", "Ayrılmasın (şu an)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.esik",
        baslik: "Karşılaştırma eşiği",
        soru: "Denemede 'netin çözenlerin yüzde kaçından yüksek' bilgisi kaç kişi çözdükten sonra açılsın?",
        simdi:
          "10 kişi. Daha az kişi çözdüyse karşılaştırma gösterilmiyor. Karşılaştırmaya her öğrencinin yalnızca ilk, ekranda çözdüğü denemesi giriyor; ad, sıra numarası gösterilmiyor.",
        neden: "Üç kişilik bir grupta 'netin %67'sinden yüksek' bilgi değil; küçük grupta kimin kaç yaptığı da tahmin edilebiliyor.",
        oneri: "10 kalsın.",
        cevap: { tur: "sayi", birim: "kişi", enAz: 3, enCok: 100, simdiki: 10 },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.tekrar",
        baslik: "Denemeyi ikinci kez çözme",
        soru: "Aynı denemenin ikinci kez çözülebilmesi, ama karşılaştırmaya yalnızca ilk çözümün girmesi uygun mu?",
        simdi:
          "Böyle. İkinci çözümde öğrenci yine netini ve diğerleri arasındaki yerini görüyor, ama bu çözüm başkalarının karşılaştırmasına girmiyor.",
        neden: "İkinci çözüm, çözümleri görülmüş bir sınavın tekrarı; gerçek bir ölçüm değil.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.kagit-sure",
        baslik: "Kâğıtta cevap işleme süresi",
        soru: "Kâğıtta çözülen testin cevaplarını optik forma işlemek için kaç saat süre verilsin?",
        simdi:
          "48 saat. Süre dolunca test o ana kadar işaretlenen cevaplarla puanlanıyor; işaretlenmeyenler boş sayılıyor.",
        neden: "Akşam çözüp ertesi gün okulda işleyen öğrenciye yetmeli; ama açık kalan test planı ve diğer işleri bekletiyor.",
        oneri: "48 saat kalsın.",
        cevap: { tur: "sayi", birim: "saat", enAz: 6, enCok: 168, simdiki: 48 },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.kagit-karsilastirma",
        baslik: "Kâğıt denemesinde karşılaştırma",
        soru: "Kâğıtta çözülen denemenin karşılaştırmaya girmemesi, ama öğrencinin yine de kendi yerini görmesi uygun mu?",
        simdi:
          "Kâğıtta süre denetlenemediği için kâğıt denemeleri karşılaştırmaya girmiyor; öğrenci netinin, ekranda çözenler arasındaki yerini görüyor. Kâğıt sonuçları gelişim grafiğine giriyor; süre ve strateji kartı ise kâğıtta yok.",
        neden: "Süresi tutulmayan bir sonuç, süreli çözülen sonuçlarla aynı sıralamaya konursa sıralama bozuluyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "deneme.kagit-kurallar",
        baslik: "Kitapçığın kurallar kutusu",
        soru: "Kitapçığın kurallar kutusuna hangi maddeler eklensin?",
        simdi:
          "Kutuda dört madde var: süreyi kendin tut; her sorunun tek doğru cevabı var ve sınavın yanlış götürme kuralı; cevaplarını son sayfadaki cevap kâğıdına işaretle; son tarihe kadar optik forma işle.",
        neden: "Kâğıtta kimse öğrenciyi denetlemiyor; kurallar kutusu sınav koşulunu ona hatırlatan tek yer.",
        oneri: "Hesap makinesi ve telefon maddeleri eklensin.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("hesap-makinesi", "Hesap makinesi kullanılmaz", onerilen),
            secenek("telefon", "Telefon kapalı ve uzakta", onerilen),
            secenek("kaynak", "Kitap ve not kullanılmaz"),
            secenek("turlama", "Önce emin olduklarını çöz, takıldığını atla, sonra dön"),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 12 ─────────────────────────────────────────────────────
  {
    anahtar: "sonuc",
    baslik: "Sonuç ekranı ve koçluk dili",
    giris:
      "Test bitince öğrenci önce tek cümlelik bir değerlendirme görüyor, sonra konu haritasını (her konu güçlü, orta ya da zayıf), yanlışlarının ortak sebebini, süre ve strateji kartını ve soruların çözümlerini. Cümlelerin hepsi bir koçun ağzından yazıldı: her biri bir sayı içeriyor ve tek bir şey yapmayı söylüyor; genel bir tebrik cümlesi yok.",
    sorular: [
      {
        anahtar: "sonuc.konu-esikleri",
        baslik: "Konu seviyesi eşikleri",
        soru: "Bir konunun güçlü, orta ya da zayıf sayılma eşikleri uygun mu?",
        simdi:
          "Boş bırakılan soru doğru sayılmıyor ve oranın paydasında kalıyor: hiç işaret koymayan öğrenci her konuda güçlü görünmesin diye. Aynı oran eşikleri sonuç ekranının ilk cümlesini de belirliyor.",
        neden:
          "Bu eşikler planın hangi konularla kurulacağını belirliyor; çok sıkıysa öğrenci her konuda 'zayıf', çok gevşekse hiç plan almıyor.",
        oneri: "Kalsın.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "deger", baslik: "Şu anki kural", tur: "metin" }],
          satirlar: [
            satir("guclu", "Güçlü", { deger: "doğru oranı %75 ve üstü" }),
            satir("orta", "Orta", { deger: "%45 ile %75 arası" }),
            satir("zayif", "Zayıf", { deger: "%45'in altı" }),
            satir("tek-test", "Bir testte seviye için en az soru", { deger: "2 soru (tek soruda seviye verilmiyor)" }),
            satir("plan", "Plana ve yayın önerisine girmek için en az soru", { deger: "3 soru" }),
            satir("genel", "Bütün testlerin birleştiği konu haritasında en az soru", { deger: "3 soru" }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.ilk-cumle",
        baslik: "Sonuç ekranının ilk cümlesi",
        soru: "Sonuç ekranının ilk cümlesi uygun mu?",
        simdi:
          "Cümle testteki genel başarıya göre üç bantta değişiyor. Konu adları ve sayılar kendiliğinden yazılıyor; plan bu testten kurulmadıysa 'bu hafta sadece bunlar' yerine 'önce bu haftanın planını bitir' deniyor.",
        neden: "Öğrencinin sonuç ekranında okuduğu ilk ve çoğu zaman tek cümle bu.",
        oneri: "Kalsın; değiştirmek istediğiniz hücreye yenisini yazın.",
        cevap: {
          tur: "tablo",
          sutunlar: [
            { anahtar: "baslik", baslik: "Başlık", tur: "metin" },
            { anahtar: "metin", baslik: "Metin", tur: "metin" },
          ],
          satirlar: [
            satir("yuksek", "Başarı %75 ve üstü", {
              baslik: "%82 — konuların çoğu oturmuş.",
              metin:
                "Tek açığın Köklü Sayılar: 3 soruda 1 doğru. Sıradaki adımın kapsamı genişletmek değil, bunu kapatmak.",
            }),
            satir("orta", "Başarı %45 ile %75 arası", {
              baslik: "%58 — temelin var, iki konu netini aşağı çekiyor.",
              metin:
                "Oran - Orantı ve Üslü Sayılar. Bu ikisi sınavda ortalama 3 soru demek. Bu hafta sadece bunlar; diğer konulara bakma.",
            }),
            satir("dusuk", "Başarı %45'in altı", {
              baslik: "%30 — bu bir yetenek meselesi değil, sıralama meselesi.",
              metin:
                "Aynı anda her yere bakıyorsun. Aşağıdaki listeden sadece Üslü Sayılar ile başla, bir hafta başka hiçbir şeye bakma.",
            }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.ilerleme",
        baslik: "Önceki çözümle karşılaştırma",
        soru: "Aynı paketin önceki çözümüyle karşılaştırmada hangi değişim 'gelişti' ya da 'geriledi' sayılsın?",
        simdi:
          "Öğrenci aynı paketi ikinci kez çözünce sonuç ekranında gelişen ve gerileyen konular listeleniyor. Yalnızca iki çözümde de seviye çıkacak kadar soru sorulmuş konular karşılaştırılıyor; 15 puandan küçük farklar gösterilmiyor.",
        neden:
          "Konu başına 3-4 soruluk bir pakette tek bir sorunun farkı 25-33 puan ediyor; yani bugünkü eşik tek soruluk oynamayı da 'gelişti' sayıyor.",
        oneri: "Eşik soru sayısıyla konsun: en az 2 soruluk fark 'gelişti' ya da 'geriledi' sayılsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("simdiki", "15 puan kalsın (tek soruluk fark da gösterilir)"),
            secenek("iki-soru", "En az 2 soruluk fark", onerilen),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.tekrar-cozme",
        baslik: "Aynı paketi yeniden çözme",
        soru: "Sonuç ekranı aynı paketi en erken kaç gün sonra yeniden çözmeyi önersin?",
        simdi:
          "10 gün: 'Bu paketi 10 gün sonra tekrar çöz. Daha erken çözersen soruları hatırlarsın, ölçüm gerçeği göstermez.' Bu bir tavsiye; sistem erken çözmeyi engellemiyor. Havuz darsa cümle 'farklı bir paket dene'ye dönüyor.",
        neden: "Tekrar çözüm gelişimi gösteren en net ölçü; ama çok erken çözülürse hatırlanan sorular sonucu şişiriyor.",
        oneri: "10 gün kalsın: haftalık planın bir turundan ve kontrol testinden sonrasına denk geliyor.",
        cevap: { tur: "sayi", birim: "gün", enAz: 1, enCok: 60, simdiki: 10 },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.sure-esikleri",
        baslik: "Süre ve strateji kartının eşikleri",
        soru: "Süre ve strateji kartının eşikleri uygun mu?",
        simdi:
          "Kart yalnızca ekranda çözülen süreli testlerde çıkıyor (kâğıtta ve alıştırmada yok) ve en fazla 3 tavsiye veriyor. Söylenecek bir kusur yoksa tek bir olumlu cümle yazıyor.",
        neden:
          "Konu haritası 'neyi bilmiyorsun' diyor; bu kart 'bildiğini sınavda nasıl kaybediyorsun' diyor. Eşikler çok hassassa her öğrenci uyarı yağmuruna tutuluyor.",
        oneri: "Kalsın; pilottan sonra en sık çıkan uyarılara birlikte bakalım.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "deger", baslik: "Şu anki kural", tur: "metin" }],
          satirlar: [
            satir("yavas-konu", "Konuda 'yavaş'", {
              deger: "konuda harcanan süre, o konunun hedef sürelerinin toplamının 1,3 katından fazla",
            }),
            satir("takilma", "Takıldığın soru", { deger: "bir soruda hedef sürenin 2 katından fazla kalmak" }),
            satir("uzun-bos", "Uzun bakılıp boş bırakılan soru", {
              deger: "hedef süre kadar ya da daha uzun bakılıp boş bırakılan soru",
            }),
            satir("ulasilmayan", "Hiç ulaşılamayan sorular", {
              deger: "testin sonundaki en az 2 soruya hiç bakılmamış (5 saniyeden az)",
            }),
            satir("son-dakika", "Son dakikaya yığılma", {
              deger:
                "sınavın son 10 dakikasında en az 4 soru ve soruların en az %30'u işaretlenmiş (yalnızca 20 dakika ve üstü testlerde)",
            }),
            satir("erken-bitirme", "Süreyi kullanmadan bitirme", {
              deger: "sürenin %60'ından azı kullanılmış, en az 3 yanlış var ve yanlışlar doğruların en az yarısı kadar",
            }),
            satir("yavas-baslangic", "Yavaş başlangıç", {
              deger: "sürenin ilk yarısında, ikinci yarısındakinin yarısından az soru işaretlenmiş (toplam en az 6 soru)",
            }),
            satir("genel-yavaslik", "Genel yavaşlık", {
              deger: "hiçbir soruda takılmadan, soru başına ortalama süre hedefin 1,3 katından fazla",
            }),
            satir("turlama", "Turlama yapılmış sayılması", {
              deger: "ilk tur testin son beşte birine ulaşmış ve en az 2 soruya sonradan dönülmüş",
            }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.strateji-dili",
        baslik: "Süre kartının tavsiye dili",
        soru: "Süre ve strateji kartındaki tavsiye cümleleri uygun mu?",
        simdi: "Her tavsiye bir sayı ve tek bir eylem içeriyor; önce net kaybettiren süre hatası, sonra taktik geliyor.",
        ornek:
          "'7. soruda 4 dk 10 sn kaldın, hedefin iki katından fazla. Bir soruda 2,5 dk dolunca işaretle ve geç; turun sonunda dönersin.' — 'Son 3 soruya hiç ulaşamadın. Turlama dene: ilk turda emin olduklarını çöz, takıldığını atla; ikinci turda dön.' — 'Sürenin ilk yarısında 4, ikinci yarısında 12 soru işaretledin. Başlangıç yavaş: ilk turda emin olduğun soruları hızla işaretle.'",
        neden: "Deneme sonrası bir koçun ilk sorusu budur: hangi soruda takıldın, sırayla mı gittin, son dakikaya ne bıraktın?",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "sonuc.turlama",
        baslik: "Turlama tekniği",
        soru: "Öğrencilere önerdiğiniz bir turlama tekniği varsa yazar mısınız?",
        simdi: "Sistemin tarifi tek cümle: 'ilk turda emin olduklarını çöz, takıldığını atla; ikinci turda dön.'",
        neden: "Öğrenciye sizin anlattığınız tekniği aynı kelimelerle söylemek, kartın tavsiyesini derste duyduğuyla birleştiriyor.",
        oneri: "Kısa, adım adım bir tarif; kart ve kitapçık aynı tarifi kullansın.",
        cevap: { tur: "metin", ipucu: "Kaç tur, her turda ne yapılır, sorular nasıl işaretlenir." },
        oncelik: "normal",
      },
    ],
  },

  // ── 13 ─────────────────────────────────────────────────────
  {
    anahtar: "yayin",
    baslik: "Yayın önerileri",
    giris:
      "Sonuç ekranında, öğrencinin zayıf çıktığı konular için Koçum.Net yayınları öneriliyor. Öneri yalnızca en az 3 soruyla ölçülüp zayıf çıkan konulardan geliyor; en fazla 3 tane ve yalnızca öğrencinin sınavına uygun yayınlar. Haftalık plandaki konu tekrarı ve soru çözümü işlerinde de aynı yayın gösteriliyor.",
    sorular: [
      {
        anahtar: "yayin.liste",
        baslik: "Yayın listesi",
        soru: "Öneri listesindeki yayınlar ve bağlı oldukları konular güncel mi?",
        simdi:
          "Sekiz yayın var: 'Tam ÖSYM Ayarı' Problemler Soru Paketi (TYT; problem türleri ve Oran-Orantı), 'ÖSYM Diliyle Problemler' (TYT; problemler), 'Sanki ÖSYM Problemleri' (TYT, KPSS, DGS, ALES; problemler), TYT Matematik 'İlk 15' Branş Denemeleri (TYT'nin temel konuları), AYT Matematik 'İlk 16' Branş Denemeleri (AYT cebiri), 'Muhteşem Üçlü' (AYT; binom, mantık, kartezyen), Trigonometri 5'te 5 (AYT), Analitik 5'te 5 (AYT).",
        neden: "Yanlış ya da güncel olmayan bir öneri, doğru teşhisin de güvenilirliğini düşürüyor.",
        oneri: "Sitedeki güncel ürün listesiyle karşılaştırıp eklenecek ya da çıkarılacakları yazmanız yeterli.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "yayin.muhtesem-uclu",
        baslik: "'Muhteşem Üçlü' ve TYT",
        soru: "'Muhteşem Üçlü' TYT öğrencisine de önerilsin mi?",
        simdi:
          "Yayın sitede yalnızca AYT ürünü olarak geçiyor; konu tarafında ise TYT'nin Kümeler, Mantık, Permütasyon-Kombinasyon-Olasılık, Veri-İstatistik ve Fonksiyonlar konularına bağlı. Öneriler sınava göre süzüldüğü için TYT öğrencisine şu an hiç önerilmiyor.",
        neden: "TYT öğrencisine uymayan bir kitap önermek güveni sarsıyor; uyan bir kitabı önermemek de öğrenciyi kaynaksız bırakıyor.",
        oneri: "Yayının TYT kapsamına uyan bölümü öğrenciyi taşıyacak kadar genişse önerilsin; değilse yalnızca AYT'de kalsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("evet", "Evet, TYT öğrencisine de önerilsin"),
            secenek("hayir", "Hayır, yalnızca AYT öğrencisine (şu an)"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "yayin.faiz",
        baslik: "Faiz Problemleri için yayın",
        soru: "'Faiz Problemleri' konusu (KPSS, DGS, ALES) için hangi yayın önerilsin?",
        simdi:
          "Konu yalnızca 'Tam ÖSYM Ayarı' Problemler Soru Paketi'ne bağlı. O yayın TYT ürünü olduğu için KPSS, DGS ve ALES öğrencisine bu konuda hiçbir yayın önerilmiyor.",
        neden: "Faiz, bu üç sınavda düzenli soru getiren bir konu; zayıf çıkan öğrenci şu an bir kaynak önerisi almıyor.",
        oneri: "'Sanki ÖSYM Problemleri': bu üç sınavda zaten öneriliyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("sanki-osym", "'Sanki ÖSYM Problemleri'", onerilen),
            secenek("baska", "Başka bir yayın (not olarak yazın)"),
            secenek("yok", "Öneri olmasın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "yayin.yayinsiz",
        baslik: "Yayın bağlı olmayan konular",
        soru: "Şu an hiçbir yayın bağlı olmayan konular için önerilecek bir yayın var mı?",
        simdi:
          "Bu konularda zayıf çıkan öğrenciye yayın önerilmiyor: LGS'nin bütün konuları, Geometri'nin bütün alt konuları, AYT'de Limit, Türev ve İntegral, KPSS, DGS ve ALES'in Sayı Dizileri, Tablo-Grafik Yorumlama, İşlem-Modüler Aritmetik ve Sayısal Mantık konuları. KPSS, DGS ve ALES öğrencisine temel konularda da öneri çıkmıyor, çünkü bağlı yayınlar TYT ürünü; bu sınavlarda yalnızca 'Sanki ÖSYM Problemleri' öneriliyor.",
        neden:
          "Öneri yalnızca bir satış kanalı değil; öğrenciye 'bu konuyu şununla çalış' diyen koç cümlesi. Yayın yoksa o cümle eksik kalıyor.",
        oneri: "Konu ve yayın adını yazmanız yeterli; yayın yoksa o konuda öneri çıkmamaya devam eder.",
        cevap: { tur: "metin", ipucu: "Konu adı ve önerilecek yayın." },
        oncelik: "sonra",
      },
    ],
  },

  // ── 14 ─────────────────────────────────────────────────────
  {
    anahtar: "plan",
    baslik: "Haftalık plan",
    giris:
      "Bir paket testi bitince (tanışma testi ve deneme dahil) sistem o haftanın planını kuruyor: en zayıf en fazla iki konu, her konu için dört iş. Öğrenci işleri ana sayfadaki plan kartında görüyor ve bitirdikçe işaretliyor; kontrol testi ise ancak test çözülünce kapanıyor. Hafta pazartesi başlayıp pazar bitiyor; aynı hafta içindeki yeni testler planı değiştirmiyor.",
    sorular: [
      {
        anahtar: "plan.konu-sayisi",
        baslik: "Haftada kaç konu",
        soru: "Bir haftalık plana en fazla kaç konu girsin?",
        simdi:
          "2. Plana yalnızca en az 3 soruyla ölçülüp zayıf çıkan konular giriyor; önce oranı en düşük olan, eşitlikte sınavda daha çok soru getiren.",
        neden:
          "Bir koçu rapordan ayıran şey 'bu hafta yalnızca bunlar' diyebilmesi; beş zayıf konuyu aynı hafta vermek hiçbirinin bitmemesi demek.",
        oneri: "2 kalsın.",
        cevap: { tur: "sayi", birim: "konu", enAz: 1, enCok: 5, simdiki: 2 },
        oncelik: "normal",
      },
      {
        anahtar: "plan.isler",
        baslik: "Planın işleri ve süreleri",
        soru: "Her konu için plandaki işler ve tahmini süreleri uygun mu?",
        simdi:
          "Her konu için sırayla dört iş var: konu tekrarı, soru çözümü, yanlış analizi ve 5 soruluk kontrol testi. Bir konunun haftalık yükü 163 dakika; iki konuyla yaklaşık 5,5 saat.",
        neden: "Süreler öğrencinin haftasına sığmazsa plan ilk günden terk ediliyor.",
        oneri: "Kalsın.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "dakika", baslik: "Süre", tur: "sayi", birim: "dakika" }],
          satirlar: [
            satir("tekrar", "Konu tekrarı", { dakika: 60 }),
            satir("soru", "Soru çözümü", { dakika: 70 }),
            satir("analiz", "Yanlış analizi", { dakika: 25 }),
            satir("kontrol", "Kontrol testi", { dakika: 8 }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "plan.soru-hedefi",
        baslik: "Haftalık soru hedefi",
        soru: "Plandaki 'soru çöz' işinde konu başına kaç soru istensin?",
        simdi: "40 soru; iş plana 'Üslü Sayılar 40 soru' diye, 70 dakika olarak yazılıyor.",
        neden: "Sayı çok yüksekse iş hiç bitmiyor ve plan güvenilmez oluyor; çok düşükse konu oturmuyor.",
        oneri: "40 kalsın.",
        cevap: { tur: "sayi", birim: "soru", enAz: 5, enCok: 200, simdiki: 40 },
        oncelik: "normal",
      },
      {
        anahtar: "plan.soru-isareti",
        baslik: "'Soru çöz' işinin kapanması",
        soru: "Plandaki '40 soru' işi nasıl kapansın?",
        simdi:
          "İkisi birden. Bugün kartında işin yanında '5 soru çöz' düğmesi ve 'bu hafta bu konuda 12/40 soru' gibi bir ilerleme var; öğrenci uygulamada o konudan hedef kadar soru çözünce iş kendiliğinden kapanıyor. 'Bilmiyorum' deyip geçilen soru sayılmıyor. Kitaptan çalışan öğrenci için 'Yaptım' düğmesi de duruyor.",
        neden:
          "Elle işaret kitaptan çalışan öğrenci için şart, ama doğrulanmıyor; uygulamada çözülen sorular ise zaten biliniyor.",
        oneri: "Kalsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("ikisi", "Uygulamada hedefe ulaşınca kendiliğinden; elle işaret de kalsın (şu an)", onerilen),
            secenek("elle", "Yalnızca elle"),
            secenek("uygulama", "Yalnızca uygulamada çözülen sorular sayılsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "plan.yanlis-analizi",
        baslik: "'Yanlışlarını deftere geçir' işi",
        soru: "Plandaki 'yanlışlarını deftere geçir' işi ne olsun?",
        simdi:
          "Plandaki üçüncü iş 'Üslü Sayılar yanlışlarını deftere geçir' diyor; oysa yanlışlar artık yanlış defterine kendiliğinden giriyor.",
        neden: "Sistemin zaten yaptığı bir işi öğrenciye yaptırmak planın inandırıcılığını düşürüyor.",
        oneri: "'Defterdeki tekrarlarını yap' işine dönüşsün ve o konunun bugünkü tekrarı bitince kendiliğinden kapansın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("tekrar", "'Defterdeki tekrarlarını yap' olsun, tekrar bitince kendiliğinden kapansın", onerilen),
            secenek("cozum-oku", "'Yanlışlarının çözümlerini oku' olsun, öğrenci işaretlesin"),
            secenek("kalksin", "Kalksın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "plan.devir",
        baslik: "Bitmeyen işlerin devri",
        soru: "Bitmeyen işler sonraki haftaya devretsin mi?",
        simdi:
          "Devretmiyor. Yeni haftanın planı o haftanın ilk paket testinden sonra kuruluyor; öğrenci isterse 'Planı oluştur' düğmesiyle son sonucundan da kurabiliyor. Pazartesi sabahı çoğu öğrencinin planı yok; pazartesi e-postası geçen haftanın bitmemiş en fazla 3 işini hatırlatıyor.",
        neden: "Haftaya plansız başlayan öğrenci çoğunlukla o hafta hiç başlamıyor.",
        oneri: "Pazartesi bitmemiş işler kendiliğinden yeni haftaya taşınsın; haftanın ilk testi bu planı genişletsin.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("tasinsin", "Bitmeyen işler taşınsın, ilk test planı genişletsin", onerilen),
            secenek("son-sonuc", "Pazartesi plan son sonuçtan kendiliğinden kurulsun"),
            secenek("simdiki", "Şimdiki gibi kalsın"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "plan.kisaltma",
        baslik: "Planın kısalması",
        soru: "Geçen hafta işlerin yarısından azı bittiyse bu hafta tek konu verilmesi uygun mu?",
        simdi:
          "Böyle. Koç notu da bunu söylüyor: 'Geçen hafta listenin yarısını bitiremedin, bu yüzden bu hafta tek konu.' Geçen hafta plan yoksa iki konu veriliyor.",
        neden: "Bitirilemeyen plan bir sonraki hafta küçülmezse öğrenci her hafta aynı başarısızlığı yaşıyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "plan.koc-notu",
        baslik: "Koç notu",
        soru: "Planın üstündeki koç notunu kim, ne sıklıkla yazsın?",
        simdi:
          "Sistem plan kurulurken notu kendisi yazıyor: 'Sadece Üslü Sayılar ve Oran - Orantı. Diğer konulara bakma.' Koç panelden bu notu değiştirebiliyor ya da kaldırabiliyor (en fazla 280 karakter). Not yalnızca bu haftanın planına yazılabiliyor.",
        neden: "Koçun kendi cümlesi öğrenciye sistemin cümlesinden çok daha güçlü ulaşıyor; ama her öğrenciye her hafta yazmak zaman istiyor.",
        oneri: "Sistemin notu yeterli; koç riskli öğrencilerde ve gerektiğinde değiştirsin.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("gerektiginde", "Sistemin notu yeter; koç gerektiğinde değiştirsin", onerilen),
            secenek("her-hafta", "Koç her öğrenciye her hafta kendisi yazsın"),
            secenek("riskli", "Yalnızca riskli öğrencilere koç yazsın"),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 15 ─────────────────────────────────────────────────────
  {
    anahtar: "alistirma",
    baslik: "Alıştırma, ipucu ve yanlış defteri",
    giris:
      "Alıştırma süresiz ve ölçüm sayılmıyor: öğrenci her sorudan hemen sonra doğru şıkkı, çözümü ve yanlış şıkkının hata türünü görüyor. Üç yoldan açılıyor: sonuç ekranındaki 'Benzerini çöz' (aynı kazanımdan yeni bir soru), 'Bu konuda çalış' (bir konudan birkaç soru) ve yanlış defterinin 'Bugünkü tekrar'ı. Testte yanlış ya da boş bırakılan her soru deftere giriyor ve belirli günlerde benzer bir soruyla yeniden soruluyor. Alıştırma sonuçları nete, gelişim grafiğine ve soru istatistiklerine girmiyor.",
    sorular: [
      {
        anahtar: "alistirma.calisma-modu",
        baslik: "Alıştırmanın işleyişi",
        soru: "Alıştırmanın işleyişi pedagojik olarak uygun mu?",
        simdi:
          "Süre yok. Öğrenci şıkkı işaretleyince cevap kilitleniyor; sonra doğru şık, çözüm, seçtiği yanlış şıkkın hata türü ve varsa kazanım özet kartı görünüyor. İsterse 'Bilmiyorum' deyip çözüme geçebiliyor. Alıştırma ölçüm sayılmıyor: nete, gelişim grafiğine, plana ve soru istatistiklerine girmiyor.",
        neden: "Ölçmek ile öğretmek ayrı işler; aynı ekranda karışırsa ne ölçüm güvenilir kalıyor ne öğrenme rahat.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "alistirma.aralik",
        baslik: "Tekrar aralıkları",
        soru: "Yanlış defterindeki tekrar aralıkları uygun mu: 1, 3 ve 7 gün; üçüncü doğruda defterden çıkış?",
        simdi:
          "Yanlıştan sonraki gün aynı kazanımdan benzer bir soru geliyor. Doğruysa 3 gün sonra, o da doğruysa 7 gün sonra yeniden soruluyor; üçüncü doğruda madde defterden çıkıyor. Yanlış ya da 'Bilmiyorum' maddeyi başa (1 gün) döndürüyor. Günler Türkiye saatiyle gece yarısından sayılıyor. 'Benzerini çöz' ile çözülen soru defteri ilerletmiyor; yalnızca bugünkü tekrar sayılıyor.",
        neden: "Aralıklı tekrar unutmayı geciktirmenin bilinen en etkili yolu; aralıklar çok kısaysa ezber, çok uzunsa unutma ölçülüyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "alistirma.gunluk-sinirlar",
        baslik: "Günlük sınırlar",
        soru: "Bir günde açılabilecek tekrar, alıştırma ve kontrol testi sınırları uygun mu?",
        simdi:
          "Gün Türkiye saatiyle gece yarısında başlıyor. Alıştırma sınırı soru açılırken sayılıyor, çözülürken değil; amaç, cevabı hemen gösteren alıştırmayla havuzun birkaç günde ezberlenmesini önlemek. Koçun konu ödevi alıştırma sınırına sayılıyor ama sınır dolsa da ödev engellenmiyor.",
        neden: "Sınır çok düşükse istekli öğrenci durduruluyor; çok yüksekse havuz cevap anahtarıyla birlikte hızla tükeniyor.",
        oneri: "Kalsın.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "sinir", baslik: "Günlük sınır", tur: "sayi" }],
          satirlar: [
            satir("tekrar", "Bugünkü tekrar (soru)", { sinir: 10 }),
            satir("alistirma", "Alıştırma: 'Benzerini çöz', 'Bu konuda çalış' ve konu ödevi (soru)", { sinir: 30 }),
            satir("kontrol", "Kontrol testi (test)", { sinir: 8 }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "alistirma.konu-calisma",
        baslik: "'Bu konuda çalış' uzunluğu",
        soru: "'Bu konuda çalış' kaç soru getirsin?",
        simdi: "5 soru. Konu ödevi de oturum başına en fazla 5 soru açıyor; ödev bitene kadar yeni oturum açılabiliyor.",
        neden: "Kısa oturum telefonda bitiriliyor; ama çok kısa oturum konuya ısınmaya yetmiyor.",
        oneri: "5 kalsın.",
        cevap: { tur: "sayi", birim: "soru", enAz: 3, enCok: 20, simdiki: 5 },
        oncelik: "sonra",
      },
      {
        anahtar: "alistirma.ipuclu-dogru",
        baslik: "İpucuyla doğru",
        soru: "Tekrarda ipucu açarak doğru yapılan soru nasıl sayılsın?",
        simdi:
          "Tam doğru sayılmıyor: madde ilerlemiyor (aşaması korunuyor) ve ertesi gün yeniden geliyor. Başa da dönmüyor.",
        neden: "İpucuyla çözen öğrenci yanlış yapmış değil, ama aralığı açmak için kendi başına çözdüğünü görmek gerekiyor.",
        oneri: "Şimdiki gibi kalsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("simdiki", "Madde ilerlemesin, ertesi gün yeniden gelsin (şu an)", onerilen),
            secenek("dogru", "Tam doğru sayılsın"),
            secenek("yanlis", "Yanlış sayılsın, başa dönsün"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "alistirma.benzer-konu",
        baslik: "Kazanımın benzeri yoksa",
        soru: "Bir kazanımın başka sorusu yoksa 'benzer soru' olarak aynı konudan bir soru gelsin mi?",
        simdi:
          "Gelmiyor. Benzer soru şu kurala göre seçiliyor: aynı kazanım (soru bir kazanıma bağlı değilse aynı konu), aynı seviye, zorluk farkı en çok 1; 'Benzerini çöz'de ayrıca son 24 saatte gösterilmemiş olmalı. Benzeri yoksa sonuç ekranında 'Benzerini çöz' düğmesi görünmüyor; defterdeki madde 'yeni sorular eklenince gelecek' diye bekliyor.",
        neden: "Aynı konudan ama başka kazanımdan bir soru, öğrencinin yanlış yaptığı beceriyi ölçmüyor; ama hiç soru gelmemesi de defteri tıkıyor.",
        oneri: "Hayır; asıl çözüm kazanım başına en az 2-3 soru yazmak. Böylece defter tıkanmıyor, ölçüm de bozulmuyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hayir", "Hayır, madde beklesin (şu an)", onerilen),
            secenek("evet", "Evet, aynı konudan gelsin"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "alistirma.asil-soru",
        baslik: "Hiç benzer soru yoksa",
        soru: "Defterdeki bir yanlışın hiç benzeri yoksa öğrencinin yanlış yaptığı asıl soru yeniden sorulsun mu?",
        simdi: "Sorulmuyor; madde benzeri bulunana kadar bekliyor ve bugünkü tekrara girmiyor.",
        neden:
          "Öğrenci asıl sorunun çözümünü sonuç ekranında gördü; aynı soruyu hemen yeniden sormak beceriyi değil hatırlamayı ölçüyor. Ama madde sonsuza kadar da beklememeli.",
        oneri: "7 gün geçtiyse ve hâlâ benzer yoksa asıl soru sorulsun: o arada çözüm büyük ölçüde unutulmuş oluyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hayir", "Hayır, madde beklesin (şu an)"),
            secenek("yedi-gun", "7 gün geçtiyse asıl soru sorulsun", onerilen),
            secenek("evet", "Evet, hemen sorulsun"),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 16 ─────────────────────────────────────────────────────
  {
    anahtar: "kocluk",
    baslik: "Koçluk: sorular, ödevler ve riskli öğrenciler",
    giris:
      "Panelde koçun üç aracı var. 'Koça sor' ile öğrenci bir soru hakkında ya da genel bir konuda yazıyor, koç panelden cevaplıyor. Gruplar ve ödevler ile koç öğrencilere paket, deneme ya da bir konudan belirli sayıda alıştırma sorusu veriyor; ödevin bitip bitmediğini sistem kendisi görüyor. Riskli öğrenciler listesi de kopma işareti veren öğrencileri bir arada gösteriyor.",
    sorular: [
      {
        anahtar: "kocluk.kim-cevaplar",
        baslik: "Koça soruları kim cevaplayacak",
        soru: "Öğrencinin koça sorularını kim cevaplasın?",
        simdi:
          "Sorular panelde 'bekleyen, cevaplanan, kapatılan' diye ayrılıyor. Yönetici, müdür ve editör cevaplayabiliyor; editör öğrencinin adını değil, baş harflerini görüyor. Her sorunun tek cevabı var; öğrenci takip sorusunu yeni soru olarak soruyor.",
        neden: "Cevabı kimin vereceği belli değilse sorular kutuda birikiyor ve öğrenci bir daha sormuyor.",
        oneri: "Pilot öğrencilerinin koçu; soruyla ilgili içerik sorusunu gerekirse yazana yönlendirsin.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("koc", "Pilot öğrencilerinin koçu", onerilen),
            secenek("hoca", "Ben"),
            secenek("ekip", "İçerik ekibinden bir sorumlu"),
            secenek("yazan", "Soru hakkındaysa soruyu yazan kişi"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.cevap-suresi",
        baslik: "Cevap süresi",
        soru: "Koça gelen bir soruya en geç kaç saat içinde cevap verilsin?",
        simdi: "Sistemde bir hedef süre yok; öğrenci cevaplanana kadar 'bekliyor' görüyor.",
        neden: "Sınavdan önceki haftalarda iki gün geç gelen cevap çoğu zaman işe yaramıyor.",
        oneri: "24 saat.",
        cevap: { tur: "sayi", birim: "saat", enAz: 1, enCok: 168 },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.soru-sinirlari",
        baslik: "Koça soru sınırları",
        soru: "Koça soru sınırları uygun mu?",
        simdi: "Soru bir test sorusu hakkındaysa öğrenci o soruyu sonuç ekranında ya da alıştırmada görmüş olmalı.",
        neden: "Koç tek kişi; sınırsız soru kutuyu bir öğrencinin doldurmasına izin veriyor.",
        oneri: "Kalsın.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "sinir", baslik: "Sınır", tur: "sayi" }],
          satirlar: [
            satir("gunluk", "Bir günde en fazla soru", { sinir: 5 }),
            satir("acik", "Aynı anda cevap bekleyen en fazla soru", { sinir: 3 }),
            satir("uzunluk", "Bir sorunun en fazla uzunluğu (karakter)", { sinir: 1000 }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.odev-sikligi",
        baslik: "Ödev sıklığı",
        soru: "Pilot grubuna haftada kaç ödev vermeyi düşünüyorsunuz?",
        simdi:
          "Sistemde bir sınır yok. Panel yeni ödeve son tarih olarak 7 gün sonrasını öneriyor; en uzak son tarih 180 gün.",
        neden:
          "Konu ödevleri alıştırmanın günlük sınırına sayılıyor; haftalık ödev yükü, öğrencinin kendi alıştırmasına ne kadar yer kaldığını belirliyor.",
        oneri: "Haftada 1-2: haftalık planın üstüne çok ödev eklemek planı ikinci plana itiyor.",
        cevap: { tur: "sayi", birim: "ödev", enAz: 0, enCok: 10 },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.odev-turleri",
        baslik: "Ödev türleri",
        soru: "Başka bir ödev türü lazım mı?",
        simdi:
          "İki tür var: bir konu paketini, tanışma testini ya da bir denemeyi çözmek; bir konudan en az belirli sayıda alıştırma sorusu çözmek (5 ile 40 arası). Grup kurmak ve ödev vermek yönetici ve müdür yetkisi istiyor.",
        neden: "Koçun en sık verdiği iş listede yoksa ödev sistem dışında, mesajla veriliyor ve takip edilemiyor.",
        oneri: "Önce yanlış defteri tekrarı: koçların en çok istediği iş yanlışların kapatılması.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("defter", "Yanlış defteri tekrarını bitirmek", onerilen),
            secenek("seviyeli", "Seviyeli check-up'ı bitirmek"),
            secenek("kontrol", "Bir konunun kontrol testini çözmek"),
            secenek("yeterli", "Bunlar yeterli"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.bilmiyorum",
        baslik: "Ödevde 'Bilmiyorum'",
        soru: "Konu ödevinde 'Bilmiyorum' deyip geçilen sorunun ödeve sayılması uygun mu?",
        simdi: "Sayılıyor: saymasak öğrenci rastgele işaretleyip geçerdi. 'Bilmiyorum' deyince soru kilitleniyor ve çözümü görünüyor.",
        neden: "Saymamak, bilmediğini dürüstçe söyleyeni cezalandırıp rastgele işaretleyeni ödüllendiriyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.gec-tamamlama",
        baslik: "Geç tamamlanan ödev",
        soru: "Son tarihten sonra bitirilen ödevin 'geç tamamlandı' diye işaretlenip yine de tamamlanmış sayılması uygun mu?",
        simdi:
          "Böyle. Son tarihi geçen ödev öğrencinin listesinde 7 gün daha 'gecikti' rozetiyle duruyor, sonra geçmişe düşüyor. Hiç işaret konmadan gönderilen ya da yarım kalan test ödevi tamamlamıyor.",
        neden: "Geç de olsa yapılması istenen bir iş; ama koçun zamanında yapanla geç yapanı ayırabilmesi gerekiyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.risk-esikleri",
        baslik: "Riskli öğrenci eşikleri",
        soru: "Bir öğrencinin riskli öğrenciler listesine düşme eşikleri uygun mu?",
        simdi:
          "Liste yalnızca yönetici ve müdüre açık; grup grup da süzülebiliyor. Etkinlik: uygulamayı açmak, test ya da alıştırma. Pilot beş hafta sürdüğü için pasif eşiği 14 günden 7 güne indi. Yeni bir uyarı var: süresi geçen hafta içinde dolan ödevi yapmayan öğrenci. 'Hiç başlamadı' uyarısı, boş ya da yarım kalan testi başlamış saymıyor. Düşüş, aynı türden son iki paket testine bakıyor; kontrol testleri, seviyeli aşamalar, boş ve yarım testler sayılmıyor. Planı yapmıyor uyarısı, içinde bulunulan haftaya değil geçen haftaya bakıyor.",
        neden:
          "Eşikler koçun haftalık arama listesini belirliyor; çok gevşekse liste kalabalıklaşıp okunmuyor, çok sıkıysa kopan öğrenci geç fark ediliyor.",
        oneri: "Kalsın; pilotta liste her hafta birkaç kişiyi geçmiyorsa doğru ayardadır.",
        cevap: {
          tur: "tablo",
          sutunlar: [{ anahtar: "esik", baslik: "Eşik", tur: "sayi" }],
          satirlar: [
            satir("pasif", "Pasif: hiç etkinlik olmayan gün", { esik: 7 }),
            satir("odev", "Ödevi yapmadı: süresi son kaç gün içinde dolan ödeve bakılsın", { esik: 7 }),
            satir("baslamadi", "Hiç başlamadı: kayıttan sonra hiç test çözmeden geçen gün", { esik: 3 }),
            satir("plan", "Planı yapmıyor: geçen haftanın planında biten işlerin oranı, yüzde (altı)", { esik: 40 }),
            satir("dusus", "Düşüşte: son iki testte başarı düşüşü, puan", { esik: 10 }),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.risk-arama",
        baslik: "Hangi durumda arama",
        soru: "Hangi durumlarda öğrenciyi aramak ya da ona yazmak istersiniz?",
        simdi:
          "Liste her duruma bir eylem öneriyor. Pasif: 'Ara ya da mesaj at; plan çok mu ağır geldi, sor.' Düşüşte: 'Düşen konulara bak; planı o konulara daralt.' Planı yapmıyor: 'Koç notuyla bu haftanın tek önceliğini yaz.' Hiç başlamadı: 'Tanışma check-up'ını hatırlat.' Sistem kendisi kimseyi aramıyor, mesaj da göndermiyor.",
        neden: "Koçun zamanı sınırlı; hangi durumda bizzat aranacağı belli olursa liste günlük bir iş listesine dönüşüyor.",
        oneri: "Pasif ve düşüşte olanlar aransın; diğer ikisine koç notu ya da kısa bir mesaj yeter.",
        cevap: {
          tur: "secenek",
          cokluSecim: true,
          secenekler: [
            secenek("pasif", "Pasif", onerilen),
            secenek("dusus", "Düşüşte", onerilen),
            secenek("plan", "Planı yapmıyor"),
            secenek("baslamadi", "Hiç başlamadı"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "kocluk.risk-plan-olcusu",
        baslik: "'Planı yapmıyor' neye baksın",
        soru: "'Planı yapmıyor' uyarısı plandaki hangi işlere baksın?",
        simdi:
          "Bütün işlere: konu tekrarı, soru çözümü ve yanlış analizi öğrencinin kendi işaretine, kontrol testi testin gerçekten çözülmesine dayanıyor.",
        neden: "Kitaptan çalışan öğrenci işini işaretlemeyi unutunca 'planı yapmıyor' görünüyor; kontrol testi ise yanıltmıyor.",
        oneri: "Yalnızca kontrol testlerine baksın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("hepsi", "Bütün işlere (şu an)"),
            secenek("kontrol", "Yalnızca kontrol testlerine", onerilen),
          ],
        },
        oncelik: "normal",
      },
    ],
  },

  // ── 17 ─────────────────────────────────────────────────────
  {
    anahtar: "motivasyon",
    baslik: "Motivasyon, haftalık e-posta ve veli",
    giris:
      "Ana sayfada bir seri kartı var: öğrencinin kaç gündür aralıksız çalıştığını ve bugünkü soru hedefine ne kadar kaldığını gösteriyor. Her pazartesi sabahı öğrenciye o haftanın planını hatırlatan bir e-posta gidiyor. Öğrenci isterse velisine süreli, salt okunur bir rapor bağlantısı gönderebiliyor.",
    sorular: [
      {
        anahtar: "motivasyon.seri",
        baslik: "Seri",
        soru: "En az bir soru çözülen her günün seriyi sürdürmesi uygun mu?",
        simdi:
          "Her türlü test ve alıştırmada cevaplanan soru sayılıyor; alıştırmadaki 'Bilmiyorum' da sayılıyor, testte boş bırakılan soru sayılmıyor. Gün Türkiye saatiyle. Bugün henüz soru çözülmediyse seri gün bitene kadar kırılmış sayılmıyor.",
        neden: "Seri, her gün az da olsa çalışmayı alışkanlığa çeviriyor; eşik yüksek olursa ilk kırılmada öğrenci bırakıyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "motivasyon.gunluk-hedef",
        baslik: "Günlük soru hedefi",
        soru: "Günlük soru hedefinin varsayılanı (10 soru) ve seçenekleri (hedef yok, 5, 10, 20, 40) uygun mu?",
        simdi: "Varsayılan 10 soru; öğrenci profilden değiştirebiliyor. Hedefe ulaşılınca seri kartında işaret çıkıyor.",
        neden: "Ulaşılabilir bir günlük hedef çalışmayı başlatıyor; ulaşılamayan hedef her gün küçük bir başarısızlık hissi bırakıyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "motivasyon.haftalik-test",
        baslik: "Haftada kaç test",
        soru: "Kayıtta sorulan 'Haftada kaç test?' seçenekleri (1, 2, 3; varsayılan 1) uygun mu?",
        simdi:
          "Kayıt ekranı 'Haftada bir check-up çoğu öğrenci için doğru tempo' diyor. Bir haftadan uzun süre test çözmeyen öğrenciye pazartesi e-postası şunu yazıyor: 'Son check-up'ından 9 gün geçti. Hedefin haftada 1 test — bu hafta bir tane çöz, planın yenilensin.'",
        neden: "Plan haftada bir kurulduğu için haftada birden fazla test ölçümü değiştirmiyor; ama bazı öğrenciler daha sık ölçülmek istiyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "sonra",
      },
      {
        anahtar: "motivasyon.posta",
        baslik: "Pazartesi e-postası",
        soru: "Pazartesi e-postasının içeriği uygun mu?",
        simdi:
          "Pazartesi saat 07:00'den sonra gidiyor. İçinde: bu haftanın planı (yoksa geçen haftanın bitmemiş en fazla 3 işi), varsa koç notu, son 7 günde kaç gün çalışıldığı, sınava kalan gün (tarih girildiyse), cevaplanmış koça sorular ve bu hafta sırası gelen tekrarlar. 60 gündür girmeyen öğrenciye gitmiyor; öğrenci tek tıkla kapatabiliyor.",
        neden: "Uygulamaya girmeyen öğrenci planı görmüyor; e-postayı görüyor. Haftanın başında koçun en basit işi planı hatırlatmak.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
      {
        anahtar: "motivasyon.veli-kapsam",
        baslik: "Veli raporunda ne olsun",
        soru: "Veli raporunda ne görünsün?",
        simdi:
          "Bağlantıyı açan kişi giriş yapmadan şunları görüyor: öğrencinin ilk adı, hedef sınavı, son ölçüm ve gelişim grafiği, güçlü ve zayıf konular (en fazla 5'er), son 5 test, bu haftanın planı ve defterdeki açık madde sayısı. Soru, cevap, çözüm, e-posta ve soyadı görünmüyor.",
        neden:
          "Kullanıcıların çoğu 18 yaşından küçük ve bağlantıyı bilen herkes raporu görüyor; kapsamı genişletmek kolay, dağılmış bağlantılardan sonra daraltmak zor.",
        oneri: "Yalnızca genel tablo kalsın.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("genel", "Yalnızca genel tablo (şu an)", onerilen),
            secenek("ayrinti", "Genel tablo ve soru soru ayrıntı"),
            secenek("koc-notu", "Genel tablo ve koçun haftalık notu"),
          ],
        },
        oncelik: "normal",
      },
      {
        anahtar: "motivasyon.veli-sure",
        baslik: "Veli bağlantısının süresi",
        soru: "Veli bağlantısının geçerlilik seçenekleri uygun mu: 7, 30 ya da 90 gün, varsayılan 30?",
        simdi:
          "Öğrenci bağlantıyı profilinden açıyor ve WhatsApp'tan paylaşabiliyor. Aynı anda en fazla 3 etkin bağlantı olabiliyor; öğrenci istediği an bağlantıyı kaldırabiliyor.",
        neden: "Uzun süreli bağlantı bir kez paylaşılınca kimin elinde olduğu bilinmiyor; kısa süreli bağlantıyı da veli her ay yeniden istemek zorunda kalıyor.",
        oneri: "Kalsın.",
        cevap: { tur: "uygunMu" },
        oncelik: "normal",
      },
    ],
  },

  // ── 18 ─────────────────────────────────────────────────────
  {
    anahtar: "is",
    baslik: "İş ve fiyat (isteğe bağlı)",
    giris:
      "Bu bölümdeki kararlar iş kararı; son sözü ürünün sahibi söyleyecek. Yine de öğrenciyle ve veliyle her gün konuşan biri olarak görüşünüzü almak istiyoruz. Bu bölümü boş bırakabilirsiniz.",
    sorular: [
      {
        anahtar: "is.satis-bicimi",
        baslik: "Satış biçimi",
        soru: "Öğrenci check-up'ı nasıl satın alsın?",
        simdi:
          "Karar yok. Sistem iki biçimi de destekliyor: tek tek paket satın alma ya da bütün paketleri kapsayan süreli abonelik. Ödeme altyapısı henüz kurulmadı.",
        neden: "Satış biçimi, ücretsiz bırakılacak kısmı ve öğrencinin ilk deneyimini belirliyor.",
        oneri: "İlk test ücretsiz, sonrası abonelik: öğrenci ürünü tanıdıktan sonra karar veriyor.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("paket", "Tek seferlik paket alımı"),
            secenek("aylik", "Aylık abonelik"),
            secenek("donemlik", "Sınava kadar geçerli dönemlik abonelik"),
            secenek("ilk-ucretsiz", "İlk test ücretsiz, sonrası abonelik", onerilen),
          ],
        },
        oncelik: "sonra",
      },
      {
        anahtar: "is.fiyat",
        baslik: "Fiyat aralığı",
        soru: "Size göre veliler için makul bir aylık fiyat aralığı nedir?",
        simdi: "Fiyat belirlenmedi.",
        neden: "Öğrenci ve veli tarafındaki beklentiyi en iyi bilen kişilerden birisiniz.",
        oneri: "Bildiğiniz benzer ürünlerin fiyatlarını da yazarsanız çok yardımcı olur.",
        cevap: { tur: "metin", ipucu: "Aylık ya da dönemlik fiyat aralığı ve varsa karşılaştırdığınız ürünler." },
        oncelik: "sonra",
      },
      {
        anahtar: "is.kurum",
        baslik: "Kurumlara satış",
        soru: "Okul, dershane ya da etüt merkezlerine toplu satış düşünülsün mü?",
        simdi:
          "Sistem öğrencileri gruplayıp ödev vermeye hazır; ama kurum adına hesap, fatura ya da kurum yöneticisi gibi bir yapı yok.",
        neden: "Kurum satışı tek tek öğrenciye satıştan farklı bir panel ve fiyat gerektiriyor; erken bilinirse ona göre hazırlanırız.",
        oneri: "Önce bireysel satış; pilottan sonra bir kurumla küçük bir deneme.",
        cevap: {
          tur: "secenek",
          secenekler: [
            secenek("evet", "Evet, ilk aylarda"),
            secenek("sonra", "Önce bireysel, sonra kurum", onerilen),
            secenek("hayir", "Hayır"),
          ],
        },
        oncelik: "sonra",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Giriş ve kapanış
// ─────────────────────────────────────────────────────────────

const BOLUM_SAYISI = HOCA_BOLUMLERI.length;
const SORU_SAYISI = HOCA_BOLUMLERI.reduce((t, b) => t + b.sorular.length, 0);
const ACIL_SAYISI = HOCA_BOLUMLERI.reduce((t, b) => t + b.sorular.filter((s) => s.oncelik === "acil").length, 0);

/** Ekranın ve belgenin başındaki giriş paragrafları. */
export const HOCA_GIRIS: string[] = [
  "Merhaba hocam. Bu sayfada Matematik Check-up'ı öğrencilere açmadan önce sizin kararınızı bekleyen konular var. Sistemin büyük kısmı hazır: öğrenci kısa testler çözüyor, sonuç ekranında konu konu nerede olduğunu görüyor, haftalık bir plan alıyor ve yanlışlarını aralıklı tekrarla kapatıyor. Eksik olan, gerçek sorular ve bir öğretmenin vermesi gereken kararlar.",
  `Sorular ürünün bölümlerine göre sıralandı (${BOLUM_SAYISI} bölüm, ${SORU_SAYISI} soru). Her bölümün başında, o özelliğin öğrencinin ekranında ne yaptığını anlatan kısa bir giriş var. Her soruda sistemin şu an ne yaptığı, bunu neden sorduğumuz ve bizim önerimiz yazıyor.`,
  `Cevaplamak için çoğu zaman bir işaret yeter: 'Uygun', 'Değişsin' ya da seçeneklerden biri. Not yazmak isteğe bağlı; 'Değişsin' dediğinizde ya da seçeneklerde olmayan bir şey söylemek istediğinizde birkaç kelime yeterli. Acil işaretli ${ACIL_SAYISI} soruyu önce cevaplamanızı rica ederiz: pilot onlarsız başlayamıyor.`,
  "Cevap vermediğiniz soruda 'Şu an' yazan durum geçerli kalır; sistem o hâliyle çalışmaya devam eder. Yani hiçbir soru işi durdurmuyor; her cevap öğrenciye daha doğru bir şey söylememizi sağlıyor.",
  "Cevaplarınız doğrudan geliştiriciye gidiyor. Bir cevap sisteme işlendiğinde soru bu listede 'uygulandı' diye işaretleniyor; hangi kararınızın öğrenciye ulaştığını buradan görebilirsiniz.",
  "Kâğıt üzerinde çalışmayı tercih ederseniz aynı soruların Word belgesi de var: işaretleyip bize geri göndermeniz yeterli, cevapları buraya biz geçiririz.",
  "Anlaşılmayan bir soru ya da eklemek istediğiniz bir konu olursa bize yazın; sorunun altındaki not alanını da bunun için kullanabilirsiniz.",
];

/** Belgenin sonundaki kapanış paragrafı. */
export const HOCA_KAPANIS =
  "Teşekkürler. Cevaplarınız geldikçe sistemi güncelleyip her soruyu 'uygulandı' diye işaretleyeceğiz. Pilotun ilk haftalarından sonra, gerçek öğrenci cevaplarıyla bazı sayılara birlikte yeniden bakmak isteriz.";
