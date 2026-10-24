import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { pruneExpiredSessions } from "@/lib/auth";
import { expireStaleSessions, yenidenPuanla } from "@/lib/checkup";
import { sahipsizKosulariSil, seviyeliKapilariOnar } from "@/lib/level-run";
import { haftalikPostalariGonder } from "@/lib/digest";
import { eskiVeliBaglantilariniSil } from "@/lib/veli-raporu";
import { asamaCalistir, kilitle } from "./bakim";

/**
 * Zamanlanmış bakım. Dışarıdan bir zamanlayıcı (Dokploy "Schedule", cron,
 * GitHub Actions) 15 dakikada bir çağırır:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://checkup.kocum.net/api/cron
 *
 * Yaptıkları:
 *  · Süresi dolan ama bitirilmeyen testleri PUANLAR (expireStaleSessions).
 *    Eskiden bu işlev hiç çağrılmıyordu: sekmeyi kapatan öğrencinin 20
 *    cevabı veritabanında duruyor ama sonuç hiç hesaplanmıyordu — ta ki aynı
 *    paketi yeniden başlatana kadar.
 *  · Süresi geçmiş giriş oturumlarını ve parola sıfırlama jetonlarını siler.
 *  · Süresi dolalı ya da kaldırılalı 30 gün geçen veli bağlantılarını siler.
 *  · Pazartesi 07:00 (TR) sonrası haftalık koçluk postasını gönderir (lib/digest.ts).
 *  · Aşamasız kalmış eski seviyeli koşuları siler ve kapısı değerlendirilmeden
 *    kalmış koşuları onarır (lib/level-run.ts).
 *  · Cevap anahtarı düzeltilen soruların bitmiş sonuçlarını yeniden puanlar
 *    (lib/checkup.ts yenidenPuanla).
 *
 * İskelet (kilit, birbirinden bağımsız işler, iş başına günlük) ./bakim.ts'te.
 * Bir iş düşerse öbürleri yine çalışır; yanıt 500 döner ki zamanlayıcının
 * `curl -f`'i bunu görsün, gövdede hangi işin neden düştüğü yazar.
 *
 * CRON_SECRET yoksa uç kapalıdır (503) — açık bırakılmış bir bakım ucu,
 * herkesin tetikleyebildiği bir yük demek.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function yetkili(req: NextRequest): boolean {
  const beklenen = (process.env.CRON_SECRET ?? "").trim();
  if (!beklenen) return false;
  const verilen = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!verilen || verilen.length !== beklenen.length) return false;
  return timingSafeEqual(Buffer.from(verilen), Buffer.from(beklenen));
}

export async function GET(req: NextRequest) {
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET tanımlı değil; bakım ucu kapalı." }, { status: 503 });
  }
  if (!yetkili(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const basladi = Date.now();
  const kilit = await kilitle(async () => {
    const birinci = await asamaCalistir([
      { ad: "suresiDolanTestler", calistir: () => expireStaleSessions() },
      { ad: "girisOturumlari", calistir: () => pruneExpiredSessions() },
      {
        ad: "sifirlamaJetonlari",
        calistir: () =>
          prisma.passwordResetToken
            .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } })
            .then((r) => r.count),
      },
      { ad: "haftalikPosta", calistir: () => haftalikPostalariGonder() },
      { ad: "veliBaglantilari", calistir: () => eskiVeliBaglantilariniSil() },
      { ad: "sahipsizKosular", calistir: () => sahipsizKosulariSil() },
    ]);
    /*
     * İkinci aşama BİRİNCİDEN SONRA: ikisi de puanlanmış testlere bakıyor.
     * Süresi dolan aşama birinci aşamada puanlanıp kapısı orada
     * değerlendirilir; onarım ancak ondan sonra "kapısız kalan"ı doğru görür.
     * Yeniden puanlama da az önce kapanan testi yarıda yakalamasın.
     */
    const ikinci = await asamaCalistir([
      { ad: "seviyeliKapilar", calistir: () => seviyeliKapilariOnar() },
      { ad: "yenidenPuanlama", calistir: () => yenidenPuanla() },
    ]);
    return [...birinci, ...ikinci];
  });

  if (!kilit.alindi) {
    console.log("[cron] zaten çalışıyor; bu çağrı atlandı");
    return NextResponse.json({ ok: true, durum: "zaten çalışıyor" });
  }

  const isler = kilit.deger;
  const ok = isler.every((i) => i.ok);
  const sonuc = { ok, isler, sureMs: Date.now() - basladi };
  console.log(`[cron] bitti: ${isler.filter((i) => i.ok).length}/${isler.length} iş tamam (${sonuc.sureMs} ms)`);
  return NextResponse.json(sonuc, { status: ok ? 200 : 500 });
}
