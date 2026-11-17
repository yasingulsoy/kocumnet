/**
 * Girişten sonra dönülecek adres (?donus=). Yalnızca bu sitenin içindeki
 * bir yol kabul edilir: "/" ile başlar, "//" ya da "/\" ile başlamaz (başka
 * siteye yönlendirme açığı olmasın). Uymazsa varsayılan.
 */
export function guvenliDonus(deger: unknown, varsayilan = "/panel"): string {
  if (typeof deger !== "string") return varsayilan;
  const yol = deger.trim();
  if (!yol.startsWith("/") || yol.startsWith("//") || yol.startsWith("/\\")) return varsayilan;
  if (yol.length > 300 || /[\u0000-\u001f]/.test(yol)) return varsayilan;
  return yol;
}
