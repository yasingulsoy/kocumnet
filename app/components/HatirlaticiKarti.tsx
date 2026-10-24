"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, CalendarPlus, X } from "lucide-react";
import { HATIRLATICI_BASLIK, VARSAYILAN_SAAT, saatCoz } from "@/lib/hatirlatici";
import { inputClass } from "@/components/tailadmin/form/styles";
import { buttonClass } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/*
 * Ana sayfa: "Hatırlatıcı kur". Öğrenci saat seçer, her gün o saatte
 * tekrarlanan bir takvim etkinliği indirir (app/hatirlatici/route.ts,
 * kurallar lib/hatirlatici.ts). Dosyada kişisel veri yok; sunucuya giden
 * tek şey saat. Telefonda dosya açılınca takvim "ekle" penceresini gösterir.
 *
 * Kapatılınca bu cihazda bir daha görünmez (localStorage, her erişim
 * try/catch: gizli sekmede depo kapalı olabilir; o zaman yalnızca bu sayfa
 * açıkken kapalı kalır). Sunucuda ve ilk hidrasyonda çizilmez: kapatmış
 * öğrencide kart bir an görünüp kaybolmasın.
 */

const ANAHTAR = "kocum:hatirlatici-kapali";

let bellek: boolean | null = null;
const dinleyiciler = new Set<() => void>();

function kapaliMi(): boolean {
  if (bellek !== null) return bellek;
  try {
    return window.localStorage.getItem(ANAHTAR) === "1";
  } catch {
    return false;
  }
}

function kapat() {
  bellek = true;
  try {
    window.localStorage.setItem(ANAHTAR, "1");
  } catch {
    // Depo kapalı: bu oturumda kapalı kalır.
  }
  for (const d of dinleyiciler) d();
}

function abone(degisti: () => void) {
  dinleyiciler.add(degisti);
  return () => {
    dinleyiciler.delete(degisti);
  };
}

export function HatirlaticiKarti() {
  // Sunucuda "kapalı": kart yalnızca tarayıcıda, depoya bakıldıktan sonra çizilir.
  const kapali = useSyncExternalStore(abone, kapaliMi, () => true);
  const [saat, setSaat] = useState(VARSAYILAN_SAAT);
  const [indi, setIndi] = useState(false);

  if (kapali) return null;
  const gecerli = saatCoz(saat) !== null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <BellRing className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-gray-800">Hatırlatıcı kur</h2>
          <p className="mt-0.5 text-theme-sm leading-relaxed text-gray-500">
            Her gün aynı saatte &ldquo;{HATIRLATICI_BASLIK}&rdquo;. Takvimine bir etkinlik eklenir, telefonun o saatte
            hatırlatır.
          </p>
        </div>
        <button
          type="button"
          onClick={kapat}
          aria-label="Hatırlatıcı kartını kapat"
          className="-me-2 -mt-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-[1_1_8rem]">
          <span className="block text-theme-xs font-medium text-gray-700">Saat</span>
          <input
            type="time"
            value={saat}
            step={300}
            onChange={(e) => {
              setSaat(e.target.value);
              setIndi(false);
            }}
            className={inputClass() + " mt-1"}
          />
        </label>
        {/* Bağlantı, düğme değil: telefon dosyayı kendi takvim uygulamasına verir. */}
        <a
          href={gecerli ? `/hatirlatici?saat=${encodeURIComponent(saat)}` : undefined}
          download={gecerli ? "kocum-hatirlatici.ics" : undefined}
          aria-disabled={!gecerli || undefined}
          onClick={() => setIndi(true)}
          className={buttonClass({ variant: "primary" }) + " max-sm:w-full"}
        >
          <CalendarPlus aria-hidden />
          Takvime ekle
        </a>
      </div>
      <p className="mt-2 text-theme-xs text-gray-500" aria-live="polite">
        {indi
          ? "Dosya indi: açıp takvimine kaydet. Saati değiştirmek istersen yeniden indir."
          : gecerli
            ? "Takvim dosyası herkese aynı; içinde adın ya da e-postan yok."
            : "Bir saat seç."}
      </p>
    </Card>
  );
}
