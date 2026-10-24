import "./_koruma.mjs";
/**
 * Hesap, ölçüm doğruluğu ve gruba katılım — uçtan uca.
 *
 *   npx tsx scripts/hesap-test.mts
 *
 * Denetler:
 *  1. Saf kurallar: girişten sonra dönülecek yol (`sonra`, açık yönlendirme
 *     yok), kayıt kaynağı izin listesi, davet kodu biçimi, bitirme sebebi,
 *     kayan oturum ve son etkinlik eşikleri.
 *  2. Yarım test: süresi dolup %8 işaretli test ölçüme, plana ve deftere
 *     (boşlarıyla) girmez; aynı oranı öğrenci kendisi bitirince girer; %60
 *     işaretli süresi dolan test girer. Deneme havuzu ve yüzdelik de aynı kural.
 *  3. endedBy her kapanış yolunda: "Bitir" (STUDENT), bakım (TIMEOUT), yeniden
 *     başlatma (RESTART), kontrol testi, seviyeli aşama, alıştırma.
 *  4. Zorluk geri bildirimi: yalnızca kendi ölçüm sayılan paket testine.
 *  5. Davet kodu: geçerli, kapalı, arşiv, zaten üye, kayıtta gruba girme.
 *  6. Son etkinlik saatte bir; oturum eşikte uzar, süresi dolan uzamaz.
 *
 * Tohumlu veritabanı ister (db:seed, db:seed:demo, db:seed:levels). Kendi
 * öğrencilerini, grubunu, paketini ve oturumlarını açar, sonunda siler.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { grantEntitlement } from "../lib/entitlements";
import {
  KAYIT_TOLERANSI_MS,
  bitirmeSebebi,
  denemeHavuzu,
  denemeKarsilastirmasi,
  expireStaleSessions,
  saveAnswer,
  startCheckup,
  startTopicRetest,
  submitCheckup,
  zorlukGeriBildirimiYaz,
  zorlukSorulur,
} from "../lib/checkup";
import { egilimeGirer, konuHaritasinaGirer, olcumDisi, yarimKaldi } from "../lib/insights";
import { planKaynagi } from "../lib/plan";
import { seviyeliSinavBaslat } from "../lib/level-run";
import { konuCalismasiBaslat } from "../lib/practice";
import { hesapAc, oturumuUzat, sonEtkinligiYaz } from "../lib/auth";
import {
  KAYIT_KAYNAKLARI,
  OTURUM_GUN,
  girisYolu,
  guvenliSonra,
  kayitKaynagi,
  kimlikAdresi,
  oturumUzatilmali,
  sonEtkinlikYazilmali,
} from "../lib/hesap-kurallari";
import {
  DAVET_DAMGASI,
  DAVET_KODU_ALFABESI,
  DAVET_KODU_UZUNLUGU,
  davetiBul,
  grubaKatil,
  kodGecerliMi,
  kodNormalize,
  kodUret,
} from "../lib/grup-katilim";

let failed = 0;
let gecen = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) gecen += 1;
  else failed += 1;
}

const ON = "hesap-test";
const DAMGA = "hesap-test@kocum.local (#0)";
const EPOSTA = {
  yarim: `${ON}-yarim@kocum.local`,
  bitiren: `${ON}-bitiren@kocum.local`,
  altmis: `${ON}-altmis@kocum.local`,
  yeniden: `${ON}-yeniden@kocum.local`,
  seviye: `${ON}-seviye@kocum.local`,
  deneme1: `${ON}-deneme1@kocum.local`,
  deneme2: `${ON}-deneme2@kocum.local`,
  deneme3: `${ON}-deneme3@kocum.local`,
  deneme4: `${ON}-deneme4@kocum.local`,
  uye: `${ON}-uye@kocum.local`,
  baska: `${ON}-baska@kocum.local`,
  kayit: `${ON}-kayit@kocum.local`,
  kayitKapali: `${ON}-kayit-kapali@kocum.local`,
};
const PAKET = "tyt-matematik-genel"; // 24 soru: 2'si %8, 15'i %62,5
const SINAV = "TYT" as const;
const DENEME_PAKETI = `${ON}-deneme`;
const GUN = 86_400_000;

async function kullanici(email: string): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Hesap Testi",
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: SINAV,
      onboardedAt: new Date(),
    },
    update: {},
    select: { id: true },
  });
  return u.id;
}

async function temizle() {
  const kullanicilar = await prisma.user.findMany({
    where: { email: { in: Object.values(EPOSTA) } },
    select: { id: true },
  });
  const ids = kullanicilar.map((u) => u.id);
  await prisma.studyGroup.deleteMany({ where: { name: { startsWith: `${ON} ` } } });
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.package.deleteMany({ where: { slug: DENEME_PAKETI } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notebookItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** Oturumun soruları, doğru ve bir yanlış şıkla. */
async function anahtar(sessionId: string) {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: {
      questionId: true,
      question: { select: { topicId: true, choices: { select: { id: true, isCorrect: true } } } },
    },
  });
  return items.map((i) => ({
    questionId: i.questionId,
    topicId: i.question.topicId,
    dogru: i.question.choices.find((c) => c.isCorrect)!.id,
    yanlis: i.question.choices.find((c) => !c.isCorrect)!.id,
  }));
}

/** İlk `adet` soruyu işaretler: ilki doğru, kalanı sırayla yanlış/doğru. */
async function isaretle(sessionId: string, userId: string, adet: number) {
  const a = await anahtar(sessionId);
  for (let i = 0; i < adet; i++) {
    await saveAnswer({
      sessionId,
      userId,
      questionId: a[i].questionId,
      choiceId: i % 2 === 0 ? a[i].dogru : a[i].yanlis,
      timeSpentMs: 2000,
    });
  }
  return a;
}

/** Süreyi kayıt toleransının da ötesine geçirir: bakım işi puanlasın. */
async function suresiniDoldur(sessionId: string) {
  await prisma.checkupSession.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() - KAYIT_TOLERANSI_MS - 5_000) },
  });
}

/** Sonucu süzgeçlerin okuduğu biçimde (endedBy oturumdan, sayılar sonuçtan). */
async function olcumKaydi(sessionId: string) {
  const s = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      kind: true,
      status: true,
      endedBy: true,
      result: { select: { correctCount: true, wrongCount: true, blankCount: true, examScope: true } },
    },
  });
  return {
    status: s.status,
    endedBy: s.endedBy,
    kayit: s.result ? { kind: s.kind, endedBy: s.endedBy, ...s.result } : null,
  };
}

const defterSayisi = (userId: string, sessionId: string) =>
  prisma.notebookItem.count({ where: { userId, lastSessionId: sessionId } });

// ─────────────────────────────────────────────────────────────
// 1. Saf kurallar
// ─────────────────────────────────────────────────────────────

function safKurallar() {
  console.log("\nGirişten sonra dönüş (sonra):");
  for (const iyi of ["/sonuc/abc123", "/katil/ABCD2345", "/gelisim?tur=TYT", "/"]) {
    check(`kabul: ${iyi}`, guvenliSonra(iyi) === iyi, String(guvenliSonra(iyi)));
  }
  const kotuler = [
    "//evil.com",
    "//evil.com/panel",
    "https://evil.com",
    "http://evil.com/x",
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/a/..//evil.com",
    "javascript:alert(1)",
    "evil.com",
    " /panel",
    "",
    "/giris",
    "/kayit?sonra=/x",
    "/" + "a".repeat(600),
  ];
  for (const kotu of kotuler) {
    check(`red: ${JSON.stringify(kotu.length > 40 ? kotu.slice(0, 20) + "…" : kotu)}`, guvenliSonra(kotu) === null, String(guvenliSonra(kotu)));
  }
  check("dizi ise ilk değer; sayı/boş reddedilir", guvenliSonra(["/panel", "//x"]) === "/panel" && guvenliSonra(42) === null && guvenliSonra(undefined) === null);
  check("çapa atılır", guvenliSonra("/sonuc/x#inceleme") === "/sonuc/x");
  check(
    "giriş yolu: sonra kodlanır, pano için gerek yok",
    girisYolu("/sonuc/a?b=1") === "/giris?sonra=%2Fsonuc%2Fa%3Fb%3D1" && girisYolu("/panel") === "/giris" && girisYolu(null) === "/giris",
    girisYolu("/sonuc/a?b=1")
  );
  check(
    "kimlik sayfaları arası adres (sonra, grup, k)",
    kimlikAdresi("/kayit", { sonra: "/x", grup: "ABCD2345", k: "blog" }) === "/kayit?sonra=%2Fx&grup=ABCD2345&k=blog" &&
      kimlikAdresi("/giris", {}) === "/giris"
  );

  console.log("\nKayıt kaynağı izin listesi:");
  check(
    "listedeki her etiket kendisi",
    KAYIT_KAYNAKLARI.every((k) => kayitKaynagi(k) === k) && KAYIT_KAYNAKLARI.length === 9
  );
  check("büyük harf ve boşluk temizlenir", kayitKaynagi(" HERO ") === "hero");
  check("listede olmayan → diger", kayitKaynagi("facebook") === "diger" && kayitKaynagi("<script>") === "diger");
  check("boş → null", kayitKaynagi("") === null && kayitKaynagi("   ") === null && kayitKaynagi(undefined) === null && kayitKaynagi(null) === null);
  check("dizi ise ilk değer", kayitKaynagi(["blog", "ust"]) === "blog");

  console.log("\nDavet kodu biçimi:");
  const kodlar = Array.from({ length: 200 }, () => kodUret());
  check(
    `üretilen kod ${DAVET_KODU_UZUNLUGU} karakter ve geçerli`,
    kodlar.every((k) => k.length === DAVET_KODU_UZUNLUGU && kodGecerliMi(k))
  );
  check("alfabede 0, O, 1, I yok", !/[0O1I]/.test(DAVET_KODU_ALFABESI) && DAVET_KODU_ALFABESI.length === 32);
  check("kodlar rastgele (200'de çakışma yok)", new Set(kodlar).size === kodlar.length);
  check("küçük harf, tire ve boşluk normalize edilir", kodNormalize(" abcd-ef gh ") === "ABCDEFGH" && kodGecerliMi(kodNormalize("abcd-efgh")));
  check(
    "karışan karakter ve yanlış uzunluk reddedilir",
    !kodGecerliMi("ABCDEFG0") && !kodGecerliMi("ABCDEFGI") && !kodGecerliMi("ABCDEFG") && !kodGecerliMi("ABCDEFGHJ") && !kodGecerliMi("")
  );
  check("Türkçe büyütme yok: 'ı' 'I' olmaz, kod reddedilir", !kodGecerliMi(kodNormalize("abcdefgı")));

  console.log("\nBitirme sebebi ve oturum eşikleri:");
  const simdi = new Date("2026-10-24T10:00:00Z");
  const bitis = new Date(simdi.getTime() + 60_000);
  check("ekran 'Bitir' dediyse STUDENT (süre geçmiş olsa da)", bitirmeSebebi("STUDENT", new Date(simdi.getTime() - 3_600_000), simdi) === "STUDENT");
  check("ekran 'süre doldu' dediyse TIMEOUT", bitirmeSebebi("TIMEOUT", bitis, simdi) === "TIMEOUT");
  check("söylenmediyse saat: süre içinde STUDENT", bitirmeSebebi(undefined, bitis, simdi) === "STUDENT");
  check(
    "söylenmediyse saat: tolerans sonrası TIMEOUT",
    bitirmeSebebi(undefined, new Date(simdi.getTime() - KAYIT_TOLERANSI_MS - 1), simdi) === "TIMEOUT"
  );
  check(
    "oturum 15 günün altında uzar, üstünde uzamaz",
    oturumUzatilmali(new Date(simdi.getTime() + 14 * GUN), simdi) && !oturumUzatilmali(new Date(simdi.getTime() + 16 * GUN), simdi)
  );
  check(
    "son etkinlik: boşsa ve saatten eskiyse yazılır",
    sonEtkinlikYazilmali(null, simdi) &&
      sonEtkinlikYazilmali(new Date(simdi.getTime() - 3_600_000), simdi) &&
      !sonEtkinlikYazilmali(new Date(simdi.getTime() - 59 * 60_000), simdi)
  );

  console.log("\nYarım test kuralı (saf):");
  const k = (d: number, y: number, b: number, endedBy: string | null) => ({ kind: "PACKAGE", correctCount: d, wrongCount: y, blankCount: b, endedBy });
  check("süre doldu, 2/24 işaretli → yarım", yarimKaldi(k(1, 1, 22, "TIMEOUT")) && !egilimeGirer(k(1, 1, 22, "TIMEOUT")));
  check("yeniden başlatıldı, 2/24 → yarım", yarimKaldi(k(1, 1, 22, "RESTART")));
  check("öğrenci bitirdi, 2/24 → ölçüm", !yarimKaldi(k(1, 1, 22, "STUDENT")) && egilimeGirer(k(1, 1, 22, "STUDENT")));
  check("eski kayıt (endedBy boş) → ölçüm", !yarimKaldi(k(1, 1, 22, null)));
  check("süre doldu, 15/24 → ölçüm", !yarimKaldi(k(8, 7, 9, "TIMEOUT")));
  check("blankCount seçilmezse kural işlemez (eski davranış)", !yarimKaldi({ correctCount: 1, wrongCount: 1, endedBy: "TIMEOUT" }));
  check("zorluk yalnızca ölçüm sayılan paket testinde", zorlukSorulur(k(5, 5, 14, "STUDENT")) && !zorlukSorulur(k(1, 1, 22, "TIMEOUT")) && !zorlukSorulur(k(0, 0, 24, "STUDENT")) && !zorlukSorulur({ ...k(3, 2, 0, "STUDENT"), kind: "TOPIC_RETEST" }));
}

// ─────────────────────────────────────────────────────────────
// 2-3. Yarım test ve kapanış sebepleri
// ─────────────────────────────────────────────────────────────

async function yarimTest() {
  console.log("\nSüresi dolan, %8 işaretli test:");
  const uA = await kullanici(EPOSTA.yarim);
  const s1 = await startCheckup(uA, PAKET);
  await isaretle(s1, uA, 2); // 1 doğru, 1 yanlış, 22 boş
  await suresiniDoldur(s1);
  await expireStaleSessions();
  const o1 = await olcumKaydi(s1);
  check("bakım kapattı: endedBy TIMEOUT, sonuç var", o1.status === "SUBMITTED" && o1.endedBy === "TIMEOUT" && Boolean(o1.kayit), `${o1.status} ${o1.endedBy}`);
  check("yarım sayıldı (2/24)", Boolean(o1.kayit && yarimKaldi(o1.kayit)), JSON.stringify(o1.kayit));
  check("eğilime ve konu haritasına girmez", Boolean(o1.kayit && !egilimeGirer(o1.kayit, SINAV) && !konuHaritasinaGirer(o1.kayit, SINAV)));
  check("plan KURMADI", (await prisma.studyPlan.count({ where: { userId: uA } })) === 0);
  check("planı oluştur bunu kaynak almaz", (await planKaynagi(uA, SINAV)) === null);
  const d1 = await defterSayisi(uA, s1);
  check("deftere yalnızca işaretlenip yanlış yapılan girdi (boşlar değil)", d1 === 1, `${d1} madde`);
  check("zorluk geri bildirimi yazılamaz", !(await zorlukGeriBildirimiYaz(s1, uA, 2)));

  console.log("\nAynı oran, öğrenci bitirdi:");
  const uB = await kullanici(EPOSTA.bitiren);
  const s2 = await startCheckup(uB, PAKET);
  await isaretle(s2, uB, 2);
  await submitCheckup(s2, uB, undefined, "STUDENT");
  const o2 = await olcumKaydi(s2);
  check("endedBy STUDENT, ölçüm", o2.endedBy === "STUDENT" && Boolean(o2.kayit && !olcumDisi(o2.kayit) && egilimeGirer(o2.kayit, SINAV)));
  const plan2 = await prisma.studyPlan.findFirst({
    where: { userId: uB, sourceSessionId: s2 },
    select: { items: { where: { kind: "RETEST" }, select: { id: true, topicId: true, verifiedBySessionId: true } } },
  });
  check("plan kurdu", Boolean(plan2));
  check("planı oluştur bunu kaynak alır", (await planKaynagi(uB, SINAV))?.sessionId === s2);
  const d2 = await defterSayisi(uB, s2);
  check("deftere yanlış ve boşlar girdi (23)", d2 === 23, `${d2} madde`);

  console.log("\nZorluk geri bildirimi:");
  check("kendi testine yazılır", await zorlukGeriBildirimiYaz(s2, uB, 3));
  const z1 = await prisma.checkupSession.findUniqueOrThrow({ where: { id: s2 }, select: { perceivedDifficulty: true } });
  check("değer 3 (zor)", z1.perceivedDifficulty === 3, String(z1.perceivedDifficulty));
  check("değiştirilebilir", await zorlukGeriBildirimiYaz(s2, uB, 1));
  const z2 = await prisma.checkupSession.findUniqueOrThrow({ where: { id: s2 }, select: { perceivedDifficulty: true } });
  check("değer 1 (kolay)", z2.perceivedDifficulty === 1, String(z2.perceivedDifficulty));
  check("geçersiz değer reddedilir", !(await zorlukGeriBildirimiYaz(s2, uB, 5)) && !(await zorlukGeriBildirimiYaz(s2, uB, "2")));
  check("başkasının oturumuna yazılamaz", !(await zorlukGeriBildirimiYaz(s2, uA, 2)));
  const z3 = await prisma.checkupSession.findUniqueOrThrow({ where: { id: s2 }, select: { perceivedDifficulty: true } });
  check("başkasının denemesi değeri değiştirmedi", z3.perceivedDifficulty === 1);

  console.log("\nKontrol testi:");
  const retest = plan2?.items.find((i) => i.topicId);
  if (!retest?.topicId) {
    check("planda kontrol testi işi var", false);
  } else {
    const r1 = await startTopicRetest(uB, retest.topicId, SINAV);
    const r1a = await anahtar(r1);
    await saveAnswer({ sessionId: r1, userId: uB, questionId: r1a[0].questionId, choiceId: r1a[0].yanlis, timeSpentMs: 2000 });
    await suresiniDoldur(r1);
    await expireStaleSessions();
    const or1 = await olcumKaydi(r1);
    check("süresi dolan kontrol testi: endedBy TIMEOUT, yarım (1/5)", or1.endedBy === "TIMEOUT" && Boolean(or1.kayit && yarimKaldi(or1.kayit)));
    const is1 = await prisma.planItem.findUniqueOrThrow({ where: { id: retest.id }, select: { verifiedBySessionId: true } });
    check("yarım kontrol testi plandaki işi KAPATMADI", is1.verifiedBySessionId === null);
    check("zorluk sorulmaz (kontrol testi)", !(await zorlukGeriBildirimiYaz(r1, uB, 2)));
    const r2 = await startTopicRetest(uB, retest.topicId, SINAV);
    const r2a = await anahtar(r2);
    await saveAnswer({ sessionId: r2, userId: uB, questionId: r2a[0].questionId, choiceId: r2a[0].dogru, timeSpentMs: 2000 });
    await submitCheckup(r2, uB); // varsayılan: öğrencinin "Bitir"i
    const or2 = await olcumKaydi(r2);
    const is2 = await prisma.planItem.findUniqueOrThrow({ where: { id: retest.id }, select: { verifiedBySessionId: true } });
    check("öğrencinin bitirdiği kontrol testi (1/5): STUDENT, işi kapattı", or2.endedBy === "STUDENT" && is2.verifiedBySessionId === r2, `${or2.endedBy} ${is2.verifiedBySessionId}`);
  }

  console.log("\nSüresi dolan, %60 işaretli test:");
  const uC = await kullanici(EPOSTA.altmis);
  const s3 = await startCheckup(uC, PAKET);
  const a3 = await isaretle(s3, uC, 15); // 8 doğru, 7 yanlış, 9 boş
  await suresiniDoldur(s3);
  await expireStaleSessions();
  const o3 = await olcumKaydi(s3);
  check("TIMEOUT ama ölçüm (15/24)", o3.endedBy === "TIMEOUT" && Boolean(o3.kayit && !yarimKaldi(o3.kayit) && egilimeGirer(o3.kayit, SINAV)));
  check("plan kurdu", (await prisma.studyPlan.count({ where: { userId: uC, sourceSessionId: s3 } })) === 1);
  const d3 = await defterSayisi(uC, s3);
  check("deftere yanlışlar ve boşlar girdi (16)", d3 === a3.length - 8, `${d3} madde`);

  console.log("\nYeniden başlatma:");
  const uD = await kullanici(EPOSTA.yeniden);
  const s4 = await startCheckup(uD, PAKET);
  await isaretle(s4, uD, 2);
  // Süre dolmuş ama bakım henüz kapatmadı; öğrenci aynı testi yeniden başlatıyor.
  await prisma.checkupSession.update({ where: { id: s4 }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  const s5 = await startCheckup(uD, PAKET);
  const o4 = await olcumKaydi(s4);
  check("eskisi kapandı: endedBy RESTART, puanlandı", s5 !== s4 && o4.status === "SUBMITTED" && o4.endedBy === "RESTART" && Boolean(o4.kayit), `${o4.status} ${o4.endedBy}`);
  check("yarım: plan yok, defterde yalnızca işaretli yanlış", (await prisma.studyPlan.count({ where: { userId: uD } })) === 0 && (await defterSayisi(uD, s4)) === 1);
  const yeni = await prisma.checkupSession.findUniqueOrThrow({ where: { id: s5 }, select: { status: true, endedBy: true } });
  check("yeni test açık, sebebi boş", yeni.status === "IN_PROGRESS" && yeni.endedBy === null);

  console.log("\nSeviyeli aşama ve alıştırma:");
  const uE = await kullanici(EPOSTA.seviye);
  const seviyeli = await prisma.package.findFirstOrThrow({ where: { kind: "LEVEL", examScope: SINAV }, select: { id: true } });
  await grantEntitlement({ userId: uE, packageId: seviyeli.id, expiresAt: new Date(Date.now() + GUN), source: ON });
  const { runId, sessionId: asama } = await seviyeliSinavBaslat(uE, SINAV);
  if (!asama) {
    check("Seviye 1 açıldı", false);
  } else {
    await isaretle(asama, uE, 1);
    await suresiniDoldur(asama);
    await expireStaleSessions();
    const oa = await olcumKaydi(asama);
    const kosu = await prisma.levelRun.findUniqueOrThrow({ where: { id: runId }, select: { gateLog: true } });
    const log = (Array.isArray(kosu.gateLog) ? kosu.gateLog : []) as { sessionId?: string }[];
    check("süresi dolan aşama: endedBy TIMEOUT", oa.endedBy === "TIMEOUT", String(oa.endedBy));
    check("kapı yine değerlendirildi (yarım aşama kapıdan kalır)", log.some((g) => g.sessionId === asama), `${log.length} kayıt`);
  }
  // Alıştırma: ölçülmüş konu ister (uC'nin testi).
  const konu = (await anahtar(s3))[0].topicId;
  const alistirma = await konuCalismasiBaslat(uC, konu, s3).catch((e: Error) => e);
  if (alistirma instanceof Error) {
    check("alıştırma açıldı", false, alistirma.message);
  } else {
    await suresiniDoldur(alistirma);
    await expireStaleSessions();
    const p = await prisma.checkupSession.findUniqueOrThrow({ where: { id: alistirma }, select: { status: true, endedBy: true } });
    check("süresi dolan alıştırma: EXPIRED, endedBy TIMEOUT", p.status === "EXPIRED" && p.endedBy === "TIMEOUT", `${p.status} ${p.endedBy}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 2b. Deneme havuzu ve yüzdelik
// ─────────────────────────────────────────────────────────────

async function denemeTesti() {
  console.log("\nDeneme havuzu:");
  const paket = await prisma.package.create({
    data: {
      slug: DENEME_PAKETI,
      name: `${ON} deneme`,
      kind: "MOCK",
      examScope: SINAV,
      questionCount: 24,
      durationMinutes: 30,
      status: "DRAFT", // öğrenci kataloğunda görünmesin
    },
    select: { id: true },
  });
  const kayitlar: [string, number, number, number, "STUDENT" | "TIMEOUT"][] = [
    [EPOSTA.deneme1, 12, 6, 6, "STUDENT"], // tam ölçüm
    [EPOSTA.deneme2, 1, 1, 22, "TIMEOUT"], // yarım
    [EPOSTA.deneme3, 0, 0, 24, "STUDENT"], // işaretsiz
    [EPOSTA.deneme4, 8, 7, 9, "TIMEOUT"], // süre doldu ama %62
  ];
  const oturumlar: Record<string, { userId: string; sessionId: string }> = {};
  for (const [email, d, y, b, sebep] of kayitlar) {
    const userId = await kullanici(email);
    const simdi = new Date();
    const s = await prisma.checkupSession.create({
      data: {
        userId,
        packageId: paket.id,
        status: "SUBMITTED",
        endedBy: sebep,
        durationMinutes: 30,
        penaltyRatio: 0.25,
        startedAt: new Date(simdi.getTime() - 3_600_000),
        expiresAt: simdi,
        submittedAt: simdi,
        result: {
          create: {
            correctCount: d,
            wrongCount: y,
            blankCount: b,
            netScore: (d - y * 0.25).toFixed(2),
            totalTimeMs: 0,
            topicBreakdown: { topics: [], groups: [] },
            examScope: SINAV,
          },
        },
      },
      select: { id: true },
    });
    oturumlar[email] = { userId, sessionId: s.id };
  }
  const havuz = await denemeHavuzu(paket.id);
  const icinde = new Set(havuz.map((h) => h.userId));
  check(
    "havuzda tam ölçüm ve %62'lik süre dolan var",
    icinde.has(oturumlar[EPOSTA.deneme1].userId) && icinde.has(oturumlar[EPOSTA.deneme4].userId)
  );
  check(
    "yarım ve işaretsiz deneme havuzda yok",
    !icinde.has(oturumlar[EPOSTA.deneme2].userId) && !icinde.has(oturumlar[EPOSTA.deneme3].userId) && havuz.length === 2,
    `${havuz.length} kayıt`
  );
  const yarimKarsi = await denemeKarsilastirmasi(oturumlar[EPOSTA.deneme2].sessionId, oturumlar[EPOSTA.deneme2].userId);
  const tamKarsi = await denemeKarsilastirmasi(oturumlar[EPOSTA.deneme1].sessionId, oturumlar[EPOSTA.deneme1].userId);
  check("yarım denemede yüzdelik kartı yok", yarimKarsi === null);
  check("tam denemede kart var, kendi kaydı havuzda", Boolean(tamKarsi?.havuzda));
}

// ─────────────────────────────────────────────────────────────
// 5. Davet kodu
// ─────────────────────────────────────────────────────────────

async function davetTesti() {
  console.log("\nDavet bağlantısı:");
  const kod = kodUret();
  const grup = await prisma.studyGroup.create({
    data: { name: `${ON} 12-A`, examScope: SINAV, createdByStaff: DAMGA, joinCode: kod },
    select: { id: true },
  });
  const uye = await kullanici(EPOSTA.uye);
  const baska = await kullanici(EPOSTA.baska);

  const d0 = await davetiBul(prisma, kod.toLowerCase().slice(0, 4) + "-" + kod.toLowerCase().slice(4), uye);
  check("geçerli kod (küçük harf, tireli) bulunur, üye değil", d0.durum === "ACIK" && d0.grupAdi === `${ON} 12-A` && !d0.uye, JSON.stringify(d0));
  const k1 = await grubaKatil(prisma, kod, uye);
  check("katıldı", k1.sonuc === "KATILDI");
  const m = await prisma.groupMember.findFirst({ where: { groupId: grup.id, userId: uye }, select: { addedByStaff: true } });
  check(`damga "${DAVET_DAMGASI}"`, m?.addedByStaff === DAVET_DAMGASI, String(m?.addedByStaff));
  const k2 = await grubaKatil(prisma, kod, uye);
  check("ikinci kez: zaten üye, tek üyelik", k2.sonuc === "ZATEN_UYE" && (await prisma.groupMember.count({ where: { groupId: grup.id, userId: uye } })) === 1);
  const d1 = await davetiBul(prisma, kod, uye);
  check("sayfa üyeliği görür", d1.durum === "ACIK" && d1.uye);

  // Koçun eklediği üye: damgası değişmez.
  await prisma.groupMember.create({ data: { groupId: grup.id, userId: baska, addedByStaff: DAMGA } });
  const k3 = await grubaKatil(prisma, kod, baska);
  const m2 = await prisma.groupMember.findFirst({ where: { groupId: grup.id, userId: baska }, select: { addedByStaff: true } });
  check("koçun eklediği öğrenci: zaten üye, damga koçun", k3.sonuc === "ZATEN_UYE" && m2?.addedByStaff === DAMGA);

  check("biçim dışı kod veritabanına sorulmadan geçersiz", (await davetiBul(prisma, "0000-1111", uye)).durum === "GECERSIZ");
  check("var olmayan kod geçersiz", (await grubaKatil(prisma, kodUret(), uye)).sonuc === "GECERSIZ");

  // Davet kapatıldı (kod boş).
  await prisma.studyGroup.update({ where: { id: grup.id }, data: { joinCode: null } });
  check("kapatılan davet geçersiz", (await davetiBul(prisma, kod, null)).durum === "GECERSIZ" && (await grubaKatil(prisma, kod, baska)).sonuc === "GECERSIZ");

  // Arşivlenen grup.
  const kod2 = kodUret();
  await prisma.studyGroup.update({ where: { id: grup.id }, data: { joinCode: kod2, archivedAt: new Date() } });
  check("arşivdeki grup geçersiz", (await davetiBul(prisma, kod2, null)).durum === "GECERSIZ");
  await prisma.studyGroup.update({ where: { id: grup.id }, data: { archivedAt: null } });

  console.log("\nKayıtta gruba girme ve kaynak:");
  const acilis = await hesapAc({
    name: "Hesap Testi Kayıt",
    email: EPOSTA.kayit,
    password: "test-1234-uzun",
    kaynak: " WhatsApp ",
    grupKodu: kodNormalize(kod2.toLowerCase()),
  });
  if (acilis.durum !== "ACILDI") {
    check("hesap açıldı", false, acilis.durum);
  } else {
    check("hesap açıldı ve gruba girdi", acilis.katilim?.sonuc === "KATILDI", JSON.stringify(acilis.katilim));
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: acilis.userId },
      select: { signupSource: true, lastLoginAt: true, lastSeenAt: true },
    });
    check("kaynak izin listesinden yazıldı (whatsapp)", u.signupSource === "whatsapp", String(u.signupSource));
    check("kayıtta lastLoginAt ve lastSeenAt yazıldı", Boolean(u.lastLoginAt && u.lastSeenAt));
    const uy = await prisma.groupMember.findFirst({ where: { groupId: grup.id, userId: acilis.userId }, select: { addedByStaff: true } });
    check("kayıttan katılanın damgası da davet", uy?.addedByStaff === DAVET_DAMGASI);
  }
  check("aynı e-posta ikinci kez açılmaz", (await hesapAc({ name: "x", email: EPOSTA.kayit, password: "test-1234-uzun", kaynak: null, grupKodu: null })).durum === "VAR");

  const kapali = await hesapAc({
    name: "Hesap Testi Kapalı",
    email: EPOSTA.kayitKapali,
    password: "test-1234-uzun",
    kaynak: "tiktok",
    grupKodu: kodUret(),
  });
  if (kapali.durum !== "ACILDI") {
    check("kapalı kodla hesap yine açılır", false);
  } else {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: kapali.userId }, select: { signupSource: true } });
    check("kapalı kodla hesap yine açılır, gruba girmez", kapali.katilim?.sonuc === "GECERSIZ" && (await prisma.groupMember.count({ where: { userId: kapali.userId } })) === 0);
    check("listede olmayan kaynak 'diger'", u.signupSource === "diger", String(u.signupSource));
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Son etkinlik ve kayan oturum
// ─────────────────────────────────────────────────────────────

async function oturumTesti() {
  console.log("\nSon etkinlik (saatte bir):");
  const userId = await kullanici(EPOSTA.uye);
  const t0 = new Date();
  await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: null } });
  check("hiç yazılmamışsa yazılır", (await sonEtkinligiYaz(userId, t0)) === 1);
  check("hemen ardından yazılmaz", (await sonEtkinligiYaz(userId, new Date(t0.getTime() + 1_000))) === 0);
  check("59 dakika sonra yazılmaz", (await sonEtkinligiYaz(userId, new Date(t0.getTime() + 59 * 60_000))) === 0);
  const t1 = new Date(t0.getTime() + 61 * 60_000);
  check("61 dakika sonra yazılır", (await sonEtkinligiYaz(userId, t1)) === 1);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lastSeenAt: true } });
  check("değer son yazılan an", u.lastSeenAt?.getTime() === t1.getTime());
  // Aynı anda iki istek: koşul sorguda, yalnızca biri yazar.
  const t2 = new Date(t1.getTime() + 2 * 3_600_000);
  const [a, b] = await Promise.all([sonEtkinligiYaz(userId, t2), sonEtkinligiYaz(userId, t2)]);
  check("eşzamanlı iki istekten yalnızca biri yazar", a + b === 1, `${a}+${b}`);

  console.log("\nKayan oturum:");
  const simdi = new Date();
  const oturum = (gun: number) =>
    prisma.authSession.create({
      data: { userId, tokenHash: `${ON}-${Math.random()}`, expiresAt: new Date(simdi.getTime() + gun * GUN), userAgent: ON },
      select: { id: true },
    });
  const uzun = await oturum(20);
  const kisa = await oturum(10);
  const bitmis = await oturum(-1);
  check("kalan 20 gün: uzamaz", (await oturumuUzat(uzun.id, simdi)) === 0);
  check("kalan 10 gün: uzar", (await oturumuUzat(kisa.id, simdi)) === 1);
  const k = await prisma.authSession.findUniqueOrThrow({ where: { id: kisa.id }, select: { expiresAt: true } });
  check(`yeni bitiş ${OTURUM_GUN} gün sonra`, Math.abs(k.expiresAt.getTime() - (simdi.getTime() + OTURUM_GUN * GUN)) < 1_000);
  check("uzayan oturum hemen yeniden uzamaz", (await oturumuUzat(kisa.id, simdi)) === 0);
  check("süresi dolmuş oturum canlanmaz", (await oturumuUzat(bitmis.id, simdi)) === 0);
  // Parola sıfırlama bütün oturumları siler: silinen satır uzatılamaz.
  await prisma.authSession.deleteMany({ where: { userId } });
  check("silinmiş oturum uzatılamaz", (await oturumuUzat(kisa.id, simdi)) === 0);
}

async function main() {
  console.log("\nHesap, ölçüm doğruluğu ve gruba katılım\n");
  await temizle();
  try {
    safKurallar();
    await yarimTest();
    await denemeTesti();
    await davetTesti();
    await oturumTesti();
  } finally {
    await prisma.authSession.deleteMany({ where: { userAgent: ON } });
    await temizle();
  }
  console.log(failed === 0 ? `\nTümü geçti (${gecen} denetim).\n` : `\n${failed} denetim BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
