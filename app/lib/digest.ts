import { prisma } from "@/lib/db";
import { aktifPlan } from "@/lib/plan";
import { haftaBasi, haftaEtiketi } from "@/lib/coaching";
import { EXAMS } from "@/lib/exams";
import { appUrl, isMailConfigured, renderMail, sendMail } from "@/lib/mailer";

/**
 * Haftalık koçluk postası — pazartesi sabahı "bu hafta ne çalışacaksın".
 *
 * Koçun en basit işi: haftanın başında planı hatırlatmak. Uygulamaya girmeyen
 * öğrenci planı görmez; posta onu görür. İçerik hizmet postasıdır (öğrencinin
 * kendi planı), pazarlama değil — yine de tek tıkla kapatılabilir
 * (profil ve her postanın altındaki bağlantı; RFC 8058 List-Unsubscribe).
 *
 * Zamanlama: /api/cron her 15 dakikada çağrılır; bu işlev yalnızca pazartesi
 * 07:00 (Türkiye) sonrasında ve o hafta daha gönderilmemişse çalışır. Cron
 * bir gün kapalı kalsa bile posta kaçmaz, gecikir — haftada en fazla bir kez.
 */

const GONDERIM_SAATI = 7;
/** Bir cron turunda en fazla bu kadar posta: tur 60 saniyeyi aşmasın. */
const PARTI = 150;
/** Bu kadar gündür girmemiş öğrenciye yazmıyoruz: terk edilmiş hesaba haftalık posta spam'dir. */
const AKTIFLIK_GUNU = 60;
const TR_OFFSET_MS = 3 * 3600_000; // Türkiye yıl boyu UTC+3 (2016'dan beri yaz saati yok)

const PLAN_ISI: Record<string, string> = {
  STUDY: "Konu tekrarı",
  SOLVE: "Soru çözümü",
  REVIEW: "Yanlış analizi",
  RETEST: "Kontrol testi",
};

export function postaZamaniMi(now: Date): boolean {
  const tr = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const pazartesi = (tr.getDay() + 6) % 7 === 0;
  // Pazartesi 07:00'den önce değil; haftanın geri kalanı serbest (gecikmiş gönderim).
  return !(pazartesi && tr.getHours() < GONDERIM_SAATI);
}

export async function haftalikPostalariGonder(now = new Date()): Promise<{ aday: number; gonderilen: number }> {
  if (!isMailConfigured() || !postaZamaniMi(now)) return { aday: 0, gonderilen: 0 };

  const hafta = haftaBasi(now); // pazartesi tarihi, 00:00Z
  const haftaBaslangici = new Date(hafta.getTime() - TR_OFFSET_MS); // pazartesi 00:00 TR
  const esik = new Date(now.getTime() - AKTIFLIK_GUNU * 86_400_000);

  const adaylar = await prisma.user.findMany({
    where: {
      mailOptOut: false,
      onboardedAt: { not: null },
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: haftaBaslangici } }],
      AND: [{ OR: [{ lastLoginAt: { gte: esik } }, { createdAt: { gte: esik } }] }],
    },
    orderBy: [{ lastDigestAt: { sort: "asc", nulls: "first" } }],
    take: PARTI,
    select: { id: true, email: true, name: true, targetExam: true, weeklyTestGoal: true, mailToken: true },
  });

  let gonderilen = 0;
  for (const u of adaylar) {
    try {
      const sonuc = await sendMail(await haftalikPosta(u, now, hafta));
      if (sonuc.sent) gonderilen++;
    } catch (e) {
      console.error("[digest] gönderilemedi:", u.id, (e as Error).message);
    } finally {
      // Başarısız olsa da damgala: aynı adrese bir saat sonra yeniden denemek
      // SMTP hatasını spam'e çevirir. Bir sonraki hafta yine denenir.
      await prisma.user.update({ where: { id: u.id }, data: { lastDigestAt: now } });
    }
  }

  if (adaylar.length) console.log(`[digest] ${gonderilen}/${adaylar.length} haftalık posta gönderildi`);
  return { aday: adaylar.length, gonderilen };
}

async function haftalikPosta(
  u: { id: string; email: string; name: string; targetExam: string | null; weeklyTestGoal: number; mailToken: string },
  now: Date,
  hafta: Date
) {
  const [plan, sonTest] = await Promise.all([
    aktifPlan(u.id, now),
    prisma.checkupSession.findFirst({
      where: { userId: u.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    }),
  ]);

  const ilkAd = u.name.trim().split(/\s+/)[0] || u.name;
  const sinav = u.targetExam && u.targetExam in EXAMS ? EXAMS[u.targetExam as keyof typeof EXAMS] : null;
  const kapatUrl = `${appUrl()}/abonelik/${u.mailToken}`;
  const tekTikUrl = `${appUrl()}/api/abonelik/${u.mailToken}`;

  const geriSayim =
    sinav?.examDate && new Date(sinav.examDate) > now
      ? `${sinav.short} sınavına ${Math.ceil((new Date(sinav.examDate).getTime() - now.getTime()) / 86_400_000)} gün.`
      : null;

  const gunFarki = sonTest?.submittedAt ? Math.floor((now.getTime() - sonTest.submittedAt.getTime()) / 86_400_000) : null;

  let icerik;
  if (plan && plan.items.length) {
    const kalan = plan.items.filter((i) => !i.done);
    icerik = {
      baslik: `${haftaEtiketi(hafta)}: planın hazır, ${ilkAd}`,
      metin: [
        plan.coachNote ?? "Bu hafta en fazla iki konu, sırayla. Önce konu tekrarı, sonra soru, sonra kontrol testi.",
        kalan.length === 0 ? "Planın tamamlanmış görünüyor — yeni bir check-up ile sıradaki konuları bulalım." : `${kalan.length} iş seni bekliyor (${plan.toplamDakika} dakika):`,
      ],
      kutu: plan.items
        .map((i) => `${i.done ? "✓" : "☐"} ${PLAN_ISI[i.kind] ?? i.kind}${i.topicName ? ` · ${i.topicName}` : ""} — ${i.estimatedMinutes} dk${i.kind === "RETEST" ? " (sistem doğrular)" : ""}`)
        .join("\n"),
      eylem: { etiket: "Planı aç", url: `${appUrl()}/panel` },
      sonMetin: [geriSayim, "Kontrol testini elle işaretleyemezsin: o konuda 5 soruluk testi çözdüğünde sistem kendisi kapatır."].filter((s): s is string => Boolean(s)),
    };
  } else {
    icerik = {
      baslik: `${ilkAd}, bu hafta ne çalışacaksın?`,
      metin: [
        gunFarki === null
          ? "Henüz bir check-up çözmedin. 20 dakikalık bir testle nerede olduğunu gör; plan kendiliğinden kurulur."
          : gunFarki > 7
            ? `Son check-up'ından ${gunFarki} gün geçti. Hedefin haftada ${u.weeklyTestGoal} test — bu hafta bir tane çöz, planın yenilensin.`
            : "Bu haftanın planı henüz oluşmadı. Bir check-up çözdüğünde en zayıf iki konun için plan kurulur.",
      ],
      eylem: { etiket: "Check-up seç", url: `${appUrl()}/paketler` },
      sonMetin: [geriSayim].filter((s): s is string => Boolean(s)),
    };
  }

  const { html, text } = renderMail({
    ...icerik,
    dipnot: "Bu posta her pazartesi gelir. İstemiyorsan aşağıdaki bağlantıdan tek tıkla kapatabilirsin; parola ve hesap postaları bundan etkilenmez.",
    altBaglanti: { etiket: "Haftalık postayı kapat", url: kapatUrl },
  });

  return {
    to: u.email,
    subject: `${icerik.baslik} · Koçum.Net Check-up`,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${tekTikUrl}>, <${kapatUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
