/**
 * SORU-SABLONU.md (v3) biçimindeki markdown dosyasını veritabanına aktarır.
 *
 *   npx tsx scripts/import-questions.mts <dosya.md>                 → yalnızca DENETLE (yazmaz)
 *   npx tsx scripts/import-questions.mts <dosya.md> --uygula         → taslak olarak kaydet
 *   npx tsx scripts/import-questions.mts <dosya.md> --uygula --yayinla   → doğrudan yayına al
 *   npx tsx scripts/import-questions.mts --geri-al <batchId>         → bir içe aktarmayı geri al
 *
 * Seçenekler:
 *   --personel "ad@kocum.net (#3)"   kayıtlara yazılacak personel damgası
 *
 * Kurallar SORU-SABLONU.md §9'dan: reddedilen soru satır numarasıyla raporlanır,
 * geri kalanı girer. Rapor: "42 soru alındı, 3 soru reddedildi".
 *
 * Tasarım:
 *  · Önce dosyanın TAMAMI çözümlenir ve denetlenir, sonra yazılır. Yarım
 *    içe aktarma yok: ya hepsi geçerli olanlar girer, ya hiçbiri.
 *  · Her içe aktarma bir ImportBatch kaydı açar; sorular ona bağlanır.
 *    `--geri-al` o partinin HİÇ ÇÖZÜLMEMİŞ sorularını siler (çözülmüş soru
 *    silinmez: öğrenci cevapları ona bağlı).
 *  · Kazanımlar koda göre bulunur; yoksa `Kazanım Adı` ile oluşturulur.
 *    İlk kullanımda ad zorunlu.
 *  · Görseller markdown'ın yanındaki gorseller/ dizininden okunur, MediaAsset
 *    olarak veritabanına yazılır, metindeki dosya adı kimlikle değiştirilir.
 */
import "dotenv/config";
import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { prisma } from "../lib/db";
import { ERROR_TYPES } from "../lib/error-types";
import { markupToContent } from "../lib/question-markup";
import {
  CHOICE_LABELS,
  deriveQuestionFields,
  safeParseQuestionContent,
  validateChoices,
  type ChoiceDraft,
  type QuestionContent,
} from "../lib/question-content";

// ─────────────────────────────────────────────────────────────
// Komut satırı
// ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const UYGULA = flag("--uygula");
const YAYINLA = flag("--yayinla");
const GERI_AL = opt("--geri-al");
const PERSONEL = opt("--personel") ?? "ice-aktarma (betik)";
const DOSYA = argv.find((a) => !a.startsWith("--") && a.endsWith(".md"));

const EXAM_SCOPES = ["LGS", "TYT", "AYT", "KPSS_LISANS", "KPSS_ONLISANS", "DGS", "ALES"] as const;
type Scope = (typeof EXAM_SCOPES)[number];
const LEVELS = { "1": "L1_TEMEL", "2": "L2_ORTA", "3": "L3_ANALIZ" } as const;

// ─────────────────────────────────────────────────────────────
// Çözümleme
// ─────────────────────────────────────────────────────────────

interface HamSoru {
  satir: number;
  baslik: string;
  alanlar: Record<string, string>;
  secenekler: { satir: number; isaretli: boolean; harf: string; metin: string; hataKodu: string | null; not: string | null }[];
}

/** `* **Alan:** değer` başlığını yakalar. Değer aynı satırda ya da sonraki satırlarda. */
const ALAN = /^\*\s+\*\*([^*]+?):\*\*\s*(.*)$/;
/** `  * [x] B) 18 (KOD: açıklama)` */
const SECENEK = /^\s*\*\s+\[( |x|X)\]\s+([A-E])\)\s*(.*)$/;
const HATA_KODU = /\(([A-Z_]+)(?::\s*([^)]*))?\)\s*$/;

/**
 * Alan adlarını ASCII anahtara indirger: "İdeal Süre" → "ideal sure",
 * "Doğru Şık" → "dogru sik". Türkçe yerel ayarla küçültmek TUZAK: "ID" →
 * "ıd" oluyor (noktasız ı) ve hiçbir anahtar eşleşmiyor. Aksanlar atılıp
 * yerelden bağımsız küçültülüyor; hoca "Ideal Sure" yazsa da eşleşir.
 */
const ad = (s: string) =>
  s
    .trim()
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function dosyayiCozumle(metin: string): HamSoru[] {
  const satirlar = metin.replace(/\r\n/g, "\n").split("\n");
  const sorular: HamSoru[] = [];
  let mevcut: HamSoru | null = null;
  let aktifAlan: string | null = null;
  let kodBlogu = false;

  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];

    // ```markdown ... ``` blokları (şablondaki örnek) atlanır — gerçek dosyada olmaz.
    if (s.trim().startsWith("```")) {
      kodBlogu = !kodBlogu;
      continue;
    }
    if (kodBlogu) continue;

    const baslik = s.match(/^###\s+(.+)$/);
    if (baslik) {
      mevcut = { satir: i + 1, baslik: baslik[1].trim(), alanlar: {}, secenekler: [] };
      sorular.push(mevcut);
      aktifAlan = null;
      continue;
    }
    if (!mevcut) continue;
    if (s.trim() === "---") {
      aktifAlan = null;
      continue;
    }

    const alan = s.match(ALAN);
    if (alan) {
      aktifAlan = ad(alan[1]);
      mevcut.alanlar[aktifAlan] = alan[2].trim();
      continue;
    }

    const sec = s.match(SECENEK);
    if (sec && aktifAlan === "secenekler") {
      let govde = sec[3].trim();
      let hataKodu: string | null = null;
      let not: string | null = null;
      const h = govde.match(HATA_KODU);
      if (h) {
        hataKodu = h[1];
        not = h[2]?.trim() || null;
        govde = govde.slice(0, h.index).trim();
      }
      mevcut.secenekler.push({ satir: i + 1, isaretli: sec[1].toLowerCase() === "x", harf: sec[2], metin: govde, hataKodu, not });
      continue;
    }

    // Çok satırlı alan devamı (soru metni, çözüm, kazanım adı…).
    if (aktifAlan && aktifAlan !== "secenekler") {
      mevcut.alanlar[aktifAlan] = (mevcut.alanlar[aktifAlan] + "\n" + s).replace(/^\n+/, "");
    }
  }

  for (const q of sorular) for (const k of Object.keys(q.alanlar)) q.alanlar[k] = q.alanlar[k].trim();
  return sorular;
}

// ─────────────────────────────────────────────────────────────
// Denetim
// ─────────────────────────────────────────────────────────────

interface Hata {
  satir: number;
  id: string;
  sebep: string;
}

interface HazirSoru {
  satir: number;
  id: string;
  topicId: string;
  topicSlug: string;
  stem: QuestionContent;
  stemText: string;
  fingerprint: string;
  solution: QuestionContent | null;
  drafts: ChoiceDraft[];
  errorTypes: (string | null)[];
  difficulty: number;
  targetTimeSeconds: number;
  level: (typeof LEVELS)[keyof typeof LEVELS] | null;
  kazanimKodu: string | null;
  kazanimAdi: string | null;
  examScopes: Scope[];
  sourceRef: string;
  gorseller: { dosya: string; alt: string }[];
}

interface Baglam {
  konular: Map<string, string>; // slug → id
  mevcutIdler: Set<string>;
  mevcutParmakIzleri: Set<string>;
  kazanimlar: Map<string, { id: string; topicId: string }>;
  gorselDizini: string;
}

function denetle(
  q: HamSoru,
  b: Baglam,
  dosyadakiIdler: Set<string>,
  dosyadakiParmakIzleri: Set<string>,
  dosyadakiKazanimlar: Map<string, string>
): HazirSoru | Hata {
  const a = q.alanlar;
  const id = a["id"] ?? "";
  const hata = (sebep: string): Hata => ({ satir: q.satir, id: id || q.baslik, sebep });

  if (!id) return hata("ID yok.");
  if (dosyadakiIdler.has(id)) return hata("Aynı ID dosyada iki kez geçiyor.");
  if (b.mevcutIdler.has(id)) return hata("Bu ID daha önce içe aktarılmış.");

  const slug = a["konu kodu"] ?? "";
  const topicId = b.konular.get(slug);
  if (!topicId) return hata(`Konu kodu listede yok: "${slug}".`);

  const zorluk = Number(a["zorluk"]);
  if (!Number.isInteger(zorluk) || zorluk < 1 || zorluk > 5) return hata(`Zorluk 1-5 arası olmalı (şu an "${a["zorluk"]}").`);

  const sure = Number(a["ideal sure"]);
  if (!Number.isInteger(sure) || sure < 10 || sure > 600) return hata(`İdeal Süre 10-600 arası tam sayı olmalı (şu an "${a["ideal sure"]}").`);

  const seviyeKodu = (a["seviye"] ?? "").trim();
  const level = seviyeKodu ? LEVELS[seviyeKodu as keyof typeof LEVELS] : null;
  if (seviyeKodu && !level) return hata(`Seviye 1, 2 veya 3 olmalı (şu an "${seviyeKodu}"). Parantezli açıklama yazma.`);

  const kazanimKodu = (a["kazanim kodu"] ?? "").trim().toUpperCase() || null;
  if (level === "L1_TEMEL" && !kazanimKodu) return hata("Seviye 1 sorusunda Kazanım Kodu zorunlu.");
  if ((level === "L2_ORTA" || level === "L3_ANALIZ") && kazanimKodu) return hata("Seviye 2 ve 3 sorusuna Kazanım Kodu yazılmaz.");
  const kazanimAdi = (a["kazanim adi"] ?? "").trim() || null;
  if (kazanimKodu) {
    const mevcutKazanim = b.kazanimlar.get(kazanimKodu);
    const dosyadaki = dosyadakiKazanimlar.get(kazanimKodu);
    if (mevcutKazanim && mevcutKazanim.topicId !== topicId) {
      return hata(`Kazanım "${kazanimKodu}" başka bir konuya ait.`);
    }
    if (dosyadaki && dosyadaki !== topicId) {
      return hata(`Kazanım "${kazanimKodu}" bu dosyada başka bir konuyla tanımlandı.`);
    }
    // Ad yalnızca İLK kullanımda gerekli: sistemde ya da bu dosyada daha önce
    // tanımlandıysa tekrar yazılmaz.
    if (!mevcutKazanim && !dosyadaki && !kazanimAdi) {
      return hata(`Kazanım "${kazanimKodu}" sistemde yok; ilk kullanımda Kazanım Adı yazılmalı.`);
    }
  }

  const sinavlar = (a["hedef sinav"] ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const s of sinavlar) {
    if (s === "ORTAK") return hata('Hedef Sınav: "ORTAK" diye bir değer yok; alanı boş bırak.');
    if (!(EXAM_SCOPES as readonly string[]).includes(s)) return hata(`Hedef Sınav kodu tanınmıyor: "${s}".`);
  }

  // Soru metni + görseller
  const stemMarkup = a["soru metni"] ?? "";
  if (!stemMarkup.trim()) return hata("Soru Metni boş.");
  const gorseller: HazirSoru["gorseller"] = [];
  for (const m of stemMarkup.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const [, alt, dosya] = m;
    if (!alt.trim()) return hata(`Görsel "${dosya}" için alternatif metin boş.`);
    const yol = join(b.gorselDizini, dosya);
    if (!existsSync(yol)) return hata(`Görsel dosyası bulunamadı: gorseller/${dosya}`);
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(extname(dosya).toLowerCase())) return hata(`Görsel PNG/JPG/WebP olmalı: ${dosya}`);
    gorseller.push({ dosya, alt: alt.trim() });
  }

  const stem = safeParseQuestionContent(markupToContent(stemMarkup));
  if (!stem.success) return hata("Soru metni çözümlenemedi.");
  const { stemText, fingerprint } = deriveQuestionFields(stem.data);
  if (dosyadakiParmakIzleri.has(fingerprint)) return hata("Aynı soru metni dosyada iki kez geçiyor.");
  if (b.mevcutParmakIzleri.has(fingerprint)) return hata("Bu soru metni havuzda zaten var (farklı ID ile).");

  // Şıklar
  if (q.secenekler.length < 4) return hata(`En az 4 şık gerekli (şu an ${q.secenekler.length}).`);
  const dogrular = q.secenekler.filter((s) => s.isaretli);
  if (dogrular.length === 0) return hata("Doğru şık işaretlenmemiş ([x]).");
  if (dogrular.length > 1) return hata(`Birden fazla doğru şık işaretli: ${dogrular.map((d) => d.harf).join(", ")}.`);
  const dogruSatir = (a["dogru sik"] ?? "").trim().toUpperCase();
  if (dogruSatir && dogruSatir !== dogrular[0].harf) {
    return hata(`[x] ${dogrular[0].harf} şıkkında ama "Doğru Şık" satırı ${dogruSatir} diyor — çelişki.`);
  }
  const errorTypes: (string | null)[] = [];
  for (const s of q.secenekler) {
    if (s.isaretli) {
      errorTypes.push(null);
      continue;
    }
    if (!s.hataKodu) return hata(`${s.harf} şıkkında hata kodu yok (satır ${s.satir}).`);
    if (!(ERROR_TYPES as readonly string[]).includes(s.hataKodu)) return hata(`${s.harf} şıkkındaki hata kodu listede yok: ${s.hataKodu}.`);
    errorTypes.push(s.hataKodu);
  }
  const drafts: ChoiceDraft[] = q.secenekler.map((s, i) => ({
    label: CHOICE_LABELS[i],
    content: markupToContent(s.metin),
    isCorrect: s.isaretli,
  }));
  if (q.secenekler.some((s, i) => s.harf !== CHOICE_LABELS[i])) return hata("Şık harfleri A, B, C, … sırasıyla gitmeli.");
  const sikHatalari = validateChoices(drafts);
  if (sikHatalari.length) return hata(sikHatalari.join(" "));

  let solution: QuestionContent | null = null;
  const cozum = a["cozum aciklamasi"] ?? "";
  if (cozum.trim()) {
    const p = safeParseQuestionContent(markupToContent(cozum));
    if (!p.success) return hata("Çözüm metni çözümlenemedi.");
    solution = p.data;
  }

  const kaynak = (a["kaynak"] ?? "").trim();
  return {
    satir: q.satir,
    id,
    topicId,
    topicSlug: slug,
    stem: stem.data,
    stemText,
    fingerprint,
    solution,
    drafts,
    errorTypes,
    difficulty: zorluk,
    targetTimeSeconds: sure,
    level: level ?? null,
    kazanimKodu,
    kazanimAdi,
    examScopes: sinavlar as Scope[],
    sourceRef: kaynak ? `${id} · ${kaynak}` : id,
    gorseller,
  };
}

// ─────────────────────────────────────────────────────────────
// Yazma
// ─────────────────────────────────────────────────────────────

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function uygula(hazir: HazirSoru[], hatalar: Hata[], dosyaAdi: string, b: Baglam) {
  const batch = await prisma.importBatch.create({
    data: {
      filename: dosyaAdi,
      format: "md",
      status: "PENDING",
      totalRows: hazir.length + hatalar.length,
      createdByStaff: PERSONEL,
    },
  });

  let yazilan = 0;
  const yeniKazanim: string[] = [];
  const gorselOnbellek = new Map<string, string>(); // dosya → mediaId

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const q of hazir) {
          // Kazanım: varsa bul, yoksa oluştur (yayında — içerik ekibinin listesi).
          let objectiveId: string | null = null;
          if (q.kazanimKodu) {
            const mevcut = b.kazanimlar.get(q.kazanimKodu);
            if (mevcut) {
              objectiveId = mevcut.id;
            } else {
              const adi = q.kazanimAdi ?? hazir.find((x) => x.kazanimKodu === q.kazanimKodu && x.kazanimAdi)?.kazanimAdi ?? q.kazanimKodu;
              const o = await tx.objective.create({
                data: { topicId: q.topicId, code: q.kazanimKodu, name: adi, status: "PUBLISHED", examScopes: q.examScopes },
                select: { id: true },
              });
              b.kazanimlar.set(q.kazanimKodu, { id: o.id, topicId: q.topicId });
              yeniKazanim.push(q.kazanimKodu);
              objectiveId = o.id;
            }
          }

          // Görseller: dosya adı → MediaAsset kimliği.
          let stem = q.stem;
          if (q.gorseller.length) {
            let markup = JSON.stringify(stem);
            for (const g of q.gorseller) {
              let mediaId = gorselOnbellek.get(g.dosya);
              if (!mediaId) {
                const yol = join(b.gorselDizini, g.dosya);
                const data = readFileSync(yol);
                const m = await tx.mediaAsset.create({
                  data: {
                    storageKey: `import/${batch.id}/${g.dosya}`,
                    mimeType: MIME[extname(g.dosya).toLowerCase()] ?? "application/octet-stream",
                    byteSize: statSync(yol).size,
                    data,
                    alt: g.alt,
                    uploadedByStaff: PERSONEL,
                  },
                  select: { id: true },
                });
                mediaId = m.id;
                gorselOnbellek.set(g.dosya, mediaId);
              }
              markup = markup.split(JSON.stringify(g.dosya).slice(1, -1)).join(mediaId);
            }
            stem = JSON.parse(markup) as QuestionContent;
          }

          await tx.question.create({
            data: {
              topicId: q.topicId,
              stem,
              stemText: q.stemText,
              fingerprint: q.fingerprint,
              solution: q.solution ?? undefined,
              difficulty: q.difficulty,
              targetTimeSeconds: q.targetTimeSeconds,
              status: YAYINLA ? "PUBLISHED" : "DRAFT",
              sourceRef: q.sourceRef,
              importBatchId: batch.id,
              examScopes: q.examScopes,
              level: q.level,
              objectiveId,
              createdByStaff: PERSONEL,
              updatedByStaff: PERSONEL,
              choices: {
                create: q.drafts.map((d, i) => ({
                  label: d.label,
                  content: d.content,
                  isCorrect: d.isCorrect,
                  errorType: (q.errorTypes[i] as never) ?? null,
                  sortOrder: i,
                })),
              },
            },
          });
          yazilan++;
        }
      },
      { timeout: 120_000 }
    );

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "DONE",
        createdCount: yazilan,
        skippedCount: hatalar.length,
        errors: hatalar.map((h) => ({ row: h.satir, reason: h.sebep, detail: h.id })),
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", errors: [{ row: 0, reason: (e as Error).message, detail: "transaction" }], completedAt: new Date() },
    });
    throw e;
  }

  return { batchId: batch.id, yazilan, yeniKazanim };
}

async function geriAl(batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, filename: true, createdCount: true, createdAt: true, completedAt: true },
  });
  if (!batch) throw new Error("Parti bulunamadı: " + batchId);

  const sorular = await prisma.question.findMany({
    where: { importBatchId: batchId },
    select: { id: true, _count: { select: { items: true } } },
  });
  const cozulmus = sorular.filter((s) => s._count.items > 0);
  const silinecek = sorular.filter((s) => s._count.items === 0).map((s) => s.id);

  if (silinecek.length) {
    await prisma.$transaction([
      prisma.choice.deleteMany({ where: { questionId: { in: silinecek } } }),
      prisma.question.deleteMany({ where: { id: { in: silinecek } } }),
    ]);
  }
  await prisma.mediaAsset.deleteMany({ where: { storageKey: { startsWith: `import/${batchId}/` } } });

  // Bu partiyle AÇILAN ve artık sorusu kalmayan kazanımlar da gider: parti
  // başlangıcı ile bitişi arasında oluşturulmuş, boş kalmış kazanımlar.
  const bitis = batch.completedAt ?? new Date();
  const bosKazanimlar = await prisma.objective.deleteMany({
    where: {
      createdAt: { gte: new Date(batch.createdAt.getTime() - 1000), lte: new Date(bitis.getTime() + 1000) },
      questions: { none: {} },
    },
  });
  if (bosKazanimlar.count) console.log(`Bu partiyle açılan ${bosKazanimlar.count} boş kazanım silindi.`);

  if (cozulmus.length === 0) await prisma.importBatch.delete({ where: { id: batchId } });
  else await prisma.importBatch.update({ where: { id: batchId }, data: { status: "REVERTED_PARTIAL" } });

  console.log(`Geri alındı: ${batch.filename} — ${silinecek.length} soru silindi` + (cozulmus.length ? `, ${cozulmus.length} soru öğrenciler çözdüğü için korundu (arşivle).` : "."));
}

// ─────────────────────────────────────────────────────────────
// Ana akış
// ─────────────────────────────────────────────────────────────

async function main() {
  if (GERI_AL) {
    await geriAl(GERI_AL);
    return;
  }
  if (!DOSYA) {
    console.error("Kullanım: npx tsx scripts/import-questions.mts <dosya.md> [--uygula] [--yayinla] [--personel \"ad (#id)\"]");
    process.exit(2);
  }
  const yol = resolve(DOSYA);
  const metin = readFileSync(yol, "utf8");
  const ham = dosyayiCozumle(metin);
  if (ham.length === 0) {
    console.error("Dosyada '### Soru …' başlığı bulunamadı.");
    process.exit(2);
  }

  const [konular, idler, kazanimlar] = await Promise.all([
    prisma.topic.findMany({ where: { children: { none: {} } }, select: { id: true, slug: true } }),
    prisma.question.findMany({ where: { sourceRef: { not: null } }, select: { sourceRef: true, fingerprint: true } }),
    prisma.objective.findMany({ select: { id: true, code: true, topicId: true } }),
  ]);

  const b: Baglam = {
    konular: new Map(konular.map((k) => [k.slug, k.id])),
    // sourceRef "ID · kaynak" biçiminde; ID kısmı karşılaştırılır.
    mevcutIdler: new Set(idler.map((q) => (q.sourceRef ?? "").split(" · ")[0]).filter(Boolean)),
    mevcutParmakIzleri: new Set(idler.map((q) => q.fingerprint)),
    kazanimlar: new Map(kazanimlar.map((k) => [k.code, { id: k.id, topicId: k.topicId }])),
    gorselDizini: join(dirname(yol), "gorseller"),
  };

  const hazir: HazirSoru[] = [];
  const hatalar: Hata[] = [];
  const dosyadakiIdler = new Set<string>();
  const dosyadakiParmakIzleri = new Set<string>();
  const dosyadakiKazanimlar = new Map<string, string>(); // kod → topicId

  for (const q of ham) {
    const r = denetle(q, b, dosyadakiIdler, dosyadakiParmakIzleri, dosyadakiKazanimlar);
    if ("sebep" in r) {
      hatalar.push(r);
    } else {
      hazir.push(r);
      dosyadakiIdler.add(r.id);
      dosyadakiParmakIzleri.add(r.fingerprint);
      if (r.kazanimKodu && !dosyadakiKazanimlar.has(r.kazanimKodu)) dosyadakiKazanimlar.set(r.kazanimKodu, r.topicId);
    }
  }

  // Uyarı: tek seviye-1 sorusu kalan kazanımlar (telafi turunda boş kalır).
  const l1Sayac = new Map<string, number>();
  for (const q of hazir) if (q.level === "L1_TEMEL" && q.kazanimKodu) l1Sayac.set(q.kazanimKodu, (l1Sayac.get(q.kazanimKodu) ?? 0) + 1);
  if (l1Sayac.size) {
    const mevcutL1 = await prisma.question.groupBy({
      by: ["objectiveId"],
      where: { level: "L1_TEMEL", objectiveId: { not: null } },
      _count: { _all: true },
    });
    const idToCode = new Map([...b.kazanimlar.entries()].map(([code, v]) => [v.id, code]));
    for (const r of mevcutL1) {
      const code = idToCode.get(r.objectiveId!);
      if (code && l1Sayac.has(code)) l1Sayac.set(code, (l1Sayac.get(code) ?? 0) + r._count._all);
    }
  }
  const tekSoruluKazanimlar = [...l1Sayac.entries()].filter(([, n]) => n < 2).map(([k]) => k);

  console.log(`\n${basename(yol)}: ${ham.length} soru bulundu`);
  console.log(`  ✓ ${hazir.length} soru geçerli`);
  console.log(`  ✗ ${hatalar.length} soru reddedildi`);
  for (const h of hatalar) console.log(`    satır ${h.satir} · ${h.id}: ${h.sebep}`);
  if (tekSoruluKazanimlar.length) {
    console.log(`  ⚠ Tek seviye-1 sorusu olan kazanımlar (telafi turunda boş kalır): ${tekSoruluKazanimlar.join(", ")}`);
  }

  if (!UYGULA) {
    console.log("\nYalnızca denetlendi, hiçbir şey yazılmadı. Kaydetmek için --uygula ekle.");
    return;
  }
  if (hazir.length === 0) {
    console.log("\nGeçerli soru yok, yazılacak bir şey yok.");
    return;
  }

  const sonuc = await uygula(hazir, hatalar, basename(yol), b);
  console.log(`\n${sonuc.yazilan} soru alındı (${YAYINLA ? "YAYINDA" : "taslak"}), ${hatalar.length} soru reddedildi.`);
  if (sonuc.yeniKazanim.length) console.log(`Yeni kazanımlar: ${sonuc.yeniKazanim.join(", ")}`);
  console.log(`Parti kimliği: ${sonuc.batchId}  (geri almak için: --geri-al ${sonuc.batchId})`);
}

main()
  .catch((e) => {
    console.error("\nİçe aktarma başarısız:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
