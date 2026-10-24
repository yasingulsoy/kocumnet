"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/*
 * Ana sayfa: "Ana ekrana ekle". Öğrencilerin çoğu telefondan giriyor; simge
 * ana ekranda olunca uygulama tarayıcı sekmeleri arasında kaybolmuyor
 * (app/manifest.ts: tam ekran açılır, /panel'den başlar).
 *
 *  - Android/Chrome: tarayıcının `beforeinstallprompt` olayı yakalanır ve
 *    kendi düğmemizle gösterilir. Olay hiç gelmezse (başka tarayıcı) menü
 *    yönergesi.
 *  - iOS (Safari): kurma penceresi yok; iki adımlık yönerge.
 *  - Zaten ana ekrandan açıldıysa (display-mode: standalone) hiç görünmez.
 *  - Kapatılınca bu cihazda bir daha görünmez (localStorage, try/catch).
 *  - Sunucuda ve ilk hidrasyonda çizilmez (ortam tarayıcıda belli olur).
 */

const ANAHTAR = "kocum:ana-ekran-kapali";

/** Chrome'un kurma isteği (standart DOM tiplerinde yok). */
interface KurmaIstegi extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Küçük bir depo: kurma isteği, kapatma ve kurulum ─────────
let istek: KurmaIstegi | null = null;
let kapaliBellek: boolean | null = null;
let kuruldu = false;
const dinleyiciler = new Set<() => void>();
const haber = () => {
  for (const d of dinleyiciler) d();
};

/*
 * Olay sayfa yüklenince, React çizmeden önce gelebilir: dinleyici modül
 * yüklenirken kurulur (istemci paketi), yoksa ilk istek kaçardı.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Tarayıcının kendi küçük çubuğu yerine bizim kartımız.
    e.preventDefault();
    istek = e as KurmaIstegi;
    haber();
  });
  window.addEventListener("appinstalled", () => {
    kuruldu = true;
    istek = null;
    haber();
  });
}

function kapaliMi(): boolean {
  if (kapaliBellek !== null) return kapaliBellek;
  try {
    return window.localStorage.getItem(ANAHTAR) === "1";
  } catch {
    return false;
  }
}

function kapat() {
  kapaliBellek = true;
  try {
    window.localStorage.setItem(ANAHTAR, "1");
  } catch {
    // Depo kapalı: bu oturumda kapalı kalır.
  }
  haber();
}

function anaEkrandanMi(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return kuruldu || window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

function iosMu(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ kendini Mac olarak tanıtıyor; dokunmatik Mac yok.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

type Durum = "GIZLI" | "ISTEK" | "IOS" | "ANDROID";

/** İlkel değer: useSyncExternalStore her çağrıda aynı değeri görmeli. */
function durum(): Durum {
  if (kapaliMi() || anaEkrandanMi()) return "GIZLI";
  if (istek) return "ISTEK";
  if (iosMu()) return "IOS";
  if (/android/i.test(window.navigator.userAgent)) return "ANDROID";
  return "GIZLI";
}

/** Tarayıcının kurma penceresini açar. İstek tek kullanımlık; reddedilirse tarayıcı yenisini sonra yollar. */
async function kurmaPenceresi(): Promise<void> {
  const i = istek;
  if (!i) return;
  try {
    await i.prompt();
    const secim = await i.userChoice;
    if (secim.outcome === "accepted") kuruldu = true;
  } finally {
    istek = null;
    haber();
  }
}

function abone(degisti: () => void) {
  dinleyiciler.add(degisti);
  const ortam = window.matchMedia?.("(display-mode: standalone)");
  ortam?.addEventListener?.("change", degisti);
  return () => {
    dinleyiciler.delete(degisti);
    ortam?.removeEventListener?.("change", degisti);
  };
}

function Adim({ no, children }: { no: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-500">
        {no}
      </span>
      <span className="min-w-0 pt-0.5 text-theme-sm text-gray-700">{children}</span>
    </li>
  );
}

export function AnaEkranaEkle() {
  const d = useSyncExternalStore(abone, durum, () => "GIZLI" as Durum);
  const [bekliyor, setBekliyor] = useState(false);

  if (d === "GIZLI") return null;

  async function kur() {
    setBekliyor(true);
    try {
      await kurmaPenceresi();
    } catch {
      // Pencere açılamadı (istek bayatladı): kart menü yönergesine döner.
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-gray-800">Ana ekrana ekle</h2>
          <p className="mt-0.5 text-theme-sm leading-relaxed text-gray-500">
            Check-up telefonunda bir uygulama gibi açılsın; sekmeler arasında aramak zorunda kalma.
          </p>
        </div>
        <button
          type="button"
          onClick={kapat}
          aria-label="Ana ekrana ekle kartını kapat"
          className="-me-2 -mt-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {d === "ISTEK" ? (
        <Button onClick={kur} loading={bekliyor} startIcon={<SquarePlus />} className="mt-4 max-sm:w-full">
          Ana ekrana ekle
        </Button>
      ) : d === "IOS" ? (
        <ol className="mt-4 space-y-2.5">
          <Adim no={1}>
            Safari&apos;nin alt çubuğundaki <strong className="font-semibold">Paylaş</strong> düğmesine dokun{" "}
            <Share className="inline size-4 align-text-bottom text-brand-500" aria-label="(kare ve yukarı ok)" />.
          </Adim>
          <Adim no={2}>
            Açılan listede <strong className="font-semibold">Ana Ekrana Ekle</strong>&apos;yi seç, sonra{" "}
            <strong className="font-semibold">Ekle</strong>&apos;ye dokun.
          </Adim>
        </ol>
      ) : (
        <ol className="mt-4 space-y-2.5">
          <Adim no={1}>
            Tarayıcının sağ üstteki menüsünü aç{" "}
            <EllipsisVertical className="inline size-4 align-text-bottom text-brand-500" aria-label="(üç nokta)" />.
          </Adim>
          <Adim no={2}>
            <strong className="font-semibold">Ana ekrana ekle</strong> ya da <strong className="font-semibold">Uygulamayı yükle</strong>&apos;yi seç.
          </Adim>
        </ol>
      )}
    </Card>
  );
}
