import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { pruneExpiredSessions } from "@/lib/auth";
import { expireStaleSessions } from "@/lib/checkup";
import { haftalikPostalariGonder } from "@/lib/digest";

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
 *  · Pazartesi 07:00 (TR) sonrası haftalık koçluk postasını gönderir (lib/digest.ts).
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
  const [puanlanan, silinenOturum, silinenJeton, posta] = await Promise.all([
    expireStaleSessions(),
    pruneExpiredSessions(),
    prisma.passwordResetToken
      .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } })
      .then((r) => r.count),
    haftalikPostalariGonder(),
  ]);

  const sonuc = { ok: true, puanlananTest: puanlanan, silinenOturum, silinenJeton, haftalikPosta: posta, sureMs: Date.now() - basladi };
  console.log("[cron]", JSON.stringify(sonuc));
  return NextResponse.json(sonuc);
}
