import type { NextRequest } from "next/server";
import { istemciIp } from "@/lib/istemci-ip";

/**
 * Soru görselleri: backend'in /api/medya/:id ucunu aktarır (API.md "Görseller").
 * Backend'in iç adresi tarayıcıya inmez; servis anahtarı burada eklenir.
 * Oturum istemez. Content-Type ve uzun önbellek başlığı olduğu gibi geçer
 * (görsel içeriği kimliğine bağlı, değişmez).
 */

const KIMLIK = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(_istek: NextRequest, ctx: RouteContext<"/medya/[id]">) {
  const { id } = await ctx.params;
  if (!KIMLIK.test(id)) return new Response("Bulunamadı", { status: 404 });

  const taban = (process.env.BACKEND_URL ?? "").trim().replace(/\/+$/, "");
  if (!taban) return new Response("Görsel şu an yüklenemiyor", { status: 503 });

  const basliklar = new Headers({ "x-servis-anahtari": process.env.SERVIS_ANAHTARI ?? "" });
  const ip = await istemciIp();
  if (ip) basliklar.set("x-istemci-ip", ip);

  let yanit: Response;
  try {
    yanit = await fetch(`${taban}/api/medya/${encodeURIComponent(id)}`, {
      headers: basliklar,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return new Response("Görsel şu an yüklenemiyor", { status: 502 });
  }

  if (!yanit.ok || !yanit.body) {
    return new Response(yanit.status === 404 ? "Bulunamadı" : "Görsel şu an yüklenemiyor", {
      status: yanit.status === 404 ? 404 : 502,
    });
  }

  const cikis = new Headers();
  cikis.set("content-type", yanit.headers.get("content-type") ?? "application/octet-stream");
  cikis.set("cache-control", yanit.headers.get("cache-control") ?? "public, max-age=31536000, immutable");
  const uzunluk = yanit.headers.get("content-length");
  if (uzunluk) cikis.set("content-length", uzunluk);
  cikis.set("x-content-type-options", "nosniff");

  return new Response(yanit.body, { status: 200, headers: cikis });
}
