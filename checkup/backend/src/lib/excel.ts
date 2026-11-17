import ExcelJS from "exceljs";

/**
 * Excel'den soru içe aktarmanın dosya tarafı (checkup/API.md "Excel'den içe
 * aktarma"): başlık eşleme, hücreleri metne çevirme, şablon üretimi.
 * Veritabanı eşleme ve kurallar servis katmanında (servisler/ice-aktar.ts).
 *
 * Başlıklar büyük-küçük harf ve Türkçe karakter farkı gözetmeden eşleşir:
 * "Alt Kazanım", "ALT KAZANIM", "alt kazanim", "AltKazanım" aynıdır.
 */

export const SUTUNLAR = [
  { anahtar: "ders", baslik: "Ders" },
  { anahtar: "konu", baslik: "Konu" },
  { anahtar: "kazanim", baslik: "Kazanım" },
  { anahtar: "altKazanim", baslik: "Alt Kazanım" },
  { anahtar: "soru", baslik: "Soru" },
  { anahtar: "a", baslik: "A" },
  { anahtar: "b", baslik: "B" },
  { anahtar: "c", baslik: "C" },
  { anahtar: "d", baslik: "D" },
  { anahtar: "e", baslik: "E" },
  { anahtar: "dogru", baslik: "Doğru" },
  { anahtar: "cozum", baslik: "Çözüm" },
  { anahtar: "zorluk", baslik: "Zorluk", istege: true },
] as const;

export type SutunAnahtari = (typeof SUTUNLAR)[number]["anahtar"];
export type SatirDegerleri = Record<SutunAnahtari, string>;

export interface ExcelSatiri {
  /** Excel'deki satır numarası (başlık 1. satır). */
  satir: number;
  degerler: SatirDegerleri;
}

export const EN_FAZLA_SATIR = 2000;

/** Şablondaki örnek satırın soru metni; içe aktarmada bu metin reddedilir. */
export const ORNEK_SORU_METNI = "Örnek: $2x + 3 = 11$ ise $x$ kaçtır? (Bu satırı silip kendi sorularınızı yazın.)";

export class ExcelHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "ExcelHatasi";
  }
}

const TURKCE_KATLAMA: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Başlık eşleme anahtarı: Türkçe küçük harf, aksanlar katlanmış, harf/rakam dışı atılmış. */
export function baslikNormalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/i̇|[çğıöşüâîû]/g, (c) => TURKCE_KATLAMA[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Ağaç adı eşleme anahtarı: kenar boşlukları atılmış, iç boşluklar teke inmiş, Türkçe küçük harf. */
export function adNormalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** exceljs hücre değerini metne çevirir. */
export function hucreMetni(deger: ExcelJS.CellValue | undefined): string {
  if (deger === null || deger === undefined) return "";
  if (typeof deger === "string") return deger.replace(/\r\n?/g, "\n");
  // Türkçe ondalık: Excel'de sayı olarak saklanan 3,5 → "3,5"
  if (typeof deger === "number") return String(deger).replace(".", ",");
  if (typeof deger === "boolean") return deger ? "DOĞRU" : "YANLIŞ";
  if (deger instanceof Date) return deger.toISOString().slice(0, 10);
  if (typeof deger === "object") {
    if ("richText" in deger && Array.isArray(deger.richText)) return deger.richText.map((p) => p.text).join("").replace(/\r\n?/g, "\n");
    if ("formula" in deger || "sharedFormula" in deger) return hucreMetni((deger as { result?: ExcelJS.CellValue }).result);
    if ("text" in deger && typeof deger.text === "string") return deger.text;
    if ("error" in deger) return "";
  }
  return String(deger);
}

/** "Sorular" sayfasını (yoksa ilk sayfayı) okur; boş satırları atlar. */
export async function excelOku(dosya: Buffer): Promise<ExcelSatiri[]> {
  const kitap = new ExcelJS.Workbook();
  try {
    await kitap.xlsx.load(dosya as unknown as ArrayBuffer);
  } catch {
    throw new ExcelHatasi("Dosya okunamadı. .xlsx biçiminde bir Excel dosyası yükleyin (şablonu indirip kullanabilirsiniz).");
  }

  const sayfa = kitap.worksheets.find((s) => baslikNormalize(s.name) === "sorular") ?? kitap.worksheets[0];
  if (!sayfa) throw new ExcelHatasi("Dosyada sayfa yok.");

  const sutunNo = new Map<SutunAnahtari, number>();
  const anahtarlar = new Map<string, SutunAnahtari>(SUTUNLAR.map((s) => [baslikNormalize(s.baslik), s.anahtar]));
  sayfa.getRow(1).eachCell((hucre, no) => {
    const anahtar = anahtarlar.get(baslikNormalize(hucreMetni(hucre.value)));
    if (anahtar && !sutunNo.has(anahtar)) sutunNo.set(anahtar, no);
  });

  const eksik = SUTUNLAR.filter((s) => !("istege" in s && s.istege) && !sutunNo.has(s.anahtar)).map((s) => s.baslik);
  if (eksik.length) {
    throw new ExcelHatasi(`"${sayfa.name}" sayfasının ilk satırında şu sütunlar yok: ${eksik.join(", ")}. Şablondaki başlıkları kullanın.`);
  }

  const satirlar: ExcelSatiri[] = [];
  for (let no = 2; no <= sayfa.rowCount; no++) {
    const satir = sayfa.getRow(no);
    const degerler = {} as SatirDegerleri;
    let dolu = false;
    for (const s of SUTUNLAR) {
      const sutun = sutunNo.get(s.anahtar);
      const metin = sutun ? hucreMetni(satir.getCell(sutun).value) : "";
      degerler[s.anahtar] = metin;
      if (metin.trim()) dolu = true;
    }
    if (!dolu) continue;
    satirlar.push({ satir: no, degerler });
    if (satirlar.length > EN_FAZLA_SATIR) throw new ExcelHatasi(`Bir dosyada en fazla ${EN_FAZLA_SATIR} soru olabilir. Dosyayı bölün.`);
  }

  if (!satirlar.length) throw new ExcelHatasi("Dosyada soru satırı yok. Başlık satırının altına sorularınızı yazın.");
  return satirlar;
}

export interface AgacYolu {
  ders: string;
  konu: string;
  kazanimKod: string | null;
  kazanim: string;
  altKazanimKod: string | null;
  altKazanim: string;
}

/** İki sayfalı şablon: "Sorular" (başlık + örnek satır) ve "Konu Ağacı" (sınavın geçerli yolları). */
export async function sablonUret(p: { sinavAd: string; yollar: AgacYolu[] }): Promise<Buffer> {
  const kitap = new ExcelJS.Workbook();
  kitap.creator = "Koçum.Net Check-up";
  kitap.created = new Date();

  const sorular = kitap.addWorksheet("Sorular", { views: [{ state: "frozen", ySplit: 1 }] });
  sorular.columns = SUTUNLAR.map((s) => ({
    header: s.baslik,
    key: s.anahtar,
    width: s.anahtar === "soru" || s.anahtar === "cozum" ? 60 : s.anahtar.length <= 1 ? 14 : 24,
  }));
  const ilk = p.yollar[0];
  sorular.addRow({
    ders: ilk?.ders ?? "Sayısal",
    konu: ilk?.konu ?? "Denklemler",
    kazanim: ilk ? (ilk.kazanimKod ?? ilk.kazanim) : "Birinci dereceden denklemler",
    altKazanim: ilk ? (ilk.altKazanimKod ?? ilk.altKazanim) : "Tek bilinmeyenli denklem çözme",
    soru: ORNEK_SORU_METNI,
    a: "2",
    b: "3",
    c: "4",
    d: "5",
    e: "6",
    dogru: "C",
    cozum: "$2x = 11 - 3 = 8$, buradan $x = 4$ bulunur.",
    zorluk: 1,
  });
  const baslik = sorular.getRow(1);
  baslik.font = { bold: true };
  baslik.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF8" } };
  sorular.getColumn("soru").alignment = { wrapText: true, vertical: "top" };
  sorular.getColumn("cozum").alignment = { wrapText: true, vertical: "top" };

  const agac = kitap.addWorksheet("Konu Ağacı", { views: [{ state: "frozen", ySplit: 1 }] });
  agac.columns = [
    { header: "Ders", key: "ders", width: 22 },
    { header: "Konu", key: "konu", width: 30 },
    { header: "Kazanım Kodu", key: "kazanimKod", width: 16 },
    { header: "Kazanım", key: "kazanim", width: 40 },
    { header: "Alt Kazanım Kodu", key: "altKazanimKod", width: 18 },
    { header: "Alt Kazanım", key: "altKazanim", width: 40 },
  ];
  agac.getRow(1).font = { bold: true };
  for (const y of p.yollar) agac.addRow({ ...y, kazanimKod: y.kazanimKod ?? "", altKazanimKod: y.altKazanimKod ?? "" });
  if (!p.yollar.length) agac.addRow({ ders: `${p.sinavAd} sınavında henüz alt kazanıma kadar inen bir konu ağacı yok.` });

  const veri = await kitap.xlsx.writeBuffer();
  return Buffer.from(veri as ArrayBuffer);
}
