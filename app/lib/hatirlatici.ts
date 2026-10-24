/**
 * Günlük hatırlatıcı: her gün aynı saatte tekrarlanan bir takvim etkinliği
 * (.ics, RFC 5545). Ana sayfadaki "Hatırlatıcı kur" kartı indirir
 * (app/hatirlatici/route.ts).
 *
 * Neden takvim, bildirim değil: tarayıcı bildirimi izin, servis çalışanı ve
 * sunucuda abonelik kaydı ister (kişisel veri). Takvim etkinliği telefonun
 * kendi takvimine düşer, uygulama kapalıyken de çalar ve hiçbir şey
 * saklamaz. Dosya HERKESE AYNI: ad, e-posta, kimlik yok; değişen tek şey
 * öğrencinin seçtiği saat.
 *
 * Saat Türkiye saati (TZID=Europe/Istanbul, dosyada VTIMEZONE tanımlı):
 * Türkiye 2016'dan beri yıl boyu UTC+3, yaz saati yok. Saf modül; testi
 * scripts/ekran-test.mts.
 */

export const HATIRLATICI_BASLIK = "10 dakika yanlış defteri";
/** Etkinliğin süresi (dakika): başlıktaki "10 dakika". */
export const HATIRLATICI_SURE_DK = 10;
/** Kartın önerdiği saat. */
export const VARSAYILAN_SAAT = "20:00";

const SAAT_KALIBI = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "20:30" → { saat: 20, dakika: 30 }. Biçim dışı, dizi ya da boşsa null. */
export function saatCoz(ham: unknown): { saat: number; dakika: number } | null {
  if (typeof ham !== "string") return null;
  const m = SAAT_KALIBI.exec(ham.trim());
  return m ? { saat: Number(m[1]), dakika: Number(m[2]) } : null;
}

const iki = (n: number) => String(n).padStart(2, "0");

/** Türkiye takvim günü "yyyymmdd". */
function trGun(an: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(an)
    .replace(/-/g, "");
}

/** Metin alanı kaçışı (RFC 5545 §3.3.11): ters bölü, noktalı virgül, virgül, satır sonu. */
function metin(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Satırı 75 sekizliği aşmadan katlar (RFC 5545 §3.1): devam satırı tek
 * boşlukla başlar. Türkçe harfler UTF-8'de iki bayt; harf ortadan bölünmez.
 */
const kodlayici = new TextEncoder();

function katla(satir: string): string {
  const parcalar: string[] = [];
  let parca = "";
  let bayt = 0;
  for (const harf of satir) {
    const b = kodlayici.encode(harf).length;
    // İlk satır 75, devam satırları baştaki boşlukla birlikte 75.
    const sinir = parcalar.length === 0 ? 75 : 74;
    if (bayt + b > sinir) {
      parcalar.push(parca);
      parca = "";
      bayt = 0;
    }
    parca += harf;
    bayt += b;
  }
  parcalar.push(parca);
  return parcalar.join("\r\n ");
}

/**
 * Takvim dosyası. `bugun`: etkinliğin ilk günü (Türkiye günü; geçmiş bir
 * saat olsa da takvim ertesi günden çalar). `adres`: uygulamanın kökü
 * (lib/site.ts appUrl), açıklamada ve URL alanında /panel.
 */
export function hatirlaticiTakvimi(g: { saat: number; dakika: number; bugun: Date; adres: string }): string {
  const gun = trGun(g.bugun);
  const bas = `${gun}T${iki(g.saat)}${iki(g.dakika)}00`;
  const panel = `${g.adres.replace(/\/$/, "")}/panel`;
  const host = (() => {
    try {
      return new URL(g.adres).host;
    } catch {
      return "checkup.kocum.net";
    }
  })();
  const satirlar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kocum.Net//Matematik Check-up//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Istanbul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:+03",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    // Aynı saat için aynı kimlik: dosya yeniden açılırsa takvim etkinliği çoğaltmaz, günceller.
    `UID:yanlis-defteri-${iki(g.saat)}${iki(g.dakika)}@${host}`,
    `DTSTAMP:${gun}T000000Z`,
    `DTSTART;TZID=Europe/Istanbul:${bas}`,
    // Bitiş DTEND değil DURATION: 23:55'te kurulan etkinlik gece yarısını aşınca tarih hesabı gerekmesin.
    `DURATION:PT${HATIRLATICI_SURE_DK}M`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${metin(HATIRLATICI_BASLIK)}`,
    `DESCRIPTION:${metin(`Bugünkü tekrarını çöz, yanlışlarına bir bak: ${panel}`)}`,
    `URL:${panel}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${metin(HATIRLATICI_BASLIK)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return satirlar.map(katla).join("\r\n") + "\r\n";
}
