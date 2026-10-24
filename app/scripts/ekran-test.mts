import "./_koruma.mjs";
/**
 * Öğrenci ekranları turu: plan işinin uygulamadaki ilerlemesi, hatırlatıcı
 * takvimi, adresle gelen hata kodu, veli raporundaki ödevler, ödevde yarım test.
 *
 *   DATABASE_URL=<geçici> npx tsx scripts/ekran-test.mts
 *
 * Neden var:
 *  - Plan işi ("Üçgenler 40 soru") artık uygulamada sayılıyor ve hedefe
 *    varınca kendiliğinden kapanıyor (lib/plan-ilerleme.ts). Sayım yanlış
 *    olursa (sınav sorusu, "Bilmiyorum" ya da geçen haftanın cevabı sayılırsa)
 *    plan sessizce yalan söyler.
 *  - `?hata=` eskiden metni olduğu gibi gösteriyordu: sahte uyarı. Kod
 *    tablosu ve dönüş yolu burada denetleniyor (lib/hata-kodlari.ts).
 *  - Veli raporu girişsiz: ödev satırına not, grup adı, kimlik sızmamalı.
 *  - Yarım kalan test (lib/insights.ts yarimKaldi) paket ödevini tamamlamamalı.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { getStudentSession, saveAnswer, startCheckup, startTopicRetest, submitCheckup } from "../lib/checkup";
import { answerPractice, getPracticeSession, konuCalismasiBaslat } from "../lib/practice";
import { haftaBasi } from "../lib/coaching";
import { aktifPlan } from "../lib/plan";
import {
  SORU_ISI_UYGULAMADA,
  haftalikKonuSorusu,
  planSoruDurumu,
  soruIsiIlerlemesi,
  soruIsleriniKapat,
} from "../lib/plan-ilerleme";
import {
  HATA_MESAJLARI,
  guvenliDonusYolu,
  hataAdresi,
  hataKoduMu,
  hataMesaji,
  kontrolTestiHataKodu,
  seviyeliHataKodu,
} from "../lib/hata-kodlari";
import { HATIRLATICI_BASLIK, hatirlaticiTakvimi, saatCoz } from "../lib/hatirlatici";
import { SEVIYELI_HAZIR_DEGIL } from "../lib/level-run";
import { odevIlerlemesi, type OdevKurali, type OdevOturumu } from "../lib/odev";
import { ogrenciOdevleri } from "../lib/odev-sorgu";
import { veliRaporu } from "../lib/veli-raporu";
import { VeliOdevleri } from "../components/VeliOdevleri";
import { GET as hatirlaticiGET } from "../app/hatirlatici/route";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const ON = "ekran-test";
const EMAIL = `${ON}@kocum.local`;
const OTHER_EMAIL = `${ON}-2@kocum.local`;
const DAMGA = "ekran-test@personel";
const PAKET = "tyt-ilk-15";
const GUN = 86_400_000;
const GIZLI_NOT = "GIZLINOT-ekran-7781";
const GIZLI_GRUP = "GIZLIGRUP-ekran-4412";

async function kullanici(email: string, name: string) {
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword("test-1234"),
      grade: "GRADE_12",
      targetExam: "TYT",
      onboardedAt: new Date(),
    },
    select: { id: true },
  });
}

/**
 * Paketi çözüp bitirir: ilk `dogru` soru doğru, sonraki `yanlis` soru yanlış,
 * kalanı boş. `sebep` CheckupSession.endedBy (STUDENT, TIMEOUT, RESTART).
 */
async function testCoz(userId: string, dogru: number, yanlis: number, sebep: "STUDENT" | "TIMEOUT" | "RESTART" = "STUDENT") {
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
    if (secim) await saveAnswer({ sessionId: id, userId, questionId: q.id, choiceId: secim, timeSpentMs: 20_000 });
  }
  await submitCheckup(id, userId, undefined, sebep);
  return { id, soru: s.questions.length };
}

// ─────────────────────────────────────────────────────────────
// Saf kurallar
// ─────────────────────────────────────────────────────────────

function safKurallar() {
  console.log("\nPlan işi ilerlemesi (saf):");
  check("kural varsayılan açık (hocaya sorulacak sabit)", SORU_ISI_UYGULAMADA === true);
  const a = soruIsiIlerlemesi(12, 40);
  check("12/40: tamam değil", a?.cozulen === 12 && a.hedef === 40 && a.tamam === false);
  check("40/40 ve 41/40: tamam", soruIsiIlerlemesi(40, 40)?.tamam === true && soruIsiIlerlemesi(41, 40)?.tamam === true);
  check("hedefsiz işte ilerleme yok", soruIsiIlerlemesi(5, null) === null && soruIsiIlerlemesi(5, 0) === null);

  console.log("\nHatırlatıcı saati:");
  check("20:30 geçerli", JSON.stringify(saatCoz("20:30")) === JSON.stringify({ saat: 20, dakika: 30 }));
  check("00:00 ve 23:59 geçerli", saatCoz("00:00") !== null && saatCoz("23:59") !== null);
  const gecersizler: unknown[] = ["24:00", "7:30", "20:60", "20:3", "aa:bb", "", "20:30:00", "20:30\r\nX-EK:1", null, undefined, ["20:00"], 2030];
  const gecen = gecersizler.filter((g) => saatCoz(g) !== null);
  check(`biçim dışı saatler reddediliyor (${gecersizler.length})`, gecen.length === 0, gecen.map(String).join(" | "));

  console.log("\nHatırlatıcı takvimi (.ics):");
  const bugun = new Date("2026-10-24T09:00:00Z");
  const ics = hatirlaticiTakvimi({ saat: 20, dakika: 30, bugun, adres: "https://checkup.kocum.net" });
  const satirlar = ics.split("\r\n");
  check("VCALENDAR ile başlıyor, CRLF ile bitiyor", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  check("bütün satır sonları CRLF (yalnız LF yok)", !/[^\r]\n/.test(ics));
  const uzun = satirlar.filter((l) => new TextEncoder().encode(l).length > 75);
  check("hiçbir satır 75 sekizliği aşmıyor", uzun.length === 0, uzun[0] ?? "");
  // Katlanmış satırları aç (RFC 5545 §3.1) ve alanları oku.
  const acik = ics.replace(/\r\n /g, "").split("\r\n");
  const alan = (ad: string) => acik.find((l) => l.startsWith(ad));
  const ciftler = ["VCALENDAR", "VTIMEZONE", "STANDARD", "VEVENT", "VALARM"];
  check(
    "BEGIN/END çiftleri dengeli",
    ciftler.every((c) => acik.filter((l) => l === `BEGIN:${c}`).length === 1 && acik.filter((l) => l === `END:${c}`).length === 1)
  );
  check("VERSION 2.0 ve PRODID var", alan("VERSION:") === "VERSION:2.0" && Boolean(alan("PRODID:")));
  check("her gün tekrar (RRULE:FREQ=DAILY)", alan("RRULE:") === "RRULE:FREQ=DAILY");
  check("Türkiye saati: TZID ve VTIMEZONE", alan("DTSTART;") === "DTSTART;TZID=Europe/Istanbul:20261024T203000" && acik.includes("TZID:Europe/Istanbul") && acik.includes("TZOFFSETTO:+0300"));
  check("10 dakika", alan("DURATION:") === "DURATION:PT10M");
  check("başlık", alan("SUMMARY:") === `SUMMARY:${HATIRLATICI_BASLIK}`);
  check("açıklamada uygulamanın /panel adresi", (alan("DESCRIPTION:") ?? "").includes("https://checkup.kocum.net/panel") && alan("URL:") === "URL:https://checkup.kocum.net/panel");
  check("hatırlatma (VALARM) etkinlik anında", acik.includes("TRIGGER:PT0M") && acik.includes("ACTION:DISPLAY"));
  check("UID ve DTSTAMP var (RFC zorunlu)", Boolean(alan("UID:")) && /^DTSTAMP:\d{8}T\d{6}Z$/.test(alan("DTSTAMP:") ?? ""));
  check(
    "herkese aynı: aynı saat ve günde aynı dosya, kişisel alan yok",
    ics === hatirlaticiTakvimi({ saat: 20, dakika: 30, bugun, adres: "https://checkup.kocum.net" }) &&
      !/ATTENDEE|ORGANIZER|mailto:/i.test(ics)
  );
  // Gece yarısına yakın: tarih Türkiye gününe göre (UTC'de hâlâ dün).
  const gece = hatirlaticiTakvimi({ saat: 7, dakika: 0, bugun: new Date("2026-10-24T22:30:00Z"), adres: "https://x.test" });
  check("ilk gün Türkiye takvimiyle (UTC 22:30 = TR ertesi gün)", gece.includes("DTSTART;TZID=Europe/Istanbul:20261025T070000"));
  // Uzun ve Türkçe harfli metin harf ortasından bölünmesin.
  const genis = hatirlaticiTakvimi({ saat: 9, dakika: 5, bugun, adres: "https://çok-uzun-bir-adres-öğrenci-şğüıöç.example.test/alt/yol/bir/iki/üç" });
  const genisUzun = genis.split("\r\n").filter((l) => new TextEncoder().encode(l).length > 75);
  check("Türkçe harfli uzun satır doğru katlanıyor", genisUzun.length === 0 && !genis.includes("�"));

  console.log("\nHata kodu eşlemesi:");
  check("bilinen kod → sabit cümle", hataMesaji("tekrar-siniri") === HATA_MESAJLARI["tekrar-siniri"]);
  const sahte = ["Hesabın askıya alındı, 0850 000 00 00'ı ara", "__proto__", "toString", "constructor", "", "TEKRAR-SINIRI"];
  check("bilinmeyen kod ve sahte metin gösterilmiyor", sahte.every((k) => hataMesaji(k) === null), sahte.filter((k) => hataMesaji(k) !== null).join(" | "));
  check("dizi (?hata=a&hata=b) ve boş gösterilmiyor", hataMesaji(["tekrar-siniri", "x"]) === null && hataMesaji(undefined) === null && hataMesaji(null) === null);
  check("cümlelerde biçim karakteri yok", Object.values(HATA_MESAJLARI).every((m) => !/[<>{}]/.test(m) && m.length > 10));
  const kontrolCumleleri = [
    ["Bu sınav için konu tekrar testi tanımlı değil.", "tekrar-paketi-yok"],
    ["Konu bulunamadı.", "konu-yok"],
    ["Üçgenler, LGS konuları arasında değil. Kontrol testi yalnızca sınavındaki konularda açılır.", "konu-sinav-disi"],
    ["Üçgenler konusunu henüz ölçmedik. Önce bu konuyu içeren bir check-up çöz.", "konu-olculmedi"],
    ["Bugünlük kontrol testi hakkın doldu. Aradaki zamanı konuyu çalışmaya ayır, yarın ölçeriz.", "tekrar-siniri"],
    ["Üçgenler konusunda kontrol testi için yeterli soru yok (2/5).", "tekrar-sorusu-yetmiyor"],
    ["Beklenmedik bir şey oldu.", "tekrar-acilamadi"],
  ] as const;
  const kontrolYanlis = kontrolCumleleri.filter(([m, k]) => kontrolTestiHataKodu(m) !== k);
  check(`kontrol testi hata metni → kod (${kontrolCumleleri.length})`, kontrolYanlis.length === 0, kontrolYanlis.map(([m]) => m).join(" | "));
  const seviyeCumleleri = [
    [SEVIYELI_HAZIR_DEGIL, "seviyeli-hazir-degil"],
    ["TYT için seviyeli check-up tanımlı değil.", "seviyeli-tanimsiz"],
    ["Bu check-up için erişim hakkın yok.", "erisim-yok"],
    ["Deneme bulunamadı.", "deneme-yok"],
    ["Bu deneme kapandı.", "deneme-kapandi"],
    ["Bu deneme zaten kapandı.", "deneme-kapandi"],
    ["Bu seviye henüz açılmadı.", "seviye-kapali"],
    ["Önce yarım kalan aşamayı bitirmelisin.", "yarim-asama"],
    ["Seviye 2 bu denemede zaten çözüldü. Sonucun karnende.", "seviye-cozuldu"],
    ["Seviye 3 için havuzda soru yok. İçerik tamamlanınca açılacak.", "havuz-yetmiyor"],
    ["Seviye 2 için soru havuzu henüz yetmiyor. İçerik tamamlanınca açılacak.", "havuz-yetmiyor"],
    ["Bekleyen telafi turu yok.", "telafi-yok"],
    ["Oturum bulunamadı.", "seviyeli-acilamadi"],
  ] as const;
  const seviyeYanlis = seviyeCumleleri.filter(([m, k]) => seviyeliHataKodu(m) !== k);
  check(`seviyeli hata metni → kod (${seviyeCumleleri.length})`, seviyeYanlis.length === 0, seviyeYanlis.map(([m]) => `${m} → ${seviyeliHataKodu(m)}`).join(" | "));
  check("üretilen her kod tabloda", [...kontrolCumleleri, ...seviyeCumleleri].every(([m]) => hataKoduMu(kontrolTestiHataKodu(m)) && hataKoduMu(seviyeliHataKodu(m))));

  console.log("\nDönüş yolu:");
  const donusler: [string | null, string][] = [
    ["/panel", "/panel"],
    ["/sonuc/cm1abc_x-9", "/sonuc/cm1abc_x-9"],
    ["/gelisim?tur=TYT#x", "/gelisim"],
    ["/panel?hata=Sahte%20uyar%C4%B1", "/panel"],
    ["https://checkup.kocum.net/sonuc/abc", "/sonuc/abc"],
    ["//kotu.example/sonuc/abc", "/panel"],
    ["/\\kotu.example", "/panel"],
    ["https://kotu.example", "/panel"],
    ["javascript:alert(1)", "/panel"],
    ["/sonuc/../admin", "/panel"],
    ["/profil", "/panel"],
    ["", "/panel"],
    [null, "/panel"],
  ];
  const donusYanlis = donusler.filter(([g, b]) => guvenliDonusYolu(g) !== b);
  check(`yalnızca bilinen göreli yollar (${donusler.length})`, donusYanlis.length === 0, donusYanlis.map(([g]) => `${g} → ${guvenliDonusYolu(g)}`).join(" | "));
  check("hata adresi yalnızca kod taşıyor", hataAdresi("/sonuc/abc", "tekrar-siniri") === "/sonuc/abc?hata=tekrar-siniri");

  // Kaynak denetimi: adresteki metni olduğu gibi gösteren ya da adrese metin yazan kalıp geri gelmesin.
  const kaynak = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const sayfalar = ["app/(panel)/panel/page.tsx", "app/(panel)/seviyeli/page.tsx", "app/(panel)/seviye/[runId]/page.tsx"];
  check(
    "sayfalar ?hata= metnini olduğu gibi göstermiyor",
    sayfalar.every((p) => !/sp\.hata\s*===\s*"string"\s*\?\s*sp\.hata/.test(kaynak(p)) && kaynak(p).includes("hataMesaji(sp.hata)"))
  );
  check(
    "eylemler adrese hata metni yazmıyor",
    ["lib/actions/plan.ts", "lib/actions/levels.ts"].every((p) => !/hata=["'`]?\s*\+\s*encodeURIComponent/.test(kaynak(p)) && !kaynak(p).includes("encodeURIComponent(e.message)"))
  );

  console.log("\nÖdevde yarım test (saf):");
  const kural: OdevKurali = {
    kind: "PACKAGE",
    packageId: "p",
    topicId: null,
    questionCount: null,
    startsAt: new Date("2026-10-20T08:00:00Z"),
    dueAt: new Date("2026-10-27T20:59:00Z"),
  };
  const oturum = (o: Partial<OdevOturumu>): OdevOturumu => ({
    id: "s",
    packageId: "p",
    status: "SUBMITTED",
    startedAt: new Date("2026-10-21T08:00:00Z"),
    submittedAt: new Date("2026-10-21T08:30:00Z"),
    expiresAt: new Date("2026-10-21T08:40:00Z"),
    net: 1,
    isaretli: true,
    ...o,
  });
  const yarim = odevIlerlemesi(kural, { oturumlar: [oturum({ yarim: true })], cevaplar: [] });
  check("yarım test ödevi tamamlamıyor, 'başladı' ve yarimKaldi", yarim.durum === "BASLADI" && yarim.yarimKaldi && !yarim.bosGonderildi);
  const sonra = odevIlerlemesi(kural, {
    oturumlar: [oturum({ id: "y", yarim: true }), oturum({ id: "t", yarim: false, submittedAt: new Date("2026-10-22T08:30:00Z"), net: 7 })],
    cevaplar: [],
  });
  check("ardından bitirilen test tamamlıyor (onun neti)", sonra.durum === "TAMAMLANDI" && sonra.oturumId === "t" && sonra.net === 7 && !sonra.yarimKaldi);
  const eski = odevIlerlemesi(kural, { oturumlar: [oturum({ yarim: undefined })], cevaplar: [] });
  check("yarim bilgisi verilmeyen (eski çağıran) tamamlıyor", eski.durum === "TAMAMLANDI");
  const bosVeYarim = odevIlerlemesi(kural, { oturumlar: [oturum({ isaretli: false, yarim: true })], cevaplar: [] });
  check("hiç işaretsiz oturum 'boş gönderildi' sayılıyor (yarım değil)", bosVeYarim.bosGonderildi && !bosVeYarim.yarimKaldi);
}

// ─────────────────────────────────────────────────────────────
// Veritabanıyla
// ─────────────────────────────────────────────────────────────

async function main() {
  safKurallar();

  const a = await kullanici(EMAIL, "Ekran Testoğlu");
  const b = await kullanici(OTHER_EMAIL, "Başka Öğrenci");
  await prisma.studyGroup.deleteMany({ where: { createdByStaff: DAMGA } });
  const now = new Date();
  const paket = await prisma.package.findUniqueOrThrow({ where: { slug: PAKET }, select: { id: true } });

  // Ödevler: A'nın grubunda dört, A'nın üyesi olmadığı grupta bir.
  const grup = await prisma.studyGroup.create({
    data: {
      name: GIZLI_GRUP,
      examScope: "TYT",
      createdByStaff: DAMGA,
      members: { create: [{ userId: a.id, addedByStaff: DAMGA }] },
    },
    select: { id: true },
  });
  const baskaGrup = await prisma.studyGroup.create({
    data: { name: `${ON} başka`, createdByStaff: DAMGA, members: { create: [{ userId: b.id, addedByStaff: DAMGA }] } },
    select: { id: true },
  });
  const ilkKonu = await prisma.packageTopic.findFirstOrThrow({ where: { packageId: paket.id }, select: { topicId: true } });
  const odev = (groupId: string, title: string, d: Record<string, unknown>) =>
    prisma.assignment.create({
      data: { groupId, title, createdByStaff: DAMGA, kind: "PACKAGE", packageId: paket.id, ...d } as never,
      select: { id: true },
    });
  const o1 = await odev(grup.id, "Ekran ödevi 1: paket", { startsAt: new Date(now.getTime() - 60_000), dueAt: new Date(now.getTime() + 3 * GUN), note: GIZLI_NOT });
  const o2 = await odev(grup.id, "Ekran ödevi 2: konu", {
    kind: "TOPIC_PRACTICE",
    packageId: null,
    topicId: ilkKonu.topicId,
    questionCount: 5,
    startsAt: new Date(now.getTime() - 60_000),
    dueAt: new Date(now.getTime() + 5 * GUN),
  });
  // Eski ödev başka bir paketin: bu testte çözülen paket onu da (geç) tamamlardı.
  const baskaPaket = await prisma.package.findFirstOrThrow({
    where: { kind: "STANDARD", status: "PUBLISHED", examScope: "TYT", slug: { not: PAKET } },
    select: { id: true },
  });
  const o3 = await odev(grup.id, "Ekran ödevi 3: eski", {
    packageId: baskaPaket.id,
    startsAt: new Date(now.getTime() - 30 * GUN),
    dueAt: new Date(now.getTime() - 20 * GUN),
  });
  const o4 = await odev(grup.id, "Ekran ödevi 4: iptal", { dueAt: new Date(now.getTime() + 2 * GUN), cancelledAt: now, cancelledByStaff: DAMGA });
  const o5 = await odev(baskaGrup.id, "Ekran ödevi 5: başka grup", { dueAt: new Date(now.getTime() + 2 * GUN) });

  // ── Yarım test ödevi tamamlamıyor ───────────────────────────
  console.log("\nÖdevde yarım test (veritabanı):");
  const yarimTest = await testCoz(a.id, 1, 1, "TIMEOUT");
  const yarimOturum = await prisma.checkupSession.findUniqueOrThrow({
    where: { id: yarimTest.id },
    select: { endedBy: true, result: { select: { blankCount: true } } },
  });
  check("test süre dolarak, yarısından azı işaretli kapandı", yarimOturum.endedBy === "TIMEOUT" && (yarimOturum.result?.blankCount ?? 0) > yarimTest.soru / 2);
  let liste = await ogrenciOdevleri(a.id, new Date());
  let l1 = liste.acik.find((o) => o.id === o1.id);
  check("yarım test paket ödevini tamamlamadı", l1?.ilerleme.durum === "BASLADI" && l1.ilerleme.yarimKaldi === true, l1?.ilerleme.durum);
  const yarimdanSonraPlan = await prisma.studyPlan.findUnique({ where: { userId_weekStart: { userId: a.id, weekStart: haftaBasi(now) } } });
  check("yarım test plan kurmadı", yarimdanSonraPlan === null);

  // Tamamı yanlış ama bitirilmiş test: ölçüm (plan kurar) ve ödevi tamamlar.
  const tamTest = await testCoz(a.id, 0, 15);
  liste = await ogrenciOdevleri(a.id, new Date());
  l1 = liste.gecmis.find((o) => o.id === o1.id);
  check("bitirilen test ödevi tamamladı (onun oturumu)", l1?.ilerleme.durum === "TAMAMLANDI" && l1.ilerleme.oturumId === tamTest.id);

  // ── Plan işi: sayım ve kendiliğinden kapanma ────────────────
  console.log("\nPlan işi (veritabanı):");
  const plan = await prisma.studyPlan.findUniqueOrThrow({
    where: { userId_weekStart: { userId: a.id, weekStart: haftaBasi(now) } },
    select: { sourceSessionId: true, items: { where: { kind: "SOLVE" }, orderBy: { sortOrder: "asc" }, select: { id: true, topicId: true, targetQuestionCount: true } } },
  });
  check("plan bitirilen testten kuruldu, soru işi var", plan.sourceSessionId === tamTest.id && plan.items.length > 0, String(plan.items.length));
  check("soru işinin hedefi 40", plan.items.every((i) => i.targetQuestionCount === 40));

  // Havuzu yeten ilk konuda 5 soruluk alıştırma ("5 soru çöz" düğmesinin eylemi).
  let isi: (typeof plan.items)[number] | null = null;
  let alistirmaId = "";
  const nedenler: string[] = [];
  for (const i of plan.items) {
    try {
      alistirmaId = await konuCalismasiBaslat(a.id, i.topicId!, plan.sourceSessionId!);
      isi = i;
      break;
    } catch (e) {
      if (!(e instanceof Error) || e.name !== "CheckupError") throw e;
      nedenler.push(e.message);
    }
  }
  if (!isi) throw new Error("Plan konularının hiçbirinde alıştırma açılamadı: " + nedenler.join(" | "));
  const konu = isi.topicId!;
  // Hedefi küçült: 40 soru beklemeden kapanmayı sınamak için.
  await prisma.planItem.update({ where: { id: isi.id }, data: { targetQuestionCount: 3 } });
  const baskaIs = plan.items.find((i) => i.id !== isi!.id) ?? null;

  let durum = await planSoruDurumu(a.id, new Date());
  check("başlangıçta 0/3: sınavdaki sorular sayılmıyor", durum?.isler.get(isi.id)?.cozulen === 0 && durum.isler.get(isi.id)?.hedef === 3);
  check("kaynak test planın testi", durum?.kaynakOturumId === tamTest.id);

  /** Sıradaki cevaplanmamış alıştırma sorusu; bittiyse yenisi açılır. */
  async function siradaki() {
    let s = await getPracticeSession(alistirmaId, a.id);
    let q = s.questions.find((x) => !x.feedback);
    if (!q) {
      alistirmaId = await konuCalismasiBaslat(a.id, konu, plan.sourceSessionId!);
      s = await getPracticeSession(alistirmaId, a.id);
      q = s.questions.find((x) => !x.feedback);
    }
    if (!q) throw new Error("Alıştırmada soru kalmadı.");
    return q;
  }
  const cevapla = async (bilmiyorum: boolean) => {
    const q = await siradaki();
    await answerPractice({ sessionId: alistirmaId, userId: a.id, questionId: q.id, choiceId: bilmiyorum ? null : q.choices[0].id, timeSpentMs: 4_000 });
  };
  const isDurumu = () => prisma.planItem.findUniqueOrThrow({ where: { id: isi!.id }, select: { doneAt: true } });

  await cevapla(true);
  check("'Bilmiyorum' sayılmıyor", (await haftalikKonuSorusu(a.id, konu, new Date())) === 0);
  await cevapla(false);
  await cevapla(false);
  durum = await planSoruDurumu(a.id, new Date());
  check("iki cevap: 2/3, iş açık", durum?.isler.get(isi.id)?.cozulen === 2 && (await isDurumu()).doneAt === null);
  await cevapla(false);
  durum = await planSoruDurumu(a.id, new Date());
  const kapandi = await isDurumu();
  check("üçüncü cevapta iş kendiliğinden kapandı (doneAt sistemden)", kapandi.doneAt !== null && durum?.isler.get(isi.id)?.tamam === true);
  const gorunum = await aktifPlan(a.id, new Date());
  check("plan kartı işi bitmiş gösteriyor", gorunum?.items.find((i) => i.id === isi!.id)?.done === true);
  if (baskaIs) {
    check("öbür konunun soru işi açık kaldı", (await prisma.planItem.findUniqueOrThrow({ where: { id: baskaIs.id } })).doneAt === null);
    check("öbür konunun sayısı ayrı", (await haftalikKonuSorusu(a.id, baskaIs.topicId!, new Date())) === 0);
  }
  check("ikinci kapatma bir şey değiştirmiyor", (await soruIsleriniKapat(a.id, konu, new Date())) === 0);
  await prisma.planItem.update({ where: { id: isi.id }, data: { doneAt: null } });
  check("işaret kaldırılınca sıradaki denetim yeniden kapatıyor", (await soruIsleriniKapat(a.id, konu, new Date())) === 1);
  const gelecekHafta = new Date(haftaBasi(now).getTime() + 8 * GUN);
  check("sayım Türkiye haftasıyla: gelecek hafta 0", (await haftalikKonuSorusu(a.id, konu, gelecekHafta)) === 0);
  check("başka öğrencinin sayısı 0", (await haftalikKonuSorusu(b.id, konu, new Date())) === 0);

  // ── Kontrol testi hatası koda dönüşüyor ─────────────────────
  console.log("\nKontrol testi hatası:");
  let olculmedi = "";
  try {
    await startTopicRetest(b.id, konu, "TYT");
  } catch (e) {
    olculmedi = e instanceof Error ? e.message : String(e);
  }
  check("ölçülmemiş konu → konu-olculmedi", kontrolTestiHataKodu(olculmedi) === "konu-olculmedi", olculmedi);

  // ── Hatırlatıcı uç noktası ──────────────────────────────────
  console.log("\nHatırlatıcı uç noktası:");
  const yanit = hatirlaticiGET(new Request("http://localhost/hatirlatici?saat=21:15"));
  const govde = await yanit.text();
  check("200 ve text/calendar; charset=utf-8", yanit.status === 200 && yanit.headers.get("content-type") === "text/calendar; charset=utf-8");
  check("indirme olarak .ics", /^attachment; filename="[a-z-]+\.ics"$/.test(yanit.headers.get("content-disposition") ?? ""));
  check("önbelleğe alınmıyor (çerezli yanıt paylaşılmasın)", (yanit.headers.get("cache-control") ?? "").includes("no-store"));
  check("gövde geçerli takvim, seçilen saat", govde.startsWith("BEGIN:VCALENDAR") && /DTSTART;TZID=Europe\/Istanbul:\d{8}T211500/.test(govde));
  const kotu = hatirlaticiGET(new Request("http://localhost/hatirlatici?saat=25:00"));
  const eksik = hatirlaticiGET(new Request("http://localhost/hatirlatici"));
  const enjeksiyon = hatirlaticiGET(new Request("http://localhost/hatirlatici?saat=" + encodeURIComponent("20:00\r\nATTENDEE:x")));
  check("geçersiz, eksik ve satır eklemeye çalışan saat 400", kotu.status === 400 && eksik.status === 400 && enjeksiyon.status === 400);
  check("hata yanıtı takvim değil", !(await kotu.text()).includes("VCALENDAR"));

  // ── Veli raporunda ödevler ──────────────────────────────────
  console.log("\nVeli raporunda ödevler:");
  const rapor = await veliRaporu(a.id);
  const json = JSON.stringify(rapor);
  const adlar = rapor.odevler.map((o) => o.ad);
  check(
    "açık ödev ve son 7 günde tamamlanan var; eski, iptal ve başka grubun yok",
    adlar.length === 2 && adlar.includes("Ekran ödevi 1: paket") && adlar.includes("Ekran ödevi 2: konu"),
    adlar.join(", ")
  );
  check("tamamlandı bilgisi doğru", rapor.odevler.find((o) => o.ad.endsWith("paket"))?.tamamlandi === true && rapor.odevler.find((o) => o.ad.endsWith("konu"))?.tamamlandi === false);
  check("son tarihe göre sıralı", rapor.odevler.every((o, i, l) => i === 0 || l[i - 1].sonTarih.getTime() <= o.sonTarih.getTime()));
  check("ödev satırında yalnızca ad, son tarih, tamamlandı", rapor.odevler.every((o) => Object.keys(o).sort().join(",") === "ad,sonTarih,tamamlandi"));
  check("yarım test ölçüme girmedi (tek ölçüm)", rapor.olcumSayisi === 1, String(rapor.olcumSayisi));
  const html = renderToStaticMarkup(createElement(VeliOdevleri, { odevler: rapor.odevler, now: new Date() }));
  const kimlikler = [o1.id, o2.id, o3.id, o4.id, o5.id, grup.id, baskaGrup.id, a.id, b.id, tamTest.id, yarimTest.id, ilkKonu.topicId];
  for (const [ad, metin] of [
    ["veri", json],
    ["HTML", html],
  ] as const) {
    check(`${ad}: koçun notu ve grup adı yok`, !metin.includes(GIZLI_NOT) && !metin.includes(GIZLI_GRUP));
    check(`${ad}: kimlik yok (ödev, grup, öğrenci, oturum, konu)`, kimlikler.every((k) => !metin.includes(k)), kimlikler.find((k) => metin.includes(k)) ?? "");
    check(`${ad}: e-posta ve soyadı yok`, !metin.includes("@") && !metin.includes("Testoğlu"));
  }
  check("HTML'de ödev adları ve durum var", html.includes("Ekran ödevi 1: paket") && html.includes("Tamamlandı") && html.includes("Devam ediyor"));
  check("ödevi olmayan öğrencide bölüm çizilmiyor", renderToStaticMarkup(createElement(VeliOdevleri, { odevler: [], now: new Date() })) === "");

  // ── Temizlik ────────────────────────────────────────────────
  await prisma.studyGroup.deleteMany({ where: { createdByStaff: DAMGA } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });

  console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
