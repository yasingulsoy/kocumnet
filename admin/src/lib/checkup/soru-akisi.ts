/**
 * Soru giriş ve inceleme akışının saf kuralları — SUNUCU/İSTEMCİ ORTAK.
 *
 * Hiçbir sunucu API'si içermez ve yalnızca göreli import kullanır: soru
 * formu, yeni soru sayfası, inceleme kuyruğu ve eylemler aynı kuralı okur;
 * app/scripts/icerik-panel-test.mts dosyayı doğrudan yükleyip sınar.
 *
 * "Yayına hazır mı" kuralının kendisi burada DEĞİL: shared/question-readiness.ts
 * (app/lib'den kopya; parmak izi yüzünden istemciye alınamıyor).
 */
import { QUESTION_LEVELS, isExamScope } from "./format";

// ─────────────────────────────────────────────────────────────
// "Kaydet ve yenisini ekle"
// ─────────────────────────────────────────────────────────────

/**
 * Sonraki sorunun durumu: kaydedilen sorunun durumu TAŞINMAZ.
 *
 * Eskiden durum da taşınıyordu: yazar bir kez "Yayında" seçince arkasından
 * yazdığı her soru incelemeden geçmeden yayına giriyordu. Şimdi yeni soru
 * hep taslak ya da incelemede başlar: incelemeye gönderen (ya da yayına
 * alan, yani "bu soru bitti" diyen) yazarın sıradaki sorusu incelemeye,
 * gerisi taslağa. Yayın tek tek, kontrol listesine bakılarak seçilir.
 */
export function yenisininDurumu(kaydedilen: string): "DRAFT" | "REVIEW" {
  return kaydedilen === "REVIEW" || kaydedilen === "PUBLISHED" ? "REVIEW" : "DRAFT";
}

/**
 * Kaynağın sonraki soruya taşınan öneki: sondaki soru numarası atılır.
 * "2023 TYT / 12" → "2023 TYT / ", "Limit s.45" → "Limit s.", "özgün" → "özgün".
 * Yazar aynı kaynaktan art arda soru giriyor; yalnızca numarayı yazsın.
 */
export function kaynakOneki(kaynak: string): string {
  const k = kaynak.trimEnd();
  return /\d$/.test(k) ? k.replace(/\d+$/, "") : k;
}

/** Yeni soru formunun adresten alınan ön dolu alanları. */
export interface YeniSoruVarsayilanlari {
  topicId: string;
  level: string;
  objectiveId: string;
  difficulty: number;
  targetTimeSeconds: number;
  status: "DRAFT" | "REVIEW";
  examScopes: string[];
  sourceRef: string;
}

type Params = Record<string, string | string[] | undefined>;
const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/**
 * Yeni soru ekranının adres parametreleri: `konuId`, `kazanimId`, `seviye`,
 * `hedef` (virgüllü sınavlar), `zorluk`, `sure`, `durum`, `kaynak`.
 *
 * Hepsi isteğe bağlı ve hepsi doğrulanır (adres elle kurcalanabilir).
 * "Kaydet ve yenisini ekle" de Kazanımlar sayfasının "Bu kazanıma soru yaz"
 * bağlantısı da bu yoldan gelir. Kazanım verilip konu verilmediyse konu
 * kazanımdan alınır; başka konunun kazanımı düşer. Durum en fazla
 * İncelemede olur: adresten yayında soru açılmaz (bkz. yenisininDurumu).
 */
export function yeniSoruVarsayilanlari(
  sp: Params,
  bilinen: { konular: ReadonlySet<string>; kazanimKonusu: ReadonlyMap<string, string> }
): YeniSoruVarsayilanlari {
  const kazanimId = tek(sp.kazanimId);
  const kazanimKonusu = bilinen.kazanimKonusu.get(kazanimId);
  const istenenKonu = tek(sp.konuId) || kazanimKonusu || "";
  const konuId = bilinen.konular.has(istenenKonu) ? istenenKonu : "";
  const seviye = tek(sp.seviye);
  const zorluk = Number(tek(sp.zorluk));
  const sure = Number(tek(sp.sure));
  const durum = tek(sp.durum);
  return {
    topicId: konuId,
    level: (QUESTION_LEVELS as readonly string[]).includes(seviye) ? seviye : "",
    objectiveId: konuId && kazanimKonusu === konuId ? kazanimId : "",
    difficulty: Number.isInteger(zorluk) && zorluk >= 1 && zorluk <= 5 ? zorluk : 3,
    targetTimeSeconds: Number.isInteger(sure) && sure >= 10 && sure <= 600 ? sure : 75,
    status: durum ? yenisininDurumu(durum) : "DRAFT",
    examScopes: [...new Set(tek(sp.hedef).split(",").filter(isExamScope))],
    // Form aynı sınırla reddediyor (KAYNAK_SINIRI); öneki uzun gelirse kırpılır.
    sourceRef: tek(sp.kaynak).slice(0, 200),
  };
}

/** Adreste bir ön dolu alan var mı (yeni soru ekranının bilgi kutusu için). */
export function adrestenDoluMu(sp: Params): boolean {
  return ["konuId", "kazanimId", "seviye", "hedef"].some((k) => tek(sp[k]) !== "");
}

// ─────────────────────────────────────────────────────────────
// İnceleme kuyruğu
// ─────────────────────────────────────────────────────────────

/** Kuyruğun süzgeçleri: sınav, konu (kodu), yazan (personel kimliği). Başka bir şey taşınmaz. */
const KUYRUK_ANAHTARLARI = ["sinav", "konu", "yazan"] as const;

/** Ham sorgu dizesinden yalnızca kuyruk süzgeçleri (dönüş adresi elle kurcalanamasın). */
export function kuyrukSorgusu(raw: string | null | undefined): string {
  if (!raw) return "";
  const giris = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const cikis = new URLSearchParams();
  for (const k of KUYRUK_ANAHTARLARI) {
    const v = giris.get(k);
    if (v) cikis.set(k, v.slice(0, 100));
  }
  return cikis.toString();
}

/** İnceleme kuyruğunun adresi; `ek` (ör. sonra=<kimlik>) en sona. */
export function kuyrukAdresi(sorgu: string, ek?: Record<string, string>): string {
  const u = new URLSearchParams(kuyrukSorgusu(sorgu));
  for (const [k, v] of Object.entries(ek ?? {})) u.set(k, v);
  const s = u.toString();
  return "/checkup/sorular/incele" + (s ? "?" + s : "");
}

/** Personel damgasındaki kimlik: "ad@x.com (#12)" → "12". */
export function damgaKimligi(damga: string | null | undefined): string | null {
  return damga?.match(/\(#(\d+)\)$/)?.[1] ?? null;
}

/** Soruyu bu personel mi yazdı (damga kimliğiyle; e-posta değişse de tutar). */
export function kendiSorusuMu(createdByStaff: string | null | undefined, staffId: number): boolean {
  return damgaKimligi(createdByStaff) === String(staffId);
}

/**
 * Yazan kendi sorusunu onaylayabilir mi? Şimdilik EVET: pilotta içerik ekibi
 * küçük, engel konursa kuyruk tıkanır. İnceleme ekranı yalnızca "kendi sorun"
 * uyarısı gösterir. Hocaya sorulacak: "yazan kendi sorusunu onaylamasın"
 * derse bu false olur, Onayla düğmesi kendi sorusunda kapanır (sunucu da reddeder).
 */
export const KENDI_SORUSUNU_ONAYLAYABILIR = true;

// ─────────────────────────────────────────────────────────────
// Toplu yayın özeti
// ─────────────────────────────────────────────────────────────

/** Toplu yayına almada atlananların özeti (sunucu hazırlar, liste gösterir). */
export interface AtlamaOzeti {
  toplam: number;
  /** Eksik türüne göre: kısa ad, kaç soru, varsa listenin `eksik` süzgeci. */
  nedenler: { kod: string; etiket: string; sayi: number; suzgec: string | null }[];
  /** Süzgeci olmayan eksikler için soruların kendisi (en fazla 20). */
  sorular: { id: string; etiket: string }[];
}

/** "12 soru yayına alındı, 3 soru atlandı: çözüm yok (2), hata tipi eksik (1)." */
export function yayinOzeti(alinan: number, atlanan: AtlamaOzeti | null | undefined): string {
  const bas = alinan === 0 ? "Hiçbir soru yayına alınmadı" : alinan + " soru yayına alındı";
  if (!atlanan?.toplam) return bas + ".";
  return bas + ", " + atlanan.toplam + " soru atlandı: " + atlanan.nedenler.map((n) => n.etiket + " (" + n.sayi + ")").join(", ") + ".";
}

// ─────────────────────────────────────────────────────────────
// Formül düğmeleri ve imlece ekleme
// ─────────────────────────────────────────────────────────────

/**
 * Formül düğmesinin eklediği LaTeX: seçili metin `once` ile `sonra` arasına
 * girer. `sonra`daki ilk `{}` ikinci yer tutucudur (kesrin paydası).
 */
export interface FormulParcasi {
  ad: string;
  /** Düğmede görünen. */
  etiket: string;
  /** Üstüne gelince ve ekran okuyucuda. */
  baslik: string;
  once: string;
  sonra: string;
}

export const FORMUL_PARCALARI: readonly FormulParcasi[] = [
  { ad: "kesir", etiket: "a⁄b", baslik: "Kesir", once: "\\frac{", sonra: "}{}" },
  { ad: "kok", etiket: "√", baslik: "Karekök", once: "\\sqrt{", sonra: "}" },
  { ad: "us", etiket: "xⁿ", baslik: "Üs", once: "^{", sonra: "}" },
  { ad: "carpi", etiket: "·", baslik: "Çarpı", once: "\\cdot ", sonra: "" },
  { ad: "kucuk-esit", etiket: "≤", baslik: "Küçük eşit", once: "\\leq ", sonra: "" },
  { ad: "buyuk-esit", etiket: "≥", baslik: "Büyük eşit", once: "\\geq ", sonra: "" },
  { ad: "pi", etiket: "π", baslik: "Pi", once: "\\pi ", sonra: "" },
  { ad: "derece", etiket: "°", baslik: "Derece", once: "^{\\circ}", sonra: "" },
  { ad: "mutlak", etiket: "|x|", baslik: "Mutlak değer", once: "\\left|", sonra: "\\right|" },
];

/**
 * İmleç bir `$…$` ya da `$$…$$` formülünün içinde mi? Yazım biçiminde formül
 * paragrafı aşmaz (boş satır paragrafı kapatır), bu yüzden paragrafın başından
 * sayılır; `\$` (gerçek dolar işareti) sayılmaz.
 */
export function matematikIcinde(metin: string, konum: number): boolean {
  if (konum <= 0) return false;
  const paragraf = metin.lastIndexOf("\n\n", konum - 1);
  let satirIci = false;
  let blok = false;
  for (let i = paragraf === -1 ? 0 : paragraf + 2; i < konum; i++) {
    const c = metin[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c !== "$") continue;
    if (metin[i + 1] === "$" && i + 1 < konum) {
      blok = !blok;
      i += 1;
    } else {
      satirIci = !satirIci;
    }
  }
  return satirIci || blok;
}

/**
 * Formül parçasını imlecin yerine (seçim varsa onu sararak) ekler. İmleç
 * formülün dışındaysa parça `$…$` içine alınır, içindeyse olduğu gibi girer.
 * İmleç ilk yer tutucuya gider; seçim sarıldıysa ikinci yer tutucuya (kesrin
 * paydası) ya da parçanın sonuna.
 */
export function formulEkle(metin: string, bas: number, son: number, p: FormulParcasi): { metin: string; imlec: number } {
  const secili = metin.slice(bas, son);
  const icinde = matematikIcinde(metin, bas);
  const once = (icinde ? "" : "$") + p.once;
  const sonra = p.sonra + (icinde ? "" : "$");
  const yeni = metin.slice(0, bas) + once + secili + sonra + metin.slice(son);
  const govde = bas + once.length + secili.length;
  const ikinci = p.sonra.indexOf("{}");
  const imlec = !secili ? govde : ikinci !== -1 ? govde + ikinci + 1 : govde + p.sonra.length;
  return { metin: yeni, imlec };
}

/**
 * Tek başına satır olan bir parçayı (şekil `![alt](kimlik)`) imlecin yerine
 * ekler. Tek başına satır blok şekil olur; cümlenin ortasına düşerse satır içi
 * simgeye dönerdi, bu yüzden imleç satırın ortasındaysa satırın sonuna
 * kaydırılır. Öncesine ve sonrasına boş satır konur. `konum` null: alana hiç
 * girilmedi, sona eklenir.
 */
export function blokEkle(metin: string, konum: number | null, parca: string): { metin: string; imlec: number } {
  let k = konum === null ? metin.length : Math.min(Math.max(0, konum), metin.length);
  const satirBasi = metin.lastIndexOf("\n", k - 1) + 1;
  const satirSonu = metin.indexOf("\n", k);
  const sonu = satirSonu === -1 ? metin.length : satirSonu;
  if (k > satirBasi && metin.slice(k, sonu).trim()) k = sonu;
  const once = metin.slice(0, k).replace(/[ \t]+$/, "");
  const sonra = metin.slice(k).replace(/^[ \t]+/, "");
  const onEk = once.trim() === "" ? "" : once.endsWith("\n\n") ? "" : once.endsWith("\n") ? "\n" : "\n\n";
  const arkaEk = sonra.startsWith("\n\n") ? "" : sonra.startsWith("\n") ? "\n" : sonra ? "\n\n" : "\n";
  const bas = (once.trim() === "" ? "" : once) + onEk + parca;
  return { metin: bas + arkaEk + sonra, imlec: bas.length };
}
