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
} from "../lib/level-run";
import { kazanimBasinaBirSoru, seviyeSorulari, sinavinKazanimlari } from "../lib/level-selection";
import { ayarGetir } from "../lib/levels";

/**
 * Seviyeli check-up — uçtan uca akış testi.
 *
 *   npm run test:levels
 *
 * Neden ayrı test: kapı mantığının saf hâli smoke'ta sınanıyor, ama asıl
 * risk orada değil. Asıl risk telafi turunda AYNI SORUNUN tekrar gelmesi —
 * o olursa öğrenci soruyu hatırlar, doğru yapar, sistem kazanımın
 * oturduğunu sanır ve ölçüm sessizce çöker. Bu test onu denetliyor.
 */

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const EMAIL_A = "level-test-a@kocum.local";
const EMAIL_B = "level-test-b@kocum.local";
const EMAIL_C = "level-test-c@kocum.local";
const SINAV = "TYT" as const;
/** Kapsam testinin fikstür kazanım/soru kodu öneki (yarıda kalan koşudan artarsa silinir). */
const FIKSTUR_ONEKI = "TEST-KAPSAM-";

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

  const paket = await prisma.package.findFirstOrThrow({
    where: { kind: "LEVEL", examScope: sinav },
    select: { id: true },
  });
  await prisma.entitlement.deleteMany({ where: { userId: u.id } });
  await grantEntitlement({
    userId: u.id,
    packageId: paket.id,
    expiresAt: new Date(Date.now() + 86_400_000),
    source: "level-test",
  });
  return u.id;
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

async function main() {
  console.log("\nSeviyeli check-up — uçtan uca\n");

  const ayar = ayarGetir(SINAV);
  const userA = await kullanici(EMAIL_A);
  await prisma.levelRun.deleteMany({ where: { userId: userA } });

  // ── Seviye 1 ana tur ─────────────────────────────────────
  console.log("Seviye 1 ana tur:");
  const { runId, sessionId: s1 } = await seviyeliSinavBaslat(userA, SINAV);
  const oturum1 = await getStudentSession(s1, userA);
  check("Seviye 1 oturumu açıldı", oturum1.questions.length > 0, `${oturum1.questions.length} soru`);

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
  const bekleyen = await aktifKosu(userA);
  check(
    "telafi HEMEN açılmıyor, bekliyor",
    (bekleyen?.pendingRemedialIds.length ?? 0) > 0 &&
      !bekleyen?.stages.some((s) => s.status === "IN_PROGRESS"),
    `${bekleyen?.pendingRemedialIds.length ?? 0} kazanım bekliyor`
  );

  // Öğrenci uyarıyı okuyup "devam" dedi.
  const telafiId = await telafiyiAc(runId, userA);
  const kosu = await aktifKosu(userA);
  const telafi = kosu?.stages.find((s) => s.id === telafiId);
  check("devam deyince telafi açıldı", Boolean(telafi));
  check("bekleyen liste temizlendi", (kosu?.pendingRemedialIds.length ?? 0) === 0);

  if (telafi) {
    const anahtarT = await cevapAnahtari(telafi.id);
    const eksikler = new Set(
      anahtar1.filter((a, i) => i >= hedefDogru).map((a) => a.objectiveId)
    );

    check(
      "telafi soru sayısı eksik kazanım sayısına eşit",
      anahtarT.length === eksikler.size,
      `${anahtarT.length} soru / ${eksikler.size} eksik kazanım`
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
  check("Seviye 2 oturumu açıldı", anahtar2.length > 0, `${anahtar2.length} soru`);

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
  await prisma.levelRun.deleteMany({ where: { userId: userB } });
  const b = await seviyeliSinavBaslat(userB, SINAV);
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
  const ids = [userA, userB, userC];
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL_A, EMAIL_B, EMAIL_C] } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

async function fiksturleriSil() {
  await prisma.question.deleteMany({ where: { fingerprint: { startsWith: FIKSTUR_ONEKI.toLowerCase() } } });
  await prisma.objective.deleteMany({ where: { code: { startsWith: FIKSTUR_ONEKI } } });
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
  const a1 = await cevapAnahtari(s1);
  const d1 = await kapsamDisi(a1.map((a) => a.questionId));
  check("LGS Seviye 1: LGS dışı soru/kazanım yok", d1.length === 0,
    `${a1.length} soru, ${d1.length} kapsam dışı`);

  // Telafiyi açmak için barajın hemen altı (TYT yolundaki gibi).
  const hedef = Math.max(0, Math.floor(a1.length * ayarL.seviye1.gecmeOrani) - 1);
  await cevapla(s1, userId, hedef);
  await submitCheckup(s1, userId);
  const k1 = await asamaDegerlendir(s1, userId);
  if (k1.tur === "TELAFI") {
    // Düzeltmeden ÖNCE açılmış bir koşunun bekleyen listesinde kapsam dışı
    // kazanım kalmış olabilir; telafi seçimi onu da süzmeli. Fikstürü listeye
    // ekleyerek bu durumu her koşuda (rastgeleliğe bırakmadan) kuruyoruz.
    const kosu = await prisma.levelRun.findUniqueOrThrow({
      where: { id: runId },
      select: { pendingRemedialIds: true },
    });
    if (!kosu.pendingRemedialIds.includes(fiksturKazanim)) {
      await prisma.levelRun.update({
        where: { id: runId },
        data: { pendingRemedialIds: [...kosu.pendingRemedialIds, fiksturKazanim] },
      });
    }
    const telafiId = await telafiyiAc(runId, userId);
    const aT = await cevapAnahtari(telafiId);
    const dT = await kapsamDisi(aT.map((a) => a.questionId));
    check("LGS telafi turu: LGS dışı soru/kazanım yok", dT.length === 0,
      `${aT.length} soru, ${dT.length} kapsam dışı`);
    await submitCheckup(telafiId, userId);
  } else {
    check("LGS telafi turu açıldı", false, k1.tur);
  }

  // Kapı mantığı yukarıda (TYT) sınandı; burada yalnızca seçimin kapsamı.
  await prisma.levelRun.update({
    where: { id: runId },
    data: { status: "IN_PROGRESS", unlockedLevel: 3, pendingRemedialIds: [] },
  });
  for (const seviye of [2, 3] as const) {
    const { sessionId } = await asamaAc(runId, seviye, "MAIN");
    const a = await cevapAnahtari(sessionId);
    const d = await kapsamDisi(a.map((x) => x.questionId));
    check(`LGS Seviye ${seviye}: LGS dışı soru yok`, d.length === 0,
      `${a.length} soru, ${d.length} kapsam dışı`);
    await submitCheckup(sessionId, userId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
