import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ayristir, icerikHatasi, icerikHtml, IcerikHatasi, latexCizimi } from "../../src/lib/icerik.js";

describe("içerik: metin → HTML + KaTeX", () => {
  it("düz metin kaçışlanır", () => {
    const html = icerikHtml(`<script>alert("x")</script> & 'tek'`);
    assert.equal(html, "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;tek&#39;");
  });

  it("satır sonu <br>, boş satır yeni <p>; çıktıda ham satır sonu yok", () => {
    assert.equal(icerikHtml("a\nb"), "a<br>b");
    assert.equal(icerikHtml("a\r\nb"), "a<br>b");
    assert.equal(icerikHtml("a\n\nb\nc"), "<p>a</p><p>b<br>c</p>");
    assert.equal(icerikHtml("a\n  \n\n\nb"), "<p>a</p><p>b</p>");
    assert.equal(icerikHtml("\n\nmerhaba\n\n"), "merhaba");
    assert.equal(icerikHtml(""), "");
    assert.ok(!icerikHtml("x\ny\n\n$a$\n$$b$$\nz").includes("\n<"), "etiketler arasında ham satır sonu olmamalı");
  });

  it("satır içi ve blok formül", () => {
    const satirIci = icerikHtml("Sonuç $x^2$ olur.");
    assert.match(satirIci, /^Sonuç <span class="katex">/);
    assert.ok(!satirIci.includes("katex-display"));
    const blok = icerikHtml("Giriş:\n$$\\frac{1}{2}$$\nsonra");
    assert.match(blok, /katex-display/);
    assert.ok(!blok.includes("<br>"), "blok formülün yanındaki satır sonu <br> olmamalı");
  });

  it("\\$ düz dolar işaretidir; formül içindeki \\$ formülü kapatmaz", () => {
    assert.equal(icerikHtml("Fiyat 5\\$ oldu"), "Fiyat 5$ oldu");
    const parcalar = ayristir("Tutar $\\$5 + 1$ dir");
    assert.deepEqual(
      parcalar.map((p) => p.tur),
      ["metin", "formul", "metin"]
    );
    assert.equal((parcalar[1] as { latex: string }).latex, "\\$5 + 1");
  });

  it("eşi olmayan $ ve boş formül hata", () => {
    assert.throws(() => icerikHtml("Fiyat 5$"), (e: unknown) => e instanceof IcerikHatasi && /1\. formül kapanmamış/.test(e.message));
    assert.throws(() => icerikHtml("$a$ ve $$b"), (e: unknown) => e instanceof IcerikHatasi && /2\. formül kapanmamış/.test(e.message));
    assert.throws(() => icerikHtml("boş $ $"), IcerikHatasi);
  });

  it("hatalı LaTeX hangi formül olduğunu söyler", () => {
    const mesaj = icerikHatasi("İlk $x$ doğru, ikinci $\\frac{1}{$ bozuk");
    assert.ok(mesaj);
    assert.match(mesaj, /^2\. formül hatalı/);
    assert.ok(mesaj.includes("\\frac{1}{"));
    assert.equal(icerikHatasi("$\\sqrt{2}$ ve $a_1$"), null);
  });

  it("trust: false — \\href ve \\url bağlantı üretmez", () => {
    const html = icerikHtml("$\\href{javascript:alert(1)}{x}$");
    assert.ok(!/href="javascript/i.test(html));
  });

  it("ondalık virgül bitişik çizilir, koordinat ve liste değişmez", () => {
    assert.equal(latexCizimi("3,5 + 2,25"), "3{,}5 + 2{,}25");
    assert.equal(latexCizimi("A(3,5)"), "A(3,5)");
    assert.equal(latexCizimi("\\{1,2,3\\}"), "\\{1,2,3\\}");
    assert.equal(latexCizimi("[0,1]"), "[0,1]");
  });
});
