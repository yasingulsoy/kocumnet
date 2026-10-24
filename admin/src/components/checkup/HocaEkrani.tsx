"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Download, ListOrdered, Printer, SearchX } from "lucide-react";
import {
  SUZGECLER,
  SUZGEC_ETIKETI,
  ilerlemeHesapla,
  iyelikEki,
  soruListesi,
  suzgecSayilari,
  suzgeceUyar,
  type Ilerleme,
  type Suzgec,
} from "@/lib/checkup/hoca/cevap";
import type { CevapDurumu, HocaBolumu } from "@/lib/checkup/hoca/tipler";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, buttonClass } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { HocaSoruKarti, type HocaYetkisi, type KayitGorunumu } from "./HocaSoruKarti";
import { useUnsavedGuard } from "./useUnsavedGuard";

/*
 * "Hocaya sorular" ekranı (istemci): giriş, ilerleme, süzgeç, bölüm atlama,
 * kartlar. Sade tutuldu: okuyucu matematik öğretmeni, yazılımcı değil.
 *
 * Süzgeç sayfa içinde (adres çubuğuna da yazılır, ?suzgec=): kartlar hep
 * çizili, süzgeç dışı olanlar gizlenir — yazılıp kaydedilmemiş cevap süzgeç
 * değişince kaybolmasın. Süzgeç seçildiği andaki kümeyi tutar: "Bekleyen"
 * listesinde cevaplanan kart yerinden kaybolmaz ("Kaydedildi ✓" görünür),
 * süzgeç yeniden seçilince düşer. Kaydedilmemiş kart her süzgeçte görünür.
 */

const AYIRAC = " · ";

function IlerlemeCumlesi({ i }: { i: Ilerleme }) {
  if (i.cevaplanan === 0) return <>{i.toplam} sorunun hiçbiri henüz cevaplanmadı.</>;
  const uygulanan = i.uygulanan > 0 ? `, ${i.uygulanan}${iyelikEki(i.uygulanan)} uygulandı` : "";
  if (i.cevaplanan === i.toplam) return <>{i.toplam} sorunun hepsi cevaplandı{uygulanan}.</>;
  return (
    <>
      {i.toplam} sorudan {i.cevaplanan}
      {iyelikEki(i.cevaplanan)} cevaplandı{uygulanan}.
    </>
  );
}

function BolumListesi({ ilerleme, git }: { ilerleme: Ilerleme; git: (e: MouseEvent<HTMLAnchorElement>, anahtar: string) => void }) {
  return (
    <ol className="space-y-0.5">
      {ilerleme.bolumler.map((b) => {
        const tamam = b.toplam > 0 && b.cevaplanan === b.toplam;
        return (
          <li key={b.anahtar}>
            <a
              href={"#bolum-" + b.anahtar}
              onClick={(e) => git(e, b.anahtar)}
              className="flex min-h-10 items-start gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="tabular w-6 shrink-0 text-gray-500">{b.no}.</span>
              <span className="min-w-0 flex-1 leading-snug">{b.baslik}</span>
              <span className={cx("tabular shrink-0 text-theme-xs font-medium", tamam ? "text-success-700" : "text-gray-500")}>
                {b.cevaplanan}/{b.toplam}
                <span className="sr-only"> cevaplandı</span>
              </span>
              {b.acilBekleyen > 0 ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-error-500" title={`${b.acilBekleyen} acil soru bekliyor`}>
                  <span className="sr-only">, {b.acilBekleyen} acil soru bekliyor</span>
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export interface HocaEkraniProps {
  bolumler: HocaBolumu[];
  giris: string[];
  kapanis: string;
  /** Soru anahtarı → kayıt (cevabı olmayan soru yok). */
  kayitlar: Record<string, KayitGorunumu>;
  yetki: HocaYetkisi;
  ilkSuzgec: Suzgec;
  /** MANAGE: cevap dökümünün adresi. */
  indirmeAdresi?: string;
}

export function HocaEkrani({ bolumler, giris, kapanis, kayitlar, yetki, ilkSuzgec, indirmeAdresi }: HocaEkraniProps) {
  const kok = useRef<HTMLDivElement>(null);
  const liste = useMemo(() => soruListesi(bolumler), [bolumler]);
  const durumlar = useMemo(
    () => Object.fromEntries(liste.map((s) => [s.soru.anahtar, kayitlar[s.soru.anahtar]?.durum ?? "bekliyor"])) as Record<string, CevapDurumu>,
    [liste, kayitlar]
  );
  const ilerleme = useMemo(() => ilerlemeHesapla(bolumler, durumlar), [bolumler, durumlar]);
  const sayilar = useMemo(() => suzgecSayilari(bolumler, durumlar), [bolumler, durumlar]);

  const eslesenler = (s: Suzgec): ReadonlySet<string> | null =>
    s === "tumu" ? null : new Set(liste.filter((x) => suzgeceUyar(x.soru, durumlar[x.soru.anahtar], s)).map((x) => x.soru.anahtar));
  const [secim, setSecim] = useState(() => ({ suzgec: ilkSuzgec, anahtarlar: eslesenler(ilkSuzgec) }));

  const [kirliler, setKirliler] = useState<ReadonlySet<string>>(() => new Set());
  const kirliBildir = useCallback((anahtar: string, kirli: boolean) => {
    setKirliler((s) => {
      if (s.has(anahtar) === kirli) return s;
      const n = new Set(s);
      if (kirli) n.add(anahtar);
      else n.delete(anahtar);
      return n;
    });
  }, []);
  // Kayıt yönlendirme yapmıyor: "gönderiliyor" hiç doğru olmaz.
  const gonderiliyor = useRef(false);
  useUnsavedGuard(kirliler.size > 0, gonderiliyor);

  const [girisAcik, setGirisAcik] = useState(false);

  // Yazdırırken kapalı "Neden soruyoruz?" / "Örnek" kutuları da kâğıda çıksın.
  useEffect(() => {
    let acilanlar: HTMLDetailsElement[] = [];
    const once = () => {
      acilanlar = Array.from(kok.current?.querySelectorAll<HTMLDetailsElement>("details:not([open])") ?? []);
      for (const d of acilanlar) d.open = true;
    };
    const sonra = () => {
      for (const d of acilanlar) d.open = false;
      acilanlar = [];
    };
    window.addEventListener("beforeprint", once);
    window.addEventListener("afterprint", sonra);
    return () => {
      window.removeEventListener("beforeprint", once);
      window.removeEventListener("afterprint", sonra);
    };
  }, []);

  const gorunur = (anahtar: string) => secim.anahtarlar === null || secim.anahtarlar.has(anahtar) || kirliler.has(anahtar);
  const bolumGorunur = (b: HocaBolumu) => b.sorular.some((s) => gorunur(s.anahtar));
  const gorunenSayisi = liste.filter((s) => gorunur(s.soru.anahtar)).length;

  /** Süzgeç adres çubuğunda da dursun (yenileyince, bağlantı paylaşınca aynı liste). */
  const adreseYaz = (s: Suzgec) => {
    const u = new URL(window.location.href);
    if (s === "tumu") u.searchParams.delete("suzgec");
    else u.searchParams.set("suzgec", s);
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  };

  const suzgecSec = (s: Suzgec) => {
    setSecim({ suzgec: s, anahtarlar: eslesenler(s) });
    adreseYaz(s);
  };

  /** Bölüm bağlantısı: bölüm süzgeç yüzünden gizliyse önce bütün sorular açılır, sonra tarayıcı atlar. */
  const bolumeGit = (e: MouseEvent<HTMLAnchorElement>, anahtar: string) => {
    const b = bolumler.find((x) => x.anahtar === anahtar);
    if (b && !bolumGorunur(b)) {
      // Bölüm DOM'da görünür olsun ki tarayıcının #bolum-… atlaması onu bulsun.
      flushSync(() => setSecim({ suzgec: "tumu", anahtarlar: null }));
      adreseYaz("tumu");
    }
    // Telefondaki açılır listeyi kapat: atlanan yer görünsün.
    const kap = e.currentTarget.closest("details");
    if (kap) kap.open = false;
  };

  const ilkKirli = liste.find((s) => kirliler.has(s.soru.anahtar));
  const cevaplananOrani = ilerleme.toplam ? (ilerleme.cevaplanan - ilerleme.uygulanan) / ilerleme.toplam : 0;
  const uygulananOrani = ilerleme.toplam ? ilerleme.uygulanan / ilerleme.toplam : 0;

  return (
    <div ref={kok} className="space-y-6">
      {giris.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <div id="hoca-giris" className="max-w-3xl space-y-3 text-base leading-relaxed text-gray-700">
            {giris.map((p, i) => (
              <p key={i} className={cx(i > 0 && !girisAcik && "hidden print:block")}>
                {p}
              </p>
            ))}
          </div>
          {giris.length > 1 ? (
            <button
              type="button"
              aria-expanded={girisAcik}
              aria-controls="hoca-giris"
              onClick={() => setGirisAcik((x) => !x)}
              className="mt-3 inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-brand-500 hover:text-brand-600 print:hidden"
            >
              {girisAcik ? "Daha az göster" : "Devamını oku"}
            </button>
          ) : null}
        </Card>
      ) : null}

      {!yetki.yazabilir ? (
        <Alert variant="info" title="Yalnızca okuma">
          Görüntüleyici rolündesiniz: soruları ve cevapları okuyabilir, cevap veremezsiniz. Cevap vermek için editör, müdür ya
          da yönetici hesabı gerekir.
        </Alert>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-[1_1_18rem]">
            <p className="font-display text-lg font-semibold text-gray-800 sm:text-xl">
              <IlerlemeCumlesi i={ilerleme} />
            </p>
            <div aria-hidden className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-200 [print-color-adjust:exact]">
              <div className="h-full bg-success-500" style={{ width: uygulananOrani * 100 + "%" }} />
              <div className="h-full bg-brand-500" style={{ width: cevaplananOrani * 100 + "%" }} />
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-theme-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-success-500 [print-color-adjust:exact]" /> Uygulandı
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-brand-500 [print-color-adjust:exact]" /> Cevaplandı
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-gray-200 [print-color-adjust:exact]" /> Bekliyor
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" startIcon={<Printer />} onClick={() => window.print()}>
              Yazdır
            </Button>
            {indirmeAdresi ? (
              <a href={indirmeAdresi} download className={buttonClass({ variant: "outline", size: "sm" })}>
                <Download aria-hidden />
                Cevapları indir (.md)
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          {ilerleme.acilBekleyen > 0 ? (
            <button
              type="button"
              onClick={() => suzgecSec("acil")}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-error-50 px-4 text-sm font-semibold text-error-700 transition hover:bg-error-100 print:bg-transparent print:px-0"
            >
              <span aria-hidden className="size-2 rounded-full bg-error-500" />
              Acil bekleyen: {ilerleme.acilBekleyen}
            </button>
          ) : ilerleme.acil > 0 ? (
            <span className="inline-flex min-h-10 items-center rounded-full bg-success-50 px-4 text-sm font-semibold text-success-700">
              Acil bekleyen soru kalmadı
            </span>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden xl:block print:hidden">
          <nav aria-label="Bölümler" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pe-1">
            <p className="mb-2 px-2.5 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Bölümler</p>
            <BolumListesi ilerleme={ilerleme} git={bolumeGit} />
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          <div role="group" aria-label="Süzgeç" className="flex flex-wrap gap-2 print:hidden">
            {SUZGECLER.map((s) => {
              const aktif = secim.suzgec === s;
              const acil = s === "acil" && sayilar.acil > 0;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => suzgecSec(s)}
                  className={cx(
                    "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                    aktif
                      ? acil
                        ? "border-error-600 bg-error-600 text-white"
                        : "border-brand-500 bg-brand-500 text-white"
                      : acil
                        ? "border-error-200 bg-white text-error-700 hover:bg-error-50"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {SUZGEC_ETIKETI[s]}
                  <span className={cx("tabular rounded-full px-1.5 text-theme-xs", aktif ? "bg-white/20" : "bg-gray-100 text-gray-600")}>
                    {sayilar[s]}
                  </span>
                </button>
              );
            })}
          </div>

          <details className="rounded-xl border border-gray-200 bg-white xl:hidden print:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700">
              <ListOrdered aria-hidden className="size-4 text-gray-500" />
              Bölümler ({ilerleme.bolumler.length}) — atlamak için açın
            </summary>
            <nav aria-label="Bölümler" className="border-t border-gray-100 p-2">
              <BolumListesi ilerleme={ilerleme} git={bolumeGit} />
            </nav>
          </details>

          {bolumler.map((b, i) => {
            const bi = ilerleme.bolumler[i];
            return (
              <section
                key={b.anahtar}
                id={"bolum-" + b.anahtar}
                aria-labelledby={"bolum-baslik-" + b.anahtar}
                hidden={!bolumGorunur(b)}
                className="scroll-mt-24 space-y-4"
              >
                <div>
                  <h2 id={"bolum-baslik-" + b.anahtar} className="font-display text-xl font-semibold text-balance text-gray-800">
                    {i + 1}. {b.baslik}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {bi.cevaplanan}/{bi.toplam} cevaplandı
                    {bi.acilBekleyen > 0 ? AYIRAC + bi.acilBekleyen + " acil bekliyor" : ""}
                  </p>
                  {b.giris ? <p className="mt-2 max-w-3xl text-base leading-relaxed whitespace-pre-line text-gray-700">{b.giris}</p> : null}
                </div>
                {b.sorular.map((soru, j) => (
                  <HocaSoruKarti
                    key={soru.anahtar}
                    soru={soru}
                    numara={`${i + 1}.${j + 1}`}
                    kayit={kayitlar[soru.anahtar]}
                    yetki={yetki}
                    gizli={!gorunur(soru.anahtar)}
                    kirliBildir={kirliBildir}
                  />
                ))}
              </section>
            );
          })}

          {gorunenSayisi === 0 ? (
            <Card>
              <EmptyState
                icon={<SearchX />}
                title={secim.suzgec === "acil" ? "Acil bekleyen soru yok" : "Bu süzgeçte soru yok"}
                action={
                  <Button variant="outline" size="sm" onClick={() => suzgecSec("tumu")}>
                    Bütün soruları göster
                  </Button>
                }
              />
            </Card>
          ) : null}

          {kapanis ? <p className="max-w-3xl pt-2 text-base leading-relaxed text-gray-700">{kapanis}</p> : null}
        </div>
      </div>

      {ilkKirli ? (
        <div
          role="status"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-warning-500 bg-warning-50 px-4 py-3 shadow-theme-lg print:hidden"
        >
          <span className="text-sm font-medium text-gray-800">
            {kirliler.size === 1 ? "Bir soruda" : kirliler.size + " soruda"} kaydedilmemiş değişiklik var.
          </span>
          <a href={"#soru-" + ilkKirli.soru.anahtar} className="text-sm font-semibold text-brand-500 underline hover:text-brand-600">
            {ilkKirli.numara} numaralı soruya git
          </a>
        </div>
      ) : null}
    </div>
  );
}
