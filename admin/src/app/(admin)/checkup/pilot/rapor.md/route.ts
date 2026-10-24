import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { loadPilot } from "@/lib/checkup/pilot";
import { pilotSuzgeci } from "@/lib/checkup/pilot-kurallari";
import { pilotRaporu } from "@/lib/checkup/pilot-rapor";

/**
 * Pilot sonu raporu (Markdown): ekrandaki toplu sayıların hepsi, tanımları ve
 * kaç kişiden hesaplandığı; ekranla aynı süzgeç (?grup=&bas=&bit=). Kişisel veri
 * yok, küçük sayılar "<5". Sayılar öğrenci verisinden türediği için yalnızca
 * yönetim rolleri (sayfa gibi sunucuda denetlenir; bağlantıyı bilmek yetmez).
 */
export async function GET(req: Request) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) {
    const durum = gate.reason === "forbidden" ? 403 : gate.reason === "unreachable" ? 503 : 401;
    return new Response(durum === 403 ? "Bu raporu yalnızca yönetici ve müdür indirebilir." : "Yetkisiz", {
      status: durum,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const url = new URL(req.url);
  const simdi = new Date();
  const veri = await loadPilot(pilotSuzgeci(Object.fromEntries(url.searchParams), simdi));
  // Yalnızca yol: proxy arkasında req.url'in sunucusu iç adres olabilir.
  const md = pilotRaporu(veri, { olusturma: simdi, adres: url.pathname });
  const s = veri.suzgec;

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pilot-raporu-' + s.bas + "-" + s.bit + '.md"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
