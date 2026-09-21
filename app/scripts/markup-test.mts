/**
 * Yazım biçimi ayrıştırıcısı: ayrıştırma + GİDİŞ-DÖNÜŞ denetimi.
 * Round-trip bozulursa mevcut bir soruyu düzenlemek içerik siler.
 *   npm run test:markup
 */
import { markupToContent, contentToMarkup } from "../lib/question-markup";
import { extractText, safeParseQuestionContent } from "../lib/question-content";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

console.log("\nAyrıştırma:");

const q1 = markupToContent("Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km?");
check("tek paragraf", q1.blocks.length === 1 && q1.blocks[0].type === "paragraph");
const inl = q1.blocks[0].type === "paragraph" ? q1.blocks[0].content : [];
check("metin ve formül ayrıştı", inl.length === 5, inl.map((n) => n.type).join("+"));
check("formül LaTeX olarak saklandı", inl[1].type === "math" && inl[1].latex === "60");

const q2 = markupToContent("Aşağıdaki denklemi çöz:\n\n$$x^2 + 2x - 8 = 0$$\n\nKökler toplamı kaçtır?");
check("blok formül ayrı blok", q2.blocks.length === 3 && q2.blocks[1].type === "math_block");
check("blok formül içeriği", q2.blocks[1].type === "math_block" && q2.blocks[1].latex === "x^2 + 2x - 8 = 0");

const q3 = markupToContent("Hangileri doğrudur?\n- $x$ tek sayıdır\n- $y$ çift sayıdır\n- $z$ asaldır");
check("öncül listesi", q3.blocks.length === 2 && q3.blocks[1].type === "list");
check("3 öncül, roma biçimi", q3.blocks[1].type === "list" && q3.blocks[1].items.length === 3 && q3.blocks[1].style === "roman");

const q4 = markupToContent("Fiyat 100 \$ olsun.");
check("kaçışlı dolar metin olarak kalıyor", extractText(q4).includes("100 $"), extractText(q4));

const q5 = markupToContent("Kapanmayan $ işareti var");
check("kapanmayan dolar soruyu yutmuyor", extractText(q5).includes("işareti var"), extractText(q5));

console.log("\nÜretilen içerik şemadan geçiyor mu:");
for (const [i, q] of [q1, q2, q3, q4, q5].entries()) {
  check(`örnek ${i + 1}`, safeParseQuestionContent(q).success);
}

console.log("\nGidiş-dönüş (düzenleme kaybı olmamalı):");
const ornekler = [
  "Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km?",
  "Aşağıdaki denklemi çöz:\n\n$$x^2 + 2x - 8 = 0$$\n\nKökler toplamı kaçtır?",
  "Hangileri doğrudur?\n\n- $x$ tek sayıdır\n- $y$ çift sayıdır",
  "$\frac{a}{b} = \frac{3}{5}$ ve $a + b = 48$ ise $a$ kaçtır?",
];
for (const [i, m] of ornekler.entries()) {
  const geri = contentToMarkup(markupToContent(m));
  const tekrar = contentToMarkup(markupToContent(geri));
  check(`örnek ${i + 1} sabit nokta`, geri === tekrar, geri === tekrar ? "" : `"${geri}" ≠ "${tekrar}"`);
  check(
    `örnek ${i + 1} metin korunuyor`,
    extractText(markupToContent(m)) === extractText(markupToContent(geri))
  );
}


console.log("\nGörsel sözdizimi:");
const g1 = markupToContent("Şekildeki üçgende:\n\n![Dik ucgen ABC](med123)\n\n$x$ kaçtır?");
check("blok görsel ayrı blok", g1.blocks.length === 3 && g1.blocks[1].type === "image");
check(
  "mediaId ve alt ayrıştı",
  g1.blocks[1].type === "image" && g1.blocks[1].mediaId === "med123" && g1.blocks[1].alt === "Dik ucgen ABC"
);

const g2 = markupToContent("Yandaki ![ikon](m9) şekle göre $y$ kaçtır?");
const g2inl = g2.blocks[0].type === "paragraph" ? g2.blocks[0].content : [];
check("satır içi görsel", g2inl.some((n) => n.type === "inline_image"), g2inl.map((n) => n.type).join("+"));
check("görsel ile formül bir arada", g2inl.some((n) => n.type === "math"));

const g3 = markupToContent("![](m1)");
check("alt metni boşsa varsayılan konuyor", g3.blocks[0].type === "image" && g3.blocks[0].alt === "Görsel");

for (const m of ["Şekil:\n\n![Cember](med77)\n\nYarıçap $r$ ise alan?", "![a](m1) ve ![b](m2) karşılaştır"]) {
  const geri = contentToMarkup(markupToContent(m));
  check("görsel gidiş-dönüş sabit", geri === contentToMarkup(markupToContent(geri)), geri);
}
check("görsel içerik şemadan geçiyor", safeParseQuestionContent(g1).success && safeParseQuestionContent(g2).success);

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
