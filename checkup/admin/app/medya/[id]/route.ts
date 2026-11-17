import { backendHam } from "@/lib/backend";

/**
 * Soru görseli: GET /api/medya/:id baytlarını aktarır. Backend servis
 * anahtarı ister, oturum istemez; tarayıcı backend adresini hiç görmez.
 * Görseller değişmez (yeni yükleme yeni kimlik alır): uzun önbellek.
 */
export async function GET(_istek: Request, ctx: RouteContext<"/medya/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return new Response("Bulunamadı", { status: 404 });

  const res = await backendHam(`/medya/${encodeURIComponent(id)}`, { oturum: false });
  if (!res || !res.ok || !res.body) {
    return new Response("Görsel bulunamadı", { status: res?.status === 404 ? 404 : 502 });
  }
  const h = new Headers();
  h.set("content-type", res.headers.get("content-type") ?? "application/octet-stream");
  h.set("cache-control", res.headers.get("cache-control") ?? "public, max-age=31536000, immutable");
  const uzunluk = res.headers.get("content-length");
  if (uzunluk) h.set("content-length", uzunluk);
  h.set("x-content-type-options", "nosniff");
  return new Response(res.body, { status: 200, headers: h });
}
