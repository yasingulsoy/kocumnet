import "dotenv/config";
import { prisma } from "../lib/db";
import {
  deriveQuestionFields,
  validateChoices,
  type ChoiceDraft,
  type QuestionContent,
} from "../lib/question-content";
import type { ErrorType } from "../lib/generated/prisma/enums";

/**
 * GELİŞTİRME VERİSİ — gerçek soru havuzu değil.
 * Akışı uçtan uca çalıştırmak, arayüzü gerçek LaTeX'le görmek ve seçim
 * algoritmasını gerçek havuz üzerinde denemek için şablondan üretilir.
 *
 *   npm run db:seed:demo
 *
 * Üretimde ASLA çalıştırılmaz; soru havuzu admin panelinden ve toplu içe
 * aktarmadan gelir.
 */

// ── blok yardımcıları ─────────────────────────────────────────
type Inline = { type: "text"; text: string } | { type: "math"; latex: string };

const t = (text: string): Inline => ({ type: "text", text });
const m = (latex: string): Inline => ({ type: "math", latex });

function stem(...parts: Inline[]): QuestionContent {
  return { version: 1, blocks: [{ type: "paragraph", content: parts }] };
}

function choice(latex: string): QuestionContent {
  return { version: 1, blocks: [{ type: "math_block", latex }] };
}

interface Built {
  stem: QuestionContent;
  /** İlk eleman DOĞRU şık; karıştırma kaydederken yapılır. */
  options: { latex: string; errorType?: ErrorType }[];
  difficulty: number;
  targetTimeSeconds: number;
}

type Template = (i: number) => Built;

/**
 * Deterministik "rastgelelik": her çalıştırmada aynı sorular üretilsin,
 * tekrar seed'lemek havuzu ikiye katlamasın.
 *
 * Basit mod aritmetiği (i*7+3) YETMİYOR: periyodu kısa olduğu için farklı
 * konular aynı sayıları üretiyor, fingerprint bunları reddediyor ve havuz
 * paketleri dolduramayacak kadar küçük kalıyor. Karıştırıcı bir karma gerekli.
 */
function hash32(a: number, b: number): number {
  let t = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 1, 0x85ebca77)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d);
  t = Math.imul(t ^ (t >>> 12), 0x297a2d39);
  return (t ^ (t >>> 15)) >>> 0;
}

const pick = (i: number, min: number, max: number) =>
  min + (hash32(i, min * 31 + max) % (max - min + 1));

/**
 * Şıkları AYRIK üretir.
 *
 * Çeldirici formülleri bazı değerlerde doğru cevapla aynı sonucu veriyor
 * (ör. kalan 0 iken "kalan − 1" de 0 çıkıyor) ve iki özdeş şık oluşuyor.
 * Öğrenci doğru değeri işaretlediği halde yanlış sayılıyor, ekranda da hiçbir
 * şey ters görünmüyor. Çakışanı bir üste kaydırıyoruz.
 */
function options(
  correct: number,
  distractors: [number, ErrorType][]
): { latex: string; errorType?: ErrorType }[] {
  const used = new Set<number>([correct]);
  const out: { latex: string; errorType?: ErrorType }[] = [{ latex: String(correct) }];

  for (const [raw, errorType] of distractors) {
    let v = Math.round(raw);
    if (v < 0) v = Math.abs(v);
    while (used.has(v)) v += 1;
    used.add(v);
    out.push({ latex: String(v), errorType });
  }
  return out;
}

// ── şablonlar ─────────────────────────────────────────────────

const hizYol: Template = (i) => {
  const v = pick(i, 40, 110);
  const s = pick(i + 5, 2, 7);
  return {
    stem: stem(
      t("Bir otomobil sabit "),
      m(`${v}`),
      t(" km/sa hızla "),
      m(`${s}`),
      t(" saat yol alıyor. Otomobilin aldığı yol kaç km'dir?")
    ),
    options: options(v * s, [
      [v + s, "TERS_ISLEM"],
      [v * (s - 1), "EKSIK_OKUMA"],
      [(v * s) / 2, "KAVRAM_YANILGISI"],
      [v * s + v, "ISLEM_HATASI"],
    ]),
    difficulty: 1 + (i % 3),
    targetTimeSeconds: 60,
  };
};

const yuzde: Template = (i) => {
  const a = pick(i, 200, 900);
  const p = [10, 20, 25, 40, 50][i % 5];
  const dogru = a + (a * p) / 100;
  return {
    stem: stem(
      t("Bir ürünün fiyatı "),
      m(`${a}`),
      t(" TL'dir. Fiyata "),
      m(`\\%${p}`),
      t(" zam yapılırsa yeni fiyat kaç TL olur?")
    ),
    options: options(dogru, [
      [a + p, "KAVRAM_YANILGISI"],
      [(a * p) / 100, "EKSIK_OKUMA"],
      [a - (a * p) / 100, "TERS_ISLEM"],
      [a * (1 + p), "BIRIM_HATASI"],
    ]),
    difficulty: 2 + (i % 3),
    targetTimeSeconds: 75,
  };
};

const usluCarpim: Template = (i) => {
  const a = pick(i, 3, 12);
  const b = pick(i + 2, 2, 9);
  return {
    stem: stem(
      m(`2^{${a}} \\cdot 2^{${b}} = 2^{x}`),
      t(" olduğuna göre "),
      m("x"),
      t(" kaçtır?")
    ),
    options: options(a + b, [
      [a * b, "FORMUL_KARISTIRMA"],
      [a - b, "TERS_ISLEM"],
      [a + b + 1, "ISLEM_HATASI"],
      [2 * (a + b), "KAVRAM_YANILGISI"],
    ]),
    difficulty: 1 + (i % 4),
    targetTimeSeconds: 55,
  };
};

const ardisikToplam: Template = (i) => {
  const n = pick(i, 10, 60);
  const dogru = (n * (n + 1)) / 2;
  return {
    stem: stem(
      m("1"),
      t("'den "),
      m(`${n}`),
      t("'e kadar olan (ikisi de dahil) tüm doğal sayıların toplamı kaçtır?")
    ),
    options: options(dogru, [
      [(n * (n - 1)) / 2, "EKSIK_OKUMA"],
      [n * (n + 1), "FORMUL_KARISTIRMA"],
      [(n * n) / 2, "ISLEM_HATASI"],
      [dogru + n, "ISLEM_HATASI"],
    ]),
    difficulty: 2 + (i % 3),
    targetTimeSeconds: 70,
  };
};

const kalan: Template = (i) => {
  const b = [7, 9, 11, 13][i % 4];
  const a = pick(i, 500, 4000);
  return {
    stem: stem(
      m(`${a}`),
      t(" sayısının "),
      m(`${b}`),
      t(" ile bölümünden kalan kaçtır?")
    ),
    options: options(a % b, [
      [(a % b) + 1, "ISLEM_HATASI"],
      [(a % b) - 1, "ISLEM_HATASI"],
      [Math.floor(a / b) % 10, "KAVRAM_YANILGISI"],
      [b - (a % b), "TERS_ISLEM"],
    ]),
    difficulty: 2 + (i % 3),
    targetTimeSeconds: 65,
  };
};

const oranToplam: Template = (i) => {
  const k = pick(i, 2, 15);
  const [p, q] = [3, 5];
  const toplam = (p + q) * k;
  return {
    stem: stem(
      m(`\\frac{a}{b} = \\frac{${p}}{${q}}`),
      t(" ve "),
      m(`a + b = ${toplam}`),
      t(" olduğuna göre "),
      m("a"),
      t(" kaçtır?")
    ),
    options: options(p * k, [
      [q * k, "TERS_ISLEM"],
      [toplam / 2, "KAVRAM_YANILGISI"],
      [p * k + q, "ISLEM_HATASI"],
      [toplam - p, "EKSIK_OKUMA"],
    ]),
    difficulty: 2 + (i % 3),
    targetTimeSeconds: 80,
  };
};

const dogrusalDenklem: Template = (i) => {
  // Aralıklar geniş: bu şablon ~35 konuda yedek olarak kullanılıyor, dar
  // aralıkta doğum günü paradoksu havuzu eritiyor.
  const a = pick(i, 2, 19);
  const x = pick(i + 3, 2, 40);
  const b = pick(i + 1, 1, 99);
  const c = a * x + b;
  return {
    stem: stem(
      m(`${a}x + ${b} = ${c}`),
      t(" denklemini sağlayan "),
      m("x"),
      t(" değeri kaçtır?")
    ),
    options: options(x, [
      [c - b, "EKSIK_OKUMA"],
      [(c + b) / a, "ISARET_HATASI"],
      [x + 1, "ISLEM_HATASI"],
      [a + b, "KAVRAM_YANILGISI"],
    ]),
    difficulty: 1 + (i % 4),
    targetTimeSeconds: 50,
  };
};

const mutlakDeger: Template = (i) => {
  const a = pick(i, 3, 15);
  const b = pick(i + 4, 16, 40);
  return {
    stem: stem(
      m(`|x - ${a}| = ${b}`),
      t(" denkleminin köklerinin toplamı kaçtır?")
    ),
    options: options(2 * a, [
      [a + b, "EKSIK_OKUMA"],
      [2 * b, "KAVRAM_YANILGISI"],
      [b - a, "ISARET_HATASI"],
      [a, "EKSIK_OKUMA"],
    ]),
    difficulty: 3 + (i % 2),
    targetTimeSeconds: 85,
  };
};

const TEMPLATES: Record<string, Template> = {
  "hareket-hiz-problemleri": hizYol,
  "yuzde-kar-zarar": yuzde,
  "uslu-sayilar": usluCarpim,
  "temel-kavramlar": ardisikToplam,
  bolunebilme: kalan,
  "oran-oranti": oranToplam,
  "denklem-cozme": dogrusalDenklem,
  "mutlak-deger": mutlakDeger,
};

/** Şablonu olmayan konular için genel doğrusal denklem. */
const FALLBACK = dogrusalDenklem;

/** Her yaprak konu için kaç soru üretilsin. */
const PER_TOPIC = 10;

const LABELS = ["A", "B", "C", "D", "E"];

/**
 * Konuya özgü tohum. Slug UZUNLUĞUNU kullanmak yetmiyor: aynı uzunluktaki
 * konular birebir aynı soruyu üretiyor ve fingerprint bunları haklı olarak
 * reddediyor. Karakterlerin tamamından türetiyoruz.
 */
function topicSeed(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 9973;
  return h;
}

/**
 * Zorluk dağılımı sabit: seçim algoritması kolay %30 / orta %50 / zor %20
 * ister, her bantta soru bulunmalı.
 */
const DIFFICULTY_SPREAD = [1, 1, 2, 2, 3, 3, 3, 4, 4, 5];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo verisi üretim ortamında çalıştırılamaz.");
  }

  // Yaprak konular: alt konusu olmayanlar. Sorular yaprakta tutulur.
  const topics = await prisma.topic.findMany({
    where: { children: { none: {} } },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });

  let created = 0;
  let skipped = 0;
  const invalid: string[] = [];

  for (const topic of topics) {
    const template = TEMPLATES[topic.slug] ?? FALLBACK;

    // Deneme sayisi PER_TOPIC'ten fazla: cakisan sorular atlaninca DENEME
    // SIRASINA gore zorluk atarsak, atlananlar hep listenin sonundan (zor
    // olanlardan) duser ve konu sadece kolay sorularla kalir. Zorlugu
    // URETILEN sayiya gore atiyoruz ve hedefe ulasana kadar deniyoruz.
    let uretilen = 0;
    for (let i = 0; uretilen < PER_TOPIC && i < PER_TOPIC * 6; i++) {
      const built = template(i + topicSeed(topic.slug));
      built.difficulty = DIFFICULTY_SPREAD[uretilen % DIFFICULTY_SPREAD.length];
      const { stemText, fingerprint } = deriveQuestionFields(built.stem);

      const exists = await prisma.question.findUnique({
        where: { fingerprint },
        select: { id: true },
      });
      if (exists) {
        skipped += 1;
        continue;
      }

      // Şıkları karıştır: doğru cevap her soruda A olursa test anlamsızlaşır.
      const order = [0, 1, 2, 3, 4].sort(
        (a, b) => ((a * 13 + i * 7) % 5) - ((b * 13 + i * 7) % 5)
      );

      const drafts: ChoiceDraft[] = order.map((optIndex, position) => ({
        label: LABELS[position],
        content: choice(built.options[optIndex].latex),
        isCorrect: optIndex === 0,
      }));

      // Emniyet ağı: options() şıkları ayrık üretiyor ama kural burada da
      // denetleniyor — bozuk soru veritabanına hiç girmesin.
      const errors = validateChoices(drafts);
      if (errors.length) {
        invalid.push(`${topic.slug}/${i}: ${errors[0]}`);
        continue;
      }

      await prisma.question.create({
        data: {
          topicId: topic.id,
          stem: built.stem,
          stemText,
          fingerprint,
          difficulty: built.difficulty,
          targetTimeSeconds: built.targetTimeSeconds,
          status: "PUBLISHED",
          sourceRef: `demo/${topic.slug}/${i}`,
          choices: {
            create: order.map((optIndex, position) => ({
              label: LABELS[position],
              content: choice(built.options[optIndex].latex),
              isCorrect: optIndex === 0,
              errorType: built.options[optIndex].errorType ?? null,
              sortOrder: position,
            })),
          },
        },
      });
      created += 1;
      uretilen += 1;
    }
  }

  await yayinaAl();

  const total = await prisma.question.count({ where: { status: "PUBLISHED" } });
  console.log(
    `\n  ${created} soru üretildi, ${skipped} atlandı (zaten vardı).` +
      `\n  Yayındaki toplam soru: ${total}\n`
  );
}


/**
 * Havuzu artık yeterli olan paketleri yayına alır.
 *
 * `db:seed` bunu YAPMAZ: orada bilerek taslağa çekilmiş bir paketi geri
 * yayına almak istemiyoruz. Burası yalnızca geliştirme verisi üreten betik,
 * amacı ürünü uçtan uca denenebilir hale getirmek.
 */
async function yayinaAl() {
  const paketler = await prisma.package.findMany({
    where: { status: "DRAFT", kind: { not: "RETEST" } },
    select: { id: true, name: true, topics: { select: { topicId: true, questionCount: true } } },
  });
  if (paketler.length === 0) return;

  const sayimlar = await prisma.question.groupBy({
    by: ["topicId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const soruSayisi = new Map(sayimlar.map((s) => [s.topicId, s._count._all]));

  const acilan: string[] = [];
  for (const p of paketler) {
    const hazir =
      p.topics.length > 0 &&
      p.topics.every((t) => (soruSayisi.get(t.topicId) ?? 0) >= t.questionCount);
    if (!hazir) continue;
    await prisma.package.update({ where: { id: p.id }, data: { status: "PUBLISHED" } });
    acilan.push(p.name);
  }
  if (acilan.length) {
    console.log(`  Yayına alındı (havuz yeterli): ${acilan.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
