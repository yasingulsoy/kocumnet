import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { cevaplarMarkdown } from "@/lib/checkup/hoca/cevap";
import { hocaCevapKayitlari } from "@/lib/checkup/hoca/kayitlar";
import { HOCA_BOLUMLERI } from "@/lib/checkup/hoca/sorular";

/**
 * "Hocaya sorular" cevap dökümü (Markdown) — geliştirici okuyup sisteme işler.
 * Yönetim rollerine (admin, müdür): "uygulandı" işaretini de onlar koyuyor.
 * Biçim lib/checkup/hoca/cevap.ts → cevaplarMarkdown.
 */
export async function GET() {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) {
    const durum = gate.reason === "forbidden" ? 403 : gate.reason === "unreachable" ? 503 : 401;
    return new Response(durum === 403 ? "Bu dosyayı yalnızca yönetici ve müdür indirebilir." : "Yetkisiz", {
      status: durum,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const simdi = new Date();
  const md = cevaplarMarkdown(HOCA_BOLUMLERI, await hocaCevapKayitlari(), { simdi });
  const tarih = simdi.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hoca-cevaplari-' + tarih + '.md"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
