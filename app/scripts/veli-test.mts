import "./_koruma.mjs";
/**
 * Veli bağlantısı — jeton yaşam döngüsü + VELİ RAPORU SIZINTI DENETİMİ.
 *
 *   npm run test:veli
 *
 * Neden var: veli sayfası GİRİŞSİZ. Rapora bir gün "kolaylık olsun" diye soru
 * metni, e-posta ya da cevap eklenirse bunu bağlantıyı bilen herkes görür ve
 * arayüzde hiçbir şey ters görünmez. Bu test raporun verisini (JSON) ve
 * çizilmiş HTML'ini öğrencinin gördüğü soruların metnine, cevap anahtarına,
 * e-postaya ve kimliklere karşı tarar; jetonun saklanmadığını, süre, kaldırma
 * ve "en fazla 3" kurallarını denetler.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { getStudentSession, saveAnswer, startCheckup, startTopicRetest, submitCheckup } from "../lib/checkup";
import { answerPractice, getPracticeSession, konuCalismasiBaslat } from "../lib/practice";
import { soruSinavdaKosulu } from "../lib/exam-scope";
import {
  EN_FAZLA_VELI_BAGLANTISI,
  RAPOR_TEST_SAYISI,
  VELI_JETONU,
  VELI_KAYIT_SAKLAMA_GUN,
  ilkAd,
  onizleyiciMi,
  whatsappAdresi,
} from "../lib/veli";
import {
  eskiVeliBaglantilariniSil,
  etkinVeliBaglantilari,
  goruntulenmeKaydet,
  veliBaglantisiOlustur,
  veliBaglantisiniCoz,
  veliBaglantisiniKaldir,
  veliRaporu,
} from "../lib/veli-raporu";
import { VeliDurumu, VeliKabugu, VeliRaporuGorunumu } from "../components/VeliRaporu";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const EMAIL = "veli-test@kocum.local";
const OTHER_EMAIL = "veli-test-other@kocum.local";
const AD_SOYAD = "Ayşe Nurcan Velitestoğlu";
const PAKET = "tyt-ilk-15";
const GUN = 86_400_000;

/** Cevap anahtarının ve iç alanların izi. */
const ANAHTAR_IZLERI = ["isCorrect", "is_correct", "errorType", "error_type", "answerKey", "choiceId", "stemText", "solution"];

async function hataAdi(p: Promise<unknown>): Promise<string> {
  // tsx'te ../lib ile @/lib ayrı modül: instanceof yerine ada bakılır.
  return p.then(
    () => "hata yok",
    (e) => (e instanceof Error ? e.name : String(e))
  );
}

/** React'in HTML'de kaçırdığı karakterler: tırnaklı bir soru metni düz aramada görünmezdi. */
const htmlKacir = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** Metin düz hâliyle, HTML'de kaçırılmış ya da JSON'da kaçırılmış hâliyle geçiyor mu. */
const geciyor = (metin: string, s: string) =>
  metin.includes(s) || metin.includes(htmlKacir(s)) || metin.includes(JSON.stringify(s).slice(1, -1));

/** JSON bloklarındaki bütün metin düğümleri (soru gövdesi, şık, çözüm). */
function metinler(json: unknown, out: string[] = []): string[] {
  if (Array.isArray(json)) for (const x of json) metinler(x, out);
  else if (json && typeof json === "object") {
    for (const [k, v] of Object.entries(json)) {
      if ((k === "text" || k === "latex") && typeof v === "string") out.push(v);
      else metinler(v, out);
    }
  }
  return out;
}

async function kullanici(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: "TYT",
      onboardedAt: new Date(),
    },
    update: { name, targetExam: "TYT" },
    select: { id: true },
  });
}

/** Bir paketi çözüp bitirir: ilk `dogru` soru doğru, sonraki `yanlis` soru yanlış, kalanı boş. */
async function testCoz(userId: string, dogru: number, yanlis: number): Promise<string> {
  const id = await startCheckup(userId, PAKET);
  const s = await getStudentSession(id, userId);
  const anahtar = new Map(
    (
      await prisma.choice.findMany({
        where: { questionId: { in: s.questions.map((q) => q.id) }, isCorrect: true },
        select: { questionId: true, id: true },
      })
    ).map((c) => [c.questionId, c.id])
  );
  for (const [i, q] of s.questions.entries()) {
    const dogruSik = anahtar.get(q.id)!;
    const secim = i < dogru ? dogruSik : i < dogru + yanlis ? q.choices.find((c) => c.id !== dogruSik)!.id : null;
    if (secim) await saveAnswer({ sessionId: id, userId, questionId: q.id, choiceId: secim, timeSpentMs: 30_000 });
  }
  await submitCheckup(id, userId);
  return id;
}

/**
 * Ölçülen konularda sırayla `ac`ı dener ve ilk açılanı döndürür. Havuzu ya da
 * sınırı yetmeyen konu (CheckupError) atlanır; beklenmeyen hata yukarı çıkar.
 * Hiçbir konuda açılmazsa nedenleriyle başarısız olur: denetim sessizce
 * atlanmasın.
 */
async function ilkAcilan(ne: string, konular: string[], ac: (topicId: string) => Promise<string>) {
  const nedenler: string[] = [];
  for (const topicId of konular) {
    try {
      return { id: await ac(topicId), topicId };
    } catch (e) {
      // tsx'te ../lib ile @/lib ayrı modül: instanceof yerine ada bakılır.
      if (!(e instanceof Error) || e.name !== "CheckupError") throw e;
      nedenler.push(e.message);
    }
  }
  throw new Error(`${ne} ölçülen ${konular.length} konunun hiçbirinde açılamadı: ${[...new Set(nedenler)].join(" | ")}`);
}

/** Oturumdaki soruların konuları, havuzu (yayındaki TYT sorusu) geniş olan önce. */
async function olculenKonular(sessionId: string): Promise<string[]> {
  const konular = [
    ...new Set(
      (await prisma.sessionItem.findMany({ where: { sessionId }, select: { question: { select: { topicId: true } } } })).map(
        (i) => i.question.topicId
      )
    ),
  ];
  const havuz = new Map(
    (
      await prisma.question.groupBy({
        by: ["topicId"],
        where: { status: "PUBLISHED", topicId: { in: konular }, AND: [soruSinavdaKosulu("TYT")] },
        _count: { _all: true },
      })
    ).map((g) => [g.topicId, g._count._all])
  );
  return konular.sort((a, b) => (havuz.get(b) ?? 0) - (havuz.get(a) ?? 0));
}

async function main() {
  const user = await kullanici(EMAIL, AD_SOYAD);
  const other = await kullanici(OTHER_EMAIL, "Başka Öğrenci");
  const kimlikler = [user.id, other.id];
  await prisma.checkupSession.deleteMany({ where: { userId: { in: kimlikler } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: kimlikler } } });
  await prisma.notebookItem.deleteMany({ where: { userId: { in: kimlikler } } });
  await prisma.studyPlan.deleteMany({ where: { userId: { in: kimlikler } } });
  await prisma.parentLink.deleteMany({ where: { userId: { in: kimlikler } } });

  // ── Saf kurallar ────────────────────────────────────────────
  console.log("\nSaf kurallar:");
  check("ilk ad yalnızca ilk kelime", ilkAd("  Ayşe Nurcan  Velitestoğlu ") === "Ayşe");
  check("WhatsApp önizleyicisi bot sayılıyor", onizleyiciMi("WhatsApp/2.23.20.0 A"));
  check("Facebook / Telegram önizleyicisi bot sayılıyor", onizleyiciMi("facebookexternalhit/1.1") && onizleyiciMi("TelegramBot (like TwitterBot)"));
  check(
    "telefon tarayıcısı bot sayılmıyor (CUBOT dahil)",
    !onizleyiciMi("Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36") &&
      !onizleyiciMi("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1") &&
      !onizleyiciMi(null)
  );
  const wa = whatsappAdresi("https://checkup.kocum.net/veli/abc", new Date());
  check(
    "WhatsApp adresi wa.me/?text= + kodlanmış mesaj, bağlantı sonda",
    wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa.slice(20)).endsWith("https://checkup.kocum.net/veli/abc")
  );

  // ── Veri: iki ölçüm, bir kontrol testi, bir alıştırma ──────
  console.log("\nVeri:");
  const ilk = await testCoz(user.id, 5, 7);
  const ikinci = await testCoz(user.id, 11, 3);
  check("iki ölçüm bitti", Boolean(ilk && ikinci));

  // Kontrol testi: konu haritasına girer, eğilime ve test listesine girmez.
  // Eskiden ilk sorunun konusunda deneniyor, açılmazsa denetim sessizce
  // atlanıyordu. Şimdi havuzu yeten ölçülmüş bir konuda MUTLAKA açılıyor ve
  // cevaplanıyor (işaretsiz test konu haritasına da girmez; denetim boşa
  // dönmesin).
  const konular = await olculenKonular(ilk);
  const kontrol = await ilkAcilan("Kontrol testi", konular, (konu) => startTopicRetest(user.id, konu, "TYT"));
  const kontrolSorulari = await getStudentSession(kontrol.id, user.id);
  for (const q of kontrolSorulari.questions) {
    await saveAnswer({ sessionId: kontrol.id, userId: user.id, questionId: q.id, choiceId: q.choices[0].id, timeSpentMs: 20_000 });
  }
  await submitCheckup(kontrol.id, user.id);
  const kontrolPaketi = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: kontrol.id },
    select: { status: true, package: { select: { name: true } } },
  });
  check("kontrol testi açıldı ve bitti", kontrolPaketi.status === "SUBMITTED" && kontrolSorulari.questions.length > 0);

  // Alıştırma: ölçüm değil, raporun hiçbir yerine girmez. Havuzu yeten ilk konu.
  const alistirmaId = (await ilkAcilan("Alıştırma", konular, (konu) => konuCalismasiBaslat(user.id, konu, ilk))).id;
  const alistirma = await getPracticeSession(alistirmaId, user.id);
  const ilkSoru = alistirma.questions[0];
  await answerPractice({ sessionId: alistirmaId, userId: user.id, questionId: ilkSoru.id, choiceId: ilkSoru.choices[0].id, timeSpentMs: 5_000 });
  const alistirmaPaketi = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: alistirmaId },
    select: { package: { select: { name: true } } },
  });
  check("alıştırma açıldı ve cevaplandı", alistirma.questions.length > 0);

  // ── Rapor verisi ────────────────────────────────────────────
  console.log("\nRapor verisi:");
  const rapor = await veliRaporu(user.id);
  const json = JSON.stringify(rapor);

  check("yalnızca ilk ad", rapor.ad === "Ayşe" && !json.includes("Velitestoğlu") && !json.includes("Nurcan"), rapor.ad);
  check("hedef sınav TYT", rapor.sinav?.kisa === "TYT");
  check("iki ölçüm sayıldı (kontrol testi ve alıştırma hariç)", rapor.olcumSayisi === 2, String(rapor.olcumSayisi));
  check("eğilimde iki nokta", rapor.egilim.length === 2);
  // Paket adlarıyla: kontrol testinin adı ("Konu Tekrar Testi") "kontrol"
  // kelimesini içermiyor, kelime aramak denetimi boşa düşürüyordu.
  const olcumPaketi = await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { name: true } });
  check(
    `son testler en fazla ${RAPOR_TEST_SAYISI}, yalnızca ölçümler`,
    rapor.sonTestler.length === 2 && rapor.sonTestler.every((t) => t.paket === olcumPaketi.name),
    rapor.sonTestler.map((t) => t.paket).join(", ")
  );
  const sonuclar = await prisma.checkupResult.findMany({
    where: { sessionId: { in: [ilk, ikinci] } },
    select: { sessionId: true, correctCount: true, wrongCount: true, blankCount: true },
  });
  const ikinciSonuc = sonuclar.find((r) => r.sessionId === ikinci)!;
  const beklenenOran = Math.round(
    (ikinciSonuc.correctCount / (ikinciSonuc.correctCount + ikinciSonuc.wrongCount + ikinciSonuc.blankCount)) * 100
  );
  check("son ölçüm ikinci test", rapor.sonOlcum?.oran === beklenenOran, `%${rapor.sonOlcum?.oran} / %${beklenenOran}`);
  check("son ölçümün değişimi bir öncekine göre", typeof rapor.sonOlcum?.degisim === "number" && rapor.sonOlcum.degisim > 0);
  check("alıştırma paketi raporda yok", !json.includes(alistirmaPaketi.package.name), alistirmaPaketi.package.name);
  check(
    "kontrol testi eğilimde, son ölçümde ve listede yok",
    !json.includes(kontrolPaketi.package.name),
    kontrolPaketi.package.name
  );
  const acikDefter = await prisma.notebookItem.count({ where: { userId: user.id, resolvedAt: null } });
  check("açık defter sayısı doğru", rapor.acikDefter === acikDefter && acikDefter > 0, String(rapor.acikDefter));
  check("bu haftanın planı var", rapor.plan !== null && rapor.plan.toplam > 0, JSON.stringify(rapor.plan));

  // Alan listesi sabit: yeni bir alan eklenirse burada yakalanır (önce gizlilik kararı).
  check(
    "rapor alanları beklenen liste",
    Object.keys(rapor).sort().join(",") ===
      "acikDefter,ad,egilim,gucluKonular,odevler,olcumSayisi,plan,sinav,sonOlcum,sonTestler,zayifKonular",
    Object.keys(rapor).join(",")
  );
  check(
    "konu ve test satırlarında kimlik yok",
    [...rapor.gucluKonular, ...rapor.zayifKonular].every((k) => Object.keys(k).sort().join(",") === "ad,dogru,oran,soru") &&
      rapor.sonTestler.every((t) => Object.keys(t).sort().join(",") === "net,oran,paket,tarih")
  );

  // ── Sızıntı: veri ve HTML ───────────────────────────────────
  // Öğrencinin gördüğü her soru (ölçüm, kontrol, alıştırma): metin, şık, çözüm, kimlik.
  const gorulen = await prisma.sessionItem.findMany({
    where: { session: { userId: user.id } },
    select: {
      sessionId: true,
      question: {
        select: {
          id: true,
          stemText: true,
          stem: true,
          solution: true,
          choices: { select: { id: true, content: true } },
        },
      },
    },
  });
  const yasakMetinler = new Set<string>();
  const yasakKimlikler = new Set<string>(kimlikler);
  for (const g of gorulen) {
    yasakKimlikler.add(g.sessionId);
    yasakKimlikler.add(g.question.id);
    for (const c of g.question.choices) yasakKimlikler.add(c.id);
    // Kısa parçalar ("x", "12") rakamlarla karışır; anlamlı uzunluktakiler aranır.
    for (const t of [g.question.stemText, ...metinler(g.question.stem), ...metinler(g.question.solution), ...g.question.choices.flatMap((c) => metinler(c.content))]) {
      const s = t.trim();
      if (s.length >= 15) yasakMetinler.add(s);
    }
  }
  const konuKimlikleri = await prisma.topic.findMany({ select: { id: true } });
  for (const k of konuKimlikleri) yasakKimlikler.add(k.id);

  const bitis = new Date(Date.now() + 30 * GUN);
  const html = renderToStaticMarkup(
    createElement(VeliKabugu, null, createElement(VeliRaporuGorunumu, { rapor, bitis }))
  );

  for (const [ad, metin] of [
    ["veri", json],
    ["HTML", html],
  ] as const) {
    console.log(`\nSızıntı (${ad}):`);
    for (const iz of ANAHTAR_IZLERI) check(`"${iz}" yok`, !metin.includes(iz));
    check("e-posta yok", !metin.includes(EMAIL) && !metin.includes(OTHER_EMAIL) && !metin.includes("@"));
    check("soyadı yok", !metin.includes("Velitestoğlu"));
    const metinSizan = [...yasakMetinler].filter((s) => geciyor(metin, s));
    check(`soru / şık / çözüm metni yok (${yasakMetinler.size} parça arandı)`, yasakMetinler.size > 0 && metinSizan.length === 0, metinSizan[0]?.slice(0, 60) ?? "");
    const kimlikSizan = [...yasakKimlikler].filter((k) => metin.includes(k));
    check(`kimlik yok (öğrenci, oturum, soru, şık, konu: ${yasakKimlikler.size})`, kimlikSizan.length === 0, kimlikSizan[0] ?? "");
  }
  check("HTML'de ilk ad ve hedef sınav var", html.includes("Ayşe") && html.includes("Hedef: TYT"));
  check("HTML'de son testin paketi var", geciyor(html, rapor.sonTestler[0]?.paket ?? "∅"));

  const kapaliHtml = renderToStaticMarkup(createElement(VeliKabugu, null, createElement(VeliDurumu, { tur: "kapali" })));
  check("kapalı bağlantı sayfasında veri yok", !kapaliHtml.includes("Ayşe") && !kapaliHtml.includes("%") && kapaliHtml.includes("artık açık değil"));

  // ── Jeton yaşam döngüsü ─────────────────────────────────────
  console.log("\nOluştur:");
  const a = await veliBaglantisiOlustur(user.id, 30);
  check("jeton 43 karakter base64url", VELI_JETONU.test(a.jeton), String(a.jeton.length));
  check("bitiş 30 gün sonra", Math.abs(a.expiresAt.getTime() - (Date.now() + 30 * GUN)) < 60_000);
  const satir = await prisma.parentLink.findUniqueOrThrow({ where: { id: a.id } });
  check("jeton saklanmıyor, yalnızca SHA-256'sı", !JSON.stringify(satir).includes(a.jeton) && satir.tokenHash === createHash("sha256").update(a.jeton).digest("hex"));
  check("yeni bağlantı açılmamış", satir.viewCount === 0 && satir.lastViewedAt === null);

  console.log("\nAç:");
  const erisim = await veliBaglantisiniCoz(a.jeton);
  check("geçerli jeton öğrenciyi buluyor", erisim.durum === "GECERLI" && erisim.userId === user.id);
  check("biçimi bozuk jeton veritabanına sorulmadan reddediliyor", (await veliBaglantisiniCoz("abc' OR 1=1 --")).durum === "GECERSIZ");
  check("bilinmeyen jeton reddediliyor", (await veliBaglantisiniCoz("A".repeat(43))).durum === "GECERSIZ");
  check("jetonun özeti jeton yerine geçmiyor", (await veliBaglantisiniCoz(satir.tokenHash)).durum === "GECERSIZ");
  await goruntulenmeKaydet(a.id);
  await goruntulenmeKaydet(a.id);
  const acilan = await prisma.parentLink.findUniqueOrThrow({ where: { id: a.id }, select: { viewCount: true, lastViewedAt: true } });
  check("açılma sayılıyor", acilan.viewCount === 2 && acilan.lastViewedAt !== null, String(acilan.viewCount));

  console.log(`\nEn fazla ${EN_FAZLA_VELI_BAGLANTISI}:`);
  const b = await veliBaglantisiOlustur(user.id, 7);
  const c = await veliBaglantisiOlustur(user.id, 90);
  check("7 ve 90 günlük bağlantı", Math.abs(b.expiresAt.getTime() - Date.now() - 7 * GUN) < 60_000 && Math.abs(c.expiresAt.getTime() - Date.now() - 90 * GUN) < 60_000);
  check("dördüncü reddediliyor", (await hataAdi(veliBaglantisiOlustur(user.id, 30))) === "VeliHatasi");
  check("hâlâ 3 etkin", (await etkinVeliBaglantilari(user.id)).length === 3);
  const esZamanli = await Promise.allSettled([veliBaglantisiOlustur(other.id, 30), veliBaglantisiOlustur(other.id, 30), veliBaglantisiOlustur(other.id, 30), veliBaglantisiOlustur(other.id, 30), veliBaglantisiOlustur(other.id, 30)]);
  const digerEtkin = await prisma.parentLink.count({ where: { userId: other.id, revokedAt: null, expiresAt: { gt: new Date() } } });
  check("aynı anda beş istek de sınırı aşmıyor", digerEtkin === 3 && esZamanli.filter((r) => r.status === "fulfilled").length === 3, String(digerEtkin));

  console.log("\nSüre dolunca:");
  await prisma.parentLink.update({ where: { id: b.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("süresi dolan jeton reddediliyor", (await veliBaglantisiniCoz(b.jeton)).durum === "GECERSIZ");
  await goruntulenmeKaydet(b.id);
  check("süresi dolana açılma yazılmıyor", (await prisma.parentLink.findUniqueOrThrow({ where: { id: b.id } })).viewCount === 0);
  check("süresi dolan etkin listede yok, yenisi açılabiliyor", (await etkinVeliBaglantilari(user.id)).length === 2 && (await hataAdi(veliBaglantisiOlustur(user.id, 30))) === "hata yok");

  console.log("\nKaldır:");
  check("başkasının bağlantısı kaldırılamıyor", (await veliBaglantisiniKaldir(other.id, c.id)) === false);
  check("sahibi kaldırıyor", (await veliBaglantisiniKaldir(user.id, c.id)) === true);
  check("ikinci kez kaldırma false", (await veliBaglantisiniKaldir(user.id, c.id)) === false);
  check("kaldırılan jeton reddediliyor", (await veliBaglantisiniCoz(c.jeton)).durum === "GECERSIZ");
  await goruntulenmeKaydet(c.id);
  check("kaldırılana açılma yazılmıyor", (await prisma.parentLink.findUniqueOrThrow({ where: { id: c.id } })).viewCount === 0);
  check("kaldırılınca yeni bağlantıya yer açılıyor", (await etkinVeliBaglantilari(user.id)).length === 2);

  console.log("\nBakım:");
  const eski = new Date(Date.now() - (VELI_KAYIT_SAKLAMA_GUN + 1) * GUN);
  await prisma.parentLink.update({ where: { id: c.id }, data: { revokedAt: eski } });
  await prisma.parentLink.update({ where: { id: b.id }, data: { expiresAt: eski } });
  const silinen = await eskiVeliBaglantilariniSil();
  const kalanlar = await prisma.parentLink.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, select: { id: true } });
  check(`${VELI_KAYIT_SAKLAMA_GUN} günü geçen kayıtlar siliniyor, etkin olan kalıyor`, silinen >= 2 && kalanlar.length === 1 && kalanlar[0].id === a.id, `${silinen} silindi`);

  // ── Hesap silinince ─────────────────────────────────────────
  console.log("\nHesap silme:");
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
  check("bağlantılar hesapla birlikte gidiyor", (await prisma.parentLink.count({ where: { userId: { in: kimlikler } } })) === 0);
  check("silinen hesabın jetonu reddediliyor", (await veliBaglantisiniCoz(a.jeton)).durum === "GECERSIZ");

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
