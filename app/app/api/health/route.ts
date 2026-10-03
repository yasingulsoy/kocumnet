import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Hazırlık yoklaması. Veritabanına GERÇEKTEN dokunur: Postgres kapalıyken
 * 200 dönen bir sağlık ucu hiçbir şey ölçmez.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("Sağlık yoklaması: veritabanına ulaşılamadı —", (e as Error).message);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
