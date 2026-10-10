"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal } from "@/components/tailadmin/ui/Modal";

/*
 * Soru görselini tam ekranda açar ve yakınlaştırır (kitin Modal'ı: yerel
 * <dialog>, odak tuzağı, Esc ile kapanma, kaydırma kilidi).
 *
 *  · Telefonda iki parmakla yakınlaştır, tek parmakla kaydır, çift dokunuşla
 *    yakınlaş / sığdır.
 *  · Bilgisayarda + / − / Sığdır düğmeleri, klavyede + − 0 ve ok tuşları,
 *    tekerlek (dokunmatik yüzeyde iki parmak) ve sürükleme.
 *  · Kapanınca odak görseli açan düğmeye döner.
 *
 * Görseller sunucuda çizilen soru içeriğinde (MathContent `buyutulebilir`):
 * düğme `data-gorsel-buyut` taşır, ekran tıklamayı yakalar (useGorselBuyutec).
 * Puanlamaya ve cevap kaydına dokunmaz.
 */

export interface BuyutulenGorsel {
  src: string;
  alt: string;
}

const EN_AZ = 1;
const EN_COK = 4;
/** Düğme ve klavye adımları (1 = ekrana sığan boy). */
const ADIMLAR = [1, 1.5, 2, 3, 4];
const KAYDIRMA_PX = 48;

const sinirla = (v: number, alt: number, ust: number) => Math.min(ust, Math.max(alt, v));

/**
 * Ekranın kullanacağı kanca: tıklamayı yakalar (soru kartına `onClick`
 * olarak verilir), açık görseli ve kapatmayı verir. Kapanınca odak açan
 * düğmeye döner (Safari düğmeye tıklayınca odak vermiyor; tarayıcıya
 * bırakmıyoruz).
 */
export function useGorselBuyutec() {
  const [gorsel, setGorsel] = useState<BuyutulenGorsel | null>(null);
  const tetikRef = useRef<HTMLElement | null>(null);
  const acikRef = useRef(false);

  const yakala = useCallback((e: ReactMouseEvent) => {
    const hedef = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-gorsel-buyut]") : null;
    const img = hedef?.querySelector("img");
    if (!hedef || !img) return;
    e.preventDefault();
    tetikRef.current = hedef;
    acikRef.current = true;
    setGorsel({ src: img.currentSrc || img.src, alt: img.alt });
  }, []);

  const kapat = useCallback(() => {
    acikRef.current = false;
    setGorsel(null);
  }, []);

  useEffect(() => {
    if (gorsel !== null) return;
    const t = tetikRef.current;
    tetikRef.current = null;
    if (t?.isConnected) t.focus({ preventScroll: true });
  }, [gorsel]);

  return { gorsel, yakala, kapat, acikRef };
}

export function GorselBuyutec({ gorsel, onKapat }: { gorsel: BuyutulenGorsel | null; onKapat: () => void }) {
  const baslikId = useId();
  const yakinlastirRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      isOpen={gorsel !== null}
      onClose={onKapat}
      isFullscreen
      padded={false}
      labelledBy={baslikId}
      closeLabel="Görseli kapat"
      initialFocusRef={yakinlastirRef}
    >
      {gorsel ? <Sahne gorsel={gorsel} baslikId={baslikId} yakinlastirRef={yakinlastirRef} /> : null}
    </Modal>
  );
}

interface Durum {
  /** Ölçek (1 = sığan boy). */
  s: number;
  /** Merkezden kaydırma, piksel. */
  x: number;
  y: number;
}

function Sahne({
  gorsel,
  baslikId,
  yakinlastirRef,
}: {
  gorsel: BuyutulenGorsel;
  baslikId: string;
  yakinlastirRef: RefObject<HTMLButtonElement | null>;
}) {
  const sahneRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [d, setD] = useState<Durum>({ s: 1, x: 0, y: 0 });
  // Olay işleyicileri her hareket karesinde en güncel değeri okusun.
  const dRef = useRef(d);

  /** Görsel sahneden taşmıyorsa ortada kalır; taşıyorsa kenarı ortadan öteye gitmez. */
  const uygula = useCallback((s: number, x: number, y: number) => {
    const sahne = sahneRef.current;
    const img = imgRef.current;
    const ol = sinirla(s, EN_AZ, EN_COK);
    let yeni: Durum = { s: ol, x: 0, y: 0 };
    if (sahne && img && ol > 1) {
      const mx = Math.max(0, (img.offsetWidth * ol - sahne.clientWidth) / 2);
      const my = Math.max(0, (img.offsetHeight * ol - sahne.clientHeight) / 2);
      yeni = { s: ol, x: sinirla(x, -mx, mx), y: sinirla(y, -my, my) };
    }
    dRef.current = yeni;
    setD(yeni);
  }, []);

  /** Ekran noktası `odak` (yoksa sahnenin ortası) yerinde kalarak yeni ölçeğe geç. */
  const olcekle = useCallback(
    (s: number, odak?: { x: number; y: number }) => {
      const sahne = sahneRef.current;
      if (!sahne) return;
      const r = sahne.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fx = (odak?.x ?? cx) - cx;
      const fy = (odak?.y ?? cy) - cy;
      const simdiki = dRef.current;
      const yeniS = sinirla(s, EN_AZ, EN_COK);
      const k = yeniS / simdiki.s;
      uygula(yeniS, fx - k * (fx - simdiki.x), fy - k * (fy - simdiki.y));
    },
    [uygula]
  );

  const buyut = useCallback(() => olcekle(ADIMLAR.find((a) => a > dRef.current.s + 0.01) ?? EN_COK), [olcekle]);
  const kucult = useCallback(
    () => olcekle([...ADIMLAR].reverse().find((a) => a < dRef.current.s - 0.01) ?? EN_AZ),
    [olcekle]
  );
  const sigdir = useCallback(() => uygula(1, 0, 0), [uygula]);

  // ── tekerlek ve dokunmatik yüzey (iki parmak = ctrl + tekerlek) ──
  useEffect(() => {
    const sahne = sahneRef.current;
    if (!sahne) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault(); // sayfa yakınlaşmasın, pencere kaymasın
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      olcekle(dRef.current.s * k, { x: e.clientX, y: e.clientY });
    }
    // Safari'nin kendi kıstırma hareketi sayfayı büyütmesin.
    const engelle = (e: Event) => e.preventDefault();
    sahne.addEventListener("wheel", onWheel, { passive: false });
    sahne.addEventListener("gesturestart", engelle);
    sahne.addEventListener("gesturechange", engelle);
    return () => {
      sahne.removeEventListener("wheel", onWheel);
      sahne.removeEventListener("gesturestart", engelle);
      sahne.removeEventListener("gesturechange", engelle);
    };
  }, [olcekle]);

  /*
   * Klavye: belgenin yakalama evresinde. Odak görselin üstündeyken (tıklanınca
   * odak gövdeye düşer) de çalışsın; pencere zaten kitin odak tuzağında,
   * sınav ekranının kısayolları pencere açıkken çalışmaz.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { s, x, y } = dRef.current;
      let islendi = true;
      switch (e.key) {
        case "+":
        case "=":
          olcekle(ADIMLAR.find((a) => a > s + 0.01) ?? EN_COK);
          break;
        case "-":
        case "_":
          olcekle([...ADIMLAR].reverse().find((a) => a < s - 0.01) ?? EN_AZ);
          break;
        case "0":
          uygula(1, 0, 0);
          break;
        case "ArrowLeft":
          uygula(s, x + KAYDIRMA_PX, y);
          break;
        case "ArrowRight":
          uygula(s, x - KAYDIRMA_PX, y);
          break;
        case "ArrowUp":
          uygula(s, x, y + KAYDIRMA_PX);
          break;
        case "ArrowDown":
          uygula(s, x, y - KAYDIRMA_PX);
          break;
        default:
          islendi = false;
      }
      if (islendi) e.preventDefault();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [olcekle, uygula]);

  // Pencere boyu değişince (telefonu çevirmek) görsel sahneden kopmasın.
  useEffect(() => {
    const sahne = sahneRef.current;
    if (!sahne || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const { s, x, y } = dRef.current;
      uygula(s, x, y);
    });
    ro.observe(sahne);
    return () => ro.disconnect();
  }, [uygula]);

  // ── parmak / fare ───────────────────────────────────────────
  const isaretciler = useRef(new Map<number, { x: number; y: number }>());
  const cimdik = useRef<{ mesafe: number; ortaX: number; ortaY: number; d: Durum } | null>(null);
  const surukle = useRef<{ x: number; y: number; d: Durum } | null>(null);
  const dokunus = useRef<{ x: number; y: number; t: number; kaydi: boolean } | null>(null);
  const sonDokunus = useRef<{ x: number; y: number; t: number } | null>(null);

  function ikiParmak() {
    const [a, b] = [...isaretciler.current.values()];
    return { mesafe: Math.hypot(b.x - a.x, b.y - a.y) || 1, ortaX: (a.x + b.x) / 2, ortaY: (a.y + b.y) / 2 };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      // Parmak sahneden çıksa da hareket buraya gelsin.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // İşaretçi çoktan bırakıldıysa yakalama atar; hareket yine işlenir.
    }
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (isaretciler.current.size === 2) {
      cimdik.current = { ...ikiParmak(), d: dRef.current };
      surukle.current = null;
      dokunus.current = null;
    } else if (isaretciler.current.size === 1) {
      surukle.current = { x: e.clientX, y: e.clientY, d: dRef.current };
      dokunus.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, kaydi: false };
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isaretciler.current.has(e.pointerId)) return;
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const sahne = sahneRef.current;
    if (!sahne) return;

    if (isaretciler.current.size >= 2 && cimdik.current) {
      // Kıstırma: iki parmağın ortasının altındaki nokta parmakların altında kalır.
      const c = cimdik.current;
      const simdi = ikiParmak();
      const r = sahne.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const s = sinirla(c.d.s * (simdi.mesafe / c.mesafe), EN_AZ, EN_COK);
      const k = s / c.d.s;
      uygula(s, simdi.ortaX - cx - k * (c.ortaX - cx - c.d.x), simdi.ortaY - cy - k * (c.ortaY - cy - c.d.y));
      return;
    }

    const t = dokunus.current;
    if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) t.kaydi = true;
    const g = surukle.current;
    if (g && g.d.s > 1) uygula(g.d.s, g.d.x + (e.clientX - g.x), g.d.y + (e.clientY - g.y));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isaretciler.current.delete(e.pointerId)) return;
    if (isaretciler.current.size < 2) cimdik.current = null;
    if (isaretciler.current.size === 1) {
      // Kıstırmadan tek parmağa dönüldü: kaydırma o parmaktan sürsün.
      const [kalan] = [...isaretciler.current.values()];
      surukle.current = { x: kalan.x, y: kalan.y, d: dRef.current };
      return;
    }
    surukle.current = null;

    // Çift dokunuş / çift tıklama: yakınlaş ya da sığdır.
    const t = dokunus.current;
    dokunus.current = null;
    if (!t || t.kaydi || e.timeStamp - t.t > 300 || e.type === "pointercancel") return;
    const onceki = sonDokunus.current;
    if (onceki && e.timeStamp - onceki.t < 350 && Math.hypot(e.clientX - onceki.x, e.clientY - onceki.y) < 32) {
      sonDokunus.current = null;
      if (dRef.current.s > 1) sigdir();
      else olcekle(2.5, { x: e.clientX, y: e.clientY });
    } else {
      sonDokunus.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    }
  }

  const yuzde = Math.round(d.s * 100);

  return (
    <div className="flex h-dvh flex-col bg-white">
      {/* Üst satır: neyin büyütüldüğü (alt metin); kapat düğmesi kitin, sağ üstte. */}
      <div className="flex min-h-14 shrink-0 items-center border-b border-gray-200 px-4 py-2 pe-16 sm:min-h-18 sm:px-6 sm:pe-20">
        <h2 id={baslikId} className="line-clamp-2 text-theme-sm text-gray-700">
          <span className="font-semibold text-gray-800">Şekil:</span> {gorsel.alt}
        </h2>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={sahneRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={
            "absolute inset-0 flex touch-none items-center justify-center overflow-hidden p-3 select-none sm:p-6 " +
            (d.s > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={gorsel.src}
            alt={gorsel.alt}
            draggable={false}
            className="max-h-full max-w-full rounded-lg bg-white will-change-transform"
            style={{ transform: `translate(${d.x}px, ${d.y}px) scale(${d.s})` }}
          />
        </div>
      </div>

      <div className="pb-safe shrink-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 pt-3">
          {/* Sınırda aria-disabled: gerçek disabled odağı düşürürdü. */}
          <Button
            variant="outline"
            onClick={kucult}
            aria-disabled={d.s <= EN_AZ || undefined}
            aria-label="Uzaklaştır"
            title="Uzaklaştır (−)"
            startIcon={<Minus />}
          />
          <output aria-live="polite" className="tabular w-16 text-center text-sm font-semibold text-gray-700">
            <span className="sr-only">Yakınlık </span>%{yuzde}
          </output>
          <Button
            ref={yakinlastirRef}
            variant="outline"
            onClick={buyut}
            aria-disabled={d.s >= EN_COK || undefined}
            aria-label="Yakınlaştır"
            title="Yakınlaştır (+)"
            startIcon={<Plus />}
          />
          <Button variant="ghost" onClick={sigdir} startIcon={<Scan />} title="Ekrana sığdır (0)">
            Sığdır
          </Button>
        </div>
        <p className="px-4 pt-1.5 pb-3 text-center text-theme-xs text-gray-500">
          <span className="pointer-fine:hidden">İki parmakla yakınlaştır, sürükleyerek kaydır.</span>
          <span className="hidden pointer-fine:inline">+ / − ya da tekerlekle yakınlaştır, sürükleyerek kaydır. Esc kapatır.</span>
        </p>
      </div>
    </div>
  );
}
