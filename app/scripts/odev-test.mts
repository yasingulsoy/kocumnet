/**
 * Grup ödevi — saf tamamlanma kuralı + öğrencinin ödev listesi sorgusu.
 *
 *   npx tsx scripts/odev-test.mts
 *
 * Neden: tamamlanma SAKLANMIYOR, her ekranda kayıtlardan türetiliyor
 * (lib/odev.ts; panel aynı dosyanın kopyasını kullanıyor). Kural sessizce
 * kayarsa koç "yapmadı", öğrenci "yaptım" der ve ikisi de ekrana bakıp
 * haklı olduğunu görür. İkinci yarı veritabanında: öğrenci yalnızca kendi
 * grubunun, iptal edilmemiş ve arşivlenmemiş ödevlerini görüyor mu, öbür
 * üyelerin kaydı sonucunu etkiliyor ya da veriye sızıyor mu.
 *
 * Kendi konusunu, paketini ve sorularını açar, sonunda siler: tohum
 * gerekmez, tohumlu veritabanında da çalışır.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import type { Prisma } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/password";
import { bugunkuIs } from "../lib/bugun";
import {
  BUGUN_ESIGI_GUN,
  GECIKME_PENCERESI_GUN,
  ODEV_SORU_ALT,
  ODEV_SORU_UST,
  EN_UZAK_SURE_GUN,
  bugunOdevi,
  enGecSonTarih,
  geciktiMi,
  kalanGun,
  kalanGunMetni,
  konuHedefi,
  odevBasligi,
  odevBolumu,
  odevIlerlemesi,
  ogrenciGorur,
  oturumBitisi,
  sonTarihAni,
  sonTarihDenetle,
  tamamlanmaOrani,
  uzatmaEnErken,
  uzatmaOnerisi,
  varsayilanSonTarih,
  type OdevCevabi,
  type OdevKurali,
  type OdevOturumu,
} from "../lib/odev";
import { bugunkuOdev, ogrenciOdevleri } from "../lib/odev-sorgu";
import { odevKonuCalismasiBaslat } from "../lib/practice";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const GUN = 86_400_000;
const SAAT = 3_600_000;

// ─────────────────────────────────────────────────────────────
// 1. Saf kural
// ─────────────────────────────────────────────────────────────

function safKural() {
  const t0 = new Date("2026-10-10T09:00:00Z");
  const bas = new Date(t0.getTime());
  const son = new Date(t0.getTime() + 7 * GUN);
  const paketOdevi: OdevKurali = { kind: "PACKAGE", packageId: "p1", topicId: null, questionCount: null, startsAt: bas, dueAt: son };
  const oturum = (o: Partial<OdevOturumu>): OdevOturumu => ({
    id: "s",
    packageId: "p1",
    status: "SUBMITTED",
    mode: "ONLINE",
    startedAt: new Date(bas.getTime() + GUN),
    submittedAt: new Date(bas.getTime() + GUN + SAAT),
    expiresAt: new Date(bas.getTime() + GUN + 2 * SAAT),
    net: 12.5,
    ...o,
  });
  const bos: OdevCevabi[] = [];

  console.log("\nPaket ödevi:");
  {
    const r = odevIlerlemesi(paketOdevi, { oturumlar: [oturum({ id: "a" })], cevaplar: bos });
    check("zamanında bitirilen oturum → tamamlandı, neti ve oturumu taşınıyor", r.durum === "TAMAMLANDI" && r.net === 12.5 && r.oturumId === "a", JSON.stringify(r));
  }
  {
    const r = odevIlerlemesi(paketOdevi, {
      oturumlar: [oturum({ startedAt: new Date(son.getTime() + SAAT), submittedAt: new Date(son.getTime() + 2 * SAAT) })],
      cevaplar: bos,
    });
    check("son tarihten sonra biten → geç tamamlandı", r.durum === "GEC_TAMAMLANDI");
  }
  {
    const r = odevIlerlemesi(paketOdevi, {
      oturumlar: [oturum({ startedAt: new Date(bas.getTime() - 3 * GUN), submittedAt: new Date(bas.getTime() - 2 * GUN) })],
      cevaplar: bos,
    });
    check("ödevden ÖNCE bitmiş oturum sayılmıyor", r.durum === "BASLAMADI");
  }
  {
    const r = odevIlerlemesi(paketOdevi, {
      oturumlar: [oturum({ startedAt: new Date(bas.getTime() - SAAT), submittedAt: new Date(bas.getTime() + SAAT) })],
      cevaplar: bos,
    });
    check("ödevden önce başlayıp sonra biten oturum sayılıyor", r.durum === "TAMAMLANDI");
  }
  {
    const r = odevIlerlemesi(paketOdevi, { oturumlar: [oturum({ mode: "PAPER", net: 8 })], cevaplar: bos });
    check("kâğıt oturumu da sayılıyor", r.durum === "TAMAMLANDI" && r.net === 8);
  }
  {
    const biten = oturum({ status: "EXPIRED", submittedAt: null, expiresAt: new Date(bas.getTime() + 2 * GUN), net: null });
    const r = odevIlerlemesi(paketOdevi, { oturumlar: [biten], cevaplar: bos });
    check("süresi dolan (EXPIRED) oturum bitiş = süre sonu, sayılıyor", r.durum === "TAMAMLANDI" && r.net === null);
    check("oturumBitisi: EXPIRED → expiresAt", oturumBitisi(biten)?.getTime() === biten.expiresAt.getTime());
    check("oturumBitisi: süren oturum → null", oturumBitisi(oturum({ status: "IN_PROGRESS", submittedAt: null })) === null);
  }
  {
    const r = odevIlerlemesi(paketOdevi, { oturumlar: [oturum({ status: "IN_PROGRESS", submittedAt: null })], cevaplar: bos });
    check("süren oturum → başladı", r.durum === "BASLADI" && r.tamamlanmaAni === null);
    const b = odevIlerlemesi(paketOdevi, { oturumlar: [oturum({ status: "ABANDONED", submittedAt: null })], cevaplar: bos });
    check("ödevden sonra açılıp bırakılan → başladı", b.durum === "BASLADI");
    const e = odevIlerlemesi(paketOdevi, {
      oturumlar: [oturum({ status: "ABANDONED", submittedAt: null, startedAt: new Date(bas.getTime() - GUN) })],
      cevaplar: bos,
    });
    check("ödevden önce bırakılmış oturum → başlamadı", e.durum === "BASLAMADI");
  }
  {
    const r = odevIlerlemesi(paketOdevi, { oturumlar: [oturum({ packageId: "baska" })], cevaplar: bos });
    check("başka paketin oturumu sayılmıyor", r.durum === "BASLAMADI");
  }
  {
    const r = odevIlerlemesi(paketOdevi, {
      oturumlar: [
        oturum({ id: "ikinci", startedAt: new Date(son.getTime() + GUN), submittedAt: new Date(son.getTime() + GUN), net: 20 }),
        oturum({ id: "ilk", net: 10 }),
      ],
      cevaplar: bos,
    });
    check("birden çok oturumda İLK biten sayılıyor (net ilk denemenin)", r.durum === "TAMAMLANDI" && r.oturumId === "ilk" && r.net === 10);
  }

  console.log("\nKonu ödevi:");
  const konuOdevi: OdevKurali = { kind: "TOPIC_PRACTICE", packageId: null, topicId: "k1", questionCount: 5, startsAt: bas, dueAt: son };
  const cevap = (saat: number, topicId = "k1"): OdevCevabi => ({ topicId, answeredAt: new Date(bas.getTime() + saat * SAAT) });
  {
    const r = odevIlerlemesi(konuOdevi, { oturumlar: [], cevaplar: [1, 2, 3, 4].map((s) => cevap(s)) });
    check("4/5 → başladı, sayaç 4", r.durum === "BASLADI" && r.cozulen === 4 && r.hedef === 5);
  }
  {
    const r = odevIlerlemesi(konuOdevi, { oturumlar: [], cevaplar: [6, 1, 3, 2, 4, 5].map((s) => cevap(s)) });
    check(
      "5/5 → tamamlandı; an eşiği dolduran (5.) cevap",
      r.durum === "TAMAMLANDI" && r.tamamlanmaAni?.getTime() === cevap(5).answeredAt.getTime() && r.cozulen === 6,
      JSON.stringify(r)
    );
  }
  {
    const r = odevIlerlemesi(konuOdevi, { oturumlar: [], cevaplar: [-5, -4, -3, 1, 2].map((s) => cevap(s)) });
    check("ödevden önceki alıştırma cevapları sayılmıyor", r.durum === "BASLADI" && r.cozulen === 2);
  }
  {
    const r = odevIlerlemesi(konuOdevi, { oturumlar: [], cevaplar: [1, 2, 3, 4, 5].map((s) => cevap(s, "k2")) });
    check("başka konunun alıştırması sayılmıyor", r.durum === "BASLAMADI" && r.cozulen === 0);
  }
  {
    const gec = [1, 2, 3, 4].map((s) => cevap(s)).concat([cevap(7 * 24 + 5)]);
    const r = odevIlerlemesi(konuOdevi, { oturumlar: [], cevaplar: gec });
    check("eşik son tarihten sonra dolarsa → geç tamamlandı", r.durum === "GEC_TAMAMLANDI");
  }
  check(
    `konu hedefi ${ODEV_SORU_ALT}-${ODEV_SORU_UST} aralığına çekiliyor`,
    konuHedefi(2) === ODEV_SORU_ALT && konuHedefi(400) === ODEV_SORU_UST && konuHedefi(null) === ODEV_SORU_ALT && konuHedefi(20) === 20
  );

  console.log("\nGörünürlük, bölüm, Bugün:");
  check("iptal edilen ödev öğrenciye görünmüyor", !ogrenciGorur({ cancelledAt: new Date() }, { archivedAt: null }));
  check("arşivlenen grubun ödevi öğrenciye görünmüyor", !ogrenciGorur({ cancelledAt: null }, { archivedAt: new Date() }));
  check("etkin grubun iptal edilmemiş ödevi görünüyor", ogrenciGorur({ cancelledAt: null }, { archivedAt: null }));

  const basladi = { durum: "BASLADI" as const };
  const bitti = { durum: "TAMAMLANDI" as const };
  const simdi = new Date(son.getTime() + 2 * GUN);
  check("bitmemiş, son tarihi 2 gün geçmiş → açık + gecikti", odevBolumu({ dueAt: son }, basladi, simdi) === "ACIK" && geciktiMi({ dueAt: son }, basladi, simdi));
  check(
    `gecikme penceresi (${GECIKME_PENCERESI_GUN} gün) kapanınca → geçmiş`,
    odevBolumu({ dueAt: son }, basladi, new Date(son.getTime() + (GECIKME_PENCERESI_GUN + 1) * GUN)) === "GECMIS"
  );
  check("tamamlanan → geçmiş, gecikmiş sayılmaz", odevBolumu({ dueAt: son }, bitti, bas) === "GECMIS" && !geciktiMi({ dueAt: son }, bitti, simdi));

  const now = new Date("2026-10-21T09:00:00Z"); // TR 12:00
  const aday = (id: string, gunSonra: number, durum: "BASLADI" | "TAMAMLANDI" = "BASLADI") => ({
    id,
    dueAt: new Date(Date.parse(varsayilanSonTarih(now, gunSonra) + "T23:59:00+03:00")),
    ilerleme: { durum },
  });
  const secilen = bugunOdevi([aday("4gun", 4), aday("2gun", 2), aday("1gun-bitti", 1, "TAMAMLANDI"), aday("gecikmis", -1), aday("3gun", 3)], now);
  check(`Bugün: ${BUGUN_ESIGI_GUN} gün içindeki bitmemişlerden en yakını (bitmiş ve gecikmiş hariç)`, secilen?.id === "2gun", secilen?.id);
  check("Bugün: 4 gün sonraki ödev karta girmiyor", bugunOdevi([aday("4gun", 4)], now) === null);
  check("Bugün: son gün (bugün 23:59) karta giriyor", bugunOdevi([aday("bugun", 0)], now)?.id === "bugun");

  check("tamamlanma oranı (geç dahil)", tamamlanmaOrani([bitti, { durum: "GEC_TAMAMLANDI" }, basladi, { durum: "BASLAMADI" }]) === 0.5);
  check("boş listede oran yok", tamamlanmaOrani([]) === null);

  console.log("\nTarih (Europe/Istanbul):");
  check("son tarih o gün 23:59 TR (= 20:59 UTC)", sonTarihAni("2026-10-28")?.toISOString() === "2026-10-28T20:59:00.000Z");
  check("geçersiz tarih reddediliyor", sonTarihAni("2026-02-30") === null && sonTarihAni("28.10.2026") === null && sonTarihAni("") === null);
  check("varsayılan: 7 gün sonra", varsayilanSonTarih(new Date("2026-10-21T09:00:00Z")) === "2026-10-28");
  check(
    "varsayılan TR gece yarısını geçince bir sonraki günden sayıyor (UTC 22:30 = TR 01:30)",
    varsayilanSonTarih(new Date("2026-10-21T22:30:00Z")) === "2026-10-29"
  );
  const gece = new Date("2026-10-21T21:30:00Z"); // TR 22 Ekim 00:30
  check("kalan gün Türkiye takvimiyle", kalanGun(sonTarihAni("2026-10-22")!, gece) === 0 && kalanGun(sonTarihAni("2026-10-25")!, gece) === 3);
  check(
    "kalan gün metni",
    kalanGunMetni(sonTarihAni("2026-10-22")!, gece) === "bugün son gün" &&
      kalanGunMetni(sonTarihAni("2026-10-23")!, gece) === "yarın son gün" &&
      kalanGunMetni(sonTarihAni("2026-10-19")!, gece) === "3 gün gecikti",
    kalanGunMetni(sonTarihAni("2026-10-19")!, gece)
  );
  {
    const n = new Date("2026-10-21T09:00:00Z"); // TR 21 Ekim 12:00
    const eski = sonTarihAni("2026-10-25")!;
    const hata = (g: string, e?: Date) => {
      const r = sonTarihDenetle(g, n, e);
      return r.ok ? null : r.hata;
    };
    check(`en uzak son tarih ${EN_UZAK_SURE_GUN} gün sonrası`, enGecSonTarih(n) === "2027-04-19", enGecSonTarih(n));
    check("ödev: bugün kabul (23:59 henüz gelmedi), dün ve 181. gün reddediliyor", hata("2026-10-21") === null && hata("2026-10-20") !== null && hata("2027-04-20") !== null && hata("2027-04-19") === null);
    check("uzatma: aynı gün ya da öncesi reddediliyor", hata("2026-10-25", eski) !== null && hata("2026-10-24", eski) !== null);
    check("uzatma: sonraki gün kabul", hata("2026-10-26", eski) === null);
    check("uzatma: sınır yine 180 gün", hata("2027-04-20", eski) !== null);
    const gecmisEski = sonTarihAni("2026-10-01")!;
    check("gecikmiş ödev bugüne uzatılabiliyor", hata("2026-10-21", gecmisEski) === null);
    check("uzatma alanının en erkeni: ertesi gün ya da bugün", uzatmaEnErken(eski, n) === "2026-10-26" && uzatmaEnErken(gecmisEski, n) === "2026-10-21");
    check(
      "uzatma önerisi: geç olanın 7 gün sonrası, sınırı aşmadan",
      uzatmaOnerisi(eski, n) === "2026-11-01" && uzatmaOnerisi(gecmisEski, n) === "2026-10-28" && uzatmaOnerisi(sonTarihAni("2027-04-15")!, n) === "2027-04-19"
    );
  }
  check(
    "otomatik başlık",
    odevBasligi({ kind: "PACKAGE", paketAdi: "TYT İlk 15" }) === "TYT İlk 15" &&
      odevBasligi({ kind: "TOPIC_PRACTICE", konuAdi: "Üçgenler", soruSayisi: 20 }) === "Üçgenler: 20 soru alıştırma"
  );

  console.log("\nBugün kartı sırası:");
  const bos2 = { acik: null, hazir: 0 };
  const tam = {
    acikTest: { id: "t" },
    odev: { id: "o" },
    seviyeli: { id: "s" },
    tekrar: { acik: { id: "r", kalan: 2, toplam: 4 }, hazir: 3 },
    planIsleri: [{ id: "i", done: false }],
    oneri: { slug: "p" },
  };
  check("açık test ödevin önünde", bugunkuIs(tam).tur === "TEST");
  check("ödev seviyeli check-up'ın, tekrarın, planın ve önerinin önünde", bugunkuIs({ ...tam, acikTest: null }).tur === "ODEV");
  check("ödev yoksa eski sıra (seviyeli)", bugunkuIs({ ...tam, acikTest: null, odev: null }).tur === "SEVIYELI");
  check(
    "ödev alanı hiç verilmezse eski davranış",
    bugunkuIs({ acikTest: null, seviyeli: null, tekrar: bos2, planIsleri: [], oneri: null }).tur === "YOK"
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Veritabanı: öğrencinin ödev listesi
// ─────────────────────────────────────────────────────────────

const ON = "odev-test";
const EPOSTA = { a: `${ON}-a@kocum.local`, b: `${ON}-b@kocum.local`, c: `${ON}-c@kocum.local`, d: `${ON}-d@kocum.local` };
const B_ADI = "Başkaüye Gizlitestoğlu";
const DAMGA = "odev-test@kocum.local (#0)";

async function temizle() {
  const kullanicilar = await prisma.user.findMany({ where: { email: { in: Object.values(EPOSTA) } }, select: { id: true } });
  const ids = kullanicilar.map((k) => k.id);
  await prisma.studyGroup.deleteMany({ where: { name: { startsWith: `${ON} ` } } });
  await prisma.checkupSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.question.deleteMany({ where: { fingerprint: { startsWith: `${ON}-` } } });
  await prisma.package.deleteMany({ where: { slug: { startsWith: `${ON}-` } } });
  await prisma.topic.deleteMany({ where: { slug: { startsWith: `${ON}-` } } });
}

async function veritabani() {
  await temizle();
  const now = new Date();
  const once = (gun: number) => new Date(now.getTime() - gun * GUN);
  const sonra = (gun: number) => new Date(now.getTime() + gun * GUN);

  const kullanici = (email: string, name: string) =>
    hashPassword("test-1234").then((passwordHash) =>
      prisma.user.create({
        data: { email, name, passwordHash, grade: "GRADE_12", targetExam: "TYT", onboardedAt: now },
        select: { id: true },
      })
    );
  const [a, b, c, d] = await Promise.all([
    kullanici(EPOSTA.a, "Ödev Testi"),
    kullanici(EPOSTA.b, B_ADI),
    kullanici(EPOSTA.c, "Grupsuz Öğrenci"),
    // Grupta ama hiç testi yok: konu ödevi kaynak test istemeden açılmalı.
    kullanici(EPOSTA.d, "Testsiz Üye"),
  ]);

  const konu = (slug: string, name: string) =>
    prisma.topic.create({ data: { slug: `${ON}-${slug}`, name, examScope: "TYT", examScopes: ["TYT"] }, select: { id: true } });
  const [k1, k2] = await Promise.all([konu("k1", "Ödev Testi Konusu"), konu("k2", "Ödev Testi İkinci Konu")]);

  const paket = (slug: string, kind: "STANDARD" | "PRACTICE", status: "PUBLISHED" | "DRAFT" = "PUBLISHED") =>
    prisma.package.create({
      data: { slug: `${ON}-${slug}`, name: `Ödev testi ${slug}`, kind, examScope: "TYT", questionCount: 3, durationMinutes: 10, status },
      select: { id: true },
    });
  const [p1, p3, pAlistirma] = await Promise.all([paket("p1", "STANDARD"), paket("p3", "STANDARD"), paket("alistirma", "PRACTICE")]);

  // 4. soru hiçbir oturumda değil: ödevden açılan konu alıştırmasına aday kalsın.
  const sorular = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      prisma.question.create({
        data: {
          topicId: k1.id,
          stem: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: `Ödev testi sorusu ${n}` }] }] },
          stemText: `Ödev testi sorusu ${n}`,
          fingerprint: `${ON}-${n}`,
          status: "PUBLISHED",
          choices: {
            create: ["A", "B"].map((label, i) => ({
              label,
              content: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: label }] }] },
              isCorrect: i === 0,
              sortOrder: i,
            })),
          },
        },
        select: { id: true, choices: { select: { id: true }, orderBy: { sortOrder: "asc" } } },
      })
    )
  );

  /** Bitmiş paket oturumu (k1 sorusuyla: konu alıştırmasının kaynağı olabilir). */
  const paketOturumu = async (userId: string, packageId: string, bitis: Date, mode: "ONLINE" | "PAPER", net: number) =>
    prisma.checkupSession.create({
      data: {
        userId,
        packageId,
        kind: "PACKAGE",
        mode,
        status: "SUBMITTED",
        durationMinutes: 10,
        penaltyRatio: 0.25,
        startedAt: new Date(bitis.getTime() - SAAT),
        expiresAt: new Date(bitis.getTime() + SAAT),
        submittedAt: bitis,
        items: { create: [{ questionId: sorular[0].id, sortOrder: 0, questionVersion: 1 }] },
        result: {
          create: {
            correctCount: 3,
            wrongCount: 1,
            blankCount: 0,
            netScore: net,
            totalTimeMs: 60_000,
            topicBreakdown: { topics: [], groups: [] },
            examScope: "TYT",
          },
        },
      },
      select: { id: true },
    });

  /** k1 alıştırması: her an bir cevap (soru başına bir madde). */
  const alistirma = async (userId: string, anlar: Date[], topicId = k1.id) =>
    prisma.checkupSession.create({
      data: {
        userId,
        packageId: pAlistirma.id,
        kind: "PRACTICE",
        practiceMode: "TOPIC",
        focusTopicId: topicId,
        status: "IN_PROGRESS",
        durationMinutes: 1440,
        penaltyRatio: 0,
        startedAt: anlar[0],
        expiresAt: new Date(anlar[0].getTime() + GUN),
        items: {
          create: anlar.map((an, i) => ({
            questionId: sorular[i].id,
            sortOrder: i,
            questionVersion: 1,
            answer: { create: { choiceId: i % 2 === 0 ? sorular[i].choices[0].id : null, isCorrect: i % 2 === 0 ? true : null, answeredAt: an } },
          })),
        },
      },
      select: { id: true },
    });

  // A: P1'i ödev süresinde bitirdi (kaynak test), P3'ü kâğıtta geç bitirdi.
  const aP1 = await paketOturumu(a.id, p1.id, once(4), "ONLINE", 2.75);
  await paketOturumu(a.id, p3.id, once(5), "PAPER", 6);
  // A'nın k1 alıştırması: 1 eski cevap (ödevden önce), 3 yeni cevap.
  await alistirma(a.id, [once(9)]);
  await alistirma(a.id, [once(1), new Date(once(1).getTime() + 60_000), new Date(once(1).getTime() + 120_000)]);
  // B: daha YENİ bir P1 oturumu ve k1 alıştırması — A'nın sonucuna karışmamalı.
  await paketOturumu(b.id, p1.id, once(0.5), "ONLINE", 30);
  await alistirma(b.id, [once(0.4), once(0.3), once(0.2)]);

  const grup = await prisma.studyGroup.create({
    data: {
      name: `${ON} etkin`,
      examScope: "TYT",
      createdByStaff: DAMGA,
      members: { create: [a, b, d].map((u) => ({ userId: u.id, addedByStaff: DAMGA })) },
    },
    select: { id: true },
  });
  const arsiv = await prisma.studyGroup.create({
    data: {
      name: `${ON} arşiv`,
      createdByStaff: DAMGA,
      archivedAt: once(1),
      members: { create: [{ userId: a.id, addedByStaff: DAMGA }] },
    },
    select: { id: true },
  });

  const odev = (groupId: string, title: string, d: Omit<Prisma.AssignmentUncheckedCreateInput, "groupId" | "title" | "createdByStaff">) =>
    prisma.assignment.create({ data: { groupId, title, createdByStaff: DAMGA, ...d }, select: { id: true } });
  const a1 = await odev(grup.id, "a1 zamanında", { kind: "PACKAGE", packageId: p1.id, startsAt: once(10), dueAt: once(3) });
  const a2 = await odev(grup.id, "a2 kâğıt geç", { kind: "PACKAGE", packageId: p3.id, startsAt: once(10), dueAt: once(6) });
  const a3 = await odev(grup.id, "a3 konu süren", { kind: "TOPIC_PRACTICE", topicId: k1.id, questionCount: 5, startsAt: once(2), dueAt: sonra(2), note: "Koçun notu" });
  const a4 = await odev(grup.id, "a4 başlanmadı", { kind: "PACKAGE", packageId: p1.id, startsAt: once(1), dueAt: sonra(6) });
  const a5 = await odev(grup.id, "a5 iptal", { kind: "PACKAGE", packageId: p1.id, startsAt: once(1), dueAt: sonra(1), cancelledAt: now, cancelledByStaff: DAMGA });
  const a6 = await odev(arsiv.id, "a6 arşiv", { kind: "PACKAGE", packageId: p1.id, startsAt: once(1), dueAt: sonra(1) });
  const a7 = await odev(grup.id, "a7 eski yapılmadı", { kind: "TOPIC_PRACTICE", topicId: k2.id, questionCount: 5, startsAt: once(30), dueAt: once(20) });
  const a8 = await odev(grup.id, "a8 konu gecikti", { kind: "TOPIC_PRACTICE", topicId: k1.id, questionCount: 5, startsAt: once(3), dueAt: once(1) });

  console.log("\nÖğrencinin ödev listesi:");
  const liste = await ogrenciOdevleri(a.id, now);
  const kimlik = (l: { id: string }[]) => l.map((o) => o.id).join(",");
  const ad = new Map([a1, a2, a3, a4, a5, a6, a7, a8].map((o, i) => [o.id, `a${i + 1}`]));
  const adlar = (l: { id: string }[]) => l.map((o) => ad.get(o.id) ?? "?").join(",");
  check("etkin grup sayısı 1 (arşivlenen grup sayılmıyor)", liste.grupSayisi === 1, String(liste.grupSayisi));
  check("açık: gecikmiş, süren, başlanmamış — son tarihi yakın önce", kimlik(liste.acik) === [a8, a3, a4].map((o) => o.id).join(","), adlar(liste.acik));
  check("geçmiş: tamamlananlar ve penceresi kapanan, en yeni önce", kimlik(liste.gecmis) === [a1, a2, a7].map((o) => o.id).join(","), adlar(liste.gecmis));
  const hepsi = [...liste.acik, ...liste.gecmis];
  check("iptal edilen ve arşivdeki grubun ödevi yok", !hepsi.some((o) => o.id === a5.id || o.id === a6.id));

  const bul = (id: string) => hepsi.find((o) => o.id === id)!;
  const r1 = bul(a1.id);
  check("a1: zamanında, neti A'nın (B'nin daha yeni oturumu karışmıyor)", r1.ilerleme.durum === "TAMAMLANDI" && r1.ilerleme.net === 2.75 && r1.ilerleme.oturumId === aP1.id);
  check("a2: kâğıt oturumu geç tamamlandı", bul(a2.id).ilerleme.durum === "GEC_TAMAMLANDI");
  const r3 = bul(a3.id);
  check("a3: 3/5 başladı (eski cevap ve B'nin cevapları sayılmıyor)", r3.ilerleme.durum === "BASLADI" && r3.ilerleme.cozulen === 3 && r3.ilerleme.hedef === 5, `${r3.ilerleme.cozulen}`);

  /*
   * Konu ödevi ödevin kendisinden açılır (lib/practice.ts odevKonuCalismasiBaslat,
   * eylemi odevKonuCalisAction): kaynak test gerekmez, sahiplik üyelikten.
   * Ret mesajı metne bağlanmadan sınanıyor: yalnızca açıldı mı, açılmadı mı.
   */
  const ac = (userId: string, odevId: string) =>
    odevKonuCalismasiBaslat(userId, odevId).then(
      (id) => prisma.checkupSession.findUnique({ where: { id }, select: { userId: true, kind: true, focusTopicId: true } }),
      (e: Error) => "HATA: " + e.message
    );
  const acilan = await ac(a.id, a3.id);
  check(
    "a3: ödevden konu alıştırması açılıyor (A'nın, k1)",
    typeof acilan === "object" && acilan?.userId === a.id && acilan.kind === "PRACTICE" && acilan.focusTopicId === k1.id,
    typeof acilan === "string" ? acilan : ""
  );
  const testsiz = await ac(d.id, a3.id);
  check(
    "a3: hiç testi olmayan üye de açabiliyor (kaynak test yok)",
    typeof testsiz === "object" && testsiz?.userId === d.id && testsiz.focusTopicId === k1.id,
    typeof testsiz === "string" ? testsiz : ""
  );
  check("a3: gruba üye olmayan öğrenci açamıyor", typeof (await ac(c.id, a3.id)) === "string");
  check("iptal edilen (a5) ve paket ödevi (a1) konu alıştırması olarak açılmıyor", typeof (await ac(a.id, a5.id)) === "string" && typeof (await ac(a.id, a1.id)) === "string");
  check("a3: koçun notu ve grup adı geliyor", r3.note === "Koçun notu" && r3.grupAdi === `${ON} etkin`);
  check("a8: süresi geçmiş, bitmemiş → gecikti", bul(a8.id).gecikti === true);
  check("a7: k2'de hiç çalışmamış → başlamadı, geçmişte", bul(a7.id).ilerleme.durum === "BASLAMADI" && liste.gecmis.some((o) => o.id === a7.id));
  check("a7: gecikme penceresi kapanan ödev açılmıyor", typeof (await ac(a.id, a7.id)) === "string");

  const json = JSON.stringify(liste);
  check("öbür üyenin adı ve e-postası veride yok", !json.includes(B_ADI) && !json.includes(EPOSTA.b) && !json.includes(b.id));
  check("cevap anahtarı izi yok", !json.includes("isCorrect") && !json.includes("errorType"));

  check("Bugün kartı: son tarihi yakın süren konu ödevi (gecikmiş değil)", (await bugunkuOdev(a.id, now))?.id === a3.id);
  check("gruba üye olmayan öğrenci hiçbir şey görmüyor", (await ogrenciOdevleri(c.id, now)).grupSayisi === 0 && (await bugunkuOdev(c.id, now)) === null);

  console.log("\nEşik dolunca:");
  await alistirma(a.id, [now, new Date(now.getTime() + 1000)]);
  const sonra2 = await ogrenciOdevleri(a.id, new Date(now.getTime() + 5000));
  const s3 = [...sonra2.acik, ...sonra2.gecmis].find((o) => o.id === a3.id)!;
  const s8 = [...sonra2.acik, ...sonra2.gecmis].find((o) => o.id === a8.id)!;
  check("a3: 5/5 → tamamlandı, geçmişe düştü", s3.ilerleme.durum === "TAMAMLANDI" && sonra2.gecmis.some((o) => o.id === a3.id));
  check("a8: eşik son tarihten sonra doldu → geç tamamlandı", s8.ilerleme.durum === "GEC_TAMAMLANDI");
  check("Bugün kartı: 6 gün sonraki ödev girmiyor", (await bugunkuOdev(a.id, new Date(now.getTime() + 5000))) === null);

  console.log("\nÜyelik:");
  await prisma.groupMember.deleteMany({ where: { groupId: grup.id, userId: a.id } });
  const cikinca = await ogrenciOdevleri(a.id, now);
  check("gruptan çıkarılan öğrenci grubun ödevlerini görmüyor", cikinca.grupSayisi === 0 && cikinca.acik.length === 0 && cikinca.gecmis.length === 0);
  await prisma.studyGroup.update({ where: { id: arsiv.id }, data: { archivedAt: null } });
  const geriAlinca = await ogrenciOdevleri(a.id, now);
  check("arşivden geri alınan grubun ödevi yeniden görünüyor", geriAlinca.acik.some((o) => o.id === a6.id));
}

async function main() {
  safKural();
  try {
    await veritabani();
  } finally {
    await temizle();
  }
  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
