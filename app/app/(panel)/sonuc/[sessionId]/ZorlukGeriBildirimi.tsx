"use client";

import { useState, useTransition } from "react";
import { zorlukAction } from "@/lib/actions/checkup";
import { cx } from "@/components/tailadmin/cx";

/** lib/checkup.ts ZORLUK_SECENEKLERI ile aynı değerler (istemciye sunucu modülü taşınmasın). */
const SECENEKLER = [
  { deger: 1, etiket: "Kolay" },
  { deger: 2, etiket: "Uygun" },
  { deger: 3, etiket: "Zor" },
] as const;

/**
 * "Bu test sana nasıl geldi?" — isteğe bağlı tek dokunuş, değiştirilebilir.
 *
 * Öğrencinin hissi, madde analizindeki gerçek doğru oranıyla yan yana
 * okunacak (pilot ölçümü). Dokunuş hemen işaretlenir; sunucu reddederse
 * (oturum düştü, test sorulmayan türden) eski seçime döner ve tek satırla
 * söylenir. Düğmeler aria-pressed: ekran okuyucu seçili olanı duyar.
 */
export function ZorlukGeriBildirimi({ sessionId, ilkDeger }: { sessionId: string; ilkDeger: number | null }) {
  const [secili, setSecili] = useState<number | null>(ilkDeger);
  const [hata, setHata] = useState(false);
  const [bekliyor, basla] = useTransition();

  function sec(deger: number) {
    if (bekliyor || deger === secili) return;
    const onceki = secili;
    setSecili(deger);
    setHata(false);
    basla(async () => {
      const r = await zorlukAction(sessionId, deger).catch(() => ({ ok: false }));
      if (!r.ok) {
        setSecili(onceki);
        setHata(true);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:px-5 print:hidden">
      <p id="zorluk-soru" className="min-w-0 flex-1 text-theme-sm font-medium text-gray-700">
        Bu test sana nasıl geldi?
        {secili !== null && !hata ? (
          <span className="ms-2 font-normal text-gray-500">Teşekkürler, istersen değiştirebilirsin.</span>
        ) : null}
        {hata ? (
          <span role="alert" className="ms-2 font-normal text-error-600">
            Kaydedilemedi, tekrar dener misin?
          </span>
        ) : null}
      </p>
      <div role="group" aria-labelledby="zorluk-soru" className="flex gap-2 max-sm:w-full">
        {SECENEKLER.map((s) => {
          const aktif = secili === s.deger;
          return (
            <button
              key={s.deger}
              type="button"
              aria-pressed={aktif}
              onClick={() => sec(s.deger)}
              className={cx(
                "min-h-9 rounded-lg px-3.5 text-theme-sm font-medium ring-1 transition ring-inset max-sm:flex-1",
                aktif
                  ? "bg-brand-500 text-white ring-brand-500"
                  : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
              )}
            >
              {s.etiket}
            </button>
          );
        })}
      </div>
    </div>
  );
}
