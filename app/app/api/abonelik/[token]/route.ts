import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Tek tıkla abonelikten çıkma (RFC 8058). Posta istemcisi "Abonelikten çık"
 * düğmesine basınca List-Unsubscribe başlığındaki bu adrese POST atar;
 * kullanıcı hiçbir sayfa görmez. GET ile çalışmaz: bağlantı önizleyen
 * tarayıcılar yanlışlıkla kapatmasın.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/abonelik/[token]">) {
  const { token } = await ctx.params;
  if (!UUID.test(token)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await prisma.user.updateMany({ where: { mailToken: token }, data: { mailOptOut: true } });
  return NextResponse.json({ ok: r.count > 0 }, { status: r.count > 0 ? 200 : 404 });
}
