import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { loadItemAnalysis } from "@/lib/checkup/item-analysis";
import { gorunenR, onerilenZorluk } from "@/lib/checkup/item-flags";
import { analizListesi, analizSuzgeci } from "@/lib/checkup/item-list";
import { QUESTION_LEVEL_LABEL, QUESTION_STATUS_LABEL, examLabel } from "@/lib/checkup/format";

/**
 * Madde analizi CSV — ekrandaki listenin aynısı (aynı süzgeç ve sıralama,
 * bütün sayfalar). Öğrenci verisi yok; bütün personel indirebilir.
 *
 * Biçim Türkçe Excel'e göre: ayraç `;`, ondalık virgül, UTF-8 BOM (yoksa
 * ğ/ş/ı bozuk açılıyor). Metin hücreleri `= + - @` ile başlıyorsa başına `'`
 * eklenir: soru metni "=..." diye başlayan bir hücre Excel'de formül olarak
 * çalışırdı (CSV enjeksiyonu).
 */
export async function GET(req: Request) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) {
    return new Response("Yetkisiz", {
      status: gate.reason === "unreachable" ? 503 : 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const url = new URL(req.url);
  const s = analizSuzgeci(Object.fromEntries(url.searchParams));
  const liste = analizListesi(await loadItemAnalysis({ sinav: s.sinav, gun: s.gun }), s);

  const sayi = (x: number | null, basamak = 2) => (x === null ? "" : x.toFixed(basamak).replace(".", ","));
  const metin = (x: string) => {
    const guvenli = /^[=+\-@\t\r]/.test(x) ? "'" + x : x;
    return /[;"\r\n]/.test(guvenli) ? '"' + guvenli.replace(/"/g, '""') + '"' : guvenli;
  };

  const baslik = [
    "Kimlik",
    "Kısa kimlik",
    "Sınav (konu)",
    "Konu",
    "Durum",
    "Sürüm",
    "Seviye",
    "Zorluk (etiket)",
    "Zorluk (gözlenen)",
    "Cevap",
    "Doğru oranı",
    "Ayırt edicilik",
    "Boş oranı",
    "Medyan süre (sn)",
    "Hedef süre (sn)",
    "Doğru şık",
    "A",
    "B",
    "C",
    "D",
    "E",
    "Bulgular",
    "Soru metni",
  ];

  const satirlar = liste.map((x) => {
    const sik = (harf: string) => {
      const c = x.choices.find((ch) => ch.label === harf);
      return c ? String(c.count) : "";
    };
    return [
      metin(x.questionId),
      metin("#" + x.questionId.slice(-6)),
      metin(examLabel(x.examScope)),
      metin(x.topicName),
      metin(QUESTION_STATUS_LABEL[x.status] ?? x.status),
      String(x.version),
      metin(x.level ? (QUESTION_LEVEL_LABEL[x.level] ?? x.level) : ""),
      String(x.difficulty),
      String(onerilenZorluk(x.p)),
      String(x.n),
      sayi(x.p),
      sayi(gorunenR(x)),
      sayi(x.blank / x.n),
      x.medianMs === null ? "" : String(Math.round(x.medianMs / 1000)),
      String(x.targetTimeSeconds),
      x.choices.find((c) => c.isCorrect)?.label ?? "",
      sik("A"),
      sik("B"),
      sik("C"),
      sik("D"),
      sik("E"),
      metin(x.bulgular.map((b) => b.baslik).join(", ")),
      metin(x.stemText.slice(0, 300)),
    ].join(";");
  });

  const tarih = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const ek = [s.sinav ? s.sinav.toLowerCase() : null, s.gun ? s.gun + "-gun" : null].filter(Boolean).join("-");
  const dosya = "madde-analizi-" + tarih + (ek ? "-" + ek : "") + ".csv";

  return new Response("\uFEFF" + [baslik.join(";"), ...satirlar].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + dosya + '"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
