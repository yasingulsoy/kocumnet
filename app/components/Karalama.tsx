"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Eraser, PenLine, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Karalama alanı: soru kartının ÜSTÜNE çizilen tuval (kâğıttaki kenar
 * boşluğu). Kalem, silgi, temizle; iki renk. Kâğıt oturumunda yok (öğrenci
 * zaten kâğıtta).
 *
 * Kullanım — kapsayıcıyı sarar, tuval onun üstüne oturur:
 *
 *   <Karalama oturumId={sessionId} soruId={soru.id}>
 *     <article>…soru…</article>
 *   </Karalama>
 *
 * - Kapalıyken çizimler GÖRÜNÜR ama tuval dokunuşu almaz (pointer-events
 *   yok): kaydırma, şık seçimi, görsel büyüteci olduğu gibi çalışır.
 * - Açıkken tuval dokunuşu alır ve `touch-action: none`: çizerken sayfa
 *   kaymıyor, tarayıcının geri jesti testten çıkarmıyor. Altta boş bir
 *   çalışma alanı açılır (soru kısa olsa da işlem yapacak yer olsun).
 * - Çizgiler VEKTÖR saklanır (nokta dizisi, kapsayıcı genişliğine oranlı):
 *   telefon döndürülünce ya da yazı boyu değişince tuval yeniden boyutlanıyor
 *   ve bit eşlem silinir; çizim noktalardan yeniden çizilir, oranı bozulmaz.
 * - Oturum + soru başına bu cihazda saklanır (localStorage, boyut sınırlı,
 *   her erişim try/catch). Sunucuya hiçbir şey gitmez. Test bitince
 *   `karalamalariTemizle(oturumId)` çağrılmalı; birikenleri
 *   `eskiKaralamalariTemizle()` siler.
 */

const ONEK = "kocum:karalama:";
const SURUM = 1;
/** Soru başına saklanan en büyük kayıt (karakter). ~8000 nokta. */
const SORU_SINIRI = 80_000;
/**
 * Tüm karalamalar için toplam sınır (karakter). localStorage ~5 MB ve sınav
 * ekranının cevap kuyruğu da orada: karalama kotayı doldurursa yazılmamış
 * cevaplar cihazda saklanamaz. Karalama kaybı, cevap kaybından ucuz.
 */
const TOPLAM_SINIR = 1_000_000;
/** Bu süreden eski karalamalar silinir (sınav deposuyla aynı ömür). */
const OMUR_MS = 3 * 86_400_000;
/** Bir çizgide en fazla nokta: basılı unutulan kalem kaydı şişirmesin. */
const CIZGI_NOKTA_SINIRI = 4_000;
/** Koordinat ölçeği: genişliğe oranlı değer × 10 000, tamsayı (kısa JSON). */
const OLCEK = 10_000;
/** Açıkken altta açılan çalışma alanı. */
const EK_ALAN = "min(45vh, 360px)";

/** İki renk: kurşun (gray-800) ve marka mavisi (brand-500). Tuval CSS değişkeni okumaz. */
const RENKLER = [
  { ad: "Koyu", deger: "#1d2939" },
  { ad: "Mavi", deger: "#1a5fb4" },
] as const;

/**
 * Tuvalin en büyük alanı (cihaz pikseli). iOS Safari ~16,7 milyonun üstündeki
 * tuvali sessizce boş çiziyor; uzun soruda yüksek yoğunluklu ekranda aşılır.
 */
const AZAMI_PIKSEL = 16_000_000;

/** Kalınlık (CSS px, çizildiği andaki genişlikte). */
const KALEM_PX = 2.5;
const SILGI_PX = 22;

type Arac = "kalem" | "silgi";

interface Cizgi {
  /** k: kalem, s: silgi */
  a: "k" | "s";
  /** renk indeksi */
  r: number;
  /** kalınlık, genişliğe oranlı × OLCEK */
  g: number;
  /** düz nokta dizisi [x0, y0, x1, y1, …], genişliğe oranlı × OLCEK */
  n: number[];
}

interface Kayit {
  v: number;
  t: number;
  c: Cizgi[];
}

const anahtar = (oturumId: string, soruId: string) => `${ONEK}${oturumId}:${soruId}`;

function gecerliCizgi(c: unknown): c is Cizgi {
  if (!c || typeof c !== "object") return false;
  const x = c as Partial<Cizgi>;
  return (
    (x.a === "k" || x.a === "s") &&
    typeof x.r === "number" &&
    typeof x.g === "number" &&
    Array.isArray(x.n) &&
    x.n.length >= 2 &&
    x.n.length % 2 === 0 &&
    x.n.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function oku(oturumId: string, soruId: string): Cizgi[] {
  try {
    const ham = window.localStorage.getItem(anahtar(oturumId, soruId));
    if (!ham) return [];
    const veri = JSON.parse(ham) as Partial<Kayit>;
    if (veri?.v !== SURUM || !Array.isArray(veri.c)) return [];
    return veri.c.filter(gecerliCizgi);
  } catch {
    return [];
  }
}

/** Bu kayıt dışındaki karalamaların toplam boyu (karakter). */
function digerBoyut(haric: string): number {
  let toplam = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k?.startsWith(ONEK) || k === haric) continue;
    toplam += window.localStorage.getItem(k)?.length ?? 0;
  }
  return toplam;
}

function yaz(oturumId: string, soruId: string, cizgiler: readonly Cizgi[]) {
  const k = anahtar(oturumId, soruId);
  try {
    if (cizgiler.length === 0) {
      window.localStorage.removeItem(k);
      return;
    }
    const butce = Math.min(SORU_SINIRI, TOPLAM_SINIR - digerBoyut(k));
    // Sığmıyorsa EN ESKİ çizgiler kayıttan düşer (ekranda kalırlar).
    let bas = 0;
    let json = JSON.stringify({ v: SURUM, t: Date.now(), c: [...cizgiler] } satisfies Kayit);
    while (json.length > butce && bas < cizgiler.length) {
      bas += Math.max(1, Math.ceil((cizgiler.length - bas) / 4));
      json = JSON.stringify({ v: SURUM, t: Date.now(), c: cizgiler.slice(bas) } satisfies Kayit);
    }
    if (bas >= cizgiler.length) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, json);
  } catch {
    // Gizli sekme ya da dolu depo: çizim yalnızca bu ekranda kalır.
  }
}

/** Bir oturumun bütün karalamalarını siler (test bitince). */
export function karalamalariTemizle(oturumId: string) {
  try {
    const onek = `${ONEK}${oturumId}:`;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(onek)) window.localStorage.removeItem(k);
    }
  } catch {
    // yoksay
  }
}

/** Bitmiş ya da terk edilmiş oturumlardan kalan eski karalamalar birikmesin. */
export function eskiKaralamalariTemizle() {
  try {
    const simdi = Date.now();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(ONEK)) continue;
      let t = 0;
      try {
        t = (JSON.parse(window.localStorage.getItem(k) ?? "null") as Partial<Kayit> | null)?.t ?? 0;
      } catch {
        t = 0;
      }
      if (simdi - t > OMUR_MS) window.localStorage.removeItem(k);
    }
  } catch {
    // yoksay
  }
}

/** Tek çizgiyi, verilen genişlikte çizer (yumuşatılmış: orta noktalardan eğri). */
function cizgiCiz(ctx: CanvasRenderingContext2D, c: Cizgi, w: number) {
  const n = c.n;
  const px = (i: number) => (n[i] / OLCEK) * w;
  ctx.globalCompositeOperation = c.a === "s" ? "destination-out" : "source-over";
  ctx.strokeStyle = RENKLER[c.r]?.deger ?? RENKLER[0].deger;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, (c.g / OLCEK) * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (n.length === 2) {
    // Tek dokunuş: nokta.
    ctx.beginPath();
    ctx.arc(px(0), px(1), ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(px(0), px(1));
  for (let i = 2; i < n.length - 2; i += 2) {
    const mx = (px(i) + px(i + 2)) / 2;
    const my = (px(i + 1) + px(i + 3)) / 2;
    ctx.quadraticCurveTo(px(i), px(i + 1), mx, my);
  }
  ctx.lineTo(px(n.length - 2), px(n.length - 1));
  ctx.stroke();
}

/**
 * Çizilmekte olan çizginin yalnızca yeni parçası (düz çizgilerle): her
 * harekette bütün tuvali yeniden çizmek uzun karalamada kalemi geciktiriyordu.
 * Çizgi bitince tamamı yumuşatılmış hâliyle yeniden çizilir.
 */
function parcaCiz(ctx: CanvasRenderingContext2D, c: Cizgi, w: number, ilkNokta: number) {
  const n = c.n;
  const px = (i: number) => (n[i] / OLCEK) * w;
  ctx.globalCompositeOperation = c.a === "s" ? "destination-out" : "source-over";
  ctx.strokeStyle = RENKLER[c.r]?.deger ?? RENKLER[0].deger;
  ctx.lineWidth = Math.max(1, (c.g / OLCEK) * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const bas = Math.max(0, ilkNokta - 1) * 2;
  ctx.moveTo(px(bas), px(bas + 1));
  for (let i = bas + 2; i < n.length; i += 2) ctx.lineTo(px(i), px(i + 1));
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

export interface KaralamaProps {
  oturumId: string;
  soruId: string;
  /** Kapsayıcı: tuval bunun üstüne oturur (soru kartı). */
  children: ReactNode;
  className?: string;
  /**
   * Açıkken araç çubuğu yapışkan: uzun soruda aşağı inince de kapatılabilsin.
   * Sayfanın sabit üst çubuğunun yüksekliği kadar boşluk (Tailwind sınıfı).
   */
  yapiskanUst?: string;
}

export function Karalama({ oturumId, soruId, children, className, yapiskanUst = "top-16 sm:top-20" }: KaralamaProps) {
  const [acik, setAcik] = useState(false);
  const [arac, setArac] = useState<Arac>("kalem");
  const [renk, setRenk] = useState(0);
  const [cizgiSayisi, setCizgiSayisi] = useState(0);

  const alanRef = useRef<HTMLDivElement>(null);
  const tuvalRef = useRef<HTMLCanvasElement>(null);
  const cizgilerRef = useRef<Cizgi[]>([]);
  const genislikRef = useRef(0);
  const aktifRef = useRef<{ id: number; cizgi: Cizgi } | null>(null);
  /** Kalem (stylus) görüldüyse dokunma yok sayılır: avuç içi çizmesin. */
  const kalemGorulduRef = useRef(false);
  /** Tuvalin cihaz pikseli / CSS pikseli oranı (AZAMI_PIKSEL'e göre kısılmış). */
  const oranRef = useRef(1);

  /** Bit eşlemi baştan çizer (boyut değişince, silince, yüklenince). */
  const yenidenCiz = useCallback(() => {
    const tuval = tuvalRef.current;
    const ctx = tuval?.getContext("2d");
    if (!tuval || !ctx) return;
    const oran = oranRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tuval.width, tuval.height);
    ctx.setTransform(oran, 0, 0, oran, 0, 0);
    const w = genislikRef.current;
    for (const c of cizgilerRef.current) cizgiCiz(ctx, c, w);
    if (aktifRef.current) cizgiCiz(ctx, aktifRef.current.cizgi, w);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Soru değişince o sorunun karalaması yüklenir.
  useEffect(() => {
    cizgilerRef.current = oku(oturumId, soruId);
    aktifRef.current = null;
    // Durum bir sonraki mikro görevde: efekt gövdesinde senkron setState yok.
    let iptal = false;
    void Promise.resolve().then(() => {
      if (iptal) return;
      setCizgiSayisi(cizgilerRef.current.length);
      yenidenCiz();
    });
    return () => {
      iptal = true;
    };
  }, [oturumId, soruId, yenidenCiz]);

  // Kapsayıcı boyutu değişince tuvali yeniden boyutla ve noktalardan çiz.
  useEffect(() => {
    const alan = alanRef.current;
    const tuval = tuvalRef.current;
    if (!alan || !tuval) return;
    const boyutla = () => {
      const r = alan.getBoundingClientRect();
      const oran = Math.max(
        0.5,
        Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(AZAMI_PIKSEL / Math.max(1, r.width * r.height)))
      );
      oranRef.current = oran;
      genislikRef.current = r.width;
      const w = Math.max(1, Math.round(r.width * oran));
      const h = Math.max(1, Math.round(r.height * oran));
      if (tuval.width !== w || tuval.height !== h) {
        tuval.width = w;
        tuval.height = h;
      }
      yenidenCiz();
    };
    boyutla();
    const izleyici = new ResizeObserver(boyutla);
    izleyici.observe(alan);
    return () => izleyici.disconnect();
  }, [yenidenCiz]);

  const nokta = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const alan = alanRef.current;
    const w = genislikRef.current;
    if (!alan || w <= 0) return null;
    const r = alan.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / w) * OLCEK), Math.round(((e.clientY - r.top) / w) * OLCEK)];
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!acik || aktifRef.current) return;
    if (e.pointerType === "pen") kalemGorulduRef.current = true;
    else if (e.pointerType === "touch" && kalemGorulduRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = nokta(e);
    if (!p) return;
    e.preventDefault();
    // Yakalama, çizgi tuvalden taşınca da sürsün diye. Bazı tarayıcılar işaretçi
    // o an bırakılmışsa hata fırlatıyor; yakalamasız da çizim çalışır.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama yok: sorun değil */
    }
    const w = genislikRef.current;
    aktifRef.current = {
      id: e.pointerId,
      cizgi: {
        a: arac === "silgi" ? "s" : "k",
        r: renk,
        g: Math.round(((arac === "silgi" ? SILGI_PX : KALEM_PX) / w) * OLCEK),
        n: [...p],
      },
    };
    yenidenCiz();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const aktif = aktifRef.current;
    if (!aktif || aktif.id !== e.pointerId) return;
    const olaylar = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const n = aktif.cizgi.n;
    const once = n.length / 2;
    let eklendi = false;
    for (const o of olaylar.length > 0 ? olaylar : [e.nativeEvent]) {
      if (n.length >= CIZGI_NOKTA_SINIRI * 2) break;
      const p = nokta(o);
      if (!p) continue;
      const dx = p[0] - n[n.length - 2];
      const dy = p[1] - n[n.length - 1];
      // Yarım pikselden kısa adım: kayda değmez.
      if (dx * dx + dy * dy < ((0.5 / Math.max(1, genislikRef.current)) * OLCEK) ** 2) continue;
      n.push(p[0], p[1]);
      eklendi = true;
    }
    const ctx = eklendi ? tuvalRef.current?.getContext("2d") : null;
    if (ctx) parcaCiz(ctx, aktif.cizgi, genislikRef.current, once);
  };

  const bitir = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const aktif = aktifRef.current;
    if (!aktif || aktif.id !== e.pointerId) return;
    aktifRef.current = null;
    cizgilerRef.current = [...cizgilerRef.current, aktif.cizgi];
    setCizgiSayisi(cizgilerRef.current.length);
    yaz(oturumId, soruId, cizgilerRef.current);
    yenidenCiz();
  };

  const temizle = () => {
    aktifRef.current = null;
    cizgilerRef.current = [];
    setCizgiSayisi(0);
    yaz(oturumId, soruId, []);
    yenidenCiz();
  };

  const aracDugmesi = (etiket: string, secili: boolean, onClick: () => void, icerik: ReactNode) => (
    <button
      key={etiket}
      type="button"
      onClick={onClick}
      aria-pressed={secili}
      aria-label={etiket}
      title={etiket}
      className={cn(
        "flex size-10 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-lg transition",
        secili ? "bg-brand-50 text-brand-500 ring-1 ring-brand-200 ring-inset" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {icerik}
    </button>
  );

  return (
    <div className={cn("relative", className)}>
      {/* Araç çubuğu: kapalıyken tek düğme, açıkken yapışkan çubuk. */}
      <div
        className={cn(
          "mb-2 flex items-center justify-end gap-1",
          acik &&
            cn(
              "sticky z-20 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-theme-xs backdrop-blur",
              yapiskanUst
            )
        )}
      >
        {acik ? (
          <>
            {aracDugmesi("Kalem", arac === "kalem", () => setArac("kalem"), <Pencil className="size-4.5" aria-hidden />)}
            {aracDugmesi("Silgi", arac === "silgi", () => setArac("silgi"), <Eraser className="size-4.5" aria-hidden />)}
            <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden />
            {RENKLER.map((r, i) =>
              aracDugmesi(
                `${r.ad} renk`,
                arac === "kalem" && renk === i,
                () => {
                  setRenk(i);
                  setArac("kalem");
                },
                <span className="size-4.5 rounded-full ring-2 ring-white" style={{ backgroundColor: r.deger }} aria-hidden />
              )
            )}
            <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden />
            <button
              type="button"
              onClick={temizle}
              disabled={cizgiSayisi === 0}
              aria-label="Karalamayı temizle"
              title="Temizle"
              className="flex size-10 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-4.5" aria-hidden />
            </button>
            <span className="min-w-0 flex-1 px-1.5 text-[11px] leading-tight text-gray-500 max-[380px]:hidden">
              Çizerken sayfa kaymaz.
            </span>
            <button
              type="button"
              onClick={() => setAcik(false)}
              aria-label="Karalamayı kapat"
              className="flex min-h-10 shrink-0 cursor-pointer touch-manipulation items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-600"
            >
              <X className="size-4" aria-hidden />
              Kapat
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAcik(true)}
            title="Soru üstüne karalama yap"
            className="flex min-h-10 shrink-0 cursor-pointer touch-manipulation items-center gap-1.5 rounded-lg bg-white px-3 text-[12px] font-semibold text-gray-700 ring-1 ring-gray-300 ring-inset transition hover:bg-gray-50 sm:text-[13px]"
          >
            <PenLine className="size-4" aria-hidden />
            Karalama
            {cizgiSayisi > 0 ? <span className="size-1.5 rounded-full bg-brand-500" aria-hidden /> : null}
            {cizgiSayisi > 0 ? <span className="sr-only"> (bu soruda karalaman var)</span> : null}
          </button>
        )}
      </div>

      <div ref={alanRef} className="relative">
        {children}
        {/* Açıkken altta boş çalışma alanı: kısa soruda da işlem yapacak yer. */}
        {acik ? (
          <div
            aria-hidden
            className="mt-3 rounded-2xl border-2 border-dashed border-gray-200 bg-white/60"
            style={{ height: EK_ALAN }}
          />
        ) : null}
        <canvas
          ref={tuvalRef}
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={bitir}
          onPointerCancel={bitir}
          onLostPointerCapture={bitir}
          className={cn(
            "absolute inset-0 z-10 size-full rounded-2xl print:hidden",
            acik ? "cursor-crosshair ring-2 ring-brand-200" : "pointer-events-none"
          )}
          style={{ touchAction: acik ? "none" : "auto" }}
        />
      </div>
    </div>
  );
}
