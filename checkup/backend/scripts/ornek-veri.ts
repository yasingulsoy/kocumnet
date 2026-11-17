/**
 * Örnek tohumun içeriği (scripts/tohum-ornek.ts yazar, test/birim/ornek-veri.test.ts
 * denetler). Sayısal soruların doğru cevabı parametrelerden HESAPLANIR; çeldiriciler
 * doğru cevapla çakışamaz. Her soruda çözüm var.
 */

// ─── Soru üreticileri ─────────────────────────────────────────

export interface DemoSoru {
  alt: string; // alt kazanım kodu
  metin: string;
  siklar: string[];
  dogru: number;
  cozum: string;
  zorluk: number;
}

const m = (n: number) => `$${n}$`;

/**
 * Doğru cevabın şıklardaki yeri: sırayla A–E'ye dağılsın (hep C olmasın).
 * Üreticiler modül yüklenirken sabit sırayla çağrıldığından sonuç her
 * çalıştırmada aynıdır (tohum idempotent kalır).
 */
const KONUMLAR = [2, 4, 0, 3, 1, 1, 3, 0, 4, 2];
let konumSayaci = 0;

/**
 * Doğru değer + çeldirici adayları → 5 ayrık şık, küçükten büyüğe (ÖSYM
 * düzeni). Adaylar yetmezse doğru değerin komşularıyla tamamlanır; `uygun`
 * (ör. "rakam olmalı") hem adaylara hem tamamlayıcılara uygulanır. Doğru
 * cevabın yeri KONUMLAR sırasıyla seçilir; o kadar küçük/büyük aday yoksa kayar.
 */
function secenekler(dogru: number, adaylar: number[], uygun: (n: number) => boolean = () => true, adim = 1): { siklar: string[]; dogru: number } {
  const havuz: number[] = [];
  const komsular = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10].map((k) => dogru + k * adim);
  for (const a of [...adaylar, ...komsular]) {
    if (Number.isFinite(a) && Number.isInteger(a) && uygun(a) && a !== dogru && !havuz.includes(a)) havuz.push(a);
  }
  const kucuk = havuz.filter((a) => a < dogru);
  const buyuk = havuz.filter((a) => a > dogru);
  let altta = Math.min(KONUMLAR[konumSayaci++ % KONUMLAR.length]!, kucuk.length);
  if (buyuk.length < 4 - altta) altta = Math.min(kucuk.length, 4 - buyuk.length);
  const secilen = [...kucuk.slice(0, altta), ...buyuk.slice(0, 4 - altta)];
  if (secilen.length < 4) throw new Error(`Yeterli çeldirici yok: ${dogru}`);
  const hepsi = [...secilen, dogru].sort((x, y) => x - y);
  return { siklar: hepsi.map(m), dogru: hepsi.indexOf(dogru) };
}

const ebob = (a: number, b: number): number => (b === 0 ? Math.abs(a) : ebob(b, a % b));
const kesir = (pay: number, payda: number) => {
  const g = ebob(pay, payda);
  const p = pay / g;
  const q = payda / g;
  return q === 1 ? `${p}` : `\\dfrac{${p}}{${q}}`;
};
const isaretli = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);

function dokuzlaBolunebilme(x: number, y: number): DemoSoru {
  const s = x + y;
  const A = (9 - (s % 9)) % 9;
  if (A < 1 || A > 8) throw new Error("Belirsiz rakam");
  const o = secenekler(A, [A - 2, A - 1, A + 1, A + 2], (n) => n >= 0 && n <= 9);
  return {
    alt: "MAT.1.1",
    metin: `Üç basamaklı $\\overline{${x}A${y}}$ sayısı 9 ile tam bölünebildiğine göre $A$ rakamı kaçtır?`,
    ...o,
    cozum: `9 ile bölünebilen bir sayının rakamları toplamı 9'un katıdır: $${x} + A + ${y} = ${s} + A$.\n$A$ bir rakam olduğundan $${s} + A = ${s + A}$ olmalı, buradan $A = ${A}$ bulunur.`,
    zorluk: 1,
  };
}

function dokuzaKalan(n: number): DemoSoru {
  const rakamlar = String(n).split("").map(Number);
  const toplam = rakamlar.reduce((a, b) => a + b, 0);
  const k = toplam % 9;
  const o = secenekler(k, [k - 2, k - 1, k + 1, k + 2], (v) => v >= 0 && v <= 8);
  return {
    alt: "MAT.1.2",
    metin: `$${n}$ sayısının 9 ile bölümünden kalan kaçtır?`,
    ...o,
    cozum: `Bir sayının 9 ile bölümünden kalan, rakamları toplamının 9 ile bölümünden kalana eşittir.\n$${rakamlar.join(" + ")} = ${toplam}$ ve $${toplam} = 9 \\cdot ${Math.floor(toplam / 9)} + ${k}$ olduğundan kalan $${k}$ olur.`,
    zorluk: 1,
  };
}

function usCarpimBolum(t: number, a: number, b: number, c: number): DemoSoru {
  const e = a + b - c;
  const r = t ** e;
  const o = secenekler(r, [t ** (e - 1), t ** (e + 1), t * e, r + t, r - 1]);
  return {
    alt: "MAT.2.1",
    metin: `$\\dfrac{${t}^{${a}} \\cdot ${t}^{${b}}}{${t}^{${c}}}$ işleminin sonucu kaçtır?`,
    ...o,
    cozum: `Tabanları aynı üslü sayılarda çarpmada üsler toplanır, bölmede çıkarılır:\n$$\\dfrac{${t}^{${a}} \\cdot ${t}^{${b}}}{${t}^{${c}}} = ${t}^{${a} + ${b} - ${c}} = ${t}^{${e}} = ${r}$$`,
    zorluk: 2,
  };
}

function ussunUssu(t: number, a: number, b: number, c: number): DemoSoru {
  const e = a * b + c;
  const r = t ** e;
  const o = secenekler(r, [t ** (e + 1), t ** (a + b + c), t * e, r * 2, t ** (e - 1)]);
  return {
    alt: "MAT.2.2",
    metin: `$(${t}^{${a}})^{${b}} \\cdot ${t}^{${c}}$ işleminin sonucu kaçtır?`,
    ...o,
    cozum: `Üssün üssünde üsler çarpılır, tabanları aynı sayılar çarpılırken üsler toplanır:\n$$(${t}^{${a}})^{${b}} \\cdot ${t}^{${c}} = ${t}^{${a * b}} \\cdot ${t}^{${c}} = ${t}^{${e}} = ${r}$$`,
    zorluk: 2,
  };
}

function denklem(a: number, x: number, b: number): DemoSoru {
  const c = a * x + b;
  const o = secenekler(x, [x - 2, x - 1, x + 1, x + 2, -x]);
  return {
    alt: "MAT.3.1",
    metin: `$${a}x ${isaretli(b)} = ${c}$ olduğuna göre $x$ kaçtır?`,
    ...o,
    cozum: `Bilinmeyeni yalnız bırakalım: $${a}x = ${c} ${isaretli(-b)} = ${a * x}$.\nHer iki taraf $${a}$ ile bölünürse $x = ${x}$ bulunur.`,
    zorluk: 1,
  };
}

function kesirliDenklem(a: number, x: number, b: number): DemoSoru {
  const c = x / a + b;
  const o = secenekler(x, [x - a, x + a, c * a, (c - b) * (a + 1), x + 1]);
  return {
    alt: "MAT.3.2",
    metin: `$\\dfrac{x}{${a}} ${isaretli(b)} = ${c}$ olduğuna göre $x$ kaçtır?`,
    ...o,
    cozum: `$\\dfrac{x}{${a}} = ${c} ${isaretli(-b)} = ${c - b}$, buradan $x = ${c - b} \\cdot ${a} = ${x}$ bulunur.`,
    zorluk: 2,
  };
}

function oranOranti(p: number, q: number, k: number): DemoSoru {
  const a = p * k;
  const b = q * k;
  const S = a + b;
  const o = secenekler(a, [b, a + k, a - k, S - a + k, p * q], (n) => n > 0 && n <= S, k);
  const ck = (n: number) => (n === 1 ? "k" : `${n}k`);
  return {
    alt: "MAT.4.1",
    metin: `$\\dfrac{a}{b} = \\dfrac{${p}}{${q}}$ ve $a + b = ${S}$ olduğuna göre $a$ kaçtır?`,
    ...o,
    cozum: `$a = ${ck(p)}$ ve $b = ${ck(q)}$ denirse $${ck(p)} + ${ck(q)} = ${ck(p + q)} = ${S}$, yani $k = ${k}$ olur.\nBuradan $a = ${p === 1 ? `k = ${a}` : `${p} \\cdot ${k} = ${a}`}$ bulunur.`,
    zorluk: 2,
  };
}

function ardArdaYuzde(p: number, q: number, ilk: number): DemoSoru {
  const son = (ilk * (100 + p) * (100 - q)) / 10000;
  if (!Number.isInteger(son)) throw new Error("Tamsayı değil");
  const katsayi = kesir((100 + p) * (100 - q), 10000);
  const kx = katsayi === "1" ? "x" : `${katsayi}x`;
  const o = secenekler(ilk, [son, ilk + 50, ilk - 50, ilk + 100, Math.round((son * 100) / (100 + p - q))], (n) => n > 0, 50);
  return {
    alt: "MAT.5.1",
    metin: `Bir ürünün fiyatı önce %${p} artırılıyor, sonra yeni fiyat üzerinden %${q} indiriliyor. Ürünün son fiyatı ${son} TL olduğuna göre ilk fiyatı kaç TL'dir?`,
    ...o,
    cozum:
      katsayi === "1"
        ? `İlk fiyat $x$ olsun. Artıştan sonra fiyat $x \\cdot \\dfrac{${100 + p}}{100}$, indirimden sonra $x \\cdot \\dfrac{${100 + p}}{100} \\cdot \\dfrac{${100 - q}}{100} = x$ olur.\nYani fiyat başa döner: ilk fiyat da $${ilk}$ TL'dir.`
        : `İlk fiyat $x$ olsun. Artıştan sonra fiyat $x \\cdot \\dfrac{${100 + p}}{100}$, indirimden sonra $x \\cdot \\dfrac{${100 + p}}{100} \\cdot \\dfrac{${100 - q}}{100} = ${kx}$ olur.\n$${kx} = ${son}$ denkleminden $x = ${ilk}$ TL bulunur.`,
    zorluk: 3,
  };
}

function yuzdesi(p: number, ek: string, y: number): DemoSoru {
  const x = (100 * y) / p;
  if (!Number.isInteger(x)) throw new Error("Tamsayı değil");
  const o = secenekler(x, [(y * p) / 100, x + y, x - y, 2 * x, x / 2], (n) => n > 0, x >= 100 ? 25 : 5);
  return {
    alt: "MAT.5.2",
    metin: `Bir sayının %${p}'${ek} ${y} olduğuna göre bu sayı kaçtır?`,
    ...o,
    cozum: `Sayı $x$ olsun: $x \\cdot \\dfrac{${p}}{100} = ${y}$.\nBuradan $x = \\dfrac{${y} \\cdot 100}{${p}} = ${x}$ bulunur.`,
    zorluk: 1,
  };
}

function karsilasma(d: number, v1: number, v2: number): DemoSoru {
  const t = d / (v1 + v2);
  if (!Number.isInteger(t)) throw new Error("Tamsayı değil");
  const o = secenekler(t, [t - 1, t + 1, t + 2, t - 2, 2 * t], (n) => n > 0);
  return {
    alt: "MAT.6.1",
    metin: `Aralarında ${d} km bulunan iki şehirden, saatteki hızları ${v1} km ve ${v2} km olan iki araç aynı anda birbirine doğru yola çıkıyor. Araçlar kaç saat sonra karşılaşır?`,
    ...o,
    cozum: `Birbirine doğru giden iki aracın arasındaki mesafe her saat $${v1} + ${v2} = ${v1 + v2}$ km azalır.\n$$t = \\dfrac{${d}}{${v1 + v2}} = ${t} \\text{ saat}$$`,
    zorluk: 2,
  };
}

function rasyonelToplam(a: number, b: number, c: number, d: number, alt: string): DemoSoru {
  const pay = a * d + c * b;
  const payda = b * d;
  const deger = (x: number, y: number) => x / y;
  // Şıklar kesir olarak; sıralama değere göre
  const adaylar: [number, number][] = [
    [a + c, Math.min(b, d)],
    [a + c, b + d],
    [a * c, b * d],
    [Math.abs(a * d - c * b), payda],
    [a + c, payda],
    [pay + 1, payda],
  ];
  const dogruDeger = deger(pay, payda);
  const secilen: [number, number][] = [];
  const metinler = new Set([kesir(pay, payda)]);
  for (const [x, y] of adaylar) {
    if (secilen.length >= 4) break;
    const k = kesir(x, y);
    if (metinler.has(k) || x === 0) continue;
    metinler.add(k);
    secilen.push([x, y]);
  }
  const hepsi = [...secilen, [pay, payda] as [number, number]].sort((u, v) => deger(u[0], u[1]) - deger(v[0], v[1]));
  return {
    alt,
    metin: `$\\dfrac{${a}}{${b}} + \\dfrac{${c}}{${d}}$ işleminin sonucu kaçtır?`,
    siklar: hepsi.map(([x, y]) => `$${kesir(x, y)}$`),
    dogru: hepsi.findIndex(([x, y]) => deger(x, y) === dogruDeger && kesir(x, y) === kesir(pay, payda)),
    cozum: `Paydaları eşitleyelim: $\\dfrac{${a} \\cdot ${d}}{${payda}} + \\dfrac{${c} \\cdot ${b}}{${payda}} = \\dfrac{${pay}}{${payda}}${kesir(pay, payda) !== `\\dfrac{${pay}}{${payda}}` ? ` = ${kesir(pay, payda)}` : ""}$.`,
    zorluk: 1,
  };
}

function esAnlamli(alt: string, sozcuk: string, dogru: string, celdiriciler: string[], aciklama: string): DemoSoru {
  const siklar = [...celdiriciler.slice(0, 4), dogru].sort((x, y) => x.localeCompare(y, "tr"));
  return {
    alt,
    metin: `"${sozcuk}" sözcüğünün anlamca en yakın karşılığı aşağıdakilerden hangisidir?`,
    siklar,
    dogru: siklar.indexOf(dogru),
    cozum: `"${sozcuk}" ${aciklama} demektir; anlamca en yakın karşılığı "${dogru}" sözcüğüdür.`,
    zorluk: 1,
  };
}

function zitAnlamli(sozcuk: string, dogru: string, celdiriciler: string[], aciklama: string): DemoSoru {
  const siklar = [...celdiriciler.slice(0, 4), dogru].sort((x, y) => x.localeCompare(y, "tr"));
  return {
    alt: "TUR.2.1",
    metin: `"${sozcuk}" sözcüğünün karşıt (zıt) anlamlısı aşağıdakilerden hangisidir?`,
    siklar,
    dogru: siklar.indexOf(dogru),
    cozum: `"${sozcuk}" ${aciklama}; karşıt anlamlısı "${dogru}" olur. Diğer seçenekler karşıt anlam taşımaz.`,
    zorluk: 1,
  };
}

// ─── Veri ─────────────────────────────────────────────────────

export interface AgacTanimi {
  ders: string;
  konular: { ad: string; kazanimlar: { kod: string; ad: string; altlar: { kod: string; ad: string }[] }[] }[];
}

export const ALES_AGACI: AgacTanimi[] = [
  {
    ders: "Sayısal",
    konular: [
      {
        ad: "Temel Kavramlar",
        kazanimlar: [
          { kod: "MAT.1", ad: "Bölünebilme kuralları", altlar: [{ kod: "MAT.1.1", ad: "9 ile bölünebilme" }, { kod: "MAT.1.2", ad: "9 ile bölümden kalan" }] },
          { kod: "MAT.2", ad: "Üslü sayılar", altlar: [{ kod: "MAT.2.1", ad: "Üslü ifadelerde çarpma ve bölme" }, { kod: "MAT.2.2", ad: "Üssün üssü" }] },
        ],
      },
      {
        ad: "Denklemler",
        kazanimlar: [
          { kod: "MAT.3", ad: "Birinci dereceden denklemler", altlar: [{ kod: "MAT.3.1", ad: "Tek bilinmeyenli denklem çözme" }, { kod: "MAT.3.2", ad: "Kesirli denklemler" }] },
          { kod: "MAT.4", ad: "Oran ve orantı", altlar: [{ kod: "MAT.4.1", ad: "Doğru orantı" }] },
        ],
      },
      {
        ad: "Problemler",
        kazanimlar: [
          { kod: "MAT.5", ad: "Yüzde problemleri", altlar: [{ kod: "MAT.5.1", ad: "Art arda yüzde değişimi" }, { kod: "MAT.5.2", ad: "Bir sayının yüzdesi" }] },
          { kod: "MAT.6", ad: "Hız problemleri", altlar: [{ kod: "MAT.6.1", ad: "Karşılaşma problemleri" }] },
        ],
      },
    ],
  },
  {
    ders: "Sözel",
    konular: [
      {
        ad: "Sözcükte Anlam",
        kazanimlar: [
          { kod: "TUR.1", ad: "Eş anlamlı sözcükler", altlar: [{ kod: "TUR.1.1", ad: "Sözcüğün eş anlamlısını bulma" }] },
          { kod: "TUR.2", ad: "Zıt anlamlı sözcükler", altlar: [{ kod: "TUR.2.1", ad: "Sözcüğün karşıt anlamlısını bulma" }] },
        ],
      },
    ],
  },
];

export const ALES_SORULARI: DemoSoru[] = [
  dokuzlaBolunebilme(4, 7),
  dokuzlaBolunebilme(5, 1),
  dokuzlaBolunebilme(2, 2),
  dokuzlaBolunebilme(6, 6),
  dokuzaKalan(47285),
  dokuzaKalan(38196),
  dokuzaKalan(52734),
  dokuzaKalan(70315),
  usCarpimBolum(3, 5, 4, 7),
  usCarpimBolum(2, 6, 3, 5),
  usCarpimBolum(5, 4, 2, 4),
  usCarpimBolum(2, 7, 5, 9),
  ussunUssu(2, 3, 2, -4),
  ussunUssu(3, 2, 2, -2),
  ussunUssu(5, 2, 3, -5),
  ussunUssu(2, 2, 3, -3),
  denklem(3, 5, 5),
  denklem(4, 7, -6),
  denklem(5, -2, 13),
  denklem(7, 3, -4),
  denklem(2, 11, 9),
  denklem(6, 4, -10),
  kesirliDenklem(3, 12, 2),
  kesirliDenklem(4, 20, -1),
  kesirliDenklem(5, 35, 3),
  kesirliDenklem(2, 18, -5),
  oranOranti(2, 3, 6),
  oranOranti(3, 5, 4),
  oranOranti(5, 2, 7),
  oranOranti(1, 4, 9),
  oranOranti(3, 4, 8),
  oranOranti(7, 3, 4),
  ardArdaYuzde(20, 25, 200),
  ardArdaYuzde(25, 20, 400),
  ardArdaYuzde(10, 10, 500),
  ardArdaYuzde(40, 50, 300),
  yuzdesi(15, "i", 45),
  yuzdesi(40, "ı", 28),
  yuzdesi(12, "si", 18),
  yuzdesi(35, "i", 70),
  karsilasma(420, 60, 80),
  karsilasma(500, 45, 55),
  karsilasma(360, 40, 50),
  karsilasma(270, 40, 50),
  karsilasma(600, 70, 80),
  karsilasma(440, 50, 60),
  esAnlamli("TUR.1.1", "mütevazı", "alçakgönüllü", ["kibirli", "cömert", "çalışkan", "sabırlı"], "gösterişten kaçınan, kendini öne çıkarmayan"),
  esAnlamli("TUR.1.1", "müsamaha", "hoşgörü", ["öfke", "cesaret", "kıskançlık", "özen"], "başkalarının yanlışlarını anlayışla karşılama"),
  esAnlamli("TUR.1.1", "lakayt", "ilgisiz", ["meraklı", "dikkatli", "neşeli", "kararlı"], "hiçbir şeyle ilgilenmeyen, aldırmaz"),
  esAnlamli("TUR.1.1", "itimat", "güven", ["şüphe", "saygı", "özlem", "sevinç"], "birine ya da bir şeye inanıp dayanma"),
  esAnlamli("TUR.1.1", "beyhude", "boşuna", ["gerekli", "yararlı", "zamanında", "özenli"], "sonuç vermeyen, yararsız"),
  esAnlamli("TUR.1.1", "muhakeme", "akıl yürütme", ["ezberleme", "tartışma", "hayal etme", "unutma"], "doğruyu bulmak için düşünüp tartma"),
  zitAnlamli("cömert", "cimri", ["eli açık", "zengin", "yardımsever", "nazik"], "elindekini başkalarıyla paylaşmaktan kaçınmayan demektir"),
  zitAnlamli("kalabalık", "tenha", ["gürültülü", "geniş", "dar", "aydınlık"], "çok insanın bulunduğu yer anlamındadır"),
  zitAnlamli("somut", "soyut", ["belirgin", "gerçek", "katı", "açık"], "duyularla algılanabilen demektir"),
  zitAnlamli("tutarlı", "çelişkili", ["düzenli", "kararlı", "sağlam", "mantıklı"], "parçaları birbiriyle uyumlu olan demektir"),
];

export const DGS_AGACI: AgacTanimi[] = [
  {
    ders: "Sayısal",
    konular: [
      { ad: "Temel Kavramlar", kazanimlar: [{ kod: "DGS.1", ad: "Rasyonel sayılar", altlar: [{ kod: "DGS.1.1", ad: "Rasyonel sayılarla toplama" }] }] },
      { ad: "Problemler", kazanimlar: [{ kod: "DGS.2", ad: "Yüzde problemleri", altlar: [{ kod: "DGS.2.1", ad: "Bir sayının yüzdesi" }] }] },
    ],
  },
  {
    ders: "Sözel",
    konular: [{ ad: "Sözcükte Anlam", kazanimlar: [{ kod: "DGS.3", ad: "Eş anlamlı sözcükler", altlar: [{ kod: "DGS.3.1", ad: "Sözcüğün eş anlamlısını bulma" }] }] }],
  },
];

export const DGS_SORULARI: DemoSoru[] = [
  rasyonelToplam(2, 3, 1, 4, "DGS.1.1"),
  rasyonelToplam(1, 2, 3, 5, "DGS.1.1"),
  rasyonelToplam(3, 4, 1, 6, "DGS.1.1"),
  { ...yuzdesi(20, "si", 36), alt: "DGS.2.1" },
  { ...yuzdesi(25, "i", 60), alt: "DGS.2.1" },
  { ...yuzdesi(8, "i", 24), alt: "DGS.2.1" },
  esAnlamli("DGS.3.1", "vefa", "bağlılık", ["unutkanlık", "cesaret", "öfke", "sabır"], "dostluğu ve sevgiyi sürdürme, sadakat"),
  esAnlamli("DGS.3.1", "gayret", "çaba", ["tembellik", "korku", "neşe", "merak"], "bir işi başarmak için gösterilen emek"),
];
