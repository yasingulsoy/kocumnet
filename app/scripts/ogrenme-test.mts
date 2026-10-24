import "./_koruma.mjs";
/**
 * Öğrenme ve motivasyon — ipucu, adım adım çözüm, video, kazanım özeti,
 * hata bildirimi, koça soru, seri.
 *
 *   npx tsx scripts/ogrenme-test.mts
 *
 * Neden ayrı test: bu turun bütün yenilikleri ya cevaba yakın bir şey
 * gösteriyor (ipucu, çözüm, video) ya da öğrencinin yazdığı bir şeyi
 * personele taşıyor (bildirim, koça soru). İkisinin de kusuru sessiz:
 * ipucu süren testte sızar, sınırlar delinir ya da görülmemiş bir sorunun
 * varlığı yoklanabilir. Seri hesabının gün sınırı (Türkiye saati) da saf
 * testle denetleniyor.
 *
 * Tohum gerekir: db:seed + db:seed:demo + db:seed:levels (CI'daki gibi).
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/password";
import {
  getCheckupReview,
  getSessionState,
  getStudentSession,
  saveAnswer,
  startCheckup,
  submitCheckup,
} from "../lib/checkup";
import {
  alistirmaHakki,
  answerPractice,
  benzerDurumlari,
  benzeriniCozBaslat,
  getPracticeSession,
  ipucuAc,
  odevKonuCalismasiBaslat,
  tekrarBaslat,
} from "../lib/practice";
import {
  BENZER_ZORLUK_FARKI,
  GUNLUK_ALISTIRMA_SORU,
  IPUCLU_DOGRU_ARA_GUN,
  KONU_CALISMA_SORU,
  TEKRAR_ARALIKLARI_GUN,
  odevAlistirmaAdedi,
  tekrarSonrasi,
  vade,
} from "../lib/review";
import { soruSinavdaKosulu } from "../lib/exam-scope";
import { ogrenciOdevleri } from "../lib/odev-sorgu";
import { gunAnahtari, gunlukSayimlar, seriDurumu, seriHesapla } from "../lib/seri";
import { hataBildir, raporDurumlari, soruyuGordu } from "../lib/hata-bildirimi";
import { cevaplariOkundu, kocaSoruHakki, kocaSoruSor, kocaSorulari, okunmamisCevapSayisi } from "../lib/koca-soru";
import {
  ACIK_KOCA_SORU_SINIRI,
  GUNLUK_KOCA_SORU_SINIRI,
  GUNLUK_RAPOR_SINIRI,
  KOCA_SORU_SINIRI,
  RAPOR_ACIKLAMA_SINIRI,
} from "../lib/bildirim-kurallari";
import { splitSolutionSteps } from "../lib/question-content";
import { haftalikCalismaSatiri } from "../lib/digest";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const EMAIL = "ogrenme-test@kocum.local";
const OTHER_EMAIL = "ogrenme-test-other@kocum.local";
const SERI_EMAIL = "ogrenme-test-seri@kocum.local";
const ODEV_EMAIL = "ogrenme-test-odev@kocum.local";
const GRUP_ADI = "Öğrenme testi grubu";
const PAKET = "tyt-ilk-15";

/** İçerik izleri: öğrenciye giden JSON'da aranır. */
const IZ = {
  ipucu: "IPUCU_IZI_",
  cozum: "COZUM_IZI_",
  ozet: "KAZANIM_IZI",
  video: "VIDEOIZI123",
};

/**
 * Beklenen ret mesajı; ret yoksa null. Adla eşleştiriyoruz: tsx, `@/lib/...`
 * ile `../lib/...` yollarını ayrı modül olarak yükleyebiliyor ve hata
 * sınıfları `instanceof` ile eşleşmiyor (practice-test'teki not).
 */
async function hataVerir(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const ad = e instanceof Error ? e.name : "";
    return ad === "CheckupError" || ad === "BildirimHatasi" ? (e as Error).message : `BEKLENMEYEN: ${String(e)}`;
  }
}
async function reddeder(fn: () => Promise<unknown>): Promise<boolean> {
  const m = await hataVerir(fn);
  return m !== null && !m.startsWith("BEKLENMEYEN");
}

async function kullanici(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Öğrenme Testi",
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: "TYT",
      onboardedAt: new Date(),
    },
    update: { dailyQuestionGoal: 10 },
    select: { id: true },
  });
}

async function temizle(ids: string[]) {
  await prisma.coachQuestion.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionNote.deleteMany({ where: { reportedById: { in: ids } } });
  await prisma.notebookItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.levelRun.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.questionExposure.deleteMany({ where: { userId: { in: ids } } });
}

/** İpucu/çözüm/video izleri olan içerik (her soru kendi numarasıyla). */
function paragraf(metin: string) {
  return { version: 1 as const, blocks: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: metin }] }] };
}
function izliIcerik(questionId: string) {
  return {
    hints: [1, 2, 3].map((n) => paragraf(`${IZ.ipucu}${n} ${questionId}`)),
    solution: {
      version: 1 as const,
      blocks: [
        { type: "paragraph" as const, content: [{ type: "text" as const, text: `${IZ.cozum}1` }] },
        { type: "step_break" as const },
        { type: "paragraph" as const, content: [{ type: "text" as const, text: `${IZ.cozum}2` }] },
      ],
    },
    videoUrl: `https://youtu.be/${IZ.video}`,
  };
}

/** Değiştirilen soruların özgün içeriği: test bitince geri yazılır. */
const geriYukle: { id: string; hints: unknown; solution: unknown; videoUrl: string | null; objectiveId: string | null }[] = [];
async function izEkle(questionId: string, objectiveId?: string) {
  const once = await prisma.question.findUniqueOrThrow({
    where: { id: questionId },
    select: { id: true, hints: true, solution: true, videoUrl: true, objectiveId: true },
  });
  if (!geriYukle.some((g) => g.id === questionId)) geriYukle.push(once);
  const iz = izliIcerik(questionId);
  await prisma.question.update({
    where: { id: questionId },
    data: { hints: iz.hints, solution: iz.solution, videoUrl: iz.videoUrl, ...(objectiveId ? { objectiveId } : {}) },
  });
}

async function dogruSik(questionId: string) {
  return (await prisma.choice.findFirstOrThrow({ where: { questionId, isCorrect: true }, select: { id: true } })).id;
}
async function yanlisSik(questionId: string) {
  return (await prisma.choice.findFirstOrThrow({ where: { questionId, isCorrect: false }, select: { id: true } })).id;
}

/**
 * Kaynak testte havuzda benzeri olan sorular; her birine AYRI bir benzer
 * düşer (lib/review.ts benzerAta gibi aynı aday iki soruya verilmez).
 *
 * Seçim kodundan BAĞIMSIZ yazılı (level-test'teki gibi: yardımcıdaki hata
 * denetime taşınmasın). Kural lib/review.ts benzerMi: aynı kazanım
 * (kazanımsızsa aynı konu), aynı seviye, zorluk farkı en fazla
 * BENZER_ZORLUK_FARKI. Aday yayında, TYT'de sorulabilir ve bu testte değil.
 */
async function ayriBenzeriOlanlar(sorular: string[]): Promise<Set<string>> {
  const alanlar = { id: true, topicId: true, objectiveId: true, level: true, difficulty: true } as const;
  const [kaynaklar, havuz] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: sorular } }, select: alanlar }),
    prisma.question.findMany({
      where: { status: "PUBLISHED", id: { notIn: sorular }, AND: [soruSinavdaKosulu("TYT")] },
      select: alanlar,
    }),
  ]);
  const kullanilan = new Set<string>();
  const sonuc = new Set<string>();
  for (const k of kaynaklar) {
    const aday = havuz.find(
      (a) =>
        !kullanilan.has(a.id) &&
        (k.objectiveId ? a.objectiveId === k.objectiveId : a.topicId === k.topicId) &&
        (a.level ?? null) === (k.level ?? null) &&
        Math.abs(a.difficulty - k.difficulty) <= BENZER_ZORLUK_FARKI
    );
    if (!aday) continue;
    kullanilan.add(aday.id);
    sonuc.add(k.id);
  }
  return sonuc;
}

/**
 * Kaynak testin yanlışları arasında benzeri olan en az bu kadar soru:
 * biri ipucu alıştırmasının kaynağı ("Benzerini çöz"), ikisi bugünkü
 * tekrarın ipuçlu ve ipucusuz sorusu. Bir fazlası pay: "Benzerini çöz"ün
 * seçtiği soru açık alıştırmada kaldığı için tekrara aday olmayabilir.
 */
const GEREKEN_BENZERLI_YANLIS = 4;

// ─────────────────────────────────────────────────────────────
// 1. Seri — saf hesap ve gün sınırları
// ─────────────────────────────────────────────────────────────
function seriSaf() {
  console.log("\nSeri (saf hesap):");
  check("TR 23:59:59 aynı gün (UTC 20:59:59)", gunAnahtari(new Date("2026-10-20T20:59:59Z")) === "2026-10-20");
  check("TR 00:00 ertesi gün (UTC 21:00)", gunAnahtari(new Date("2026-10-20T21:00:00Z")) === "2026-10-21");
  check("UTC gece yarısı TR'de 03:00, aynı gün", gunAnahtari(new Date("2026-10-21T00:00:00Z")) === "2026-10-21");

  const g = (gun: string, adet = 1) => ({ gun, adet });
  const s1 = seriHesapla([g("2026-10-19"), g("2026-10-20"), g("2026-10-21", 7)], "2026-10-21", 10);
  check("bugün dahil 3 gün", s1.seri === 3 && s1.bugunCalisti && !s1.seriBekliyor, `seri ${s1.seri}`);
  check("bugünkü sayı ve hedef", s1.bugunAdet === 7 && s1.hedef === 10 && !s1.hedefTamam);
  check("hedef dolunca tamam", seriHesapla([g("2026-10-21", 10)], "2026-10-21", 10).hedefTamam);
  check("hedef 0: tamam sayılmaz, yalnızca sayı", !seriHesapla([g("2026-10-21", 50)], "2026-10-21", 0).hedefTamam);

  const s2 = seriHesapla([g("2026-10-19"), g("2026-10-20")], "2026-10-21", 10);
  check("bugün çözülmediyse seri dünden sayılır", s2.seri === 2 && !s2.bugunCalisti && s2.seriBekliyor);

  const s3 = seriHesapla([g("2026-10-15"), g("2026-10-16"), g("2026-10-17"), g("2026-10-18"), g("2026-10-20")], "2026-10-21", 10);
  check("arada boş gün seriyi keser, en uzun ayrı", s3.seri === 1 && s3.enUzun === 4, `seri ${s3.seri}, en uzun ${s3.enUzun}`);

  const s4 = seriHesapla([g("2026-10-18")], "2026-10-21", 10);
  check("iki gün önce kırılan seri: 0, bekleyen seri yok", s4.seri === 0 && !s4.seriBekliyor && s4.enUzun === 1);
  check("0 adetli gün çalışılmış sayılmaz", seriHesapla([g("2026-10-21", 0)], "2026-10-21", 10).seri === 0);

  check("ay sınırı ardışık", seriHesapla([g("2026-10-31"), g("2026-11-01")], "2026-11-01", 10).seri === 2);
  check("yıl sınırı ardışık", seriHesapla([g("2026-12-31"), g("2027-01-01")], "2027-01-01", 10).seri === 2);
  check("artık yıl (29 Şubat)", seriHesapla([g("2028-02-28"), g("2028-02-29"), g("2028-03-01")], "2028-03-01", 10).seri === 3);

  const hafta = s1.son7;
  check("son 7 gün: 7 kayıt, sonuncusu bugün", hafta.length === 7 && hafta[6].bugun && hafta[6].gun === "2026-10-21");
  check("21 Ekim 2026 çarşamba", hafta[6].kisa === "Çar" && hafta[0].kisa === "Per", hafta.map((d) => d.kisa).join(" "));
  check("son 7 günde 3 gün", s1.son7Calisilan === 3);
  check("gelecek gün en uzuna girmez", seriHesapla([g("2026-10-22"), g("2026-10-23")], "2026-10-21", 10).enUzun === 0);

  // Haftalık posta satırı: bugün HARİÇ son 7 gün.
  const pzt = new Date("2026-10-26T05:00:00Z"); // pazartesi 08:00 TR
  check(
    "posta: bugün hariç son 7 gün",
    haftalikCalismaSatiri([g("2026-10-19"), g("2026-10-20"), g("2026-10-25"), g("2026-10-26")], pzt) === "Son 7 günde 3 gün çalıştın."
  );
  check("posta: hiç çalışılmadıysa satır yok", haftalikCalismaSatiri([g("2026-10-26")], pzt) === null);
}

// ─────────────────────────────────────────────────────────────
// 2. Seri — veritabanı (gün bazında toplama)
// ─────────────────────────────────────────────────────────────
async function seriVeritabani() {
  console.log("\nSeri (veritabanı):");
  const u = await kullanici(SERI_EMAIL);
  await temizle([u.id]);
  const paket = await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { id: true } });
  const sorular = await prisma.question.findMany({ where: { status: "PUBLISHED" }, take: 6, select: { id: true } });
  const siklar = await Promise.all(sorular.map((q) => yanlisSik(q.id)));

  const t = (iso: string) => new Date(iso);
  // Sınav: TR 20 Ekim 23:59 · TR 21 Ekim 00:01 (ilk işaret; sonra değiştirildi) · boş satır · 100 gün önce
  await prisma.checkupSession.create({
    data: {
      userId: u.id,
      packageId: paket.id,
      kind: "PACKAGE",
      status: "SUBMITTED",
      durationMinutes: 30,
      penaltyRatio: 0.25,
      startedAt: t("2026-10-20T20:30:00Z"),
      expiresAt: t("2026-10-20T21:30:00Z"),
      submittedAt: t("2026-10-20T21:20:00Z"),
      items: {
        create: [
          { questionId: sorular[0].id, sortOrder: 0, questionVersion: 1, answer: { create: { choiceId: siklar[0], isCorrect: false, answeredAt: t("2026-10-20T20:59:00Z") } } },
          {
            questionId: sorular[1].id,
            sortOrder: 1,
            questionVersion: 1,
            answer: { create: { choiceId: siklar[1], isCorrect: false, firstAnsweredAt: t("2026-10-20T21:01:00Z"), answeredAt: t("2026-10-21T08:00:00Z") } },
          },
          // Süre birleştirmenin açtığı boş satır: soru çözülmedi, sayılmaz.
          { questionId: sorular[2].id, sortOrder: 2, questionVersion: 1, answer: { create: { choiceId: null, isCorrect: null, answeredAt: t("2026-10-21T09:00:00Z") } } },
          { questionId: sorular[3].id, sortOrder: 3, questionVersion: 1, answer: { create: { choiceId: siklar[3], isCorrect: false, answeredAt: t("2026-07-10T09:00:00Z") } } },
        ],
      },
    },
  });
  // Alıştırmada "Bilmiyorum" (şıksız) sayılır: soru kilitlendi, çözüm okundu.
  const alistirmaPaketi = await prisma.package.findFirst({ where: { kind: "PRACTICE" }, select: { id: true } });
  await prisma.checkupSession.create({
    data: {
      userId: u.id,
      packageId: alistirmaPaketi?.id ?? paket.id,
      kind: "PRACTICE",
      practiceMode: "TOPIC",
      status: "SUBMITTED",
      durationMinutes: 1440,
      penaltyRatio: 0,
      startedAt: t("2026-10-21T09:00:00Z"),
      expiresAt: t("2026-10-22T09:00:00Z"),
      items: {
        create: [
          { questionId: sorular[4].id, sortOrder: 0, questionVersion: 1, answer: { create: { choiceId: null, isCorrect: null, answeredAt: t("2026-10-21T09:05:00Z") } } },
        ],
      },
    },
  });

  const simdi = t("2026-10-21T12:00:00Z");
  const sayim = new Map((await gunlukSayimlar(u.id, simdi)).map((s) => [s.gun, s.adet]));
  check("TR 23:59 cevabı 20 Ekim'de", sayim.get("2026-10-20") === 1, JSON.stringify([...sayim]));
  check("ilk işaret TR 00:01 → 21 Ekim; sınav boşu sayılmaz; alıştırma 'Bilmiyorum' sayılır", sayim.get("2026-10-21") === 2);
  check("90 günlük pencere dışı sayılmaz", !sayim.has("2026-07-10"));

  const durum = await seriDurumu(u.id, simdi);
  check("seri 2, bugün 2/10", durum.seri === 2 && durum.bugunAdet === 2 && durum.hedef === 10 && durum.bugunCalisti);
  await prisma.user.update({ where: { id: u.id }, data: { dailyQuestionGoal: 0 } });
  check("hedef 0 profilden geliyor", (await seriDurumu(u.id, simdi)).hedef === 0);
  await temizle([u.id]);
}

// ─────────────────────────────────────────────────────────────
// 8. Koçun konu ödevi: kaynak test istemez, sınır engellemez
// ─────────────────────────────────────────────────────────────
async function konuOdevi(yabanciId: string) {
  console.log("\nKoçun konu ödevi:");
  check("kural: hak varken normal konu alıştırması kadar", odevAlistirmaAdedi(2, 30) === KONU_CALISMA_SORU);
  check("kural: hak bittiyse ödevin kalanı kadar", odevAlistirmaAdedi(2, 0) === 2 && odevAlistirmaAdedi(3, 1) === 3);
  check("kural: oturum en fazla konu alıştırması kadar", odevAlistirmaAdedi(40, 0) === KONU_CALISMA_SORU);
  check("kural: ödev ve hak bittiyse 0", odevAlistirmaAdedi(0, 0) === 0);

  const u = await kullanici(ODEV_EMAIL);
  await temizle([u.id]);
  await prisma.studyGroup.deleteMany({ where: { name: GRUP_ADI } });

  // Bol sorulu bir TYT konusu: iki oturum (5 + 2) soru tekrar etmeden açılabilsin.
  const [enBol] = await prisma.question.groupBy({
    by: ["topicId"],
    where: { status: "PUBLISHED", ...soruSinavdaKosulu("TYT") },
    _count: { _all: true },
    orderBy: { _count: { topicId: "desc" } },
    take: 1,
  });
  const topicId = enBol.topicId;
  const grup = await prisma.studyGroup.create({
    data: { name: GRUP_ADI, examScope: "TYT", createdByStaff: "test (#0)" },
    select: { id: true },
  });
  await prisma.groupMember.create({ data: { groupId: grup.id, userId: u.id, addedByStaff: "test (#0)" } });
  const gun = 86_400_000;
  const odev = await prisma.assignment.create({
    data: {
      groupId: grup.id,
      kind: "TOPIC_PRACTICE",
      topicId,
      questionCount: 7,
      title: "Öğrenme testi: 7 soru",
      startsAt: new Date(Date.now() - 60_000),
      dueAt: new Date(Date.now() + 7 * gun),
      createdByStaff: "test (#0)",
    },
    select: { id: true, startsAt: true },
  });

  check("öğrencinin hiç testi yok (kaynak test yok)", (await prisma.checkupSession.count({ where: { userId: u.id } })) === 0);
  const uyeDegil = await hataVerir(() => odevKonuCalismasiBaslat(yabanciId, odev.id));
  const yok = await hataVerir(() => odevKonuCalismasiBaslat(u.id, "yok-boyle-bir-odev"));
  check("üye olmayan reddediliyor", uyeDegil !== null && !uyeDegil.startsWith("BEKLENMEYEN"), uyeDegil ?? "");
  check("var olmayan ödevle aynı ileti (yoklama yok)", uyeDegil === yok);

  const o1 = await odevKonuCalismasiBaslat(u.id, odev.id);
  const s1 = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: o1 },
    select: {
      kind: true,
      practiceMode: true,
      focusTopicId: true,
      sourceSessionId: true,
      package: { select: { kind: true, examScope: true } },
      items: { select: { questionId: true } },
    },
  });
  check("kaynak testi olmayan öğrencide açıldı: PRACTICE / TOPIC", s1.kind === "PRACTICE" && s1.practiceMode === "TOPIC");
  check("odak konu ödevin konusu, kaynak test yok", s1.focusTopicId === topicId && s1.sourceSessionId === null);
  check("grubun sınavı (TYT) alıştırma paketinde", s1.package.kind === "PRACTICE" && s1.package.examScope === "TYT");
  check(`ilk oturum ${KONU_CALISMA_SORU} soru`, s1.items.length === KONU_CALISMA_SORU, `${s1.items.length}`);
  check("yarım kalan oturuma dönüyor", (await odevKonuCalismasiBaslat(u.id, odev.id)) === o1);
  check(
    "ödev oturumu günlük sınıra sayılıyor",
    (await alistirmaHakki(u.id)) === GUNLUK_ALISTIRMA_SORU - KONU_CALISMA_SORU
  );
  for (const it of s1.items) {
    await answerPractice({ sessionId: o1, userId: u.id, questionId: it.questionId, choiceId: await yanlisSik(it.questionId), timeSpentMs: 3000 });
  }

  // İptal, arşiv, başlamamış ödev, paket ödevi, kapanmış pencere.
  await prisma.assignment.update({ where: { id: odev.id }, data: { cancelledAt: new Date(), cancelledByStaff: "test (#0)" } });
  check("iptal edilen ödev reddediliyor", await reddeder(() => odevKonuCalismasiBaslat(u.id, odev.id)));
  await prisma.assignment.update({ where: { id: odev.id }, data: { cancelledAt: null, cancelledByStaff: null } });
  await prisma.studyGroup.update({ where: { id: grup.id }, data: { archivedAt: new Date() } });
  check("arşivlenen grubun ödevi reddediliyor", await reddeder(() => odevKonuCalismasiBaslat(u.id, odev.id)));
  await prisma.studyGroup.update({ where: { id: grup.id }, data: { archivedAt: null } });
  await prisma.assignment.update({ where: { id: odev.id }, data: { startsAt: new Date(Date.now() + gun) } });
  check("başlamamış ödev reddediliyor", await reddeder(() => odevKonuCalismasiBaslat(u.id, odev.id)));
  await prisma.assignment.update({ where: { id: odev.id }, data: { startsAt: odev.startsAt } });
  const paketOdevi = await prisma.assignment.create({
    data: {
      groupId: grup.id,
      kind: "PACKAGE",
      packageId: (await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { id: true } })).id,
      title: "Paket ödevi",
      dueAt: new Date(Date.now() + 7 * gun),
      createdByStaff: "test (#0)",
    },
    select: { id: true },
  });
  check("paket ödevi bu yoldan açılmıyor", await reddeder(() => odevKonuCalismasiBaslat(u.id, paketOdevi.id)));
  const eskiOdev = await prisma.assignment.create({
    data: {
      groupId: grup.id,
      kind: "TOPIC_PRACTICE",
      topicId,
      questionCount: 40,
      title: "Eski ödev",
      startsAt: new Date(Date.now() - 30 * gun),
      dueAt: new Date(Date.now() - 8 * gun),
      createdByStaff: "test (#0)",
    },
    select: { id: true },
  });
  const kapandi = await hataVerir(() => odevKonuCalismasiBaslat(u.id, eskiOdev.id));
  check("gecikme penceresi kapanan ödev reddediliyor", kapandi?.includes("süresi kapandı") === true, kapandi ?? "");

  // Sınır: günlük hak biterse ödev, kalan sorusu kadar yine açılır.
  const doldurucu = await prisma.question.findMany({
    where: { status: "PUBLISHED", topicId: { not: topicId } },
    take: GUNLUK_ALISTIRMA_SORU - KONU_CALISMA_SORU,
    select: { id: true },
  });
  const alistirmaPaketi = await prisma.package.findFirstOrThrow({
    where: { kind: "PRACTICE", examScope: "TYT" },
    select: { id: true },
  });
  await prisma.checkupSession.create({
    data: {
      userId: u.id,
      packageId: alistirmaPaketi.id,
      kind: "PRACTICE",
      practiceMode: "SIMILAR",
      status: "SUBMITTED",
      durationMinutes: 1440,
      penaltyRatio: 0,
      expiresAt: new Date(Date.now() + gun),
      items: { create: doldurucu.map((q, i) => ({ questionId: q.id, sortOrder: i, questionVersion: 1 })) },
    },
  });
  check("günlük alıştırma hakkı bitti", (await alistirmaHakki(u.id)) === 0);
  const o2 = await odevKonuCalismasiBaslat(u.id, odev.id);
  const s2 = await prisma.sessionItem.findMany({ where: { sessionId: o2 }, select: { questionId: true } });
  check("hak bittiğinde ödev engellenmiyor: kalan 2 soru geldi", o2 !== o1 && s2.length === 2, `${s2.length} soru`);
  check(
    "yeni oturumda önceki oturumun soruları yok",
    s2.every((i) => !s1.items.some((x) => x.questionId === i.questionId))
  );
  for (const it of s2) {
    await answerPractice({ sessionId: o2, userId: u.id, questionId: it.questionId, choiceId: await dogruSik(it.questionId), timeSpentMs: 3000 });
  }
  const bitti = await hataVerir(() => odevKonuCalismasiBaslat(u.id, odev.id));
  check("ödev bitince yeni oturum açılmıyor", bitti?.includes("tamamladın") === true, bitti ?? "");
  const liste = await ogrenciOdevleri(u.id);
  const satir = [...liste.acik, ...liste.gecmis].find((o) => o.id === odev.id);
  check("ödevler ekranında tamamlandı (7/7)", satir?.ilerleme.durum === "TAMAMLANDI" && satir.ilerleme.cozulen === 7);

  await prisma.studyGroup.delete({ where: { id: grup.id } });
  await temizle([u.id]);
}

// ─────────────────────────────────────────────────────────────
// Ana akış
// ─────────────────────────────────────────────────────────────
async function main() {
  seriSaf();
  await seriVeritabani();

  const user = await kullanici(EMAIL);
  const other = await kullanici(OTHER_EMAIL);
  await temizle([user.id, other.id]);

  // ── Kaynak test: 5 doğru, gerisi yanlış ───────────────────
  //
  // Sonraki bölümler yanlışlar arasında havuzda benzeri olan sorular bekliyor
  // (GEREKEN_BENZERLI_YANLIS). Paketin soruları rastgele geliyor; rastgele
  // çıkan yanlışlara güvenmek kırılgandı (practice-test §11 CI'da bu yüzden
  // düşmüştü). Ön koşul burada kuruluyor: benzeri olan sorular yanlışlara
  // konuyor; testte o kadar yoksa öğrencinin izleri silinip test yeniden
  // açılıyor (hiç soru görmemiş öğrenciyle aynı durum).
  console.log("\nKaynak test:");
  let kaynakTest: { id: string; sorular: string[]; benzerli: Set<string> } | null = null;
  let enCokBenzerli = 0;
  for (let deneme = 0; !kaynakTest && deneme < 3; deneme++) {
    if (deneme > 0) await temizle([user.id]);
    const id = await startCheckup(user.id, PAKET);
    const sorular = (await getStudentSession(id, user.id)).questions.map((q) => q.id);
    const benzerli = await ayriBenzeriOlanlar(sorular);
    enCokBenzerli = Math.max(enCokBenzerli, benzerli.size);
    if (benzerli.size < GEREKEN_BENZERLI_YANLIS) continue;
    // Benzeri olmayanlar başa (doğru), benzeri olanlar sona (yanlış).
    kaynakTest = {
      id,
      sorular: [...sorular.filter((q) => !benzerli.has(q)), ...sorular.filter((q) => benzerli.has(q))],
      benzerli,
    };
  }
  if (!kaynakTest) {
    throw new Error(
      `Üç denemede de en az ${GEREKEN_BENZERLI_YANLIS} sorusunun havuzda benzeri olan kaynak test gelmedi ` +
        `(en çok ${enCokBenzerli}); demo havuzu kontrol et (db:seed:demo).`
    );
  }
  const { id: examId, sorular: examIds, benzerli } = kaynakTest;
  for (const [i, q] of examIds.entries()) {
    const choiceId = i < 5 ? await dogruSik(q) : await yanlisSik(q);
    await saveAnswer({ sessionId: examId, userId: user.id, questionId: q, choiceId, timeSpentMs: 20_000 });
  }
  await submitCheckup(examId, user.id);
  const yanlislar = examIds.slice(5);
  const benzerliYanlis = yanlislar.filter((id) => benzerli.has(id)).length;
  check("kaynak test bitti", (await prisma.checkupSession.findUniqueOrThrow({ where: { id: examId } })).status === "SUBMITTED");
  check(
    `yanlışlardan en az ${GEREKEN_BENZERLI_YANLIS} tanesinin havuzda benzeri var (ön koşul)`,
    benzerliYanlis >= GEREKEN_BENZERLI_YANLIS,
    `${benzerliYanlis}`
  );

  // ── 3. İpucu: sıra, yetki, sızıntı ────────────────────────
  console.log("\nKademeli ipucu:");
  const benzerler = await benzerDurumlari(user.id, examId);
  const kaynak = yanlislar.find((id) => benzerler.get(id));
  // Ön koşul yukarıda kuruldu: burada yoksa sonuç ekranının kuralı ayrışmıştır.
  if (!kaynak) {
    throw new Error(
      `${benzerliYanlis} yanlışın havuzda benzeri var ama sonuç ekranı hiçbirine "Benzerini çöz" vermiyor ` +
        "(lib/practice.ts benzerDurumlari ile lib/review.ts benzerMi ayrışmış)."
    );
  }
  const p1 = await benzeriniCozBaslat(user.id, examId, kaynak);
  const p1Soru = (await prisma.sessionItem.findFirstOrThrow({ where: { sessionId: p1 }, select: { questionId: true } })).questionId;
  const konu = (await prisma.question.findUniqueOrThrow({ where: { id: p1Soru }, select: { topicId: true } })).topicId;
  const kazanim = await prisma.objective.upsert({
    where: { code: "OGRENME-TEST-KAZANIM" },
    create: { code: "OGRENME-TEST-KAZANIM", name: "Öğrenme testi kazanımı", topicId: konu, summary: paragraf(IZ.ozet), status: "DRAFT" },
    update: { topicId: konu, summary: paragraf(IZ.ozet) },
    select: { id: true },
  });
  await izEkle(p1Soru, kazanim.id);

  const v0 = await getPracticeSession(p1, user.id);
  const v0Json = JSON.stringify(v0);
  check("ilk yüklemede ipucu SAYISI var", v0.questions[0].ipucu.toplam === 3 && v0.questions[0].ipucu.acilan.length === 0);
  for (const [ad, iz] of Object.entries(IZ)) check(`ilk yüklemede ${ad} içeriği YOK`, !v0Json.includes(iz));
  check("ilk yüklemede hints/videoUrl alanı yok", !v0Json.includes('"hints"') && !v0Json.includes("videoUrl"));

  check("sırayı atlayan ipucu reddediliyor (2/3)", await reddeder(() => ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 2 })));
  check("başka öğrenci ipucu açamıyor", await reddeder(() => ipucuAc({ sessionId: p1, userId: other.id, questionId: p1Soru, sira: 1 })));
  check("geçersiz sıra (4) reddediliyor", await reddeder(() => ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 4 })));
  check("başka sorunun kimliğiyle açılamıyor", await reddeder(() => ipucuAc({ sessionId: p1, userId: user.id, questionId: examIds[0], sira: 1 })));
  check("ret sayacı artırmadı", (await prisma.sessionItem.findFirstOrThrow({ where: { sessionId: p1 } })).hintsUsed === 0);

  await ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 1 });
  await ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 1 }); // çift dokunuş
  check("ilk ipucu açıldı, çift dokunuş ikinciyi açmadı", (await prisma.sessionItem.findFirstOrThrow({ where: { sessionId: p1 } })).hintsUsed === 1);
  const v1 = await getPracticeSession(p1, user.id);
  const v1Json = JSON.stringify(v1);
  check("yenileyince açılan ipucu geliyor", v1.questions[0].ipucu.acilan.length === 1 && v1Json.includes(`${IZ.ipucu}1`));
  check("açılmamış ipuçları hâlâ yok", !v1Json.includes(`${IZ.ipucu}2`) && !v1Json.includes(`${IZ.ipucu}3`));
  check("çözüm ve video cevaptan önce yok", !v1Json.includes(IZ.cozum) && !v1Json.includes(IZ.video));

  // Süren sınavın verisi: aynı izler hiçbir yoldan girmez.
  const sinav2 = await startCheckup(other.id, PAKET);
  const s2 = await getStudentSession(sinav2, other.id);
  await izEkle(s2.questions[0].id);
  const s2Json = JSON.stringify(await getStudentSession(sinav2, other.id)) + JSON.stringify(await getSessionState(sinav2, other.id));
  for (const [ad, iz] of Object.entries(IZ)) check(`süren sınavın verisinde ${ad} YOK`, !s2Json.includes(iz));
  check(
    "sınav oturumunda ipucu açılmıyor",
    await reddeder(() => ipucuAc({ sessionId: sinav2, userId: other.id, questionId: s2.questions[0].id, sira: 1 }))
  );
  check("süren sınavda inceleme (çözüm/video) kapalı", await reddeder(() => getCheckupReview(sinav2, other.id)));

  // Aynı soru öğrencinin açık bir sınavında da varsa ipucu açılmaz.
  const paketId = (await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { id: true } })).id;
  const elleAcik = await prisma.checkupSession.create({
    data: {
      userId: user.id,
      packageId: paketId,
      kind: "PACKAGE",
      status: "IN_PROGRESS",
      durationMinutes: 30,
      penaltyRatio: 0.25,
      expiresAt: new Date(Date.now() + 30 * 60_000),
      items: { create: [{ questionId: p1Soru, sortOrder: 0, questionVersion: 1 }] },
    },
    select: { id: true },
  });
  check(
    "soru açık bir sınavda da varsa ipucu açılmıyor",
    await reddeder(() => ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 2 }))
  );
  check(
    "süren sınavdaki soru bildirilemiyor (görülmüş sayılmaz)",
    await reddeder(() => hataBildir({ userId: user.id, questionId: p1Soru, sessionId: elleAcik.id, reason: "DIGER", body: "" }))
  );
  await prisma.checkupSession.update({ where: { id: elleAcik.id }, data: { status: "ABANDONED" } });

  // Cevap: yanlış → çözüm adımları, video, kazanım özeti; açılan ipucu kalır.
  await answerPractice({ sessionId: p1, userId: user.id, questionId: p1Soru, choiceId: await yanlisSik(p1Soru), timeSpentMs: 5000 });
  const v2 = await getPracticeSession(p1, user.id);
  const fb = v2.questions[0].feedback;
  check("geri bildirimde açılan ipucu sayısı", fb?.ipucuSayisi === 1);
  check("açılan ipucu cevaptan sonra da duruyor", v2.questions[0].ipucu.acilan.length === 1);
  check("video cevaptan sonra geliyor (çerezsiz adres)", fb?.video?.embedUrl === `https://www.youtube-nocookie.com/embed/${IZ.video}`);
  check("çözüm iki adıma bölünüyor", fb?.solution ? splitSolutionSteps(fb.solution).length === 2 : false);
  check("yanlışta kazanım özeti geliyor", fb?.kazanim?.id === kazanim.id && JSON.stringify(fb.kazanim).includes(IZ.ozet));
  check("cevaptan sonra ipucu açılmıyor", await reddeder(() => ipucuAc({ sessionId: p1, userId: user.id, questionId: p1Soru, sira: 2 })));

  // ── 4. Yanlış defteri: ipucuyla doğru tam doğru sayılmaz ──
  console.log("\nYanlış defteri (ipucu kuralı):");
  const simdi = new Date();
  const saf = tekrarSonrasi(1, true, simdi, true);
  check("saf: ipucuyla doğru aşamayı korur, yarın gelir", saf.stage === 1 && saf.dueAt.getTime() === vade(simdi, IPUCLU_DOGRU_ARA_GUN).getTime() && !saf.resolvedAt);
  const sonAsama = tekrarSonrasi(TEKRAR_ARALIKLARI_GUN.length - 1, true, simdi, true);
  check("saf: son aşamada da ipucuyla doğru defterden çıkarmaz", !sonAsama.cozuldu && sonAsama.resolvedAt === null);
  check("saf: ipucuyla yanlış yine başa döner", tekrarSonrasi(2, false, simdi, true).stage === 0);

  await prisma.notebookItem.updateMany({ where: { userId: user.id, resolvedAt: null }, data: { dueAt: new Date(Date.now() - 2 * 3600_000) } });
  const tekrar = await tekrarBaslat(user.id, "TYT");
  const tekrarItems = await prisma.sessionItem.findMany({
    where: { sessionId: tekrar },
    orderBy: { sortOrder: "asc" },
    select: { questionId: true, sourceQuestionId: true },
  });
  check("tekrarda en az iki soru var", tekrarItems.length >= 2, `${tekrarItems.length} soru`);
  // Aşağısı iki soru (ipuçlu + ipucusuz) üzerine kurulu: eksik veriyle sürüp
  // anlaşılmaz bir TypeError'la çökmesin. Kaynak test bunu garanti ediyor.
  if (tekrarItems.length < 2) {
    const vadesiGelen = await prisma.notebookItem.count({ where: { userId: user.id, resolvedAt: null, dueAt: { lte: new Date() } } });
    throw new Error(
      `Bugünkü tekrar ${tekrarItems.length} soruyla açıldı; ipucu kuralı denetimi iki soru istiyor ` +
        `(vadesi gelen madde ${vadesiGelen}, kaynak testte benzeri olan yanlış ${benzerliYanlis}; lib/practice.ts tekrarPlani).`
    );
  }
  const [ipuclu, ipucsuz] = tekrarItems;
  await izEkle(ipuclu.questionId);
  const maddeOnce = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ipuclu.sourceQuestionId! } },
    select: { stage: true },
  });
  await ipucuAc({ sessionId: tekrar, userId: user.id, questionId: ipuclu.questionId, sira: 1 });
  await answerPractice({ sessionId: tekrar, userId: user.id, questionId: ipuclu.questionId, choiceId: await dogruSik(ipuclu.questionId), timeSpentMs: 4000 });
  const maddeSonra = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ipuclu.sourceQuestionId! } },
    select: { stage: true, dueAt: true, resolvedAt: true, lastReviewedAt: true },
  });
  check("ipucuyla doğru: madde ilerlemedi", maddeSonra.stage === maddeOnce.stage && maddeSonra.resolvedAt === null);
  check(
    "ipucuyla doğru: ertesi gün yeniden geliyor",
    maddeSonra.dueAt.getTime() === vade(maddeSonra.lastReviewedAt!, IPUCLU_DOGRU_ARA_GUN).getTime()
  );
  await answerPractice({ sessionId: tekrar, userId: user.id, questionId: ipucsuz.questionId, choiceId: await dogruSik(ipucsuz.questionId), timeSpentMs: 4000 });
  const ipucsuzMadde = await prisma.notebookItem.findUniqueOrThrow({
    where: { userId_questionId: { userId: user.id, questionId: ipucsuz.sourceQuestionId! } },
    select: { stage: true, dueAt: true, lastReviewedAt: true },
  });
  check(
    "ipucusuz doğru: bir sonraki aralığa geçti",
    ipucsuzMadde.stage === 1 && ipucsuzMadde.dueAt.getTime() === vade(ipucsuzMadde.lastReviewedAt!, TEKRAR_ARALIKLARI_GUN[1]).getTime()
  );
  const tv = await getPracticeSession(tekrar, user.id);
  const notu = tv.questions.find((q) => q.id === ipuclu.questionId)?.feedback?.defterNotu ?? "";
  check("öğrenciye açıkça söyleniyor", notu.startsWith("İpucuyla doğru") && notu.includes("yarın bir daha soracağız"), notu);
  check(
    "ipucusuz doğruda bu not yok",
    !(tv.questions.find((q) => q.id === ipucsuz.questionId)?.feedback?.defterNotu ?? "").startsWith("İpucuyla")
  );
  const cevaplanmamis = tekrarItems.find((i, k) => k >= 2);

  // ── 5. Hata bildirimi ─────────────────────────────────────
  console.log("\nHata bildirimi:");
  const gorulmemis = await prisma.question.findFirstOrThrow({
    where: { status: "PUBLISHED", items: { none: { session: { userId: user.id } } } },
    select: { id: true },
  });
  check("görülmemiş soru 'görüldü' sayılmıyor", !(await soruyuGordu(user.id, gorulmemis.id, null)));
  const gorulmediMesaji = await hataVerir(() => hataBildir({ userId: user.id, questionId: gorulmemis.id, sessionId: examId, reason: "DIGER", body: "" }));
  const yokMesaji = await hataVerir(() => hataBildir({ userId: user.id, questionId: "yok-boyle-bir-soru", sessionId: examId, reason: "DIGER", body: "" }));
  check("görülmemiş soru bildirilemiyor", gorulmediMesaji !== null && !gorulmediMesaji.startsWith("BEKLENMEYEN"));
  check("var olmayan soruyla aynı ret (yoklama yok)", gorulmediMesaji === yokMesaji, `${gorulmediMesaji} | ${yokMesaji}`);
  if (cevaplanmamis) {
    check(
      "cevaplanmamış alıştırma sorusu bildirilemiyor",
      await reddeder(() => hataBildir({ userId: user.id, questionId: cevaplanmamis.questionId, sessionId: tekrar, reason: "DIGER", body: "" }))
    );
  }
  check(
    "başkasının testindeki soru bildirilemiyor",
    await reddeder(() => hataBildir({ userId: other.id, questionId: examIds[0], sessionId: examId, reason: "DIGER", body: "" }))
  );
  check(
    `açıklama ${RAPOR_ACIKLAMA_SINIRI} karakteri aşamaz`,
    await reddeder(() => hataBildir({ userId: user.id, questionId: examIds[0], sessionId: examId, reason: "DIGER", body: "x".repeat(RAPOR_ACIKLAMA_SINIRI + 1) }))
  );

  const r1 = await hataBildir({ userId: user.id, questionId: examIds[0], sessionId: examId, reason: "YANLIS_ANAHTAR", body: "  C de doğru  " });
  const not1 = await prisma.questionNote.findUniqueOrThrow({ where: { id: r1.id } });
  check(
    "bildirim STUDENT_REPORT olarak açıldı",
    not1.kind === "STUDENT_REPORT" && not1.reportedById === user.id && not1.reason === "YANLIS_ANAHTAR" && not1.sessionId === examId && not1.body === "C de doğru" && not1.authorStaff === null
  );
  const ikinci = await hataVerir(() => hataBildir({ userId: user.id, questionId: examIds[0], sessionId: examId, reason: "DIGER", body: "" }));
  check("açık bildirim varken ikincisi açılmıyor", ikinci?.includes("inceleniyor") === true, ikinci ?? "");
  check("durum: inceleniyor", (await raporDurumlari(user.id, [examIds[0]])).get(examIds[0]) === "INCELENIYOR");
  const inceleme = await getCheckupReview(examId, user.id);
  check("sonuç incelemesinde bildirim durumu", inceleme.find((i) => i.questionId === examIds[0])?.rapor === "INCELENIYOR");
  check("bildirmediği soruda durum yok", (inceleme.find((i) => i.questionId === examIds[1])?.rapor ?? null) === null);
  await prisma.questionNote.update({ where: { id: r1.id }, data: { resolvedAt: new Date(), resolvedByStaff: "test (#0)" } });
  check("çözülünce durum: incelendi", (await raporDurumlari(user.id, [examIds[0]])).get(examIds[0]) === "INCELENDI");
  await hataBildir({ userId: user.id, questionId: examIds[0], sessionId: examId, reason: "COZUM_HATALI", body: "" });
  check("çözülen bildirimden sonra yenisi açılabiliyor", (await raporDurumlari(user.id, [examIds[0]])).get(examIds[0]) === "INCELENIYOR");
  await hataBildir({ userId: user.id, questionId: p1Soru, sessionId: p1, reason: "GORSEL_SORUNU", body: "" });
  check("cevaplanmış alıştırma sorusu bildirilebiliyor", (await getPracticeSession(p1, user.id)).questions[0].feedback?.rapor === "INCELENIYOR");

  // Günlük sınır: bugün 3 bildirim açıldı; kalan hak kadar daha, sonra ret.
  const bugunku = await prisma.questionNote.count({ where: { reportedById: user.id } });
  const kalanSorular = examIds.slice(1).slice(0, GUNLUK_RAPOR_SINIRI - bugunku);
  for (const q of kalanSorular) await hataBildir({ userId: user.id, questionId: q, sessionId: examId, reason: "YAZIM_HATASI", body: "" });
  const sinir = await hataVerir(() =>
    hataBildir({ userId: user.id, questionId: examIds[examIds.length - 1], sessionId: examId, reason: "DIGER", body: "" })
  );
  check(`günde en fazla ${GUNLUK_RAPOR_SINIRI} bildirim`, sinir?.includes(String(GUNLUK_RAPOR_SINIRI)) === true, sinir ?? "");
  check("sınırda yazılmadı", (await prisma.questionNote.count({ where: { reportedById: user.id } })) === GUNLUK_RAPOR_SINIRI);

  // ── 6. Koça soru ──────────────────────────────────────────
  console.log("\nKoça soru:");
  check("boş soru reddediliyor", await reddeder(() => kocaSoruSor({ userId: user.id, body: "   " })));
  check(
    `${KOCA_SORU_SINIRI} karakteri aşan reddediliyor`,
    await reddeder(() => kocaSoruSor({ userId: user.id, body: "x".repeat(KOCA_SORU_SINIRI + 1) }))
  );
  check(
    "görülmemiş soru hakkında sorulamıyor",
    await reddeder(() => kocaSoruSor({ userId: user.id, body: "neden?", questionId: gorulmemis.id, sessionId: examId }))
  );
  check(
    "oturum bağlamı uymuyorsa sorulamıyor",
    await reddeder(() => kocaSoruSor({ userId: user.id, body: "neden?", questionId: examIds[0], sessionId: p1 }))
  );
  const k1 = await kocaSoruSor({ userId: user.id, body: "İkinci adımı anlamadım.", questionId: examIds[0], sessionId: examId });
  const k2 = await kocaSoruSor({ userId: user.id, body: "Günde kaç soru çözmeliyim?", questionId: null, sessionId: examId });
  const k2Satir = await prisma.coachQuestion.findUniqueOrThrow({ where: { id: k2.id } });
  check("genel soruda bağlam saklanmıyor", k2Satir.questionId === null && k2Satir.sessionId === null);
  await kocaSoruSor({ userId: user.id, body: "Alıştırmadaki soru.", questionId: p1Soru, sessionId: p1 });
  const acikSinir = await hataVerir(() => kocaSoruSor({ userId: user.id, body: "dördüncü" }));
  check(`aynı anda en fazla ${ACIK_KOCA_SORU_SINIRI} cevapsız soru`, acikSinir?.includes("Cevap bekleyen") === true, acikSinir ?? "");
  check("form da kapalı diyor", (await kocaSoruHakki(user.id)).kapali !== null);

  await prisma.coachQuestion.update({ where: { id: k1.id }, data: { answerBody: "Her iki tarafı 3'e böldük.", answeredAt: new Date(), answeredByStaff: "koç (#1)" } });
  await kocaSoruSor({ userId: user.id, body: "dördüncü" });
  await prisma.coachQuestion.update({ where: { id: k2.id }, data: { answerBody: "Günde 20 yeter.", answeredAt: new Date(), answeredByStaff: "koç (#1)" } });
  await kocaSoruSor({ userId: user.id, body: "beşinci" });
  const sonAcik = await prisma.coachQuestion.findFirstOrThrow({ where: { userId: user.id, answeredAt: null }, orderBy: { createdAt: "asc" } });
  await prisma.coachQuestion.update({ where: { id: sonAcik.id }, data: { closedAt: new Date(), closedByStaff: "koç (#1)" } });
  const gunSiniri = await hataVerir(() => kocaSoruSor({ userId: user.id, body: "altıncı" }));
  check(`günde en fazla ${GUNLUK_KOCA_SORU_SINIRI} soru`, gunSiniri?.includes(String(GUNLUK_KOCA_SORU_SINIRI)) === true, gunSiniri ?? "");
  check("sınırda yazılmadı", (await prisma.coachQuestion.count({ where: { userId: user.id } })) === GUNLUK_KOCA_SORU_SINIRI);

  check("okunmamış cevap: 2", (await okunmamisCevapSayisi(user.id)) === 2);
  const liste = await kocaSorulari(user.id);
  const l1 = liste.find((s) => s.id === k1.id);
  check("listede soru gövdesi ve cevap", Boolean(l1?.soru) && l1?.answerBody === "Her iki tarafı 3'e böldük." && l1?.yeni === true);
  check("sonuç bağlantısı paket testinde var", l1?.sonucId === examId);
  check("durumlar: cevaplandı, kapatıldı, bekliyor", ["CEVAPLANDI", "KAPATILDI", "BEKLIYOR"].every((d) => liste.some((s) => s.durum === d)));
  check("sonuç incelemesinde koça soru durumu", (await getCheckupReview(examId, user.id)).find((i) => i.questionId === examIds[0])?.kocaSoru === "CEVAPLANDI");

  const yeniler = liste.filter((s) => s.yeni).map((s) => s.id);
  check("başka öğrenci okundu işaretleyemiyor", (await cevaplariOkundu(other.id, yeniler)) === 0);
  check("görülen cevaplar okundu", (await cevaplariOkundu(user.id, yeniler)) === 2 && (await okunmamisCevapSayisi(user.id)) === 0);
  check("ikinci işaret bir şey değiştirmiyor", (await cevaplariOkundu(user.id, yeniler)) === 0);

  // Soru açık bir sınavda da varsa gövde ve koçun cevabı gizli (cevap çözümü anlatıyor olabilir).
  const gizliSinav = await prisma.checkupSession.create({
    data: {
      userId: user.id,
      packageId: paketId,
      kind: "PACKAGE",
      status: "IN_PROGRESS",
      durationMinutes: 30,
      penaltyRatio: 0.25,
      expiresAt: new Date(Date.now() + 30 * 60_000),
      items: { create: [{ questionId: examIds[0], sortOrder: 0, questionVersion: 1 }] },
    },
    select: { id: true },
  });
  const gizli = (await kocaSorulari(user.id)).find((s) => s.id === k1.id);
  check("açık sınavdaki sorunun cevabı gizli", gizli?.gizli === true && gizli.answerBody === null && gizli.soru === null);
  await prisma.checkupSession.delete({ where: { id: gizliSinav.id } });

  // ── 7. Sonuç incelemesi: video ve kazanım özeti ───────────
  console.log("\nSonuç incelemesi:");
  const yanlisSoru = yanlislar[0];
  await izEkle(yanlisSoru, kazanim.id);
  const son = (await getCheckupReview(examId, user.id)).find((i) => i.questionId === yanlisSoru);
  check("video incelemede (sınav bittikten sonra)", son?.video?.id === IZ.video);
  check("kazanım özeti incelemede", son?.objective?.id === kazanim.id && JSON.stringify(son.objective.summary).includes(IZ.ozet));
  await prisma.objective.update({ where: { id: kazanim.id }, data: { summary: { bozuk: true } } });
  const bozuk = (await getCheckupReview(examId, user.id)).find((i) => i.questionId === yanlisSoru);
  check("bozuk özet sayfayı düşürmüyor, kart çıkmıyor", bozuk?.objective?.summary === null);

  await konuOdevi(other.id);

  // ── Temizlik ──────────────────────────────────────────────
  for (const g of geriYukle) {
    await prisma.question.update({
      where: { id: g.id },
      data: {
        hints: g.hints === null ? Prisma.DbNull : (g.hints as Prisma.InputJsonValue),
        solution: g.solution === null ? Prisma.DbNull : (g.solution as Prisma.InputJsonValue),
        videoUrl: g.videoUrl,
        objectiveId: g.objectiveId,
      },
    });
  }
  await temizle([user.id, other.id]);
  await prisma.objective.delete({ where: { id: kazanim.id } });
}

main()
  .catch((e) => {
    console.error(e);
    failed += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
    process.exitCode = failed === 0 ? 0 : 1;
  });
