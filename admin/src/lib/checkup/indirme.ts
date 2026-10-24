import "server-only";
import { CONTENT_ROLES, checkStaff } from "./staff";

/**
 * İçe aktarma ekranının indirme bağlantıları (Şablonu indir, Örnek dosya,
 * örnek şekil, Konu ve kazanım kodları) için ortak yanıtlar. Hepsi içerik
 * rollerine açık: içe aktarmayı yapan onlar. Öğrenci verisi yok.
 */

/** Yetki yoksa yanıt (route handler'ın ilk satırı); varsa null. */
export async function indirmeYetkisi(): Promise<Response | null> {
  const gate = await checkStaff(CONTENT_ROLES);
  if (gate.ok) return null;
  return new Response("Yetkisiz", {
    status: gate.reason === "unreachable" ? 503 : gate.reason === "forbidden" ? 403 : 401,
    headers: { "Cache-Control": "no-store" },
  });
}

/** İndirilen dosya: ad ASCII (tarayıcılar arası güvenli), içerik önbelleğe alınmaz (hep güncel). */
export function dosyaYaniti(govde: BodyInit, ad: string, tur: string): Response {
  return new Response(govde, {
    headers: {
      "Content-Type": tur,
      "Content-Disposition": `attachment; filename="${ad}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const MD_TURU = "text/markdown; charset=utf-8";
