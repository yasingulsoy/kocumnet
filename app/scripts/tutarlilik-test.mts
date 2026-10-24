import "./_koruma.mjs";
/**
 * Ölçüm akışının tutarlılığı — uçtan uca.
 *
 *   npx tsx scripts/tutarlilik-test.mts
 *
 * Dört şeyi denetler:
 *  1. Seviyeli aşamanın kapısı test BİTİNCE değerlendiriliyor (süresi dolup
 *     cron'la kapanan aşama dahil) ve kayıt idempotent: iki kez çalışan
 *     değerlendirme ya da bakım onarımı tek kayıt bırakıyor.
 *  2. Hiç işaret konmadan biten test (işaretsiz) plan kurmuyor, deftere
 *     yazmıyor, ödevi tamamlamıyor, plandaki kontrol testi işini kapatmıyor.
 *  3. Cevap anahtarı düzeltilince bitmiş sonuç yeniden puanlanıyor: net,
 *     defter, rescoreNote; açık testte düzeltme bitişte yakalanıyor.
 *  4. Bakım ucunun iskeleti: işler birbirini düşürmüyor (allSettled), kilit
 *     üst üste binmeyi engelliyor.
 *
 * Neden ayrı test: bu kuralların her biri tek başına küçük, ama bozulunca
 * sessiz. Kapı değerlendirilmeyince koşu "sürüyor" kalıyor; işaretsiz test
 * plana girince bütün konular "zayıf" çıkıyor; anahtar düzeltilince sonuç
 * yeniden puanlanmazsa öğrenci "yanlışsın, doğru şık senin işaretin" görüyor.
 *
 * Tohumlu veritabanı ister (db:seed, db:seed:demo, db:seed:levels). Kendi
 * öğrencilerini, grubunu ve oturumlarını açar, sonunda siler; değiştirdiği
 * cevap anahtarını geri alır.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { grantEntitlement } from "../lib/entitlements";
import {
  KAYIT_TOLERANSI_MS,
  expireStaleSessions,
  saveAnswer,
  startCheckup,
  startTopicRetest,
  submitCheckup,
  yenidenPuanla,
  yenidenPuanlamaBilgisi,
} from "../lib/checkup";
import { asamaDegerlendir, seviyeliKapilariOnar, seviyeliSinavBaslat } from "../lib/level-run";
import { egilimeGirer, isaretsiz, konuHaritasinaGirer } from "../lib/insights";
import { odevIlerlemesi, type OdevKurali, type OdevOturumu } from "../lib/odev";
import { ogrenciOdevleri } from "../lib/odev-sorgu";
import { asamaCalistir, kilitle } from "../app/api/cron/bakim";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const ON = "tutarlilik-test";
const DAMGA = "tutarlilik-test@kocum.local (#0)";
const EPOSTA = {
  kapi: `${ON}-kapi@kocum.local`,
  bos: `${ON}-bos@kocum.local`,
  isaretsiz: `${ON}-isaretsiz@kocum.local`,
  puan: `${ON}-puan@kocum.local`,
};
const PAKET = "tyt-ilk-15";
const SINAV = "TYT" as const;
const GUN = 86_400_000;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function kullanici(email: string): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Tutarlılık Testi",
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

/** Süreyi kayıt toleransının da ötesine geçirir: bakım işi puanlasın. */
async function suresiniDoldur(sessionId: string) {
  await prisma.checkupSession.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() - KAYIT_TOLERANSI_MS - 5_000) },
  });
}

async function kapiKayitlari(runId: string) {
  const r = await prisma.levelRun.findUniqueOrThrow({
    where: { id: runId },
    select: { gateLog: true, unlockedLevel: true, status: true },
  });
  const log = (Array.isArray(r.gateLog) ? r.gateLog : []) as { sessionId?: string; karar: string }[];
  return { log, unlockedLevel: r.unlockedLevel, status: r.status };
}

// ─────────────────────────────────────────────────────────────
// 0. Saf süzgeç (lib/insights.ts)
// ─────────────────────────────────────────────────────────────

function safSuzgec() {
  console.log("\nÖlçüm süzgeci:");
  const k = (kind: string, d: number, y: number, examScope: string | null = "TYT") => ({
    kind,
    correctCount: d,
    wrongCount: y,
    examScope,
  });
  check("işaretsiz: doğru + yanlış = 0", isaretsiz(k("PACKAGE", 0, 0)) && !isaretsiz(k("PACKAGE", 0, 1)));
  check("eğilime yalnızca işaretli PAKET testi girer", egilimeGirer(k("PACKAGE", 3, 2)));
  check(
    "kontrol testi, seviyeli aşama ve alıştırma eğilime girmez",
    !egilimeGirer(k("TOPIC_RETEST", 3, 2)) && !egilimeGirer(k("LEVEL_STAGE", 30, 0)) && !egilimeGirer(k("PRACTICE", 3, 0))
  );
  check("boş gönderilen paket testi eğilime girmez", !egilimeGirer(k("PACKAGE", 0, 0)));
  check(
    "konu haritasına paket, kontrol testi ve aşama girer",
    konuHaritasinaGirer(k("PACKAGE", 1, 0)) && konuHaritasinaGirer(k("TOPIC_RETEST", 1, 0)) && konuHaritasinaGirer(k("LEVEL_STAGE", 0, 1))
  );
  check(
    "konu haritasına alıştırma ve işaretsiz test girmez",
    !konuHaritasinaGirer(k("PRACTICE", 3, 0)) && !konuHaritasinaGirer(k("LEVEL_STAGE", 0, 0))
  );
  check(
    "sınav süzgeci: başka sınav girmez, kapsamı yazmayan eski kayıt girer",
    !egilimeGirer(k("PACKAGE", 3, 1, "LGS"), "TYT") && egilimeGirer(k("PACKAGE", 3, 1, null), "TYT") && egilimeGirer(k("PACKAGE", 3, 1, "TYT"), "TYT")
  );

  console.log("\nÖdev kuralı (saf):");
  const bas = new Date("2026-10-10T09:00:00Z");
  const odev: OdevKurali = { kind: "PACKAGE", packageId: "p", topicId: null, questionCount: null, startsAt: bas, dueAt: new Date(bas.getTime() + 7 * GUN) };
  const oturum = (o: Partial<OdevOturumu>): OdevOturumu => ({
    id: "s",
    packageId: "p",
    status: "SUBMITTED",
    startedAt: new Date(bas.getTime() + GUN),
    submittedAt: new Date(bas.getTime() + GUN + 3_600_000),
    expiresAt: new Date(bas.getTime() + GUN + 7_200_000),
    net: 0,
    isaretli: false,
    ...o,
  });
  const bos = odevIlerlemesi(odev, { oturumlar: [oturum({})], cevaplar: [] });
  check("işaretsiz oturum ödevi tamamlamaz, 'boş gönderildi'", bos.durum === "BASLADI" && bos.bosGonderildi, JSON.stringify(bos));
  const sonra = odevIlerlemesi(odev, {
    oturumlar: [oturum({}), oturum({ id: "t", isaretli: true, net: 4, submittedAt: new Date(bas.getTime() + 2 * GUN) })],
    cevaplar: [],
  });
  check(
    "sonraki işaretli oturum tamamlar (neti onun)",
    sonra.durum === "TAMAMLANDI" && sonra.oturumId === "t" && sonra.net === 4 && !sonra.bosGonderildi,
    JSON.stringify(sonra)
  );
  const eski = odevIlerlemesi(odev, { oturumlar: [oturum({ isaretli: undefined, net: 5 })], cevaplar: [] });
  check("alanı vermeyen eski çağıran işaretli sayılır", eski.durum === "TAMAMLANDI");
}

// ─────────────────────────────────────────────────────────────
// 1. Seviyeli kapı: bitişte, cron'da, idempotent
// ─────────────────────────────────────────────────────────────

async function seviyeliKapi() {
  console.log("\nSeviyeli kapı (süresi dolan aşama):");
  const userId = await kullanici(EPOSTA.kapi);
  const paket = await prisma.package.findFirstOrThrow({ where: { kind: "LEVEL", examScope: SINAV }, select: { id: true } });
  await grantEntitlement({ userId, packageId: paket.id, expiresAt: new Date(Date.now() + GUN), source: ON });

  const { runId, sessionId } = await seviyeliSinavBaslat(userId, SINAV);
  if (!sessionId) {
    check("Seviye 1 açıldı", false, "aşama açılmadı");
    return;
  }
  // Hepsi doğru: kapı Seviye 2'yi açmalı. Öğrenci "Bitir"e basmıyor; süre doluyor.
  for (const s of await anahtar(sessionId)) {
    await saveAnswer({ sessionId, userId, questionId: s.questionId, choiceId: s.dogru, timeSpentMs: 3000 });
  }
  await suresiniDoldur(sessionId);
  await expireStaleSessions();

  const durum = await prisma.checkupSession.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true } });
  check("süresi dolan aşama cron'la puanlandı", durum.status === "SUBMITTED", durum.status);
  let k = await kapiKayitlari(runId);
  check(
    "kapı cron'un bitirişinde değerlendirildi → Seviye 2",
    k.log.length === 1 && k.log[0].sessionId === sessionId && k.unlockedLevel === 2,
    `${k.log.length} kayıt, seviye ${k.unlockedLevel}`
  );

  const karar = await asamaDegerlendir(sessionId, userId);
  await seviyeliKapilariOnar();
  k = await kapiKayitlari(runId);
  check("ikinci değerlendirme ve onarım YAZMIYOR (tek kayıt)", k.log.length === 1, `${k.log.length} kayıt`);
  check("ikinci değerlendirme yine kararı döndürüyor", karar.tur === "SONRAKI_SEVIYE", karar.tur);

  console.log("\nSeviyeli kapı (eski kayıt onarımı):");
  // Eski kusuru taklit et: aşama bitmiş, kapı hiç değerlendirilmemiş.
  await prisma.levelRun.update({
    where: { id: runId },
    data: { gateLog: [], unlockedLevel: 1, reachedLevel: 1 },
  });
  const onarim = await seviyeliKapilariOnar();
  k = await kapiKayitlari(runId);
  check(
    "onarım kapısız kalan aşamayı değerlendirdi",
    k.log.length === 1 && k.log[0].sessionId === sessionId && k.unlockedLevel === 2 && onarim.onarilan >= 1,
    `${k.log.length} kayıt, seviye ${k.unlockedLevel}, onarılan ${onarim.onarilan}`
  );
  await seviyeliKapilariOnar();
  k = await kapiKayitlari(runId);
  check("onarım iki kez çalışınca tek kayıt", k.log.length === 1, `${k.log.length} kayıt`);

  // sessionId taşımayan eski biçim: satır sayısı biten aşama sayısına eşit → değerlendirilmiş.
  await prisma.levelRun.update({
    where: { id: runId },
    data: { gateLog: [{ seviye: 1, karar: "SONRAKI_SEVIYE", dogru: 1, toplam: 1, zaman: new Date().toISOString() }] },
  });
  await seviyeliKapilariOnar();
  k = await kapiKayitlari(runId);
  check("sessionId'siz eski kayıt: satır sayısı yeterli, yazılmadı", k.log.length === 1 && !k.log[0].sessionId, `${k.log.length} kayıt`);

  console.log("\nSeviyeli kapı (boş aşama):");
  const bosId = await kullanici(EPOSTA.bos);
  await grantEntitlement({ userId: bosId, packageId: paket.id, expiresAt: new Date(Date.now() + GUN), source: ON });
  const bosKosu = await seviyeliSinavBaslat(bosId, SINAV);
  if (!bosKosu.sessionId) {
    check("boş aşama açıldı", false);
    return;
  }
  await suresiniDoldur(bosKosu.sessionId);
  await expireStaleSessions();
  const bk = await kapiKayitlari(bosKosu.runId);
  check(
    "boş bırakılan aşamada da kapı çalıştı (boş = kapıdan kalmak)",
    bk.log.length === 1 && bk.log[0].sessionId === bosKosu.sessionId && bk.status !== "IN_PROGRESS",
    `${bk.log.length} kayıt, ${bk.log[0]?.karar ?? "-"}, koşu ${bk.status}`
  );
  check(
    "boş aşama deftere yazmadı",
    (await prisma.notebookItem.count({ where: { userId: bosId } })) === 0
  );
  check("aşamadan plan kurulmadı", (await prisma.studyPlan.count({ where: { userId: { in: [userId, bosId] } } })) === 0);
}

// ─────────────────────────────────────────────────────────────
// 2. İşaretsiz test: plan, defter, ödev, kontrol testi
// ─────────────────────────────────────────────────────────────

async function isaretsizTest() {
  console.log("\nİşaretsiz paket testi:");
  const userId = await kullanici(EPOSTA.isaretsiz);
  const paket = await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { id: true } });

  // Ödev: bu paketin testi, şimdiden önce açıldı.
  const grup = await prisma.studyGroup.create({
    data: {
      name: `${ON} grup`,
      examScope: SINAV,
      createdByStaff: DAMGA,
      members: { create: [{ userId, addedByStaff: DAMGA }] },
    },
    select: { id: true },
  });
  const odev = await prisma.assignment.create({
    data: {
      groupId: grup.id,
      title: `${ON} ödev`,
      kind: "PACKAGE",
      packageId: paket.id,
      startsAt: new Date(Date.now() - GUN),
      dueAt: new Date(Date.now() + 3 * GUN),
      createdByStaff: DAMGA,
    },
    select: { id: true },
  });
  const odevDurumu = async () => {
    const l = await ogrenciOdevleri(userId);
    return [...l.acik, ...l.gecmis].find((o) => o.id === odev.id)?.ilerleme ?? null;
  };

  const p0 = await startCheckup(userId, PAKET);
  const p0Puan = await submitCheckup(p0, userId);
  check("boş gönderilen test puanlandı (sonuç var, işaretsiz)", isaretsiz(p0Puan), JSON.stringify({ d: p0Puan.correctCount, y: p0Puan.wrongCount }));
  check("işaretsiz test plan KURMADI", (await prisma.studyPlan.count({ where: { userId } })) === 0);
  check("işaretsiz test deftere YAZMADI", (await prisma.notebookItem.count({ where: { userId } })) === 0);
  const o0 = await odevDurumu();
  check("işaretsiz test ödevi TAMAMLAMADI ('boş gönderildi')", o0?.durum === "BASLADI" && o0.bosGonderildi === true, JSON.stringify(o0));

  console.log("\nİşaretli paket testi (karşılaştırma):");
  const p1 = await startCheckup(userId, PAKET);
  const p1Anahtar = await anahtar(p1);
  // Hepsi yanlış: bütün konular zayıf, plan kontrol testi işleri içerir.
  for (const s of p1Anahtar) {
    await saveAnswer({ sessionId: p1, userId, questionId: s.questionId, choiceId: s.yanlis, timeSpentMs: 2000 });
  }
  await submitCheckup(p1, userId);
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, sourceSessionId: p1 },
    select: { items: { where: { kind: "RETEST" }, select: { id: true, topicId: true, verifiedBySessionId: true } } },
  });
  check("işaretli test plan kurdu", Boolean(plan));
  check("işaretli test deftere yazdı", (await prisma.notebookItem.count({ where: { userId, lastSessionId: p1 } })) === p1Anahtar.length);
  const o1 = await odevDurumu();
  check("işaretli test ödevi tamamladı", o1?.durum === "TAMAMLANDI" && o1.oturumId === p1, JSON.stringify(o1));

  console.log("\nKontrol testi:");
  const retest = plan?.items.find((i) => i.topicId);
  if (!retest?.topicId) {
    check("planda kontrol testi işi var", false);
    return;
  }
  const r1 = await startTopicRetest(userId, retest.topicId, SINAV);

  // Günlük sınır dolu olsa da AÇIK test döner (sınırdan önce denetlenir).
  const retestPaketi = await prisma.package.findFirstOrThrow({ where: { kind: "RETEST", examScope: SINAV }, select: { id: true } });
  const simdi = new Date();
  await prisma.checkupSession.createMany({
    data: Array.from({ length: 8 }, () => ({
      userId,
      packageId: retestPaketi.id,
      kind: "TOPIC_RETEST" as const,
      status: "SUBMITTED" as const,
      durationMinutes: 8,
      penaltyRatio: 0,
      startedAt: simdi,
      expiresAt: simdi,
      submittedAt: simdi,
    })),
  });
  const donen = await startTopicRetest(userId, retest.topicId, SINAV).catch((e: Error) => e.message);
  check("sınır dolmuşken açık kontrol testine dönülüyor", donen === r1, String(donen));
  await prisma.checkupSession.deleteMany({ where: { userId, kind: "TOPIC_RETEST", items: { none: {} } } });

  await submitCheckup(r1, userId);
  const sonra = await prisma.planItem.findUniqueOrThrow({ where: { id: retest.id }, select: { verifiedBySessionId: true } });
  check("işaretsiz kontrol testi plandaki işi KAPATMADI", sonra.verifiedBySessionId === null);
  check("işaretsiz kontrol testi deftere yazmadı", (await prisma.notebookItem.count({ where: { userId, lastSessionId: r1 } })) === 0);

  const r2 = await startTopicRetest(userId, retest.topicId, SINAV);
  const r2Anahtar = await anahtar(r2);
  await saveAnswer({ sessionId: r2, userId, questionId: r2Anahtar[0].questionId, choiceId: r2Anahtar[0].dogru, timeSpentMs: 2000 });
  await submitCheckup(r2, userId);
  const kapali = await prisma.planItem.findUniqueOrThrow({ where: { id: retest.id }, select: { verifiedBySessionId: true } });
  check("işaretli kontrol testi işi kapattı", kapali.verifiedBySessionId === r2, String(kapali.verifiedBySessionId));
}

// ─────────────────────────────────────────────────────────────
// 3. Yeniden puanlama
// ─────────────────────────────────────────────────────────────

/** Bir sorunun cevap anahtarını iki şık arasında değiştirir (paneldeki düzeltme gibi). */
async function anahtariDegistir(questionId: string, yeniDogru: string, eskiDogru: string) {
  await prisma.$transaction([
    prisma.choice.update({ where: { id: yeniDogru }, data: { isCorrect: true, errorType: null } }),
    prisma.choice.update({ where: { id: eskiDogru }, data: { isCorrect: false } }),
    // Panel soruyu da günceller (updatedAt, sürüm); bakım updatedAt'e bakar.
    prisma.question.update({ where: { id: questionId }, data: { version: { increment: 1 } } }),
  ]);
}

async function yenidenPuanlamaTesti() {
  console.log("\nYeniden puanlama:");
  const userId = await kullanici(EPOSTA.puan);
  const s = await startCheckup(userId, PAKET);
  const a = await anahtar(s);
  const [hedef, ...digerleri] = a;
  const eskiHata = await prisma.choice.findUniqueOrThrow({ where: { id: hedef.yanlis }, select: { errorType: true } });

  // Hedef soruda "yanlış" şıkkı işaretle; ötekiler doğru.
  await saveAnswer({ sessionId: s, userId, questionId: hedef.questionId, choiceId: hedef.yanlis, timeSpentMs: 2000 });
  for (const d of digerleri) {
    await saveAnswer({ sessionId: s, userId, questionId: d.questionId, choiceId: d.dogru, timeSpentMs: 2000 });
  }
  const ilk = await submitCheckup(s, userId);
  check("ilk sonuç: 1 yanlış", ilk.wrongCount === 1 && ilk.correctCount === a.length - 1, `${ilk.correctCount}D ${ilk.wrongCount}Y`);
  check(
    "yanlış soru deftere girdi",
    (await prisma.notebookItem.count({ where: { userId, questionId: hedef.questionId, resolvedAt: null } })) === 1
  );
  const sayacOnce = (await prisma.question.findUniqueOrThrow({ where: { id: hedef.questionId }, select: { correctCount: true } }))
    .correctCount;

  try {
    // Panel anahtarı düzeltiyor: öğrencinin işareti meğer doğruymuş.
    await anahtariDegistir(hedef.questionId, hedef.yanlis, hedef.dogru);
    const r1 = await yenidenPuanla();
    check("bakım uyumsuz oturumu yeniden puanladı", r1.oturum >= 1 && r1.cevap >= 1, JSON.stringify(r1));

    const sonuc = await prisma.checkupResult.findUniqueOrThrow({
      where: { sessionId: s },
      select: { correctCount: true, wrongCount: true, netScore: true, rescoredAt: true, rescoreNote: true },
    });
    const not = sonuc.rescoreNote as { onceki: { dogru: number; yanlis: number; net: number }; soruSayisi: number } | null;
    check(
      "net yeni anahtarla: 0 yanlış",
      sonuc.correctCount === a.length && sonuc.wrongCount === 0 && Number(sonuc.netScore) === a.length,
      `${sonuc.correctCount}D ${sonuc.wrongCount}Y net ${sonuc.netScore}`
    );
    check(
      "rescoreNote: önceki sonuç ve düzeltilen soru sayısı",
      Boolean(sonuc.rescoredAt) && not?.onceki.dogru === a.length - 1 && not.onceki.yanlis === 1 && not.soruSayisi === 1,
      JSON.stringify(not)
    );
    const cevap = await prisma.answer.findFirstOrThrow({
      where: { sessionItem: { sessionId: s, questionId: hedef.questionId } },
      select: { isCorrect: true },
    });
    check("kayıttaki doğruluk düzeldi (inceleme ekranı)", cevap.isCorrect === true);
    const madde = await prisma.notebookItem.findUniqueOrThrow({
      where: { userId_questionId: { userId, questionId: hedef.questionId } },
      select: { resolvedAt: true },
    });
    check("artık doğru olan defter maddesi kapandı", madde.resolvedAt !== null);
    const sayacSonra = (await prisma.question.findUniqueOrThrow({ where: { id: hedef.questionId }, select: { correctCount: true } }))
      .correctCount;
    check("sorunun doğru sayacı +1", sayacSonra === sayacOnce + 1, `${sayacOnce} → ${sayacSonra}`);
    const bant = await yenidenPuanlamaBilgisi(s, userId);
    check(
      "sonuç ekranı bandının verisi",
      bant?.soruSayisi === 1 && bant.onceki.dogru === a.length - 1 && bant.simdi.dogru === a.length,
      JSON.stringify(bant)
    );

    const tekrar = await yenidenPuanla();
    const sonra = await prisma.checkupResult.findUniqueOrThrow({ where: { sessionId: s }, select: { rescoredAt: true } });
    check(
      "ikinci çalıştırma aynı oturuma dokunmadı",
      sonra.rescoredAt?.getTime() === sonuc.rescoredAt?.getTime(),
      JSON.stringify(tekrar)
    );

    console.log("\nAçık testte anahtar düzeltmesi:");
    const acik = await startCheckup(userId, PAKET);
    const aa = await anahtar(acik);
    // Açıkken: öğrenci şu an "yanlış" olan şıkkı işaretliyor, sonra panel düzeltiyor.
    await saveAnswer({ sessionId: acik, userId, questionId: aa[0].questionId, choiceId: aa[0].yanlis, timeSpentMs: 2000 });
    await anahtariDegistir(aa[0].questionId, aa[0].yanlis, aa[0].dogru);
    try {
      const bitis = await submitCheckup(acik, userId);
      const c = await prisma.answer.findFirstOrThrow({
        where: { sessionItem: { sessionId: acik, questionId: aa[0].questionId } },
        select: { isCorrect: true },
      });
      check("bitiş güncel anahtarla puanladı", bitis.correctCount === 1 && bitis.wrongCount === 0, `${bitis.correctCount}D ${bitis.wrongCount}Y`);
      check("bitişte kayıttaki doğruluk da eşitlendi", c.isCorrect === true);
    } finally {
      await anahtariDegistir(aa[0].questionId, aa[0].dogru, aa[0].yanlis);
      await prisma.choice.update({ where: { id: aa[0].yanlis }, data: { errorType: eskiHata.errorType } }).catch(() => {});
    }
  } finally {
    // Anahtarı geri al; bakım sonucu da geri döndürmeli.
    await anahtariDegistir(hedef.questionId, hedef.dogru, hedef.yanlis);
    await prisma.choice.update({ where: { id: hedef.yanlis }, data: { errorType: eskiHata.errorType } });
  }

  await yenidenPuanla();
  const geri = await prisma.checkupResult.findUniqueOrThrow({
    where: { sessionId: s },
    select: { correctCount: true, wrongCount: true, rescoreNote: true },
  });
  const notGeri = geri.rescoreNote as { onceki: { dogru: number }; soruSayisi: number } | null;
  check(
    "anahtar geri alınınca sonuç da geri döndü",
    geri.correctCount === a.length - 1 && geri.wrongCount === 1,
    `${geri.correctCount}D ${geri.wrongCount}Y`
  );
  check(
    "rescoreNote.onceki İLK puanlamadan korundu, aynı soru iki kez sayılmadı",
    notGeri?.onceki.dogru === a.length - 1 && notGeri.soruSayisi === 1,
    JSON.stringify(notGeri)
  );
  const sayacGeri = (await prisma.question.findUniqueOrThrow({ where: { id: hedef.questionId }, select: { correctCount: true } }))
    .correctCount;
  check("sorunun doğru sayacı geri döndü", sayacGeri === sayacOnce, `${sayacOnce} → ${sayacGeri}`);
}

// ─────────────────────────────────────────────────────────────
// 4. Bakım iskeleti
// ─────────────────────────────────────────────────────────────

async function bakimIskeleti() {
  console.log("\nBakım iskeleti:");
  let calisti = false;
  const sonuc = await asamaCalistir([
    { ad: "esZamanliHata", calistir: () => { throw new Error("eşzamanlı patladı"); } },
    { ad: "redHata", calistir: () => Promise.reject(new Error("söz reddedildi")) },
    {
      ad: "saglam",
      calistir: async () => {
        await bekle(50);
        calisti = true;
        return 42;
      },
    },
  ]);
  check("düşen işler öbürünü durdurmadı", calisti && sonuc[2].ok && sonuc[2].sonuc === 42, JSON.stringify(sonuc[2]));
  check(
    "her iş için ad, sonuç ya da hata",
    sonuc.map((s) => s.ad).join(",") === "esZamanliHata,redHata,saglam" &&
      !sonuc[0].ok && sonuc[0].hata === "eşzamanlı patladı" && !sonuc[1].ok && sonuc[1].hata === "söz reddedildi",
    JSON.stringify(sonuc.map((s) => [s.ad, s.ok, s.hata ?? s.sonuc]))
  );

  const [birinci, ikinci] = await Promise.all([
    kilitle(async () => {
      await bekle(600);
      return "birinci";
    }),
    bekle(150).then(() => kilitle(async () => "ikinci")),
  ]);
  check("kilit tutulurken ikinci çağrı 'zaten çalışıyor'", birinci.alindi && !ikinci.alindi, JSON.stringify([birinci, ikinci]));
  const ucuncu = await kilitle(async () => "üçüncü");
  check("kilit iş bitince kalkıyor", ucuncu.alindi && ucuncu.deger === "üçüncü");
  const hatali = await kilitle(async () => {
    throw new Error("iş düştü");
  }).catch((e: Error) => e.message);
  const sonrasi = await kilitle(async () => "sonra");
  check("iş fırlatsa da kilit kalkıyor", hatali === "iş düştü" && sonrasi.alindi, String(hatali));
}

async function main() {
  console.log("\nÖlçüm akışı tutarlılığı\n");
  await temizle();
  try {
    safSuzgec();
    await seviyeliKapi();
    await isaretsizTest();
    await yenidenPuanlamaTesti();
    await bakimIskeleti();
  } finally {
    await temizle();
  }
  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} denetim BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
