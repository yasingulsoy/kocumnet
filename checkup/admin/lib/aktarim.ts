import "server-only";
import { backendHam, yanitiCoz } from "./backend";
import type { IslemSonucu } from "./tipler";

/**
 * Route handler yardımcıları: tarayıcıdan gelen multipart dosyayı backend'e
 * aktarır ve sonucu `IslemSonucu` biçiminde JSON döndürür. Route handler'lar
 * proxy.ts dışında (gövde belleğe alınmasın); oturum yoksa backend
 * OTURUM_YOK döner, istemci girişe yönlendirir.
 */

export const EN_BUYUK_DOSYA = 10 * 1024 * 1024;

export function jsonYanit<T>(sonuc: IslemSonucu<T>, durum = 200): Response {
  return Response.json(sonuc, { status: durum, headers: { "cache-control": "no-store" } });
}

export function hataYaniti(kod: string, mesaj: string, durum = 400): Response {
  return jsonYanit({ ok: false, kod, mesaj }, durum);
}

/** İstekteki `dosya` alanını okur; yoksa ya da çok büyükse hata yanıtı döner. */
export async function dosyaAl(istek: Request, enBuyuk = EN_BUYUK_DOSYA): Promise<{ dosya: File; form: FormData } | Response> {
  let form: FormData;
  try {
    form = await istek.formData();
  } catch {
    return hataYaniti("DOGRULAMA", "Dosya okunamadı. Yeniden seçip deneyin.");
  }
  const dosya = form.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) return hataYaniti("DOGRULAMA", "Bir dosya seçin.");
  if (dosya.size > enBuyuk) {
    return hataYaniti("DOGRULAMA", `Dosya çok büyük (en fazla ${Math.round(enBuyuk / 1024 / 1024)} MB).`, 413);
  }
  return { dosya, form };
}

/** Multipart gövdeyi backend'e gönderir, sonucu IslemSonucu JSON'u olarak döndürür. */
export async function multipartAktar(yol: string, govde: FormData): Promise<Response> {
  const s = await yanitiCoz<unknown>(await backendHam(yol, { method: "POST", formData: govde }));
  if (s.ok) return jsonYanit({ ok: true, veri: s.veri }, s.durum);
  const h = s.hata;
  return jsonYanit({ ok: false, kod: h.kod, mesaj: h.mesaj, alanlar: h.alanlar, ek: h.ek }, h.durum || 502);
}
