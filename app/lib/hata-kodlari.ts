/**
 * Adresle taşınan hata: `?hata=<kod>` → sabit mesaj.
 *
 * Eskiden eylemler hatanın METNİNİ adrese yazıyordu (`/panel?hata=...`) ve
 * sayfa onu olduğu gibi kırmızı uyarı kutusunda gösteriyordu. Biri
 * öğrenciye "/panel?hata=Hesabın askıya alındı, şu numarayı ara" bağlantısı
 * gönderip sahte bir uyarıyı uygulamanın resmi uyarısı gibi gösterebilirdi.
 * Artık adreste yalnızca KOD var; sayfa kodu bu tablodan okur, bilinmeyen
 * kodu hiç göstermez. En kötü durumda biri aşağıdaki cümlelerden birini
 * gösterebilir.
 *
 * Eylem hata METNİNDEN kod çıkarırken (kontrolTestiHataKodu, seviyeliHataKodu)
 * tanımadığı metne genel kodu verir: metin değişirse öğrenci yine sabit, doğru
 * ama daha genel bir cümle görür. Saf modül; testi scripts/ekran-test.mts.
 */

export const HATA_MESAJLARI = {
  // Kontrol testi (lib/actions/plan.ts konuTekrarBaslat)
  "konu-secilmedi": "Hangi konuda test açılacağı anlaşılmadı. Sayfayı yenileyip tekrar dene.",
  "konu-yok": "Bu konu bulunamadı. Sayfayı yenileyip tekrar dene.",
  "tekrar-paketi-yok": "Bu sınav için kontrol testi henüz hazır değil.",
  "konu-sinav-disi": "Bu konu hedef sınavının konuları arasında değil. Kontrol testi yalnızca sınavındaki konularda açılır.",
  "konu-olculmedi": "Bu konuyu henüz ölçmedik. Önce bu konuyu içeren bir check-up çöz.",
  "tekrar-siniri": "Bugünlük kontrol testi hakkın doldu. Aradaki zamanı konuyu çalışmaya ayır, yarın ölçeriz.",
  "tekrar-sorusu-yetmiyor": "Bu konuda kontrol testi için şu an yeterli soru yok.",
  "tekrar-acilamadi": "Kontrol testi şu an açılamadı. Biraz sonra tekrar dene.",
  // Seviyeli check-up (lib/actions/levels.ts)
  "sinav-secilmedi": "Önce bir sınav seç.",
  "seviyeli-tanimsiz": "Bu sınav için seviyeli check-up henüz hazır değil.",
  "seviyeli-hazir-degil": "Seviyeli check-up'ın soru havuzu henüz hazır değil. İçerik tamamlanınca açılacak.",
  "erisim-yok": "Bu check-up için erişim hakkın yok.",
  "deneme-yok": "Bu seviyeli check-up bulunamadı.",
  "deneme-kapandi": "Bu seviyeli check-up kapandı.",
  "seviye-kapali": "Bu seviye henüz açılmadı.",
  "seviye-gecersiz": "Geçersiz seviye. Sayfayı yenileyip tekrar dene.",
  "yarim-asama": "Önce yarım kalan aşamayı bitirmelisin.",
  "seviye-cozuldu": "Bu seviyeyi bu denemede zaten çözdün. Sonucun karnende.",
  "havuz-yetmiyor": "Bu seviye için soru havuzu henüz yetmiyor. İçerik tamamlanınca açılacak.",
  "telafi-yok": "Bekleyen bir teyit turu yok.",
  "seviyeli-acilamadi": "Bu adım şu an açılamadı. Sayfayı yenileyip tekrar dene.",
} as const;

export type HataKodu = keyof typeof HATA_MESAJLARI;

export function hataKoduMu(kod: unknown): kod is HataKodu {
  return typeof kod === "string" && Object.prototype.hasOwnProperty.call(HATA_MESAJLARI, kod);
}

/**
 * Sayfanın `hata` parametresinden gösterilecek cümle. Bilinmeyen kod, dizi
 * (`?hata=a&hata=b`) ya da boş: null (hiçbir şey gösterilmez).
 */
export function hataMesaji(kod: string | string[] | undefined | null): string | null {
  return hataKoduMu(kod) ? HATA_MESAJLARI[kod] : null;
}

/** Kontrol testinin hata metninden kod (lib/checkup.ts startTopicRetest'in cümleleri). */
export function kontrolTestiHataKodu(mesaj: string): HataKodu {
  if (mesaj.includes("konu tekrar testi tanımlı değil")) return "tekrar-paketi-yok";
  if (mesaj.startsWith("Konu bulunamadı")) return "konu-yok";
  if (mesaj.includes("konuları arasında değil")) return "konu-sinav-disi";
  if (mesaj.includes("henüz ölçmedik")) return "konu-olculmedi";
  if (mesaj.includes("kontrol testi hakkın doldu")) return "tekrar-siniri";
  if (mesaj.includes("yeterli soru yok")) return "tekrar-sorusu-yetmiyor";
  return "tekrar-acilamadi";
}

/** Seviyeli check-up'ın hata metninden kod (lib/level-run.ts'in cümleleri). */
export function seviyeliHataKodu(mesaj: string): HataKodu {
  if (mesaj.includes("seviyeli check-up tanımlı değil")) return "seviyeli-tanimsiz";
  if (mesaj.includes("erişim hakkın yok")) return "erisim-yok";
  if (mesaj.includes("henüz hazır değil")) return "seviyeli-hazir-degil";
  if (mesaj.startsWith("Deneme bulunamadı")) return "deneme-yok";
  if (mesaj.includes("kapandı")) return "deneme-kapandi";
  if (mesaj.includes("henüz açılmadı")) return "seviye-kapali";
  if (mesaj.includes("yarım kalan aşamayı")) return "yarim-asama";
  if (mesaj.includes("zaten çözüldü")) return "seviye-cozuldu";
  if (mesaj.includes("havuz")) return "havuz-yetmiyor";
  if (mesaj.includes("telafi turu yok")) return "telafi-yok";
  return "seviyeli-acilamadi";
}

/**
 * Eylemden sonra dönülecek sayfa: yalnızca bu uygulamanın, bilinen bir
 * sayfasının GÖRELİ yolu. Başka site ("//kotu.site", "https://…"), ters
 * bölü ve bilinmeyen yollar /panel'e düşer: dönüş adresi formdan ya da
 * Referer'dan geliyor, ikisi de öğrencinin elinde değiştirilebilir.
 * Sorgu ve parça atılır (eski bir `hata` taşınmasın).
 */
const DONUS_YOLLARI = [/^\/panel$/, /^\/gelisim$/, /^\/defter$/, /^\/sonuc\/[A-Za-z0-9_-]{1,64}$/];

export function guvenliDonusYolu(ham: string | null | undefined, yedek = "/panel"): string {
  if (typeof ham !== "string" || ham.length === 0 || ham.length > 200) return yedek;
  // Tam adres (Referer) ise yalnızca yolu al; kökeni çağıran denetler.
  let yol = ham;
  if (!yol.startsWith("/")) {
    try {
      yol = new URL(yol).pathname;
    } catch {
      return yedek;
    }
  }
  if (yol.startsWith("//") || yol.includes("\\")) return yedek;
  yol = yol.split(/[?#]/)[0];
  return DONUS_YOLLARI.some((r) => r.test(yol)) ? yol : yedek;
}

/**
 * Uygulama içi yola hata kodu ekler: "/sonuc/abc" → "/sonuc/abc?hata=tekrar-siniri".
 * Yolu eylem kurar (ya da guvenliDonusYolu'ndan geçirir); burada denetlenmez.
 */
export function hataAdresi(yol: string, kod: HataKodu): string {
  return `${yol}?hata=${kod}`;
}
