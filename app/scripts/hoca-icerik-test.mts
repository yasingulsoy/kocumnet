import "./_koruma.mjs";
/**
 * "Hocaya sorular" içerik denetimi. Veritabanı istemez.
 *   npx tsx scripts/hoca-icerik-test.mts
 *
 * Sorular panelde duruyor (admin/src/lib/checkup/hoca/sorular.ts) ama okuyucusu
 * yazılımcı değil, matematik öğretmeni. Bu test iki şeyi korur:
 *  1. Yapı: anahtarlar kalıcı ve benzersiz ("bolum.kisa-ad"), seçenek değerleri ve
 *     tablo satır/sütun anahtarları benzersiz, tablodaki "şu an" değerleri sütunlarla
 *     uyumlu, her soruda soru, şu an, neden ve öneri dolu.
 *  2. Dil: hiçbir metinde yazılımcı terimi yok (dosya yolu, ters tırnak, İngilizce
 *     teknik kelimeler, büyük harfli iç adlar, "kod" kelimesi tek başına).
 * Ayrıca HOCAYA-SORULAR.md'nin bu veriden üretilmiş hâliyle aynı olduğunu denetler
 * (scripts/hoca-belgesi.mts --check ile aynı karşılaştırma).
 *
 * Panel modülü dinamik import'la yüklenir (scripts/deneme-panel-test.mts ile aynı
 * gerekçe); dosya yoksa test atlanır, CI'da (CI tanımlıysa) bu bir HATADIR.
 */
import { belgeGuncelMi, belgeMetni, veriYukle, type HocaVerisi } from "./hoca-belgesi.mjs";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

let veri: HocaVerisi | null;
try {
  veri = await veriYukle();
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
if (!veri) {
  console.log("admin/ yok (ayrı derleme ortamı): hocaya sorular içerik testi atlandı.");
  process.exit(0);
}
const v = veri;

const KISA_AD = "[a-z0-9]+(?:-[a-z0-9]+)*";
const BOLUM_ANAHTARI = new RegExp(`^${KISA_AD}$`);
const SORU_ANAHTARI = new RegExp(`^(${KISA_AD})\\.(${KISA_AD})$`);
const DEGER = new RegExp(`^${KISA_AD}$`);
const TARIH = /^\d{2}\.\d{2}\.\d{4}$/;
const ONCELIKLER = new Set(["acil", "normal", "sonra"]);

const dolu = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const tekrarlar = (l: readonly string[]) => [...new Set(l.filter((x, i) => l.indexOf(x) !== i))];

const sorular = v.bolumler.flatMap((b) => b.sorular.map((s) => ({ b, s })));

// ─────────────────────────────────────────────────────────────
console.log("\nGiriş ve kapanış:");
{
  check("giriş 4-7 paragraf", v.giris.length >= 4 && v.giris.length <= 7, `${v.giris.length} paragraf`);
  check("giriş paragraflarının hepsi dolu", v.giris.every(dolu));
  check("kapanış 'Teşekkürler.' ile başlıyor", v.kapanis.startsWith("Teşekkürler."));
  check("'hocam' hitabı girişin ilk paragrafında", /hocam/i.test(v.giris[0] ?? ""));
}

// ─────────────────────────────────────────────────────────────
console.log("\nBölümler:");
{
  const anahtarlar = v.bolumler.map((b) => b.anahtar);
  const bozuk = anahtarlar.filter((a) => !BOLUM_ANAHTARI.test(a));
  check("bölüm anahtarları küçük harf, rakam ve tire", bozuk.length === 0, bozuk.join(", "));
  const cift = tekrarlar(anahtarlar);
  check("bölüm anahtarları benzersiz", cift.length === 0, cift.join(", "));
  const bos = v.bolumler.filter((b) => !dolu(b.baslik) || !dolu(b.giris) || b.sorular.length === 0);
  check("her bölümün başlığı, girişi ve en az bir sorusu var", bos.length === 0, bos.map((b) => b.anahtar).join(", "));
  // Giriş 2-5 cümle: nokta, soru ve ünlem işaretiyle biten parçalar (kaba ama yeter).
  const cumle = (s: string) => s.split(/[.!?](?:\s|$)/).filter((p) => p.trim().length > 0).length;
  const uzun = v.bolumler.filter((b) => b.giris && (cumle(b.giris) < 2 || cumle(b.giris) > 5));
  check("bölüm girişleri 2-5 cümle", uzun.length === 0, uzun.map((b) => `${b.anahtar} (${cumle(b.giris!)})`).join(", "));
}

// ─────────────────────────────────────────────────────────────
console.log("\nSorular:");
{
  const anahtarlar = sorular.map(({ s }) => s.anahtar);
  const cift = tekrarlar(anahtarlar);
  check("soru anahtarları benzersiz", cift.length === 0, cift.join(", "));

  const bicim = sorular.filter(({ s }) => !SORU_ANAHTARI.test(s.anahtar)).map(({ s }) => s.anahtar);
  check("soru anahtarları 'bolum.kisa-ad' biçiminde", bicim.length === 0, bicim.join(", "));

  const yanlisBolum = sorular
    .filter(({ b, s }) => SORU_ANAHTARI.exec(s.anahtar)?.[1] !== b.anahtar)
    .map(({ s }) => s.anahtar);
  check("soru anahtarının ilk parçası bölümün anahtarı", yanlisBolum.length === 0, yanlisBolum.join(", "));

  const eksik = (alan: "baslik" | "soru" | "simdi" | "neden" | "oneri") =>
    sorular.filter(({ s }) => !dolu(s[alan])).map(({ s }) => s.anahtar);
  for (const alan of ["baslik", "soru", "simdi", "neden", "oneri"] as const) {
    const l = eksik(alan);
    check(`her soruda '${alan}' dolu`, l.length === 0, l.join(", "));
  }

  const oncelik = sorular.filter(({ s }) => s.oncelik !== undefined && !ONCELIKLER.has(s.oncelik));
  check("öncelikler acil, normal ya da sonra", oncelik.length === 0, oncelik.map(({ s }) => s.anahtar).join(", "));

  const acil = sorular.filter(({ s }) => s.oncelik === "acil").length;
  check("acil soru az (en fazla 12)", acil > 0 && acil <= 12, `${acil} acil`);
  console.log(`    (${v.bolumler.length} bölüm, ${sorular.length} soru, ${acil} acil)`);
}

// ─────────────────────────────────────────────────────────────
console.log("\nCevap alanları:");
{
  const hatalar: string[] = [];
  for (const { s } of sorular) {
    const c = s.cevap;
    const yer = s.anahtar;
    switch (c.tur) {
      case "uygunMu":
        break;
      case "secenek": {
        if (c.secenekler.length < 2) hatalar.push(`${yer}: en az iki seçenek olmalı`);
        const degerler = c.secenekler.map((x) => x.deger);
        const cift = tekrarlar(degerler);
        if (cift.length) hatalar.push(`${yer}: seçenek değeri tekrar ediyor (${cift.join(", ")})`);
        const bozuk = degerler.filter((d) => !DEGER.test(d));
        if (bozuk.length) hatalar.push(`${yer}: seçenek değeri biçimsiz (${bozuk.join(", ")})`);
        if (c.secenekler.some((x) => !dolu(x.etiket))) hatalar.push(`${yer}: boş seçenek etiketi`);
        if (!c.cokluSecim && c.secenekler.filter((x) => x.onerilen).length > 2) {
          hatalar.push(`${yer}: tek seçimli soruda ikiden fazla önerilen seçenek`);
        }
        break;
      }
      case "sayi": {
        if (c.enAz !== undefined && c.enCok !== undefined && c.enAz > c.enCok) hatalar.push(`${yer}: enAz > enCok`);
        if (c.simdiki !== undefined) {
          if (!Number.isFinite(c.simdiki)) hatalar.push(`${yer}: şu anki değer sayı değil`);
          if (c.enAz !== undefined && c.simdiki < c.enAz) hatalar.push(`${yer}: şu anki değer enAz'ın altında`);
          if (c.enCok !== undefined && c.simdiki > c.enCok) hatalar.push(`${yer}: şu anki değer enCok'un üstünde`);
        }
        break;
      }
      case "tablo": {
        if (c.sutunlar.length === 0 || c.satirlar.length === 0) hatalar.push(`${yer}: tablo boş`);
        const sutunlar = c.sutunlar.map((x) => x.anahtar);
        const satirlar = c.satirlar.map((x) => x.anahtar);
        const cs = tekrarlar(sutunlar);
        const cr = tekrarlar(satirlar);
        if (cs.length) hatalar.push(`${yer}: sütun anahtarı tekrar ediyor (${cs.join(", ")})`);
        if (cr.length) hatalar.push(`${yer}: satır anahtarı tekrar ediyor (${cr.join(", ")})`);
        const bozuk = [...sutunlar, ...satirlar].filter((d) => !DEGER.test(d));
        if (bozuk.length) hatalar.push(`${yer}: tablo anahtarı biçimsiz (${bozuk.join(", ")})`);
        const tur = new Map(c.sutunlar.map((x) => [x.anahtar, x.tur]));
        for (const r of c.satirlar) {
          const anahtarlar = Object.keys(r.simdiki);
          const fazla = anahtarlar.filter((k) => !tur.has(k));
          if (fazla.length) hatalar.push(`${yer}/${r.anahtar}: sütunlarda olmayan değer (${fazla.join(", ")})`);
          const eksik = sutunlar.filter((k) => !(k in r.simdiki));
          if (eksik.length) hatalar.push(`${yer}/${r.anahtar}: sütunun değeri yazılmamış, boşsa null yaz (${eksik.join(", ")})`);
          for (const [k, deger] of Object.entries(r.simdiki)) {
            if (deger === null) continue;
            const t = tur.get(k);
            if (t === "sayi" && (typeof deger !== "number" || !Number.isFinite(deger))) {
              hatalar.push(`${yer}/${r.anahtar}.${k}: sayı sütununda sayı olmayan değer`);
            }
            if (t === "tarih" && (typeof deger !== "string" || !TARIH.test(deger))) {
              hatalar.push(`${yer}/${r.anahtar}.${k}: tarih GG.AA.YYYY olmalı`);
            }
            if (t === "metin" && typeof deger !== "string") hatalar.push(`${yer}/${r.anahtar}.${k}: metin sütununda sayı`);
          }
        }
        break;
      }
      case "metin":
        break;
      default:
        hatalar.push(`${yer}: bilinmeyen cevap türü`);
    }
  }
  check("seçenek, sayı ve tablo alanları tutarlı", hatalar.length === 0, hatalar.slice(0, 8).join(" · "));
  for (const h of hatalar.slice(8)) console.log(`      ${h}`);
}

// ─────────────────────────────────────────────────────────────
console.log("\nDil (yazılımcı terimi yok):");

/** Hocanın göreceği bütün metinler, yerleriyle. */
function metinler(): { yer: string; metin: string }[] {
  const out: { yer: string; metin: string }[] = [];
  const ekle = (yer: string, metin: string | undefined) => {
    if (typeof metin === "string") out.push({ yer, metin });
  };
  v.giris.forEach((p, i) => ekle(`giriş ${i + 1}`, p));
  ekle("kapanış", v.kapanis);
  for (const b of v.bolumler) {
    ekle(`${b.anahtar} başlık`, b.baslik);
    ekle(`${b.anahtar} giriş`, b.giris);
    for (const s of b.sorular) {
      for (const alan of ["baslik", "soru", "simdi", "neden", "ornek", "oneri"] as const) ekle(`${s.anahtar}.${alan}`, s[alan]);
      const c = s.cevap;
      if (c.tur === "secenek") {
        for (const x of c.secenekler) {
          ekle(`${s.anahtar}/${x.deger}`, x.etiket);
          ekle(`${s.anahtar}/${x.deger}`, x.aciklama);
        }
      } else if (c.tur === "sayi") {
        ekle(`${s.anahtar} birim`, c.birim);
      } else if (c.tur === "metin") {
        ekle(`${s.anahtar} ipucu`, c.ipucu);
      } else if (c.tur === "tablo") {
        for (const x of c.sutunlar) {
          ekle(`${s.anahtar}/${x.anahtar}`, x.baslik);
          ekle(`${s.anahtar}/${x.anahtar}`, x.birim);
          ekle(`${s.anahtar}/${x.anahtar}`, x.yardim);
        }
        for (const r of c.satirlar) {
          ekle(`${s.anahtar}/${r.anahtar}`, r.baslik);
          for (const [k, deger] of Object.entries(r.simdiki)) {
            if (typeof deger === "string") ekle(`${s.anahtar}/${r.anahtar}.${k}`, deger);
          }
        }
      }
    }
  }
  return out;
}

/** Türkçe harfler: "kod" kelimesini "kodu", "kodla" içinden ayırmak için. */
const H = "A-Za-zÇĞİÖŞÜÂÎÛçğıöşüâîû";
const kelime = (k: string, bayrak = "i") => new RegExp(`(^|[^${H}])${k}($|[^${H}])`, bayrak);

const YASAK: { ad: string; desen: RegExp }[] = [
  { ad: "dosya yolu", desen: /(^|[^A-Za-z])(lib|app|admin|scripts|components|prisma|src)\// },
  { ad: ".ts / .tsx / .mts", desen: /\.(m?ts|tsx|mjs|js|json)\b/ },
  { ad: "ters tırnak", desen: /`/ },
  { ad: "migration", desen: /migration/i },
  { ad: "cron", desen: kelime("cron") },
  { ad: "seed", desen: kelime("seed") },
  { ad: "tohum", desen: new RegExp(`(^|[^${H}])tohum`, "i") },
  { ad: "prisma", desen: /prisma/i },
  { ad: "API", desen: kelime("API", "") },
  { ad: "JSON", desen: /json/i },
  { ad: "schema", desen: /schema/i },
  { ad: "şema", desen: /şema|Şema/ },
  { ad: "PUBLISHED", desen: /PUBLISHED/ },
  { ad: "DRAFT", desen: /DRAFT/ },
  { ad: "sessionId", desen: /sessionId/i },
  { ad: "kod (tek başına)", desen: kelime("kod(da|dan|lama|lamak)?") },
  { ad: "veritabanı", desen: /veritaban/i },
  { ad: "sunucu", desen: /sunucu/i },
  { ad: "backend / frontend", desen: /backend|frontend/i },
  { ad: "commit / deploy", desen: /commit|deploy/i },
  { ad: "endpoint", desen: /endpoint/i },
  { ad: "enum", desen: kelime("enum") },
  { ad: "slug", desen: kelime("slug") },
  { ad: "typescript", desen: /typescript/i },
  { ad: "npm / npx / tsx", desen: kelime("(npm|npx|tsx)") },
  { ad: "localStorage / cache / cookie", desen: /localstorage|cache|cookie|çerez/i },
  { ad: "markdown", desen: /markdown/i },
  { ad: "URL", desen: kelime("URL", "") },
  { ad: "token / jeton", desen: /token|jeton/i },
  { ad: "SQL", desen: kelime("SQL", "") },
  { ad: "admin", desen: kelime("admin") },
  { ad: "bug", desen: kelime("bug") },
  { ad: "string / boolean / null", desen: kelime("(string|boolean|null|undefined)") },
  { ad: "büyük harfli iç ad (ISLEM_HATASI)", desen: /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/ },
  { ad: "camelCase iç ad (isFree)", desen: /\b[a-z]+[A-Z][A-Za-z]*\b/ },
];

{
  const bulunan: string[] = [];
  for (const { yer, metin } of metinler()) {
    for (const y of YASAK) {
      const m = y.desen.exec(metin);
      if (m) bulunan.push(`${yer}: ${y.ad} ("${m[0].trim()}")`);
    }
  }
  check("hiçbir metinde yasak terim yok", bulunan.length === 0, bulunan.slice(0, 6).join(" · "));
  for (const b of bulunan.slice(6)) console.log(`      ${b}`);

  // "hocam" hitabı yalnızca girişte.
  const hitap = metinler().filter(({ yer, metin }) => !yer.startsWith("giriş") && /hocam/i.test(metin));
  check("'hocam' hitabı yalnızca girişte", hitap.length === 0, hitap.map((x) => x.yer).join(", "));
}

// ─────────────────────────────────────────────────────────────
console.log("\nBelge:");
{
  check(
    "HOCAYA-SORULAR.md güncel",
    belgeGuncelMi(belgeMetni(v)),
    "güncel değilse: (app/ içinde) npx tsx scripts/hoca-belgesi.mts"
  );
}

console.log(failed === 0 ? "\nTamam.\n" : `\n${failed} denetim başarısız.\n`);
process.exit(failed === 0 ? 0 : 1);
