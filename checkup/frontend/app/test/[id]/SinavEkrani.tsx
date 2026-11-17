"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clock,
  Eraser,
  Flag,
  LayoutGrid,
  Loader2,
  LogOut,
} from "lucide-react";
import { checkupBitir, cevapKaydet, testDurumu, type EylemSonucu } from "@/lib/eylemler/checkup";
import { sayac, sayacMetni } from "@/lib/bicim";
import type { TestDevam } from "@/lib/tipler";
import { HtmlIcerik } from "@/components/HtmlIcerik";
import { LogoMark } from "@/components/Logo";
import { SoruGorseli } from "@/components/SoruGorseli";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { BitirPenceresi } from "./BitirPenceresi";
import { SoruGezgini, bolumlereAyir, type KayitDurumu } from "./SoruGezgini";

/** Son kaç dakikada sayaç uyarı rengine geçer. */
const UYARI_MS = 5 * 60_000;

const BAGLANTI_HATASI = "Bağlantı kurulamadı. İnternetini kontrol et.";

/**
 * Sınav ekranı (ÖSYM kitapçığı düzeninde, tek soru).
 *
 * Cevaplar iyimser: şık seçilince ekranda hemen işaretlenir, arkada sırayla
 * kaydedilir (bir soruya art arda basılırsa yalnızca sonuncusu gider).
 * Kaydedilemeyen cevap görünür bir uyarıyla bekler; "Yeniden dene", bağlantı
 * gelince ve bitirmeden önce tekrar gönderilir.
 *
 * Süre sunucunun saatine göre işler: açılışta sunucu saati ile bu cihazın
 * saati arasındaki fark ölçülür, geri sayım ona göre düzeltilir. Süre bitince
 * bekleyen cevaplar gönderilir, test bitirilir ve rapora gidilir. Kesin
 * sınır yine backend'de (sınırdan 15 sn sonra SURE_DOLDU).
 */
export function SinavEkrani({ veri }: { veri: TestDevam }) {
  const router = useRouter();
  const { id, sorular } = veri;
  const bolumler = useMemo(() => bolumlereAyir(sorular), [sorular]);

  // Kaldığı yerden: ilk boş soru (hepsi doluysa ilk soru).
  const [indeks, setIndeks] = useState(() => Math.max(0, sorular.findIndex((s) => s.secilenSikId === null)));
  const [cevaplar, setCevaplar] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(sorular.map((s) => [s.sira, s.secilenSikId]))
  );
  const [kayit, setKayit] = useState<Record<number, KayitDurumu>>({});
  const [kayitHatasi, setKayitHatasi] = useState<string | null>(null);
  // İlk çizim sunucu saatiyle: sunucuda ve tarayıcıda aynı metin çıksın (hydration).
  const [simdiMs, setSimdiMs] = useState(() => Date.parse(veri.simdi));
  const [bitisMs, setBitisMs] = useState(() => Date.parse(veri.bitisSiniri));
  const [bitirAcik, setBitirAcik] = useState(false);
  const [gezginAcik, setGezginAcik] = useState(false);
  const [bitiyor, setBitiyor] = useState<null | "kullanici" | "sure">(null);
  const [bitirmeHatasi, setBitirmeHatasi] = useState<string | null>(null);
  const [sureDuyurusu, setSureDuyurusu] = useState("");
  const [konumDuyurusu, setKonumDuyurusu] = useState("");

  /** Sunucu saati − bu cihazın saati (ms). */
  const fark = useRef<number | null>(null);
  /** Gönderilmeyi bekleyen cevaplar: sıra → istenen şık. */
  const bekleyen = useRef<Map<number, number | null>>(new Map());
  /** Gönderilemeyenler; "Yeniden dene" bunları bekleyene geri koyar. */
  const basarisiz = useRef<Map<number, number | null>>(new Map());
  const calisan = useRef<Promise<void> | null>(null);
  /** Backend check-up'ı kapattı (SURE_DOLDU / KAPANDI): artık cevap gönderilmez. */
  const kapandi = useRef(false);
  const bitiriliyor = useRef(false);
  /** Süre bitince otomatik bitirme bir kez denenir; olmazsa öğrenci 'Yeniden dene'ye basar. */
  const otomatikBitirildi = useRef(false);
  const uyarildi = useRef({ bes: false, bir: false });
  const sureBitti = useRef<() => void>(() => {});
  const soruUstu = useRef<HTMLDivElement>(null);
  const yenidenDeneDugmesi = useRef<HTMLButtonElement>(null);
  const [onayPenceresi, onayla] = useConfirm();

  const soru = sorular[indeks];
  const secili = cevaplar[soru.sira] ?? null;
  const kalan = bitisMs - simdiMs;
  const sonDakikalar = kalan <= UYARI_MS;
  const bosSiralar = sorular.flatMap((s, i) => (cevaplar[s.sira] == null ? [i] : []));
  const kaydedilemeyen = Object.values(kayit).filter((d) => d === "hata").length;
  const bolum = bolumler.find((b) => indeks >= b.ilk && indeks <= b.son) ?? bolumler[0];
  const sonSoru = indeks === sorular.length - 1;

  // ── Kayıt kuyruğu ────────────────────────────────────────────

  /** Bekleyen cevapları sırayla gönderir; zaten çalışıyorsa onu döndürür. */
  const isle = useCallback((): Promise<void> => {
    if (calisan.current) return calisan.current;
    const is = (async () => {
      while (bekleyen.current.size > 0 && !kapandi.current) {
        const [sira, sikId] = bekleyen.current.entries().next().value as [number, number | null];
        bekleyen.current.delete(sira);

        let sonuc: EylemSonucu | undefined;
        try {
          sonuc = await cevapKaydet(id, sira, sikId);
        } catch {
          sonuc = { ok: false, kod: "ULASILAMADI", mesaj: BAGLANTI_HATASI };
        }
        // Eylem yönlendirdiyse (oturum düştü) yanıt gelmez; sayfa zaten gidiyor.
        if (!sonuc) return;

        const yenisiVar = bekleyen.current.has(sira);
        if (sonuc.ok) {
          if (!yenisiVar) setKayit((k) => ({ ...k, [sira]: "tamam" }));
        } else if (sonuc.kod === "SURE_DOLDU" || sonuc.kod === "KAPANDI") {
          kapandi.current = true;
          bekleyen.current.clear();
          basarisiz.current.clear();
          sureBitti.current();
        } else if (!yenisiVar) {
          basarisiz.current.set(sira, sikId);
          setKayit((k) => ({ ...k, [sira]: "hata" }));
          setKayitHatasi(sonuc.kod === "ULASILAMADI" ? BAGLANTI_HATASI : sonuc.mesaj);
        }
      }
    })().finally(() => {
      calisan.current = null;
    });
    calisan.current = is;
    return is;
  }, [id]);

  const kaydet = useCallback(
    (sira: number, sikId: number | null) => {
      if (kapandi.current || bitiriliyor.current) return;
      setCevaplar((c) => ({ ...c, [sira]: sikId }));
      setKayit((k) => ({ ...k, [sira]: "bekliyor" }));
      bekleyen.current.set(sira, sikId);
      basarisiz.current.delete(sira);
      void isle();
    },
    [isle]
  );

  /** Kaydedilemeyenleri yeniden kuyruğa koyar ve gönderir. */
  const yenidenDene = useCallback(() => {
    const siralar = [...basarisiz.current.keys()];
    for (const [s, v] of basarisiz.current) if (!bekleyen.current.has(s)) bekleyen.current.set(s, v);
    basarisiz.current.clear();
    if (siralar.length) {
      setKayit((k) => {
        const y = { ...k };
        for (const s of siralar) y[s] = "bekliyor";
        return y;
      });
    }
    setKayitHatasi(null);
    return isle();
  }, [isle]);

  /** Her şeyi göndermeyi dener; hepsi kaydedildiyse true. */
  const bosalt = useCallback(async () => {
    await yenidenDene();
    while (calisan.current) await calisan.current;
    return basarisiz.current.size === 0;
  }, [yenidenDene]);

  // ── Bitirme ──────────────────────────────────────────────────

  const bitir = useCallback(
    async (neden: "kullanici" | "sure") => {
      if (bitiriliyor.current) return;
      bitiriliyor.current = true;
      setBitirAcik(false);
      setGezginAcik(false);
      setBitiyor(neden);
      setBitirmeHatasi(null);

      if (!kapandi.current) await bosalt();

      let sonuc: EylemSonucu | undefined;
      try {
        sonuc = await checkupBitir(id);
      } catch {
        sonuc = { ok: false, kod: "ULASILAMADI", mesaj: BAGLANTI_HATASI };
      }
      // Başarılıysa eylem /rapor/[id]'ye yönlendirdi.
      if (sonuc && !sonuc.ok) {
        bitiriliyor.current = false;
        setBitirmeHatasi(sonuc.kod === "ULASILAMADI" ? `${BAGLANTI_HATASI} Sonra yeniden dene.` : sonuc.mesaj);
      }
    },
    [id, bosalt]
  );

  useEffect(() => {
    sureBitti.current = () => void bitir("sure");
  }, [bitir]);

  // Bitirme hatasında odak "Yeniden dene"ye.
  useEffect(() => {
    if (bitirmeHatasi) yenidenDeneDugmesi.current?.focus();
  }, [bitirmeHatasi]);

  // ── Saat ve eşitleme ─────────────────────────────────────────

  const tik = useEffectEvent(() => {
    const simdi = Date.now() + (fark.current ?? 0);
    setSimdiMs(simdi);
    const k = bitisMs - simdi;
    if (k <= 60_000 && k > 0 && !uyarildi.current.bir) {
      uyarildi.current = { bes: true, bir: true };
      setSureDuyurusu("Son 1 dakika.");
    } else if (k <= UYARI_MS && k > 60_000 && !uyarildi.current.bes) {
      uyarildi.current.bes = true;
      setSureDuyurusu("Son 5 dakika.");
    }
    if (k <= 0 && !otomatikBitirildi.current) {
      otomatikBitirildi.current = true;
      void bitir("sure");
    }
  });

  /**
   * Sunucuyla eşitle: saat farkı ve kayıtlı cevaplar. Geri/ileri tuşuyla
   * önbellekten dönülen sayfa eski veriyle gelir; bu onu düzeltir.
   * Gönderilmeyi bekleyen cevaplara dokunulmaz (yerel olan daha yeni).
   */
  const esitle = useEffectEvent(async () => {
    const t0 = Date.now();
    let s: Awaited<ReturnType<typeof testDurumu>> | undefined;
    try {
      s = await testDurumu(id);
    } catch {
      return;
    }
    const t1 = Date.now();
    if (!s || !s.ok) return;
    if (s.durum === "BITTI") {
      kapandi.current = true;
      router.replace(`/rapor/${id}`);
      return;
    }
    fark.current = Date.parse(s.simdi) - (t0 + t1) / 2;
    setBitisMs(Date.parse(s.bitisSiniri));
    const sunucuda = s.cevaplar;
    setCevaplar((c) => {
      const y = { ...c };
      for (const [sira, sikId] of sunucuda) {
        if (!bekleyen.current.has(sira) && !basarisiz.current.has(sira)) y[sira] = sikId;
      }
      return y;
    });
  });

  const cevrimiciOldu = useEffectEvent(() => {
    if (basarisiz.current.size) void yenidenDene();
  });

  const ayrilirken = useEffectEvent((e: BeforeUnloadEvent) => {
    if (bitiriliyor.current) return;
    if (bekleyen.current.size || basarisiz.current.size || calisan.current) e.preventDefault();
  });

  useEffect(() => {
    // İlk tahmin: sunucunun yanıt anındaki saati. esitle() birazdan ölçerek düzeltir.
    if (fark.current === null) fark.current = Date.parse(veri.simdi) - Date.now();
    const zamanlayici = window.setInterval(() => tik(), 500);
    // Eşitleme ilk çizimden hemen sonra (render'ı bekletmez).
    const ilkEsitleme = window.setTimeout(() => void esitle(), 0);

    let gizlendi = 0;
    const gorunurluk = () => {
      if (document.visibilityState === "hidden") gizlendi = Date.now();
      else if (gizlendi && Date.now() - gizlendi > 30_000) void esitle();
    };
    const cevrimici = () => cevrimiciOldu();
    const ayril = (e: BeforeUnloadEvent) => ayrilirken(e);
    document.addEventListener("visibilitychange", gorunurluk);
    window.addEventListener("online", cevrimici);
    window.addEventListener("beforeunload", ayril);
    return () => {
      window.clearInterval(zamanlayici);
      window.clearTimeout(ilkEsitleme);
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("online", cevrimici);
      window.removeEventListener("beforeunload", ayril);
    };
  }, [veri.simdi]);

  // ── Gezinme ──────────────────────────────────────────────────

  const git = useCallback(
    (i: number) => {
      const hedef = Math.max(0, Math.min(sorular.length - 1, i));
      setIndeks(hedef);
      setKonumDuyurusu(`Soru ${hedef + 1} / ${sorular.length}`);
      // Sorunun başı ekranın üstünde kaldıysa oraya kaydır.
      const ust = soruUstu.current;
      if (ust && ust.getBoundingClientRect().top < 0) ust.scrollIntoView({ block: "start" });
    },
    [sorular.length]
  );

  function sec(sikId: number) {
    // Seçili şıkka yeniden basmak seçimi kaldırır.
    kaydet(soru.sira, secili === sikId ? null : sikId);
  }

  const tusaBasildi = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || bitiriliyor.current) return;
    const hedef = e.target instanceof Element ? e.target : null;
    if (hedef?.closest("input, textarea, select, [contenteditable='true'], dialog")) return;
    if (document.querySelector("dialog[open]")) return;

    if (e.key === "ArrowRight") {
      if (indeks < sorular.length - 1) {
        e.preventDefault();
        git(indeks + 1);
      }
    } else if (e.key === "ArrowLeft") {
      if (indeks > 0) {
        e.preventDefault();
        git(indeks - 1);
      }
    } else if (/^[a-e]$/i.test(e.key)) {
      const sik = soru.siklar.find((s) => s.harf.toUpperCase() === e.key.toUpperCase());
      if (sik) {
        e.preventDefault();
        sec(sik.id);
      }
    }
  });

  useEffect(() => {
    const dinle = (e: KeyboardEvent) => tusaBasildi(e);
    window.addEventListener("keydown", dinle);
    return () => window.removeEventListener("keydown", dinle);
  }, []);

  async function cik() {
    const uyari = basarisiz.current.size
      ? " Bazı cevapların henüz kaydedilemedi; çıkmadan önce bağlantını kontrol et."
      : " Cevapların kaydedildi.";
    const tamam = await onayla({
      title: "Testten çıkmak istiyor musun?",
      description: `Kaldığın yerden devam edebilirsin, ama süre işlemeye devam eder.${uyari}`,
      confirmLabel: "Panele dön",
      cancelLabel: "Teste devam et",
      tone: "warning",
    });
    if (!tamam) return;
    await bosalt();
    router.push("/panel");
  }

  // ── Çizim ────────────────────────────────────────────────────

  const kayitDurumu = kayit[soru.sira];
  const gezgin = (
    <SoruGezgini
      sorular={sorular}
      bolumler={bolumler}
      cevaplar={cevaplar}
      kayit={kayit}
      indeks={indeks}
      onSec={(i) => {
        git(i);
        setGezginAcik(false);
      }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {onayPenceresi}

      {/* Ekran okuyucu duyuruları: süre uyarıları ve soru değişimi. */}
      <p className="sr-only" aria-live="assertive">
        {sureDuyurusu}
      </p>
      <p className="sr-only" aria-live="polite">
        {konumDuyurusu}
      </p>

      <div inert={bitiyor !== null} className="flex flex-1 flex-col">
        {/* ── Üst çubuk ── */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
            <button
              type="button"
              onClick={cik}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800"
              aria-label="Testten çık, panele dön"
            >
              <LogOut className="size-5 rtl:rotate-180" aria-hidden />
              <span className="max-md:hidden">Çık</span>
            </button>
            <LogoMark className="size-8 max-sm:hidden" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-gray-800">
                <span className="max-sm:hidden">
                  {veri.sinav.ad} · {veri.tur.ad}
                </span>
                <span className="tabular sm:hidden">
                  Soru {indeks + 1}/{sorular.length}
                </span>
              </p>
              <p className="tabular truncate text-caption text-gray-500 max-sm:hidden">
                {sorular.length - bosSiralar.length} / {sorular.length} cevaplandı
              </p>
            </div>

            <div
              role="timer"
              aria-label={`Kalan süre: ${sayacMetni(kalan)}`}
              className={cx(
                "tabular inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 font-display text-base font-semibold transition-colors",
                sonDakikalar ? "bg-warning-50 text-warning-700 ring-1 ring-warning-300" : "bg-gray-100 text-gray-800"
              )}
            >
              {sonDakikalar ? (
                <AlarmClock className="size-4.5 motion-safe:animate-soft-pulse" aria-hidden />
              ) : (
                <Clock className="size-4.5 text-gray-500" aria-hidden />
              )}
              <span aria-hidden>{sayac(kalan)}</span>
              {sonDakikalar ? <span className="text-caption font-medium max-md:hidden">son dakikalar</span> : null}
            </div>

            <Button variant="outline" size="sm" onClick={() => setBitirAcik(true)} startIcon={<Flag />} className="shrink-0 max-sm:px-3">
              <span className="max-sm:hidden">Testi bitir</span>
              <span className="sm:hidden">Bitir</span>
            </Button>
          </div>
        </header>

        {kaydedilemeyen > 0 ? (
          <div className="sticky top-16 z-20">
            <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-6">
              <Alert
                variant="error"
                compact
                className="shadow-theme-md"
                title={`${kaydedilemeyen} cevabın kaydedilemedi`}
                action={
                  <Button size="xs" variant="danger-outline" onClick={() => void yenidenDene()}>
                    Yeniden dene
                  </Button>
                }
              >
                {kayitHatasi ?? BAGLANTI_HATASI} İşaretlerin ekranda duruyor; bağlantı gelince yeniden göndeririz.
              </Alert>
            </div>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-6xl flex-1 px-3 pt-5 pb-28 sm:px-6 sm:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8 lg:pb-10">
          <main id="icerik" className="min-w-0">
            <div ref={soruUstu} className="scroll-mt-20" />

            {bolum.ilk === indeks ? (
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-brand-50 px-3 py-1 font-display text-caption font-semibold text-brand-700">
                  {bolum.ders}
                </span>
                <span aria-hidden className="h-px flex-1 bg-gray-200" />
                <span className="tabular text-caption text-gray-500">
                  Soru {bolum.ilk + 1}–{bolum.son + 1}
                </span>
              </div>
            ) : null}

            {/* ── Kitapçık sayfası ── */}
            <article aria-labelledby="soru-baslik" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-8">
              <div className="flex items-center justify-between gap-3 text-caption text-gray-500">
                <span className="truncate">{soru.ders}</span>
                <span className="tabular shrink-0">
                  {indeks + 1} / {sorular.length}
                </span>
              </div>

              <h2 id="soru-baslik" className="sr-only">
                Soru {indeks + 1}
              </h2>
              <div className="mt-4 flex gap-2.5 sm:gap-3">
                <span aria-hidden className="tabular shrink-0 font-display text-read font-bold text-gray-900 sm:text-lg">
                  {indeks + 1}.
                </span>
                <HtmlIcerik html={soru.metinHtml} className="min-w-0 flex-1 text-read text-gray-900 sm:text-lg sm:leading-relaxed" />
              </div>

              {soru.gorselId != null ? <SoruGorseli id={soru.gorselId} oncelikli className="mt-5" /> : null}

              <div role="group" aria-label="Şıklar" className="mt-6 space-y-2.5">
                {soru.siklar.map((s) => {
                  const bu = secili === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => sec(s.id)}
                      aria-pressed={bu}
                      className={cx(
                        "group flex min-h-12 w-full cursor-pointer touch-manipulation items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition sm:px-4",
                        bu ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <span
                        className={cx(
                          "flex h-8 min-w-10 shrink-0 items-center justify-center rounded-lg px-1.5 font-display text-read font-bold",
                          bu ? "bg-brand-500 text-white" : "text-gray-800"
                        )}
                      >
                        {s.harf})
                      </span>
                      <HtmlIcerik as="span" html={s.metinHtml} className="block min-w-0 flex-1 pt-1 text-read text-gray-900" />
                      {bu ? (
                        <span className="flex shrink-0 items-center gap-1 pt-1.5 text-caption font-semibold text-brand-600">
                          <Check className="size-4" aria-hidden />
                          <span className="max-sm:sr-only">Seçtin</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => kaydet(soru.sira, null)} disabled={secili === null} startIcon={<Eraser />}>
                  Boş bırak
                </Button>
                <p aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-caption">
                  {kayitDurumu === "bekliyor" ? (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Kaydediliyor…
                    </span>
                  ) : kayitDurumu === "tamam" ? (
                    <span className="flex items-center gap-1.5 text-success-700">
                      <Check className="size-3.5" aria-hidden />
                      {secili === null ? "Boş bırakıldı" : "Kaydedildi"}
                    </span>
                  ) : kayitDurumu === "hata" ? (
                    <span className="flex items-center gap-1.5 font-medium text-error-700">
                      <CircleAlert className="size-3.5" aria-hidden />
                      Kaydedilemedi
                    </span>
                  ) : null}
                </p>
              </div>
            </article>

            {/* ── Geniş ekranda gezinme ── */}
            <div className="mt-5 hidden items-center justify-between gap-3 lg:flex">
              <Button variant="outline" size="md" onClick={() => git(indeks - 1)} disabled={indeks === 0} startIcon={<ArrowLeft className="rtl:rotate-180" />}>
                Önceki
              </Button>
              <p className="text-caption text-gray-500">
                <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans text-micro">A</kbd>–
                <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans text-micro">E</kbd> şık seçer ·{" "}
                <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans text-micro">←</kbd>{" "}
                <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-sans text-micro">→</kbd> soru değiştirir
              </p>
              {sonSoru ? (
                <Button size="md" onClick={() => setBitirAcik(true)} startIcon={<Flag />}>
                  Testi bitir
                </Button>
              ) : (
                <Button size="md" onClick={() => git(indeks + 1)} endIcon={<ArrowRight className="rtl:rotate-180" />}>
                  Sonraki
                </Button>
              )}
            </div>
          </main>

          {/* ── Geniş ekranda soru gezgini ── */}
          <aside aria-label="Soru gezgini" className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-4 shadow-card">
              <h2 className="mb-3 font-display text-sm font-semibold text-gray-800">Sorular</h2>
              <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain p-1">{gezgin}</div>
            </div>
          </aside>
        </div>

        {/* ── Telefonda alt çubuk ── */}
        <nav aria-label="Soru gezinme" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white lg:hidden">
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-3 pt-2">
            <Button variant="outline" size="md" onClick={() => git(indeks - 1)} disabled={indeks === 0} startIcon={<ArrowLeft className="rtl:rotate-180" />}>
              Önceki
            </Button>
            <Button variant="soft" size="md" onClick={() => setGezginAcik(true)} startIcon={<LayoutGrid />} aria-label={`Soru listesini aç, şu an ${indeks + 1}. soru`}>
              <span className="tabular">
                {indeks + 1}/{sorular.length}
              </span>
            </Button>
            {sonSoru ? (
              <Button size="md" onClick={() => setBitirAcik(true)} startIcon={<Flag />}>
                Bitir
              </Button>
            ) : (
              <Button size="md" onClick={() => git(indeks + 1)} endIcon={<ArrowRight className="rtl:rotate-180" />}>
                Sonraki
              </Button>
            )}
          </div>
        </nav>
      </div>

      <Modal isOpen={gezginAcik} onClose={() => setGezginAcik(false)} title="Sorular" sheet size="md">
        {gezgin}
      </Modal>

      <BitirPenceresi
        acik={bitirAcik}
        kapat={() => setBitirAcik(false)}
        soruSayisi={sorular.length}
        bosIndeksler={bosSiralar}
        kaydedilemeyen={kaydedilemeyen}
        onBosaDon={(i) => {
          setBitirAcik(false);
          git(i);
        }}
        onBitir={() => void bitir("kullanici")}
      />

      {/* ── Bitiriliyor / süre doldu ── */}
      {bitiyor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 p-6 backdrop-blur-sm">
          <div className="max-w-sm text-center" role={bitirmeHatasi ? "alert" : "status"}>
            <span
              className={cx(
                "mx-auto flex size-14 items-center justify-center rounded-full",
                bitirmeHatasi ? "bg-error-50 text-error-600" : "bg-brand-50 text-brand-500"
              )}
            >
              {bitirmeHatasi ? <CircleAlert className="size-7" aria-hidden /> : <Loader2 className="size-7 animate-spin" aria-hidden />}
            </span>
            <h2 className="mt-5 font-display text-h2 font-semibold text-gray-800">
              {bitirmeHatasi ? "Test bitirilemedi" : bitiyor === "sure" ? "Süre doldu" : "Test bitiyor"}
            </h2>
            <p className="mt-2 text-body text-gray-600">
              {bitirmeHatasi ?? "Cevapların kaydediliyor, raporun hazırlanıyor…"}
            </p>
            {bitirmeHatasi ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button ref={yenidenDeneDugmesi} onClick={() => void bitir(bitiyor)}>
                  Yeniden dene
                </Button>
                <ButtonLink href="/panel" variant="outline">
                  Panele dön
                </ButtonLink>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
