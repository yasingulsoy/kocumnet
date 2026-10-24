/**
 * "Hocaya sorular" belgesi: panelin soru listesinden (admin/src/lib/checkup/hoca/sorular.ts)
 * depo kökündeki HOCAYA-SORULAR.md'yi üretir. Word belgesi bu Markdown'dan çıkıyor;
 * biçim o üreticinin anladığı kadar sade:
 *   `# Başlık`, `## N. Bölüm`, `**Soru N.M** — soru`, `- ` maddeler, `| … |` tablolar,
 *   her sorudan sonra `> Cevap:` kutusu, sonda "Teşekkürler." ile başlayan paragraf.
 *
 *   npx tsx scripts/hoca-belgesi.mts           → dosyayı yazar
 *   npx tsx scripts/hoca-belgesi.mts --check   → güncel değilse 1 ile çıkar (yazmaz)
 *
 * Statik import YOK, bilerek (scripts/deneme-panel-test.mts ile aynı gerekçe): app ayrı
 * derleniyor (Dokploy yalnızca app/ klasörünü görür) ve tip denetimi scripts/'i de
 * kapsıyor; admin'e statik import derlemeyi kırardı. Tipler bu yüzden burada AYNA:
 * admin/src/lib/checkup/hoca/tipler.ts değişirse burası da güncellenmeli. Dosya yoksa
 * betik atlanır; CI'da (CI tanımlıysa) bu bir HATADIR.
 *
 * İçerik denetimi (yasak kelimeler, anahtarlar, tablo uyumu): scripts/hoca-icerik-test.mts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ─────────────────────────────────────────────────────────────
// Tiplerin aynası (admin/src/lib/checkup/hoca/tipler.ts)
// ─────────────────────────────────────────────────────────────

export interface Secenek {
  deger: string;
  etiket: string;
  aciklama?: string;
  onerilen?: boolean;
}

export interface TabloSutunu {
  anahtar: string;
  baslik: string;
  tur: "metin" | "sayi" | "tarih";
  birim?: string;
  yardim?: string;
}

export interface TabloSatiri {
  anahtar: string;
  baslik: string;
  simdiki: Record<string, string | number | null>;
}

export type CevapAlani =
  | { tur: "uygunMu" }
  | { tur: "secenek"; secenekler: Secenek[]; cokluSecim?: boolean }
  | { tur: "sayi"; birim?: string; enAz?: number; enCok?: number; simdiki?: number }
  | { tur: "tablo"; sutunlar: TabloSutunu[]; satirlar: TabloSatiri[] }
  | { tur: "metin"; ipucu?: string };

export type Oncelik = "acil" | "normal" | "sonra";

export interface HocaSorusu {
  anahtar: string;
  baslik: string;
  soru: string;
  simdi?: string;
  neden?: string;
  ornek?: string;
  oneri?: string;
  cevap: CevapAlani;
  oncelik?: Oncelik;
}

export interface HocaBolumu {
  anahtar: string;
  baslik: string;
  giris?: string;
  sorular: HocaSorusu[];
}

export interface HocaVerisi {
  giris: string[];
  kapanis: string;
  bolumler: HocaBolumu[];
}

// ─────────────────────────────────────────────────────────────
// Yollar ve yükleme
// ─────────────────────────────────────────────────────────────

const BURASI = dirname(fileURLToPath(import.meta.url));

/** Soruların kaynağı (panel). */
export const SORULAR_YOLU = resolve(BURASI, "../../admin/src/lib/checkup/hoca/sorular.ts");

/** Üretilen belge (depo kökü). */
export const BELGE_YOLU = resolve(BURASI, "../../HOCAYA-SORULAR.md");

/**
 * Panel modülünü yükler. Modül yoksa: CI'da hata (orada depo bütün; yokluk bir yer
 * ya da ad değişikliği demek), yerelde null (çağıran "atlandı" der).
 */
export async function veriYukle(): Promise<HocaVerisi | null> {
  if (!existsSync(SORULAR_YOLU)) {
    if (process.env.CI) {
      throw new Error(
        "admin/src/lib/checkup/hoca/sorular.ts bulunamadı: CI'da hocaya sorular atlanamaz. " +
          "Dosya taşındıysa ya da adı değiştiyse app/scripts/hoca-belgesi.mts içindeki SORULAR_YOLU'nu güncelle."
      );
    }
    return null;
  }
  const m = (await import(pathToFileURL(SORULAR_YOLU).href)) as {
    HOCA_GIRIS?: unknown;
    HOCA_KAPANIS?: unknown;
    HOCA_BOLUMLERI?: unknown;
  };
  if (!Array.isArray(m.HOCA_GIRIS) || typeof m.HOCA_KAPANIS !== "string" || !Array.isArray(m.HOCA_BOLUMLERI)) {
    throw new Error("sorular.ts beklenen adları dışa vermiyor: HOCA_GIRIS, HOCA_KAPANIS, HOCA_BOLUMLERI.");
  }
  return {
    giris: m.HOCA_GIRIS as string[],
    kapanis: m.HOCA_KAPANIS,
    bolumler: m.HOCA_BOLUMLERI as HocaBolumu[],
  };
}

// ─────────────────────────────────────────────────────────────
// Belge
// ─────────────────────────────────────────────────────────────

export const BELGE_BASLIGI = "Özgür Hoca'ya sorular — Matematik Check-up";

/** Tablo hücresi: dikey çizgi kaçışlı, tek satır. */
function hucre(metin: string): string {
  return metin.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

/** Sayı Türkçe ondalıkla: 0,25. */
function sayiYaz(n: number): string {
  return String(n).replace(".", ",");
}

function degerYaz(v: string | number): string {
  return typeof v === "number" ? sayiYaz(v) : v;
}

function sutunBasligi(s: TabloSutunu): string {
  // "Soru sayısı (soru)" gibi tekrar olmasın: birim başlıkta geçiyorsa yazılmaz.
  const tekrar = s.birim && s.baslik.toLocaleLowerCase("tr-TR").includes(s.birim.toLocaleLowerCase("tr-TR"));
  if (s.birim && !tekrar) return `${s.baslik} (${s.birim})`;
  if (s.tur === "tarih") return `${s.baslik} (GG.AA.YYYY)`;
  return s.baslik;
}

function cevapSatirlari(c: CevapAlani): string[] {
  const out: string[] = [];
  switch (c.tur) {
    case "uygunMu":
      out.push("- ☐ Uygun", "- ☐ Değişsin", "");
      break;
    case "secenek":
      if (c.cokluSecim) out.push("Birden çok seçenek işaretleyebilirsiniz.", "");
      for (const s of c.secenekler) {
        // "… (şu an)" ile "(önerimiz)" yan yana iki parantez olmasın: "(şu an; önerimiz)".
        const etiket =
          s.onerilen && s.etiket.endsWith(" (şu an)") ? s.etiket.replace(/ \(şu an\)$/, " (şu an; önerimiz)") : s.etiket;
        const isaret = s.onerilen && etiket === s.etiket ? " (önerimiz)" : "";
        out.push(`- ☐ ${etiket}${s.aciklama ? ` — ${s.aciklama}` : ""}${isaret}`);
      }
      out.push("");
      break;
    case "sayi": {
      // Türkçede yüzde işareti sayının önünde: %55.
      const yaz = (n: string) => (c.birim === "%" ? `%${n}` : c.birim ? `${n} ${c.birim}` : n);
      const simdi = c.simdiki === undefined ? "belirlenmedi" : yaz(sayiYaz(c.simdiki));
      out.push(`Şu an: ${simdi}; sizin önerdiğiniz: ${yaz("____")}`, "");
      break;
    }
    case "tablo": {
      out.push(
        "Parantez içindeki değerler şu an sistemde olanlar. Değiştirmek istediğiniz hücreye yenisini yazın; boş hücreler doldurulacak.",
        ""
      );
      out.push(`|  | ${c.sutunlar.map((s) => hucre(sutunBasligi(s))).join(" | ")} |`);
      out.push(`| --- | ${c.sutunlar.map(() => "---").join(" | ")} |`);
      for (const r of c.satirlar) {
        const hucreler = c.sutunlar.map((s) => {
          const v = r.simdiki[s.anahtar];
          return v === null || v === undefined || v === "" ? " " : `(${hucre(degerYaz(v))})`;
        });
        out.push(`| ${hucre(r.baslik)} | ${hucreler.join(" | ")} |`);
      }
      out.push("");
      const yardimlar = c.sutunlar.filter((s) => s.yardim);
      if (yardimlar.length > 0) {
        for (const s of yardimlar) out.push(`- **${s.baslik}:** ${s.yardim}`);
        out.push("");
      }
      break;
    }
    case "metin":
      if (c.ipucu) out.push(`Cevabınızda: ${c.ipucu}`, "");
      break;
  }
  return out;
}

/** HOCAYA-SORULAR.md'nin tam metni (satır sonu \n, sonda tek boş satır). */
export function belgeMetni(v: HocaVerisi): string {
  const out: string[] = [`# ${BELGE_BASLIGI}`, ""];
  for (const p of v.giris) out.push(p, "");

  // Kâğıtta okuyan için: önce hangi sorular.
  const acil: string[] = [];
  v.bolumler.forEach((b, bi) =>
    b.sorular.forEach((s, si) => {
      if (s.oncelik === "acil") acil.push(`- Soru ${bi + 1}.${si + 1}: ${s.baslik}`);
    })
  );
  if (acil.length > 0) out.push("**Önce bunlar (acil):**", "", ...acil, "");

  v.bolumler.forEach((b, bi) => {
    out.push(`## ${bi + 1}. ${b.baslik}`, "");
    if (b.giris) out.push(b.giris, "");
    b.sorular.forEach((s, si) => {
      out.push(`**Soru ${bi + 1}.${si + 1}** — ${s.soru}`, "");
      if (s.simdi) out.push(`**Şu an:** ${s.simdi}`, "");
      if (s.neden) out.push(`**Neden soruyoruz:** ${s.neden}`, "");
      if (s.ornek) out.push(`**Örnek:** ${s.ornek}`, "");
      if (s.oneri) out.push(`**Önerimiz:** ${s.oneri}`, "");
      out.push(...cevapSatirlari(s.cevap));
      out.push("> Cevap:", "");
    });
  });

  out.push(v.kapanis, "");
  // Sonda tam bir satır sonu; fazladan boş satır yok.
  return out.join("\n").replace(/\n+$/, "") + "\n";
}

/** Diskteki belge `beklenen` ile aynı mı (satır sonları eşitlenerek). */
export function belgeGuncelMi(beklenen: string): boolean {
  if (!existsSync(BELGE_YOLU)) return false;
  return readFileSync(BELGE_YOLU, "utf8").replace(/\r\n/g, "\n") === beklenen;
}

// ─────────────────────────────────────────────────────────────
// Komut satırı
// ─────────────────────────────────────────────────────────────

async function main() {
  const kontrol = process.argv.includes("--check");
  let veri: HocaVerisi | null;
  try {
    veri = await veriYukle();
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  if (!veri) {
    console.log("admin/ yok (ayrı derleme ortamı): hocaya sorular belgesi atlandı.");
    return;
  }
  const metin = belgeMetni(veri);
  const soru = veri.bolumler.reduce((t, b) => t + b.sorular.length, 0);

  if (kontrol) {
    if (!belgeGuncelMi(metin)) {
      console.error("✗ HOCAYA-SORULAR.md güncel değil. Yeniden üret: (app/ içinde) npx tsx scripts/hoca-belgesi.mts");
      process.exit(1);
    }
    console.log(`✓ HOCAYA-SORULAR.md güncel (${veri.bolumler.length} bölüm, ${soru} soru).`);
    return;
  }

  writeFileSync(BELGE_YOLU, metin, "utf8");
  console.log(`✓ HOCAYA-SORULAR.md yazıldı (${veri.bolumler.length} bölüm, ${soru} soru).`);
}

/** Yalnızca doğrudan çalıştırılınca: içerik testi bu dosyayı içe aktarıyor. */
function dogrudanMi(): boolean {
  const calisan = process.argv[1];
  if (!calisan) return false;
  const a = resolve(fileURLToPath(import.meta.url));
  const b = resolve(calisan);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

if (dogrudanMi()) await main();
