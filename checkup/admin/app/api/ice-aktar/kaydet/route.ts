import { dosyaAl, hataYaniti, multipartAktar } from "@/lib/aktarim";

/**
 * Excel kaydı: `dosya` + `sinavId` → POST /api/admin/ice-aktar/kaydet.
 * Hatalı satır varsa backend hiçbir şey yazmaz ve 400 DOGRULAMA döner
 * (`ek` denetim raporunu taşır); yanıt istemciye olduğu gibi gider.
 */
export async function POST(istek: Request) {
  const alinan = await dosyaAl(istek);
  if (alinan instanceof Response) return alinan;
  const sinavId = Number(alinan.form.get("sinavId"));
  if (!Number.isSafeInteger(sinavId) || sinavId <= 0) return hataYaniti("DOGRULAMA", "Önce sınavı seçin.");

  const govde = new FormData();
  govde.append("dosya", alinan.dosya, alinan.dosya.name || "sorular.xlsx");
  govde.append("sinavId", String(sinavId));
  return multipartAktar("/admin/ice-aktar/kaydet", govde);
}
