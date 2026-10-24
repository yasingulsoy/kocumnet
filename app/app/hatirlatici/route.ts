import { appUrl } from "@/lib/site";
import { hatirlaticiTakvimi, saatCoz } from "@/lib/hatirlatici";

/**
 * Günlük hatırlatıcı (.ics): `/hatirlatici?saat=20:30`. Kurallar lib/hatirlatici.ts.
 *
 * Girişsiz, bilerek: dosyada kişisel hiçbir şey yok, herkese aynı; değişen
 * tek şey saat. Takvim uygulamaları (ve iOS'un "Takvime ekle" penceresi)
 * dosyayı çerezsiz açabiliyor. Saat biçim dışıysa 400: yanlış saatte çalan
 * bir hatırlatıcı indirmektense hiç indirmemek.
 */
export function GET(request: Request) {
  const saat = saatCoz(new URL(request.url).searchParams.get("saat"));
  if (!saat) {
    return new Response("Saat SS:DD biçiminde olmalı, ör. 20:30.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const govde = hatirlaticiTakvimi({ ...saat, bugun: new Date(), adres: appUrl() });
  return new Response(govde, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kocum-hatirlatici.ics"',
      /*
       * Önbelleğe alınmaz: ilk gün bugünün tarihi, ve proxy.ts girişli
       * öğrencinin isteğinde oturum çerezini yeniden yazıyor. "public" bir
       * yanıt aradaki bir önbellekte o çerezle başkasına gidebilirdi.
       */
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
