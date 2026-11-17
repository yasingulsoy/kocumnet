import { dosyaAl, hataYaniti, multipartAktar } from "@/lib/aktarim";

/** Excel denetimi: `dosya` + `sinavId` → POST /api/admin/ice-aktar/denetle. Hiçbir şey yazılmaz. */
export async function POST(istek: Request) {
  const alinan = await dosyaAl(istek);
  if (alinan instanceof Response) return alinan;
  const sinavId = Number(alinan.form.get("sinavId"));
  if (!Number.isSafeInteger(sinavId) || sinavId <= 0) return hataYaniti("DOGRULAMA", "Önce sınavı seçin.");

  const govde = new FormData();
  govde.append("dosya", alinan.dosya, alinan.dosya.name || "sorular.xlsx");
  govde.append("sinavId", String(sinavId));
  return multipartAktar("/admin/ice-aktar/denetle", govde);
}
