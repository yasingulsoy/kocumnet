import "./_koruma.mjs";
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { grantEntitlement } from "../lib/entitlements";
import { saveAnswer, submitCheckup, getStudentSession } from "../lib/checkup";
import {
  seviyeliSinavBaslat,
  asamaDegerlendir,
  asamaAc,
  aktifKosu,
  telafiyiAc,
  kosuyuBirak,
  sahipsizKosulariSil,
  SEVIYELI_HAZIR_DEGIL,
} from "../lib/level-run";
import {
  kazanimBasinaBirSoru,
  seviyeliHazirlik,
  seviyeSorulari,
  sinavinKazanimlari,
} from "../lib/level-selection";
import { seviyeKarnesi, sonrakiAdim } from "../lib/level-report";
import { ayarGetir, telafiDakikasi } from "../lib/levels";

/**
 * Seviyeli check-up — uçtan uca akış testi.
 *
 *   npm run test:levels
 *
 * Neden ayrı test: kapı mantığının saf hâli smoke'ta sınanıyor, ama asıl
 * risk orada değil. Asıl risk telafi turunda AYNI SORUNUN tekrar gelmesi —
 * o olursa öğrenci soruyu hatırlar, doğru yapar, sistem kazanımın
 * oturduğunu sanır ve ölçüm sessizce çöker. Bu test onu denetliyor.
 *
 * Sağlık bölümü (22 Ekim 2026): havuzu yetmeyen sınavda koşu hiç açılmıyor,
 * ana aşama eksik soruyla açılmıyor, teyit turu sıfır soruda koşuyu
 * kilitlemiyor, bırakma çalışıyor, aşama soruları tekrar kaydına yazılıyor,
 * sahipsiz koşular temizleniyor. Havuz darlığı birkaç soru ya da kazanım
 * geçici olarak taslağa alınarak kuruluyor (geciciTaslak, hemen geri alınır).
 */

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

/** Fırlatılan hatanın iletisi; fırlatmazsa null. */
async function hataVerir(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const EMAIL_A = "level-test-a@kocum.local";
const EMAIL_B = "level-test-b@kocum.local";
const EMAIL_C = "level-test-c@kocum.local";
const EMAIL_D = "level-test-d@kocum.local";
const EMAIL_E = "level-test-e@kocum.local";
const EMAIL_F = "level-test-f@kocum.local";
const EPOSTALAR = [EMAIL_A, EMAIL_B, EMAIL_C, EMAIL_D, EMAIL_E, EMAIL_F];
const SINAV = "TYT" as const;
/** Kapsam testinin fikstür kazanım/soru kodu öneki (yarıda kalan koşudan artarsa silinir). */
const FIKSTUR_ONEKI = "TEST-KAPSAM-";
/** Var olmayan kazanım: teyit turunda hiç sorusu bulunmayan kazanımı temsil eder. */
const SORUSUZ_KAZANIM = "seviye-test-sorusuz-kazanim";

async function kullanici(email: string, sinav: "TYT" | "LGS" = SINAV) {
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Seviye Testi",
      passwordHash: await hashPassword("test-1234"),
      grade: sinav === "LGS" ? "GRADE_8" : "GRADE_12",
      targetExam: sinav,
      onboardedAt: new Date(),
    },
    update: {},
    select: { id: true },
  });

  await prisma.entitlement.deleteMany({ where: { userId: u.id } });
  await hakVer(u.id, sinav);
  // Önceki yarıda kalmış koşunun izleri sayımlara karışmasın.
  await prisma.levelRun.deleteMany({ where: { userId: u.id } });
  await prisma.questionExposure.deleteMany({ where: { userId: u.id } });
  return u.id;
}

async function hakVer(userId: string, sinav: "TYT" | "LGS") {
  const paket = await prisma.package.findFirstOrThrow({
    where: { kind: "LEVEL", examScope: sinav },
    select: { id: true },
  });
  await grantEntitlement({
    userId,
    packageId: paket.id,
    expiresAt: new Date(Date.now() + 86_400_000),
    source: "level-test",
  });
}

/** Oturumun sorularını, doğru şık kimlikleriyle birlikte getirir. */
async function cevapAnahtari(sessionId: string) {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: {
      questionId: true,
      question: {
        select: {
          objectiveId: true,
          choices: { select: { id: true, isCorrect: true } },
        },
      },
    },
  });
  return items.map((i) => ({
    questionId: i.questionId,
    objectiveId: i.question.objectiveId,
    dogruChoiceId: i.question.choices.find((c) => c.isCorrect)?.id ?? null,
    yanlisChoiceId: i.question.choices.find((c) => !c.isCorrect)?.id ?? null,
  }));
}

/** İlk `dogruAdet` soruyu doğru, kalanını yanlış işaretler. */
async function cevapla(sessionId: string, userId: string, dogruAdet: number) {
  const anahtar = await cevapAnahtari(sessionId);
  for (const [i, s] of anahtar.entries()) {
    const choiceId = i < dogruAdet ? s.dogruChoiceId : s.yanlisChoiceId;
    if (!choiceId) continue;
    await saveAnswer({ sessionId, userId, questionId: s.questionId, choiceId, timeSpentMs: 5000 });
  }
  return anahtar;
}

/** Bu sorulardan kaçı öğrencinin tekrar kaydında (`an`dan sonra gösterilmiş). */
async function maruziyetSayisi(userId: string, questionIds: string[], an: Date) {
  return prisma.questionExposure.count({
    where: { userId, questionId: { in: questionIds }, lastShownAt: { gte: an } },
  });
}

/**
 * Teyit turunda yeni sorusu olan kazanımlar — seçim kodundan BAĞIMSIZ yazılı
 * (yardımcıdaki hatayı denetime taşımasın): yayında L1, bu denemede
 * gösterilmemiş. Kazanımlar sınavın kendi Seviye 1 kazanımları; kapsamı
 * ayrıca sınanıyor (LGS bölümü).
 */
async function yeniSorusuOlanlar(objectiveIds: string[], gosterilmis: string[]) {
  const gruplar = await prisma.question.groupBy({
    by: ["objectiveId"],
    where: {
      objectiveId: { in: objectiveIds },
      status: "PUBLISHED",
      level: "L1_TEMEL",
      id: { notIn: gosterilmis.length ? gosterilmis : ["-"] },
    },
  });
  return gruplar.map((g) => g.objectiveId).filter((id): id is string => Boolean(id));
}

/**
 * Yayındaki soruları ya da kazanımları geçici olarak taslağa alır; `fn`
 * bitince (hata olsa da) geri yayına alır. Havuz darlığını kurmanın yolu bu:
 * seviye ayarını süreç içinde değiştirmek işe yaramıyor (tsx, test betiğinin
 * içe aktardığı modülle lib/'in kendi içe aktardığını iki ayrı örnek olarak
 * yükleyebiliyor). Yalnızca birkaç satır ve hemen geri alınıyor.
 */
async function geciciTaslak<T>(tur: "soru" | "kazanim", idler: string[], fn: () => Promise<T>): Promise<T> {
  const yaz = (status: "DRAFT" | "PUBLISHED") =>
    tur === "soru"
      ? prisma.question.updateMany({ where: { id: { in: idler } }, data: { status } })
      : prisma.objective.updateMany({ where: { id: { in: idler } }, data: { status } });
  await yaz("DRAFT");
  try {
    return await fn();
  } finally {
    await yaz("PUBLISHED");
  }
}

async function main() {
  console.log("\nSeviyeli check-up — uçtan uca\n");

  const ayar = ayarGetir(SINAV);
  const userA = await kullanici(EMAIL_A);
  const testBasi = new Date(Date.now() - 1000);

  // ── Seviye 1 ana tur ─────────────────────────────────────
  console.log("Seviye 1 ana tur:");
  const { runId, sessionId: s1 } = await seviyeliSinavBaslat(userA, SINAV);
  if (!s1) throw new Error("Seviye 1 aşaması açılmadı.");
  const oturum1 = await getStudentSession(s1, userA);
  check(
    "Seviye 1 TAM sayıyla açıldı",
    oturum1.questions.length === ayar.seviye1.soruSayisi,
    `${oturum1.questions.length}/${ayar.seviye1.soruSayisi} soru`
  );

  const anahtar1 = await cevapAnahtari(s1);
  const kazanimlar1 = anahtar1.map((a) => a.objectiveId).filter(Boolean);
  check(
    "her soru bir kazanıma bağlı",
    kazanimlar1.length === anahtar1.length,
    `${kazanimlar1.length}/${anahtar1.length}`
  );
  check(
    "aynı kazanımdan iki soru YOK",
    new Set(kazanimlar1).size === kazanimlar1.length,
    `${new Set(kazanimlar1).size} farklı kazanım`
  );
  const maruz1 = await maruziyetSayisi(userA, anahtar1.map((a) => a.questionId), testBasi);
  check("Seviye 1 soruları tekrar kaydına yazıldı", maruz1 === anahtar1.length, `${maruz1}/${anahtar1.length}`);

  // Telafi turunu tetiklemek için barajın hemen altında bırakıyoruz.
  const toplam1 = anahtar1.length;
  const hedefDogru = Math.floor(toplam1 * ayar.seviye1.gecmeOrani) - 1;
  await cevapla(s1, userA, hedefDogru);
  await submitCheckup(s1, userA);
  const karar1 = await asamaDegerlendir(s1, userA);
  check(
    `${hedefDogru}/${toplam1} telafi turunu açtı`,
    karar1.tur === "TELAFI",
    karar1.tur
  );

  // ── Telafi turu ──────────────────────────────────────────
  console.log("");
  console.log("Telafi turu:");
  const bekleyen = await aktifKosu(userA, SINAV);
  check(
    "telafi HEMEN açılmıyor, bekliyor",
    (bekleyen?.pendingRemedialIds.length ?? 0) > 0 &&
      !bekleyen?.stages.some((s) => s.status === "IN_PROGRESS"),
    `${bekleyen?.pendingRemedialIds.length ?? 0} kazanım bekliyor`
  );

  const eksikler = new Set(anahtar1.filter((a, i) => i >= hedefDogru).map((a) => a.objectiveId));
  const yeniSorulu = await yeniSorusuOlanlar(
    [...eksikler].filter((x): x is string => Boolean(x)),
    anahtar1.map((a) => a.questionId)
  );
  const adimT = await sonrakiAdim(runId, userA);
  check(
    "karne turun gerçek soru sayısını söylüyor",
    adimT?.tur === "TELAFI_BEKLIYOR" && adimT.soruSayisi === yeniSorulu.length && adimT.acilacak,
    adimT?.tur === "TELAFI_BEKLIYOR" ? `${adimT.soruSayisi} soru / ${adimT.kazanimSayisi} kazanım` : adimT?.tur
  );

  // Öğrenci uyarıyı okuyup "devam" dedi.
  const telafiId = await telafiyiAc(runId, userA);
  const kosu = await aktifKosu(userA, SINAV);
  const telafi = kosu?.stages.find((s) => s.id === telafiId);
  check("devam deyince telafi açıldı", Boolean(telafi));
  check("bekleyen liste temizlendi", (kosu?.pendingRemedialIds.length ?? 0) === 0);

  if (telafi) {
    const anahtarT = await cevapAnahtari(telafi.id);

    check(
      "telafi soru sayısı = yeni sorusu olan eksik kazanım sayısı",
      anahtarT.length === yeniSorulu.length,
      `${anahtarT.length} soru / ${eksikler.size} eksik kazanım, ${yeniSorulu.length} tanesinde yeni soru`
    );
    check(
      "telafi YALNIZCA eksik kazanımlardan",
      anahtarT.every((a) => a.objectiveId && eksikler.has(a.objectiveId))
    );

    // EN KRİTİK DENETİM
    const ilkTurSorulari = new Set(anahtar1.map((a) => a.questionId));
    const tekrarEden = anahtarT.filter((a) => ilkTurSorulari.has(a.questionId));
    check(
      "telafide ilk turun sorusu TEKRAR GELMİYOR",
      tekrarEden.length === 0,
      tekrarEden.length === 0 ? "0 tekrar" : `${tekrarEden.length} SORU TEKRARLANDI`
    );
    const maruzT = await maruziyetSayisi(userA, anahtarT.map((a) => a.questionId), testBasi);
    check("telafi soruları tekrar kaydına yazıldı", maruzT === anahtarT.length, `${maruzT}/${anahtarT.length}`);

    // Birleşik oranı barajın üstüne çıkar: (hedefDogru + x) / (toplam1 + T) >= 0.55
    const gereken = Math.ceil(
      ayar.telafiSonrasiOran * (toplam1 + anahtarT.length) - hedefDogru
    );
    await cevapla(telafi.id, userA, Math.min(gereken, anahtarT.length));
    await submitCheckup(telafi.id, userA);
    const kararT = await asamaDegerlendir(telafi.id, userA);
    check(
      `birleşik oran barajı aştı → Seviye 2`,
      kararT.tur === "SONRAKI_SEVIYE",
      `${hedefDogru}+${Math.min(gereken, anahtarT.length)} / ${toplam1}+${anahtarT.length}`
    );
  }

  // ── Seviye 2 ─────────────────────────────────────────────
  console.log("");
  console.log("Seviye 2:");
  const { sessionId: s2 } = await asamaAc(runId, 2, "MAIN");
  const anahtar2 = await cevapAnahtari(s2);
  check(
    "Seviye 2 TAM sayıyla açıldı",
    anahtar2.length === ayar.seviye2.soruSayisi,
    `${anahtar2.length}/${ayar.seviye2.soruSayisi} soru`
  );

  const l1Sorular = new Set([...anahtar1.map((a) => a.questionId)]);
  check(
    "Seviye 2'de Seviye 1'in sorusu yok",
    anahtar2.every((a) => !l1Sorular.has(a.questionId))
  );

  const seviye2Sorular = await prisma.question.findMany({
    where: { id: { in: anahtar2.map((a) => a.questionId) } },
    select: { level: true },
  });
  check(
    "Seviye 2 soruları L2_ORTA",
    seviye2Sorular.every((q) => q.level === "L2_ORTA")
  );
  const maruz2 = await maruziyetSayisi(userA, anahtar2.map((a) => a.questionId), testBasi);
  check("Seviye 2 soruları tekrar kaydına yazıldı", maruz2 === anahtar2.length, `${maruz2}/${anahtar2.length}`);

  await cevapla(s2, userA, Math.ceil(anahtar2.length * ayar.seviye2.gecmeOrani));
  await submitCheckup(s2, userA);
  const karar2 = await asamaDegerlendir(s2, userA);
  check("Seviye 2 geçildi → Seviye 3", karar2.tur === "SONRAKI_SEVIYE", karar2.tur);

  // ── Seviye 3 ─────────────────────────────────────────────
  console.log("");
  console.log("Seviye 3:");
  const { sessionId: s3 } = await asamaAc(runId, 3, "MAIN");
  const anahtar3 = await cevapAnahtari(s3);
  check("Seviye 3 oturumu açıldı", anahtar3.length > 0, `${anahtar3.length} soru`);
  await cevapla(s3, userA, Math.floor(anahtar3.length / 2));
  await submitCheckup(s3, userA);
  const karar3 = await asamaDegerlendir(s3, userA);
  check("Seviye 3'te baraj yok, sınav bitti", karar3.tur === "BITTI", karar3.tur);

  const bitmis = await prisma.levelRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true, reachedLevel: true, stoppedAtLevel: true, gateLog: true },
  });
  check("deneme COMPLETED", bitmis.status === "COMPLETED", bitmis.status);
  check("ulaşılan seviye 3", bitmis.reachedLevel === 3, String(bitmis.reachedLevel));
  check(
    "kapı günlüğü dolu",
    Array.isArray(bitmis.gateLog) && (bitmis.gateLog as unknown[]).length === 4,
    `${Array.isArray(bitmis.gateLog) ? (bitmis.gateLog as unknown[]).length : 0} kayıt`
  );

  // ── Durma yolu ───────────────────────────────────────────
  console.log("");
  console.log("Durma yolu (baraj altı):");
  const userB = await kullanici(EMAIL_B);
  const b = await seviyeliSinavBaslat(userB, SINAV);
  if (!b.sessionId) throw new Error("Seviye 1 aşaması açılmadı.");
  const anahtarB = await cevapAnahtari(b.sessionId);
  // Telafi turuyla bile barajı aşamayacak kadar düşük.
  await cevapla(b.sessionId, userB, 2);
  await submitCheckup(b.sessionId, userB);
  const kararB = await asamaDegerlendir(b.sessionId, userB);
  check(
    `2/${anahtarB.length} → telafiye sokulmadan durdu`,
    kararB.tur === "DUR",
    kararB.tur
  );

  const durmus = await prisma.levelRun.findUniqueOrThrow({
    where: { id: b.runId },
    select: { status: true, stoppedAtLevel: true, unlockedLevel: true },
  });
  check("deneme STOPPED", durmus.status === "STOPPED", durmus.status);
  check("Seviye 1'de durdu", durmus.stoppedAtLevel === 1);
  check("Seviye 2 KİLİTLİ kaldı", durmus.unlockedLevel === 1, String(durmus.unlockedLevel));

  let kilitCalisti = false;
  try {
    await asamaAc(b.runId, 2, "MAIN");
  } catch {
    kilitCalisti = true;
  }
  check("kilitli seviye açılamıyor", kilitCalisti);

  // ── Sağlık: havuz, eksik aşama, teyit turu, bırakma, onarım ──
  const userD = await kullanici(EMAIL_D);
  const userE = await kullanici(EMAIL_E);
  const userF = await kullanici(EMAIL_F);
  await hakVer(userD, "LGS");
  await hakVer(userF, "LGS");
  await havuzDenetimi(userD);
  await teyitTuruDenetimi(userE);
  await birakmaDenetimi(userF);

  // ── Sınav kapsamı (LGS) ──────────────────────────────────
  const userC = await kullanici(EMAIL_C, "LGS");
  try {
    await kapsamDenetimi(userC);
  } finally {
    // Fikstür soru, oturum kalemlerinde dururken silinemez (Restrict):
    // önce bu kullanıcının oturumları, sonra fikstürler.
    await prisma.levelRun.deleteMany({ where: { userId: userC } });
    await prisma.checkupSession.deleteMany({ where: { userId: userC } });
    await fiksturleriSil();
  }

  // ── Temizlik ─────────────────────────────────────────────
  const ids = [userA, userB, userC, userD, userE, userF];
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { in: EPOSTALAR } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

async function fiksturleriSil() {
  await prisma.question.deleteMany({ where: { fingerprint: { startsWith: FIKSTUR_ONEKI.toLowerCase() } } });
  await prisma.objective.deleteMany({ where: { code: { startsWith: FIKSTUR_ONEKI } } });
}

/**
 * Havuz yetmezken koşu da aşama da açılmıyor; Seviye 1 kazanımları önce
 * süzülüp sonra alınıyor.
 */
async function havuzDenetimi(userId: string) {
  console.log("");
  console.log("Havuz hazırlığı ve tam sayılı aşamalar:");
  const ayar = ayarGetir(SINAV);

  const hazir = await seviyeliHazirlik(SINAV);
  check("TYT havuzu üç seviyede de hazır", hazir.hazir,
    hazir.seviyeler.map((s) => `S${s.seviye} ${s.mevcut}/${s.gerekli}`).join(" · "));

  // LGS'de sorulabilen kazanım gerekenden BİR eksik → koşu HİÇ açılmıyor.
  // (LGS: demo havuzu dar, birkaç satırla kuruluyor.)
  const gerekliL = ayarGetir("LGS").seviye1.soruSayisi;
  const lgsKazanimlari = await sinavinKazanimlari("LGS");
  const kapanan = lgsKazanimlari.slice(-Math.max(1, lgsKazanimlari.length - gerekliL + 1)).map((k) => k.id);
  await geciciTaslak("kazanim", kapanan, async () => {
    const h = await seviyeliHazirlik("LGS");
    check("Seviye 1'de bir kazanım eksikken hazırlık 'hazır değil'",
      !h.hazir && h.seviyeler[0].mevcut === gerekliL - 1, `S1 ${h.seviyeler[0].mevcut}/${gerekliL}`);
    const hata = await hataVerir(() => seviyeliSinavBaslat(userId, "LGS"));
    check("hazır olmayan havuzda koşu açılmıyor", hata === SEVIYELI_HAZIR_DEGIL, hata ?? "açıldı");
  });
  const sahipsiz = await prisma.levelRun.count({ where: { userId } });
  check("reddedilen başlatma aşamasız koşu bırakmadı", sahipsiz === 0, `${sahipsiz} koşu`);
  check("kazanımlar geri yayında, LGS yine hazır", (await seviyeliHazirlik("LGS")).hazir);

  // Önce süz, sonra al: sırada en başa düşen SORUSUZ kazanım ilk N'e girmez.
  const sirali = await sinavinKazanimlari(SINAV);
  const sorusuz = await prisma.objective.create({
    data: {
      code: FIKSTUR_ONEKI + "SORUSUZ-" + Date.now(),
      topicId: sirali[0].topicId,
      name: "Sorusuz kazanım (test)",
      examScopes: [],
      status: "PUBLISHED",
      sortOrder: -1_000_000,
    },
    select: { id: true },
  });
  try {
    const ilkN = await sinavinKazanimlari(SINAV, ayar.seviye1.soruSayisi);
    check("sorusuz kazanım ilk N'e girmiyor, liste yine tam",
      !ilkN.some((k) => k.id === sorusuz.id) && ilkN.length === ayar.seviye1.soruSayisi,
      `${ilkN.length} kazanım`);
    const sayimlar = await prisma.question.groupBy({
      by: ["objectiveId"],
      where: { objectiveId: { in: ilkN.map((k) => k.id) }, status: "PUBLISHED", level: "L1_TEMEL" },
    });
    check("ilk N kazanımın her birinin yayında L1 sorusu var", sayimlar.length === ilkN.length,
      `${sayimlar.length}/${ilkN.length}`);
    const hazirS1 = (await seviyeliHazirlik(SINAV)).seviyeler[0].mevcut;
    check("hazırlık sayacı seçimle aynı kümeyi sayıyor", hazirS1 === sirali.length, `${hazirS1}/${sirali.length}`);
  } finally {
    await prisma.objective.delete({ where: { id: sorusuz.id } });
  }

  // Koşu açılır; Seviye 1 geçilir; Seviye 2'nin havuzu yetmezse aşama açılmaz.
  const { runId, sessionId } = await seviyeliSinavBaslat(userId, SINAV);
  if (!sessionId) throw new Error("Seviye 1 aşaması açılmadı.");
  const a1 = await cevapla(sessionId, userId, ayar.seviye1.soruSayisi);
  await submitCheckup(sessionId, userId);
  const k1 = await asamaDegerlendir(sessionId, userId);
  check("tam doğru Seviye 1 → Seviye 2", k1.tur === "SONRAKI_SEVIYE", `${a1.length} soru, ${k1.tur}`);

  const aynisi = await hataVerir(() => asamaAc(runId, 1, "MAIN"));
  check("çözülmüş Seviye 1 aynı koşuda yeniden açılmıyor", aynisi !== null, aynisi ?? "açıldı");

  // Seviye 2'nin havuzu koşu sürerken daraldı (sorular yayından alındı):
  // aşama eksik soruyla açılmaz.
  const l2Havuzu = (await seviyeSorulari("L2_ORTA", 100_000, SINAV, userId, [])).questions.map((q) => q.id);
  const l2Kapanan = l2Havuzu.slice(ayar.seviye2.soruSayisi - 1);
  const eksikHata = await geciciTaslak("soru", l2Kapanan, () => hataVerir(() => asamaAc(runId, 2, "MAIN")));
  const asamaSayisi = await prisma.checkupSession.count({ where: { levelRunId: runId } });
  check("eksik soruyla Seviye 2 açılmıyor", eksikHata !== null && asamaSayisi === 1,
    `${eksikHata ?? "açıldı"} · ${asamaSayisi} aşama`);

  const { sessionId: s2 } = await asamaAc(runId, 2, "MAIN");
  const n2 = await prisma.sessionItem.count({ where: { sessionId: s2 } });
  check("havuz yetince Seviye 2 tam sayıyla açılıyor", n2 === ayar.seviye2.soruSayisi, `${n2}/${ayar.seviye2.soruSayisi}`);
  const ikinci = await hataVerir(() => asamaAc(runId, 2, "MAIN"));
  check("açık aşama varken ikinci aşama açılmıyor", ikinci !== null, ikinci ?? "açıldı");
}

/**
 * Teyit turu: sıfır soruda karar tur beklemeden veriliyor (koşu kilitlenmiyor),
 * kısa devre bulunan soru sayısıyla hesaplanıyor, kısmi tur bulunan sorularla açılıyor.
 */
async function teyitTuruDenetimi(userId: string) {
  console.log("");
  console.log("Teyit turu (kısmi ve sıfır soru):");
  const ayar = ayarGetir(SINAV);
  const N = ayar.seviye1.soruSayisi;

  /** Koşu açar, Seviye 1'i `dogru` doğruyla bitirir; kapı TELAFI demeli. */
  async function telafiyeKadar(dogru: number) {
    const { runId, sessionId } = await seviyeliSinavBaslat(userId, SINAV);
    if (!sessionId) throw new Error("Seviye 1 aşaması açılmadı.");
    const anahtar = await cevapla(sessionId, userId, dogru);
    await submitCheckup(sessionId, userId);
    const k = await asamaDegerlendir(sessionId, userId);
    return { runId, anahtar, karar: k };
  }

  // 1) Barajın biraz altı (%55-60) ve teyit turunda hiç yeni soru yok.
  const dogru1 = Math.ceil(N * ayar.telafiSonrasiOran);
  const t1 = await telafiyeKadar(dogru1);
  check(`${dogru1}/${N} teyit turuna gidiyor`, t1.karar.tur === "TELAFI", t1.karar.tur);
  // Eksik kazanımların hiçbirinde yeni soru yokmuş gibi: bekleyen liste sorusuz kazanım.
  await prisma.levelRun.update({ where: { id: t1.runId }, data: { pendingRemedialIds: [SORUSUZ_KAZANIM] } });
  const adim1 = await sonrakiAdim(t1.runId, userId);
  check("karne turun açılmayacağını söylüyor",
    adim1?.tur === "TELAFI_BEKLIYOR" && adim1.soruSayisi === 0 && !adim1.acilacak,
    adim1?.tur === "TELAFI_BEKLIYOR" ? `${adim1.soruSayisi} soru, açılacak=${adim1.acilacak}` : adim1?.tur);
  const tur1 = await telafiyiAc(t1.runId, userId);
  const kosu1 = await prisma.levelRun.findUniqueOrThrow({
    where: { id: t1.runId },
    select: { status: true, unlockedLevel: true, pendingRemedialIds: true, gateLog: true },
  });
  const sonKayit = (kosu1.gateLog as { karar?: string }[] | null)?.at(-1);
  check("0 soruda tur açılmadı, karar verildi", tur1 === null && sonKayit?.karar === "SONRAKI_SEVIYE",
    `${tur1 ?? "tur yok"} · ${sonKayit?.karar ?? "kayıt yok"}`);
  check("koşu kilitlenmedi: Seviye 2 açık, bekleyen liste boş",
    kosu1.status === "IN_PROGRESS" && kosu1.unlockedLevel === 2 && kosu1.pendingRemedialIds.length === 0,
    `${kosu1.status}, açık seviye ${kosu1.unlockedLevel}`);
  const tekrar = await hataVerir(() => telafiyiAc(t1.runId, userId));
  const kayitSayisi = Array.isArray(kosu1.gateLog) ? kosu1.gateLog.length : 0;
  const sonra = await prisma.levelRun.findUniqueOrThrow({ where: { id: t1.runId }, select: { gateLog: true } });
  check("ikinci 'Devam' kararı yeniden yazmıyor",
    tekrar !== null && Array.isArray(sonra.gateLog) && sonra.gateLog.length === kayitSayisi, tekrar ?? "");
  const { sessionId: s2 } = await asamaAc(t1.runId, 2, "MAIN");
  check("Seviye 2 açılabiliyor", Boolean(s2));
  await kosuyuBirak(t1.runId, userId);

  // 2) Barajın çok altı: eksik kazanım sayısıyla tur umut veriyordu, gerçekte
  //    bulunan soruyla (0) baraj aşılamaz → tur açılmadan DUR.
  const dogru2 = Math.floor(N * 0.4);
  const t2 = await telafiyeKadar(dogru2);
  check(`${dogru2}/${N} eksik sayısıyla teyit turuna gidiyor`, t2.karar.tur === "TELAFI", t2.karar.tur);
  await prisma.levelRun.update({ where: { id: t2.runId }, data: { pendingRemedialIds: [SORUSUZ_KAZANIM] } });
  const tur2 = await telafiyiAc(t2.runId, userId);
  const kosu2 = await prisma.levelRun.findUniqueOrThrow({
    where: { id: t2.runId },
    select: { status: true, stoppedAtLevel: true },
  });
  check("bulunan soruyla baraj aşılamıyor → tur açılmadan durdu",
    tur2 === null && kosu2.status === "STOPPED" && kosu2.stoppedAtLevel === 1,
    `${kosu2.status}, durduğu seviye ${kosu2.stoppedAtLevel}`);

  // 3) Kısmi tur: iki eksik kazanımda yeni soru var, birinde yok.
  const t3 = await telafiyeKadar(dogru1);
  const yanlislar = t3.anahtar.slice(dogru1).map((a) => a.objectiveId).filter((x): x is string => Boolean(x));
  const yeniSorulu = (await yeniSorusuOlanlar(yanlislar, t3.anahtar.map((a) => a.questionId))).slice(0, 2);
  if (yeniSorulu.length < 2) {
    check("yeni sorusu olan iki eksik kazanım bulundu (kısmi tur için)", false, `${yeniSorulu.length}`);
    return;
  }
  await prisma.levelRun.update({
    where: { id: t3.runId },
    data: { pendingRemedialIds: [...yeniSorulu, SORUSUZ_KAZANIM] },
  });
  const tur3 = await telafiyiAc(t3.runId, userId);
  const anahtarT = tur3 ? await cevapAnahtari(tur3) : [];
  const oturumT = tur3
    ? await prisma.checkupSession.findUniqueOrThrow({ where: { id: tur3 }, select: { durationMinutes: true } })
    : null;
  check("kısmi tur bulunan sorularla açıldı",
    anahtarT.length === 2 && anahtarT.every((a) => a.objectiveId && yeniSorulu.includes(a.objectiveId)),
    `${anahtarT.length} soru`);
  check("kısmi turun süresi soru sayısına göre", oturumT?.durationMinutes === telafiDakikasi(2, ayar),
    `${oturumT?.durationMinutes} dk`);
}

/** Bırakma: karnede "bırakıldı", Bugün'de yok, yeni koşu açılabiliyor; başka sınavın başlatılması eskisini bırakıyor. */
async function birakmaDenetimi(userId: string) {
  console.log("");
  console.log("Denemeyi bırakma:");

  const { runId, sessionId } = await seviyeliSinavBaslat(userId, SINAV);
  if (!sessionId) throw new Error("Seviye 1 aşaması açılmadı.");
  const anahtar = await cevapAnahtari(sessionId);

  const yabanci = await hataVerir(() => kosuyuBirak(runId, "baska-ogrenci"));
  check("başkasının denemesi bırakılamıyor", yabanci !== null, yabanci ?? "bırakıldı");

  await kosuyuBirak(runId, userId);
  const [kosu, asama] = await Promise.all([
    prisma.levelRun.findUniqueOrThrow({ where: { id: runId }, select: { status: true, finishedAt: true } }),
    prisma.checkupSession.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true } }),
  ]);
  check("koşu ABANDONED, açık aşaması da bırakıldı",
    kosu.status === "ABANDONED" && asama.status === "ABANDONED" && kosu.finishedAt !== null,
    `${kosu.status} / ${asama.status}`);
  check("bırakılan koşu süren sayılmıyor (Bugün kartına girmez)",
    (await aktifKosu(userId)) === null && (await aktifKosu(userId, SINAV)) === null);
  const cevap = await hataVerir(() =>
    saveAnswer({ sessionId, userId, questionId: anahtar[0].questionId, choiceId: anahtar[0].dogruChoiceId, timeSpentMs: 1000 })
  );
  check("bırakılan aşamaya cevap yazılamıyor", cevap !== null, cevap ?? "yazıldı");

  const [karne, adim] = await Promise.all([seviyeKarnesi(runId, userId), sonrakiAdim(runId, userId)]);
  check("karne 'bırakıldı' durumunda", karne?.durum === "ABANDONED" && adim?.tur === "BIRAKILDI",
    `${karne?.baslik} · ${adim?.tur}`);
  const ikinci = await hataVerir(() => kosuyuBirak(runId, userId));
  check("bırakılmış deneme yeniden bırakılamıyor", ikinci !== null, ikinci ?? "");

  const yeni = await seviyeliSinavBaslat(userId, SINAV);
  check("bıraktıktan sonra yeni deneme açılıyor", yeni.runId !== runId && yeni.sessionId !== null);

  // Başka sınavın seviyelisi: TYT'nin süren denemesi bırakılır, LGS'ninki açılır.
  const lgs = await seviyeliSinavBaslat(userId, "LGS");
  const tyt = await prisma.levelRun.findUniqueOrThrow({ where: { id: yeni.runId }, select: { status: true } });
  const panodaki = await aktifKosu(userId);
  check("başka sınav başlatılınca eski sınavın koşusu bırakıldı",
    tyt.status === "ABANDONED" && panodaki?.id === lgs.runId && panodaki?.examScope === "LGS",
    `TYT ${tyt.status}, süren ${panodaki?.examScope ?? "-"}`);
  check("sınava göre süren koşu", (await aktifKosu(userId, SINAV)) === null && (await aktifKosu(userId, "LGS"))?.id === lgs.runId);
  const ayni = await seviyeliSinavBaslat(userId, "LGS");
  check("aynı sınavda ikinci koşu açılmıyor, süren dönüyor", ayni.runId === lgs.runId && ayni.sessionId === lgs.sessionId);

  // Veri onarımı: aşamasız, bir saatten eski, süren koşu silinir; yenisine dokunulmaz.
  const eski = await prisma.levelRun.create({
    data: { userId, examScope: "TYT", startedAt: new Date(Date.now() - 2 * 3600_000) },
    select: { id: true },
  });
  const taze = await prisma.levelRun.create({
    data: { userId, examScope: "TYT", startedAt: new Date(Date.now() - 10 * 60_000) },
    select: { id: true },
  });
  const silinen = await sahipsizKosulariSil();
  const [eskiVar, tazeVar, lgsVar] = await Promise.all([
    prisma.levelRun.count({ where: { id: eski.id } }),
    prisma.levelRun.count({ where: { id: taze.id } }),
    prisma.levelRun.count({ where: { id: lgs.runId } }),
  ]);
  check("sahipsiz eski koşu silindi, taze ve aşamalı koşu duruyor",
    silinen >= 1 && eskiVar === 0 && tazeVar === 1 && lgsVar === 1, `${silinen} silindi`);
  await prisma.levelRun.delete({ where: { id: taze.id } });
}

/**
 * LGS seviyeli koşusuna (Seviye 1, telafi, Seviye 2, Seviye 3) LGS'de olmayan
 * konudan soru ya da kazanım girmemeli.
 *
 * Kural (şema): kazanımın/sorunun sınav listesi DOLUYSA o liste karar verir;
 * BOŞSA konusunun geçtiği sınavlar (Topic.examScopes; o da boşsa konunun ana
 * sınavı). Eski seçim boş listeyi "her sınav" sayıyordu: kapsamı boş AYT/TYT
 * soruları LGS Seviye 2-3'e aday oluyordu (dev veritabanında yüzlercesi).
 *
 * Kural burada seçim kodundan BAĞIMSIZ yazılı: denetimi aynı yardımcıyla
 * yapmak, yardımcıdaki hatayı denetime de taşırdı.
 */
async function kapsamDenetimi(userId: string) {
  console.log("");
  console.log("Sınav kapsamı (LGS):");
  const LGS = "LGS" as const;

  const konular = await prisma.topic.findMany({
    select: { id: true, examScope: true, examScopes: true, _count: { select: { children: true } } },
  });
  const konuHaritasi = new Map(konular.map((k) => [k.id, k]));
  const konuLgs = (topicId: string) => {
    const k = konuHaritasi.get(topicId);
    if (!k) return false;
    return k.examScopes.length ? k.examScopes.includes(LGS) : k.examScope === LGS;
  };
  const lgsde = (liste: string[], topicId: string) => (liste.length ? liste.includes(LGS) : konuLgs(topicId));

  /** Verilen sorulardan LGS'de sorulamayanlar (soru ya da bağlı kazanım kapsam dışı). */
  async function kapsamDisi(questionIds: string[]) {
    const qs = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        topicId: true,
        examScopes: true,
        objective: { select: { topicId: true, examScopes: true } },
      },
    });
    return qs.filter(
      (q) =>
        !lgsde(q.examScopes, q.topicId) ||
        (q.objective !== null && !lgsde(q.objective.examScopes, q.objective.topicId))
    );
  }

  /*
   * Fikstür: kapsamı BOŞ bir kazanım ve ona bağlı, kapsamı boş bir L1 sorusu;
   * ikisi de LGS'de olmayan bir konuda. Dev verisinde bütün kazanımların
   * kapsamı dolu olduğu için kazanım kuralı başka türlü sınanamıyor. Paket
   * testlerine düşmesin diye yaprak olmayan bir konu tercih ediliyor.
   */
  await fiksturleriSil();
  const disKonu =
    konular.find((k) => !konuLgs(k.id) && k._count.children > 0) ?? konular.find((k) => !konuLgs(k.id));
  if (!disKonu) throw new Error("LGS dışı konu bulunamadı.");
  const kod = FIKSTUR_ONEKI + Date.now();
  const icerik = (metin: string) => ({
    version: 1,
    blocks: [{ type: "paragraph", content: [{ type: "text", text: metin }] }],
  });
  const fikstur = await prisma.objective.create({
    data: { code: kod, topicId: disKonu.id, name: "Kapsam testi kazanımı", examScopes: [], status: "PUBLISHED", sortOrder: -1 },
    select: { id: true },
  });
  // İki soru: biri Seviye 1'de gösterilse bile telafide ikincisi aday kalsın
  // (telafi aynı soruyu asla tekrar sormuyor).
  for (const n of [1, 2]) {
    await prisma.question.create({
      data: {
        topicId: disKonu.id,
        stem: icerik(`Kapsam testi sorusu ${n}`),
        stemText: `Kapsam testi sorusu ${n}`,
        fingerprint: `${kod.toLowerCase()}-${n}`,
        status: "PUBLISHED",
        level: "L1_TEMEL",
        examScopes: [],
        objectiveId: fikstur.id,
        choices: {
          create: ["A", "B", "C", "D", "E"].map((label, i) => ({
            label,
            content: icerik(String(i + 1)),
            isCorrect: i === 0,
            sortOrder: i,
          })),
        },
      },
    });
  }

  // Aday havuzları — rastgele seçimden bağımsız, her koşuda aynı sonuç.
  const kazanimlar = await sinavinKazanimlari(LGS);
  const kayitlar = await prisma.objective.findMany({
    where: { id: { in: kazanimlar.map((k) => k.id) } },
    select: { id: true, topicId: true, examScopes: true },
  });
  const disKazanim = kayitlar.filter((o) => !lgsde(o.examScopes, o.topicId));
  check("S1 kazanım listesinde LGS dışı kazanım yok", disKazanim.length === 0,
    `${kazanimlar.length} kazanım, ${disKazanim.length} kapsam dışı`);

  const l1 = await kazanimBasinaBirSoru([...kazanimlar.map((k) => k.id), fikstur.id], LGS, userId, []);
  const l1Dis = await kapsamDisi(l1.questions.map((q) => q.id));
  check("S1/telafi seçimi kapsam dışı kazanımdan soru getirmiyor", l1Dis.length === 0,
    `${l1.questions.length} soru, ${l1Dis.length} kapsam dışı`);

  for (const [level, ad] of [["L2_ORTA", "Seviye 2"], ["L3_ANALIZ", "Seviye 3"]] as const) {
    const havuz = await seviyeSorulari(level, 100_000, LGS, userId, []);
    const dis = await kapsamDisi(havuz.questions.map((q) => q.id));
    check(`${ad} aday havuzunda LGS dışı soru yok`, dis.length === 0,
      `${havuz.questions.length} aday, ${dis.length} kapsam dışı`);
  }

  await lgsKosusu(userId, fikstur.id, kapsamDisi);
}

/** Uçtan uca LGS koşusu: her aşamada oturuma GİREN sorular kapsam içinde mi. */
async function lgsKosusu(
  userId: string,
  fiksturKazanim: string,
  kapsamDisi: (ids: string[]) => Promise<unknown[]>
) {
  const LGS = "LGS" as const;
  const ayarL = ayarGetir(LGS);
  await prisma.levelRun.deleteMany({ where: { userId } });

  const { runId, sessionId: s1 } = await seviyeliSinavBaslat(userId, LGS);
  if (!s1) throw new Error("LGS Seviye 1 aşaması açılmadı.");
  const a1 = await cevapAnahtari(s1);
  const d1 = await kapsamDisi(a1.map((a) => a.questionId));
  check("LGS Seviye 1: tam sayı, LGS dışı soru/kazanım yok",
    d1.length === 0 && a1.length === ayarL.seviye1.soruSayisi,
    `${a1.length}/${ayarL.seviye1.soruSayisi} soru, ${d1.length} kapsam dışı`);

  // Telafiyi açmak için barajın hemen altı (TYT yolundaki gibi).
  const hedef = Math.max(0, Math.floor(a1.length * ayarL.seviye1.gecmeOrani) - 1);
  await cevapla(s1, userId, hedef);
  await submitCheckup(s1, userId);
  const k1 = await asamaDegerlendir(s1, userId);
  if (k1.tur === "TELAFI") {
    /*
     * Düzeltmeden ÖNCE açılmış bir koşunun bekleyen listesinde kapsam dışı
     * kazanım kalmış olabilir; telafi seçimi onu da süzmeli. Fikstürü listeye
     * ekleyerek bu durumu her koşuda (rastgeleliğe bırakmadan) kuruyoruz.
     * Listenin geri kalanı yeni sorusu olan Seviye 1 kazanımları: eksik çıkan
     * kazanımlar rastgele (sorular karışık geliyor) ve demo verisinde LGS
     * kazanımlarının çoğunun tek sorusu var; tur yine de her koşuda açılsın.
     */
    const yeniSorulu = await yeniSorusuOlanlar(
      a1.map((a) => a.objectiveId).filter((x): x is string => Boolean(x)),
      a1.map((a) => a.questionId)
    );
    await prisma.levelRun.update({
      where: { id: runId },
      data: { pendingRemedialIds: [...yeniSorulu, fiksturKazanim] },
    });
    const telafiId = await telafiyiAc(runId, userId);
    const aT = telafiId ? await cevapAnahtari(telafiId) : [];
    const dT = await kapsamDisi(aT.map((a) => a.questionId));
    check("LGS telafi turu: açıldı, LGS dışı soru/kazanım yok",
      telafiId !== null && aT.length === yeniSorulu.length && dT.length === 0,
      `${aT.length} soru, ${dT.length} kapsam dışı`);
    if (telafiId) await submitCheckup(telafiId, userId);
  } else {
    check("LGS telafi turu açıldı", false, k1.tur);
  }

  // Kapı mantığı yukarıda (TYT) sınandı; burada yalnızca seçimin kapsamı.
  // Koşu her seviyeden önce yeniden açılır: bitiş kapıyı değerlendiriyor
  // (submitCheckup), boş gönderilen Seviye 2 koşuyu durduruyor.
  for (const seviye of [2, 3] as const) {
    await prisma.levelRun.update({
      where: { id: runId },
      data: { status: "IN_PROGRESS", unlockedLevel: 3, stoppedAtLevel: null, finishedAt: null, pendingRemedialIds: [] },
    });
    const { sessionId } = await asamaAc(runId, seviye, "MAIN");
    const a = await cevapAnahtari(sessionId);
    const d = await kapsamDisi(a.map((x) => x.questionId));
    const beklenen = seviye === 2 ? ayarL.seviye2.soruSayisi : ayarL.seviye3.soruSayisi;
    check(`LGS Seviye ${seviye}: tam sayı, LGS dışı soru yok`, d.length === 0 && a.length === beklenen,
      `${a.length}/${beklenen} soru, ${d.length} kapsam dışı`);
    await submitCheckup(sessionId, userId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
