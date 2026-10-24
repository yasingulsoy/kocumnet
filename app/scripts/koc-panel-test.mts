import "./_koruma.mjs";
/**
 * Koçun panel ekranlarının saf kuralları (admin/src/lib/checkup/): risk
 * bulguları (ödev yapmadı, 7 gün pasif, boş ve yarım testin "başlamadı"
 * sayılması), grup davet kodu, e-posta listesi ayrıştırma, "Bu hafta"
 * sıralaması, öğrenci listesinin ölçüm kuralı ve personelin parola sıfırlama
 * jetonunun uygulamanın doğrulamasıyla eşleşmesi. Veritabanı istemez.
 *   npx tsx scripts/koc-panel-test.mts
 *
 * Modüller panelde duruyor ama testler burada toplanıyor. Statik import YOK,
 * bilerek: app ayrı derleniyor (Dokploy yalnızca app/ klasörünü görür) ve
 * `next build` tip denetimi scripts/'i de kapsıyor; admin'e statik import
 * derlemeyi kırardı. Panel dosyaları yoksa test atlanır; CI'da (CI tanımlıysa)
 * bu bir HATADIR: orada depo bütün, dosyanın yokluğu bir yer ya da ad
 * değişikliği demek ve test sessizce "geçmemeli".
 *
 * Uygulamanın tarafı (davet kodunun doğrulaması, sıfırlama jetonunun özeti)
 * buradan, app/lib'den okunur: iki taraf ayrı yazıldığı için asıl iş ikisinin
 * aynı kuralı uyguladığını göstermek.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as katilim from "../lib/grup-katilim";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

// ─────────────────────────────────────────────────────────────
// Panel modülleri (dinamik)
// ─────────────────────────────────────────────────────────────

type OdevDurumu = "TAMAMLANDI" | "GEC_TAMAMLANDI" | "BASLADI" | "BASLAMADI";
interface RiskOdevi {
  title: string;
  dueAt: Date;
  durum: OdevDurumu;
  katildi: Date;
}
interface RiskOzeti {
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  sonTest: Date | null;
  sonBaslama: Date | null;
  testSayisi: number;
  kapananTest: number;
  sonIkiPaket: [number | null, number | null];
  gecenHaftaPlan: { biten: number; toplam: number } | null;
  odevler: RiskOdevi[];
}
interface RiskBulgusu {
  key: string;
  ton: "bad" | "warn" | "info";
  baslik: string;
  ayrinti: string;
}
interface RiskModulu {
  RISK_ESIK: { pasifGun: number; baslamadiGun: number; odevPencereGun: number };
  riskBulgulari(o: RiskOzeti, now: Date): RiskBulgusu[];
  riskPuani(l: RiskBulgusu[]): number;
  yapilmayanOdevler<T extends RiskOdevi>(l: readonly T[], now: Date): T[];
}
interface DavetModulu {
  DAVET_KODU_ALFABESI: string;
  DAVET_KODU_UZUNLUGU: number;
  DAVET_KODU_DESENI: RegExp;
  DAVET_DAMGASI: string;
  davetKoduUret(rastgele?: (n: number) => Uint8Array): string;
  davetKoduGecerli(k: unknown): boolean;
  davetKoduCoz(ham: string): string | null;
  davetKoduOkunur(k: string): string;
  davetBaglantisi(kok: string, kod: string): string;
  davetleKatildi(d: string | null): boolean;
}
interface KuralModulu {
  epostaListesiAyristir(metin: string): { gecerli: string[]; gecersiz: string[] };
  oranaSayilir(u: { createdAt: Date }, o: { dueAt: Date }): boolean;
}
interface BuHaftaSatiri {
  id: string;
  name: string;
  email: string;
  sonEtkinlik: Date;
  haftaSoru: number;
  gecenOdev: { tamamlayan: number; sayilan: number };
  acikOdev: { toplam: number; bekleyen: number };
  plan: { biten: number; toplam: number } | null;
  bulgular: RiskBulgusu[];
  puan: number;
  bekleyenSoru: number;
}
interface BuHaftaModulu {
  buHaftaSirala<T extends BuHaftaSatiri>(l: readonly T[]): T[];
  mudahaleGerekir(s: Pick<BuHaftaSatiri, "bulgular" | "gecenOdev">): boolean;
  gecenOdevOzeti(l: readonly RiskOdevi[], now: Date): { tamamlayan: number; sayilan: number };
  acikOdevOzeti(l: readonly RiskOdevi[], now: Date): { toplam: number; bekleyen: number };
}
interface SifirlamaModulu {
  SIFIRLAMA_GECERLILIK_SAAT: number;
  SIFIRLAMA_SAATLIK_SINIR: number;
  SIFIRLAMA_UYARISI: string;
  sifirlamaJetonuUret(): string;
  sifirlamaJetonuOzeti(j: string): string;
  sifirlamaBaglantisi(kok: string, j: string): string;
  damgaKimligi(id: number): string;
}
interface OlcumSonucu {
  kind: string;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  endedBy?: string | null;
  examScope: string;
}
interface OzetModulu {
  listeOzeti(l: readonly OlcumSonucu[], hedef: string | null): { test: number; sonBasari: number | null };
  olcumSinavi(l: readonly OlcumSonucu[], hedef: string | null, istenen?: string | null): { sinav: string | null };
  olcumDisiNedeni(r: OlcumSonucu): string | null;
  sonGorulme(u: { lastSeenAt: Date | null; lastLoginAt: Date | null }): Date | null;
}

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "../../admin/src/lib/checkup");
const DOSYALAR = ["risk.ts", "davet.ts", "grup-kurallari.ts", "bu-hafta-kurallari.ts", "sifirlama.ts", "ogrenci-ozeti.ts"];
const eksik = DOSYALAR.filter((d) => !existsSync(resolve(KOK, d)));
if (eksik.length) {
  if (process.env.CI) {
    console.error("✗ admin/src/lib/checkup altında bulunamadı: " + eksik.join(", ") + ". CI'da koç paneli testi atlanamaz.");
    console.error("  Dosya taşındıysa ya da adı değiştiyse bu betikteki DOSYALAR listesini güncelle.");
    process.exit(1);
  }
  console.log("admin/ yok (ayrı derleme ortamı): koç paneli testi atlandı.");
  process.exit(0);
}
const yukle = async <T,>(ad: string) => (await import(pathToFileURL(resolve(KOK, ad)).href)) as T;
const risk = await yukle<RiskModulu>("risk.ts");
const davet = await yukle<DavetModulu>("davet.ts");
const kurallar = await yukle<KuralModulu>("grup-kurallari.ts");
const buHafta = await yukle<BuHaftaModulu>("bu-hafta-kurallari.ts");
const sifirlama = await yukle<SifirlamaModulu>("sifirlama.ts");
const ozet = await yukle<OzetModulu>("ogrenci-ozeti.ts");

const GUN = 86_400_000;
const NOW = new Date("2026-10-21T09:00:00.000Z"); // çarşamba, Türkiye 12:00
const once = (gun: number) => new Date(NOW.getTime() - gun * GUN);
const sonra = (gun: number) => new Date(NOW.getTime() + gun * GUN);
const anahtarlar = (l: RiskBulgusu[]) => l.map((b) => b.key).sort().join(",");

/** Bulgusu olmayan, etkin bir öğrenci; testler tek alanı bozar. */
const temiz = (ek: Partial<RiskOzeti> = {}): RiskOzeti => ({
  createdAt: once(40),
  lastLoginAt: once(20),
  lastSeenAt: once(1),
  sonTest: once(3),
  sonBaslama: once(2),
  testSayisi: 4,
  kapananTest: 4,
  sonIkiPaket: [0.6, 0.62],
  gecenHaftaPlan: { biten: 4, toplam: 5 },
  odevler: [],
  ...ek,
});
const odev = (title: string, dueAt: Date, durum: OdevDurumu, katildi = once(30)): RiskOdevi => ({ title, dueAt, durum, katildi });

// ─────────────────────────────────────────────────────────────

console.log("\nRisk: pasif (7 gün) ve son etkinlik:");
{
  check("pasif eşiği 7 gün", risk.RISK_ESIK.pasifGun === 7, String(risk.RISK_ESIK.pasifGun));
  check("etkin öğrencide bulgu yok", risk.riskBulgulari(temiz(), NOW).length === 0, anahtarlar(risk.riskBulgulari(temiz(), NOW)));
  const sessiz = (gun: number) =>
    temiz({ lastLoginAt: once(gun), lastSeenAt: null, sonTest: once(gun + 1), sonBaslama: once(gun) });
  check("6 gün sessiz: pasif değil", !anahtarlar(risk.riskBulgulari(sessiz(6), NOW)).includes("pasif"));
  const yedi = risk.riskBulgulari(sessiz(7), NOW).find((b) => b.key === "pasif");
  check("7 gün sessiz: pasif", Boolean(yedi), yedi?.ayrinti);
  check(
    "son görülme (lastSeenAt) etkinlik sayılır: eski girişe rağmen pasif değil",
    !anahtarlar(risk.riskBulgulari(temiz({ lastLoginAt: once(30), lastSeenAt: once(2), sonTest: null, sonBaslama: null }), NOW)).includes(
      "pasif"
    )
  );
}

console.log("\nRisk: ödevi yapmadı:");
{
  check("pencere 7 gün", risk.RISK_ESIK.odevPencereGun === 7);
  const bul = (odevler: RiskOdevi[]) => risk.riskBulgulari(temiz({ odevler }), NOW).find((b) => b.key === "odev");
  const b1 = bul([odev("Üçgenler testi", once(2), "BASLAMADI")]);
  check("2 gün önce süresi dolan, başlanmamış ödev → bulgu", Boolean(b1), b1?.ayrinti);
  check("tek ödevde ayrıntı ödevin adı", b1?.ayrinti === "Üçgenler testi");
  check("başlayıp bitirmeyen de yapmadı sayılır", Boolean(bul([odev("A", once(1), "BASLADI")])));
  check("tamamlayan: bulgu yok", !bul([odev("A", once(2), "TAMAMLANDI")]));
  check("geç tamamlayan: bulgu yok (yapmış)", !bul([odev("A", once(2), "GEC_TAMAMLANDI")]));
  check("süresi dolmamış açık ödev: bulgu yok", !bul([odev("A", sonra(2), "BASLAMADI")]));
  check("8 gün önce süresi dolan: pencere dışı", !bul([odev("A", once(8), "BASLAMADI")]));
  check("son tarihten sonra katılan: sayılmaz", !bul([odev("A", once(3), "BASLAMADI", once(1))]));
  const iki = bul([odev("A", once(1), "BASLAMADI"), odev("B", once(4), "BASLADI"), odev("C", once(5), "TAMAMLANDI")]);
  check("iki yapılmamış ödev → '2 ödev'", iki?.ayrinti === "2 ödev", iki?.ayrinti);
  const uzun = bul([odev("Ç".repeat(60), once(1), "BASLAMADI")]);
  check("uzun başlık kısaltılır", (uzun?.ayrinti.length ?? 99) <= 40 && Boolean(uzun?.ayrinti.endsWith("…")));
  const sirali = risk.yapilmayanOdevler([odev("eski", once(5), "BASLAMADI"), odev("yeni", once(1), "BASLAMADI")], NOW);
  check("yapılmayanlar en yeni son tarih önce", sirali.map((o) => o.title).join(",") === "yeni,eski");
  check("ödev bulgusu 'warn' tonunda", b1?.ton === "warn");
}

console.log("\nRisk: hiç başlamadı (boş ve yarım test sayılmaz):");
{
  const baslamadi = (ek: Partial<RiskOzeti>) =>
    risk.riskBulgulari(temiz({ createdAt: once(5), sonIkiPaket: [null, null], gecenHaftaPlan: null, ...ek }), NOW).find(
      (b) => b.key === "baslamadi"
    );
  const hic = baslamadi({ testSayisi: 0, kapananTest: 0 });
  check("hiç test yok, kayıt 5 gün önce → başlamadı", Boolean(hic), hic?.ayrinti);
  check("hiç açmadıysa ayrıntıda 'boş ya da yarım' yok", !hic?.ayrinti.includes("boş"));
  const bos = baslamadi({ testSayisi: 0, kapananTest: 2 });
  check("2 test kapanmış ama ölçüm 0 → yine başlamadı", Boolean(bos));
  check("ayrıntı açıp bıraktığını söyler", Boolean(bos?.ayrinti.includes("2 test boş ya da yarım")), bos?.ayrinti);
  check("bir ölçüm varsa başlamadı değil", !baslamadi({ testSayisi: 1, kapananTest: 3 }));
  check("kayıt 2 gün önce: nefes payı", !baslamadi({ testSayisi: 0, kapananTest: 0, createdAt: once(2) }));
}

console.log("\nÖğrenci listesi ve ayrıntı: aynı ölçüm kuralı (egilimeGirer):");
{
  // Yeniden eskiye.
  const sonuclar: OlcumSonucu[] = [
    { kind: "PACKAGE", correctCount: 0, wrongCount: 0, blankCount: 24, endedBy: "STUDENT", examScope: "TYT" }, // boş
    { kind: "PACKAGE", correctCount: 2, wrongCount: 1, blankCount: 21, endedBy: "TIMEOUT", examScope: "TYT" }, // yarım
    { kind: "TOPIC_RETEST", correctCount: 5, wrongCount: 0, blankCount: 0, endedBy: "STUDENT", examScope: "TYT" }, // kontrol testi
    { kind: "PACKAGE", correctCount: 10, wrongCount: 5, blankCount: 5, endedBy: "TIMEOUT", examScope: "TYT" }, // süre doldu ama dolu
    { kind: "LEVEL_STAGE", correctCount: 8, wrongCount: 2, blankCount: 0, endedBy: "STUDENT", examScope: "TYT" },
    { kind: "PACKAGE", correctCount: 6, wrongCount: 2, blankCount: 12, endedBy: "STUDENT", examScope: "TYT" }, // bilerek boş bırakılmış
    { kind: "PACKAGE", correctCount: 9, wrongCount: 1, blankCount: 0, endedBy: null, examScope: "LGS" }, // eski kayıt, başka sınav
  ];
  const o = ozet.listeOzeti(sonuclar, "TYT");
  check("yalnızca ölçüm sayılan TYT paket testleri: 2", o.test === 2, String(o.test));
  check("son başarı: süre dolan ama yarısından çoğu işaretli test (%50)", o.sonBasari === 0.5, String(o.sonBasari));
  check("hedef sınav ölçülmediyse en son ölçülen sınav", ozet.olcumSinavi(sonuclar, "AYT").sinav === "TYT");
  check("ayrıntının ?sinav= seçimi listeyle aynı kuraldan", ozet.olcumSinavi(sonuclar, "TYT", "LGS").sinav === "LGS");
  check("boş test için neden", ozet.olcumDisiNedeni(sonuclar[0]) === "boş gönderildi, sayılmadı");
  check("yarım test için neden", ozet.olcumDisiNedeni(sonuclar[1]) === "yarım kaldı, sayılmadı");
  check("öğrencinin bitirdiği az işaretli test ölçümdür", ozet.olcumDisiNedeni({ ...sonuclar[1], endedBy: "STUDENT" }) === null);
  check("eski kayıt (endedBy boş) ölçümdür", ozet.olcumDisiNedeni({ ...sonuclar[1], endedBy: null }) === null);
  check("yalnızca boş ve yarım testi olan: 0 test", ozet.listeOzeti(sonuclar.slice(0, 2), "TYT").test === 0);

  const a = once(1);
  const b = once(3);
  check("son etkinlik: lastSeenAt", ozet.sonGorulme({ lastSeenAt: a, lastLoginAt: b }) === a);
  check("son etkinlik: lastSeenAt yoksa son giriş", ozet.sonGorulme({ lastSeenAt: null, lastLoginAt: b }) === b);
  check("son etkinlik: giriş daha yeniyse giriş", ozet.sonGorulme({ lastSeenAt: b, lastLoginAt: a }) === a);
  check("son etkinlik: ikisi de yoksa null", ozet.sonGorulme({ lastSeenAt: null, lastLoginAt: null }) === null);
}

console.log("\nDavet kodu:");
{
  check("alfabe 32 farklı karakter", new Set(davet.DAVET_KODU_ALFABESI).size === 32 && davet.DAVET_KODU_ALFABESI.length === 32);
  check("alfabede 0, O, 1, I yok", !/[0O1I]/.test(davet.DAVET_KODU_ALFABESI));
  check("alfabe yalnızca büyük harf ve rakam", /^[A-Z2-9]+$/.test(davet.DAVET_KODU_ALFABESI));
  const kodlar = Array.from({ length: 2000 }, () => davet.davetKoduUret());
  check("2000 kodun hepsi 8 karakter ve desene uyuyor", kodlar.every((k) => k.length === 8 && davet.DAVET_KODU_DESENI.test(k)));
  check("2000 kodda çakışma yok", new Set(kodlar).size === kodlar.length);
  const gorulen = new Set(kodlar.join(""));
  check("bütün alfabe kullanılıyor (dağılım)", gorulen.size === 32, gorulen.size + " karakter");
  const sabit = davet.davetKoduUret(() => Uint8Array.from([0, 31, 32, 63, 255, 1, 224, 7]));
  check("bayt → karakter: son 5 bit (eşit dağılım)", sabit === "A9A99BAH", sabit);
  check("çözümleme: küçük harf, boşluk ve tire", davet.davetKoduCoz(" abcd-2345 ") === "ABCD2345");
  check("çözümleme: eksik hane reddedilir", davet.davetKoduCoz("ABCD234") === null);
  check("çözümleme: O harfi reddedilir", davet.davetKoduCoz("ABCDO234") === null);
  check("tahta için okunur biçim", davet.davetKoduOkunur("ABCD2345") === "ABCD 2345");
  check(
    "bağlantı /katil/<kod>",
    davet.davetBaglantisi("https://checkup.kocum.net/", "ABCD2345") === "https://checkup.kocum.net/katil/ABCD2345"
  );
  check("davetle katılan damgası tanınır", davet.davetleKatildi(davet.DAVET_DAMGASI));
  check("personel damgası davet sayılmaz", !davet.davetleKatildi("koc@kocum.net (#3)"));

  // Uygulamanın tarafıyla (app/lib/grup-katilim.ts) aynı biçim.
  check("app ile aynı alfabe", katilim.DAVET_KODU_ALFABESI === davet.DAVET_KODU_ALFABESI);
  check("app ile aynı uzunluk", katilim.DAVET_KODU_UZUNLUGU === davet.DAVET_KODU_UZUNLUGU);
  check("app ile aynı davet damgası", katilim.DAVET_DAMGASI === davet.DAVET_DAMGASI, JSON.stringify(katilim.DAVET_DAMGASI));
  check("panelin ürettiği 2000 kodu app kabul ediyor", kodlar.every((k) => katilim.kodGecerliMi(katilim.kodNormalize(k))));
  const appKodlari = Array.from({ length: 2000 }, () => katilim.kodUret());
  check("app'in ürettiği 2000 kodu panel kabul ediyor", appKodlari.every((k) => davet.davetKoduGecerli(k)));
  const ornekler = [" abcd-2345 ", "ABCD 2345", "abcdefgh", "ABCDO234", "ABCD234", "ıııııııı", "A B C D 2 3 4 5"];
  check(
    "elle yazılan kod iki tarafta aynı sonucu veriyor",
    ornekler.every((x) => {
      const app = katilim.kodNormalize(x);
      return (katilim.kodGecerliMi(app) ? app : null) === davet.davetKoduCoz(x);
    })
  );
}

console.log("\nE-posta listesi ayrıştırma:");
{
  const a = kurallar.epostaListesiAyristir("a@x.com, B@X.com\nc@y.org; d@z.net e@w.io\r\n\tf@v.com.tr");
  check(
    "satır, virgül, noktalı virgül, boşluk ve sekme ayırır; küçük harfe çevirir",
    a.gecerli.join(" ") === "a@x.com b@x.com c@y.org d@z.net e@w.io f@v.com.tr",
    a.gecerli.join(" ")
  );
  check("tekrar atılır", kurallar.epostaListesiAyristir("a@x.com A@X.COM a@x.com").gecerli.length === 1);
  const ad = kurallar.epostaListesiAyristir("Ayşe Yılmaz <ayse@ornek.com>, \"Mehmet\" (mehmet@ornek.com).");
  check("ad soyad ve ayraçlar atlanır", ad.gecerli.join(" ") === "ayse@ornek.com mehmet@ornek.com" && ad.gecersiz.length === 0, ad.gecerli.join(" "));
  const hatali = kurallar.epostaListesiAyristir("ali@ornek, veli@@x.com, iyi@x.com");
  check("'@' içerip e-posta olmayan ayrıca listelenir", hatali.gecersiz.length === 2 && hatali.gecerli.join() === "iyi@x.com", hatali.gecersiz.join(" "));
  check("boş metin", kurallar.epostaListesiAyristir("  \n ").gecerli.length === 0);
}

console.log("\nBu hafta: ödev sütunları ve sıralama:");
{
  const odevler = [
    odev("dün doldu, yapmadı", once(1), "BASLAMADI"),
    odev("dün doldu, yaptı", once(1), "TAMAMLANDI"),
    odev("geç yaptı", once(3), "GEC_TAMAMLANDI"),
    odev("9 gün önce doldu", once(9), "BASLAMADI"),
    odev("sonra katıldı", once(2), "BASLAMADI", once(1)),
    odev("açık, yaptı", sonra(2), "TAMAMLANDI"),
    odev("açık, bekliyor", sonra(3), "BASLADI"),
  ];
  const g = buHafta.gecenOdevOzeti(odevler, NOW);
  check("son 7 günde süresi dolan: 2/3 (pencere dışı ve sonra katılan sayılmaz)", g.tamamlayan === 2 && g.sayilan === 3, g.tamamlayan + "/" + g.sayilan);
  const ac = buHafta.acikOdevOzeti(odevler, NOW);
  check("açık ödev: 2, bekleyen 1", ac.toplam === 2 && ac.bekleyen === 1, ac.bekleyen + "/" + ac.toplam);

  const b = (key: string, ton: RiskBulgusu["ton"]): RiskBulgusu => ({ key, ton, baslik: key, ayrinti: "" });
  const satir = (id: string, name: string, ek: Partial<BuHaftaSatiri> = {}): BuHaftaSatiri => {
    const s: BuHaftaSatiri = {
      id,
      name,
      email: id + "@x.com",
      sonEtkinlik: once(1),
      haftaSoru: 10,
      gecenOdev: { tamamlayan: 1, sayilan: 1 },
      acikOdev: { toplam: 0, bekleyen: 0 },
      plan: null,
      bulgular: [],
      puan: 0,
      bekleyenSoru: 0,
      ...ek,
    };
    return { ...s, puan: ek.puan ?? risk.riskPuani(s.bulgular) };
  };
  const liste = [
    satir("a", "Zeynep"),
    satir("b", "Bora", { bulgular: [b("pasif", "bad")], sonEtkinlik: once(9) }),
    satir("c", "Can", { bulgular: [b("odev", "warn")], gecenOdev: { tamamlayan: 0, sayilan: 1 } }),
    satir("d", "Deniz", { gecenOdev: { tamamlayan: 1, sayilan: 2 } }),
    satir("e", "Ali"),
    satir("f", "Fatma", { bulgular: [b("plan", "warn")], sonEtkinlik: once(5) }),
    satir("g", "Gül", { bulgular: [b("plan", "warn")], sonEtkinlik: once(2) }),
    satir("h", "Çağla"),
    satir("i", "Cem"),
  ];
  const sira = buHafta.buHaftaSirala(liste).map((s) => s.id).join(",");
  check(
    "önce müdahale (puan, yapılmayan ödev, en uzun sessiz), sonra ada göre (Türkçe sıra)",
    sira === "b,c,f,g,d,e,i,h,a",
    sira
  );
  check("bulgusu olmayan ama ödev açığı olan müdahale ister", buHafta.mudahaleGerekir(liste[3]));
  check("bulgusu ve ödev açığı olmayan müdahale istemez", !buHafta.mudahaleGerekir(liste[0]));
  check("sıralama girdiyi değiştirmez", liste.map((s) => s.id).join(",") === "a,b,c,d,e,f,g,h,i");
}

console.log("\nParola sıfırlama jetonu (app ile eşit):");
{
  const jetonlar = Array.from({ length: 200 }, () => sifirlama.sifirlamaJetonuUret());
  check("jeton 32 bayt base64url (43 karakter)", jetonlar.every((j) => /^[A-Za-z0-9_-]{43}$/.test(j)));
  check("200 jetonda çakışma yok", new Set(jetonlar).size === jetonlar.length);
  check("24 saat geçerli", sifirlama.SIFIRLAMA_GECERLILIK_SAAT === 24);
  check("personel başına saatlik sınır var", sifirlama.SIFIRLAMA_SAATLIK_SINIR > 0 && sifirlama.SIFIRLAMA_SAATLIK_SINIR <= 10);
  check(
    "ekrandaki uyarı",
    sifirlama.SIFIRLAMA_UYARISI === "Bu bağlantıyla öğrencinin parolası değiştirilebilir. Yalnızca öğrencinin kendisine ilet."
  );

  // Uygulamanın kendi kodu: hashToken "use server" dosyasında ve dışa aktarılmıyor
  // (içe aktarmak server-only zincirine takılır). Fonksiyonun gövdesi kaynaktan
  // okunup çalıştırılıyor: uygulama özet yöntemini değiştirirse bu test kırılır.
  const yol = resolve(dirname(fileURLToPath(import.meta.url)), "../lib/actions/password-reset.ts");
  const kaynak = readFileSync(yol, "utf8").replace(/\r\n/g, "\n");
  const govde = kaynak.match(/function hashToken\(token: string\)\s*\{\n([\s\S]*?)\n\}/)?.[1];
  check("app'te hashToken bulundu", Boolean(govde), govde ? "" : "lib/actions/password-reset.ts değişmiş; sifirlama.ts ile yeniden karşılaştır");
  if (govde) {
    const appOzeti = new Function("createHash", "token", govde) as (c: typeof createHash, t: string) => string;
    check(
      "200 jetonun özeti app'in hashToken'ıyla aynı",
      jetonlar.every((j) => appOzeti(createHash, j) === sifirlama.sifirlamaJetonuOzeti(j))
    );
  }
  check("app jetonu aynı biçimde üretiyor (randomBytes(32), base64url)", kaynak.includes('randomBytes(32).toString("base64url")'));
  const adres = kaynak.match(/link: `\$\{appUrl\(\)\}(\/[^`$]*)\$\{token\}`/)?.[1];
  check("app bağlantısı /sifre-sifirla/<jeton>", adres === "/sifre-sifirla/", String(adres));
  check(
    "panelin bağlantısı aynı adres",
    sifirlama.sifirlamaBaglantisi("https://checkup.kocum.net/", "abc") === "https://checkup.kocum.net/sifre-sifirla/abc"
  );
  check(
    "app'in sıfırlama sayfası var",
    existsSync(resolve(dirname(fileURLToPath(import.meta.url)), "../app/(auth)/sifre-sifirla/[token]/page.tsx"))
  );
  check(
    "app jetonun süresini kayıttan okuyor (24 saat panelde yazılabilsin)",
    /kayit\.expiresAt\s*<\s*new Date\(\)/.test(kaynak)
  );
  // Sayaç personel kimliğine bakar: #7'nin sınırına #70 sayılmasın.
  check("sayaç kimlik kuyruğu: (#7)", sifirlama.damgaKimligi(7) === "(#7)");
  check("#70 damgası #7'nin sayacına girmez", !"koc@kocum.net (#70)".endsWith(sifirlama.damgaKimligi(7)));
  check("#7 damgası e-posta değişse de sayılır", "yeni@kocum.net (#7)".endsWith(sifirlama.damgaKimligi(7)));
}

console.log(failed === 0 ? "\n✓ Koç paneli kuralları: hepsi geçti." : `\n✗ ${failed} kontrol başarısız.`);
process.exit(failed === 0 ? 0 : 1);
