"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleX, FileText, FolderOpen, ImageIcon, ScanSearch, TriangleAlert, X } from "lucide-react";
import { denetleAction, kaydetAction } from "@/lib/checkup/actions/question-import";
import {
  YUKLEME_SINIRI,
  boyutYazisi,
  sinirAsildiMesaji,
  type IceAktarmaRaporu,
  type KayitYaniti,
  type RaporSorusu,
} from "@/lib/checkup/import-report";
import { cx } from "@/components/tailadmin/cx";
import { Dropzone } from "@/components/tailadmin/extras/dropzone/Dropzone";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { ContentPreview } from "./ContentPreview";
import { useOnay } from "./Onay";
import { CODE, MONO, Meter } from "./ui";

/**
 * Toplu içe aktarma sihirbazı: dosyaları seç → denetle (hiçbir şey yazılmaz)
 * → geçerli soruları taslak olarak kaydet.
 *
 * Dosyalar tarayıcıda tutulur; "Denetle" ve "Kaydet" ikisi de hepsini
 * gönderir ve sunucu her seferinde baştan denetler. Seçim değişince rapor
 * düşer: eski rapora bakarak kaydetmek mümkün olmasın.
 *
 * Seçim kitin Dropzone'u (sürükle-bırak, "Dosya seç"; klasör de bırakılabilir)
 * ve ayrı "Klasör seç" düğmesiyle; listeyi bu bileşen tutar (Dropzone `onAdd`).
 */

const MD_DOSYASI = /\.(md|markdown|txt)$/i;
/** Klasörden seçimde .txt alınmaz (klasörde not dosyası olabilir). */
const MD_KLASORDE = /\.(md|markdown)$/i;
/** Görsel sayılan uzantılar. Desteklenmeyenleri (GIF, SVG…) de gönderiyoruz: sunucu nedenini söylesin. */
const GORSEL_DOSYASI = /\.(png|jpe?g|webp|gif|svg|bmp|tiff?|heic|avif)$/i;
/** Önizlemede bulunamayan görsel yerine şeffaf 1×1 (boş src React uyarısı verir). */
const BOS_GORSEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

interface SeciliGorsel {
  ad: string;
  file: File;
  /** Önizleme için tarayıcı içi adres (URL.createObjectURL). */
  url: string;
}

type Sekme = "hepsi" | "reddedilen" | "uyarili" | "gecerli";

/** Dosyanın klasör içindeki yolu: klasör seçicide webkitRelativePath, sürükle-bırakta react-dropzone'un `path`'i. */
function dosyaYolu(f: File): string {
  return (f.webkitRelativePath || (f as File & { path?: string }).path || f.name).replace(/^\.?\//, "");
}

/** Bırakılan dosyalar bir klasörden mi geldi (yolunda dizin var mı)? */
const klasordenMi = (dosyalar: File[]) => dosyalar.some((f) => dosyaYolu(f).includes("/"));

/**
 * Eylem çağrısı fırlattıysa (ağ, sınır aşımı) kullanıcıya ne denir. Next
 * 10 MB'ı aşan gövdeyi bağlantıyı keserek reddediyor; tarayıcı yalnızca
 * "istek başarısız" görüyor, sebebi ayırt edilemiyor. Ön denetim bu yüzden
 * istemcide (YUKLEME_SINIRI, multipart payı bırakılarak).
 */
function eylemHatasi(e: unknown, toplam: number): string {
  const mesaj = e instanceof Error ? e.message : String(e);
  if (/body exceeded|413|too large|payload/i.test(mesaj) || toplam > YUKLEME_SINIRI * 0.9) return sinirAsildiMesaji(toplam);
  return (
    "İstek sunucuya ulaşmadı ya da yarıda kesildi. Dosyalar 10 MB sınırına yakınsa dosyayı ikiye böl; " +
    "değilse sayfayı yenileyip tekrar dene."
  );
}

export function QuestionImport() {
  const [md, setMd] = useState<File | null>(null);
  const [gorseller, setGorseller] = useState<SeciliGorsel[]>([]);
  const [secimNotu, setSecimNotu] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [rapor, setRapor] = useState<IceAktarmaRaporu | null>(null);
  const [kayit, setKayit] = useState<Extract<KayitYaniti, { ok: true }> | null>(null);
  const [yayinla, setYayinla] = useState(false);
  const [denetleniyor, denetimBaslat] = useTransition();
  const [kaydediliyor, kayitBaslat] = useTransition();
  const mesgul = denetleniyor || kaydediliyor;
  const onayla = useOnay();
  const klasorAlani = useRef<HTMLInputElement | null>(null);

  // Oluşturulan önizleme adresleri; sayfadan çıkınca bırakılır.
  const urller = useRef<Set<string>>(new Set());
  useEffect(() => {
    const kume = urller.current;
    return () => {
      for (const u of kume) URL.revokeObjectURL(u);
      kume.clear();
    };
  }, []);

  const toplam = (md?.size ?? 0) + gorseller.reduce((t, g) => t + g.file.size, 0);
  const asim = toplam > YUKLEME_SINIRI;

  const adresler = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of gorseller) {
      m.set(g.ad, g.url);
      if (!m.has(g.ad.toLowerCase())) m.set(g.ad.toLowerCase(), g.url);
    }
    return m;
  }, [gorseller]);
  const gorselAdresi = (ad: string) => adresler.get(ad) ?? adresler.get(ad.toLowerCase()) ?? BOS_GORSEL;

  /** Seçim değişti: eski rapor ve sonuç geçersiz. */
  const raporuDusur = () => {
    setRapor(null);
    setKayit(null);
    setHata(null);
  };

  const adresiBirak = (url: string) => {
    URL.revokeObjectURL(url);
    urller.current.delete(url);
  };

  const ekle = (dosyalar: File[], klasorden: boolean) => {
    const gizli = (f: File) => /(^|\/)(\.|__MACOSX)/.test(dosyaYolu(f));
    const liste = dosyalar.filter((f) => f.size > 0 && !gizli(f));
    const mdler = liste.filter((f) => (klasorden ? MD_KLASORDE : MD_DOSYASI).test(f.name));
    const yeniGorseller = liste.filter((f) => GORSEL_DOSYASI.test(f.name));
    const diger = liste.filter((f) => !mdler.includes(f) && !yeniGorseller.includes(f));

    const notlar: string[] = [];
    if (mdler.length > 1 && klasorden) {
      notlar.push(
        "Klasörde birden fazla soru dosyası var (" +
          mdler.map((f) => f.name).join(", ") +
          "). Hangisini aktaracağını \"Dosya seç\" ile ayrıca seç."
      );
    } else if (mdler.length > 0) {
      const secilen = mdler[mdler.length - 1];
      if (mdler.length > 1) notlar.push(`Birden fazla .md seçildi; "${secilen.name}" alındı.`);
      setMd(secilen);
    }
    if (diger.length) {
      notlar.push(`Soru dosyası ya da görsel olmayan ${diger.length} dosya yok sayıldı (${diger.slice(0, 3).map((f) => f.name).join(", ")}${diger.length > 3 ? "…" : ""}).`);
    }
    if (yeniGorseller.length) {
      // Güncelleyici fonksiyon değil: geliştirmede iki kez çağrılır, adres sızardı.
      const m = new Map(gorseller.map((g) => [g.ad, g]));
      for (const f of yeniGorseller) {
        const eski = m.get(f.name);
        if (eski) adresiBirak(eski.url);
        const url = URL.createObjectURL(f);
        urller.current.add(url);
        m.set(f.name, { ad: f.name, file: f, url });
      }
      setGorseller([...m.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr")));
    }
    if (klasorden && mdler.length === 0) notlar.push("Klasörde .md soru dosyası bulunamadı.");
    setSecimNotu(notlar.length ? notlar.join(" ") : null);
    raporuDusur();
  };

  const gorselKaldir = (ad: string) => {
    const g = gorseller.find((x) => x.ad === ad);
    if (g) adresiBirak(g.url);
    setGorseller(gorseller.filter((x) => x.ad !== ad));
    raporuDusur();
  };

  const sifirla = () => {
    for (const g of gorseller) adresiBirak(g.url);
    setMd(null);
    setGorseller([]);
    setSecimNotu(null);
    setYayinla(false);
    raporuDusur();
  };

  const formVerisi = () => {
    const fd = new FormData();
    if (md) fd.set("dosya", md, md.name);
    for (const g of gorseller) fd.append("gorsel", g.file, g.ad);
    return fd;
  };

  const denetle = () => {
    if (!md) {
      setHata("Önce soru dosyasını (.md) seç.");
      return;
    }
    if (asim) {
      setHata(sinirAsildiMesaji(toplam));
      return;
    }
    setHata(null);
    setKayit(null);
    denetimBaslat(async () => {
      try {
        const r = await denetleAction(formVerisi());
        if (!r.ok) {
          setRapor(null);
          setHata(r.hata);
          return;
        }
        setRapor(r.rapor);
      } catch (e) {
        setHata(eylemHatasi(e, toplam));
      }
    });
  };

  const kaydet = async () => {
    if (!rapor || !md) return;
    const n = rapor.sayilar.gecerli;
    if (
      yayinla &&
      !(await onayla({
        title: n + " soru doğrudan yayına alınsın mı?",
        description: "Sorular öğrenci testlerine seçilmeye başlayacak. İşaretlemezsen taslak girer; listeden inceleyip toplu yayına alırsın.",
        confirmLabel: "Yayına al",
        tone: "warning",
      }))
    ) {
      return;
    }
    setHata(null);
    const fd = formVerisi();
    if (yayinla) fd.set("yayinla", "1");
    kayitBaslat(async () => {
      try {
        const r = await kaydetAction(fd);
        if (!r.ok) {
          if (r.rapor) setRapor(r.rapor);
          setHata(r.hata);
          return;
        }
        setRapor(r.rapor);
        setKayit(r);
      } catch (e) {
        setHata(eylemHatasi(e, toplam));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Dosyalar ─────────────────────────────────── */}
      <ComponentCard
        title="1. Dosyaları seç"
        desc={
          <>
            SORU-SABLONU biçimindeki .md dosyası ve soru metninde <code className={CODE}>![…](dosya)</code> ile andığın
            görseller.
          </>
        }
      >
        <Dropzone
          multiple
          ariaLabel="Soru dosyası ve görseller: sürükle bırak ya da seç"
          disabled={mesgul}
          title="Dosyaları buraya sürükle"
          description="Klasörü de bırakabilirsin. Dosya seçerken .md ile görselleri birden çok seferde ekleyebilirsin."
          browseLabel="Dosya seç"
          onAdd={(dosyalar) => ekle(dosyalar, klasordenMi(dosyalar))}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xs" startIcon={<FolderOpen />} disabled={mesgul} onClick={() => klasorAlani.current?.click()}>
            Klasör seç
          </Button>
          <input
            type="file"
            multiple
            hidden
            tabIndex={-1}
            aria-hidden
            disabled={mesgul}
            // webkitdirectory React'in tiplerinde yok; klasör seçiciyi açar.
            ref={(el) => {
              klasorAlani.current = el;
              if (el) el.setAttribute("webkitdirectory", "");
            }}
            onChange={(e) => {
              ekle([...(e.currentTarget.files ?? [])], true);
              e.currentTarget.value = "";
            }}
          />
          <p className="min-w-0 flex-1 basis-64 text-theme-xs text-gray-500">
            Klasör seçersen içindeki .md dosyası ve görseller (gorseller/ alt klasörü dahil) birlikte alınır.
          </p>
        </div>

        {secimNotu ? (
          <Alert variant="info" compact>
            {secimNotu}
          </Alert>
        ) : null}

        {md || gorseller.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5">
              <FileText aria-hidden className="size-5 shrink-0 text-gray-500" />
              {md ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800">{md.name}</span>
                  <span className="tabular shrink-0 text-theme-xs text-gray-500">{boyutYazisi(md.size)}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setMd(null);
                      raporuDusur();
                    }}
                    disabled={mesgul}
                    aria-label="Soru dosyasını kaldır"
                  >
                    <X aria-hidden />
                  </Button>
                </>
              ) : (
                <span className="text-theme-sm text-warning-700">Soru dosyası (.md) seçilmedi.</span>
              )}
            </div>

            {gorseller.length ? (
              <div className="rounded-xl border border-gray-200 px-3.5 py-2.5">
                <p className="flex items-center gap-2 text-theme-sm font-medium text-gray-800">
                  <ImageIcon aria-hidden className="size-5 text-gray-500" /> {gorseller.length} görsel
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {gorseller.map((g) => (
                    <li
                      key={g.ad}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-gray-100 py-1 ps-2.5 pe-1 text-theme-xs text-gray-700"
                    >
                      <span className="truncate">{g.ad}</span>
                      <span className="tabular text-gray-500">{boyutYazisi(g.file.size)}</span>
                      <button
                        type="button"
                        onClick={() => gorselKaldir(g.ad)}
                        disabled={mesgul}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-200 hover:text-error-600 disabled:cursor-not-allowed"
                        aria-label={g.ad + " görselini kaldır"}
                      >
                        <X aria-hidden className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-theme-xs">
                <span className="text-gray-500">Gönderilecek toplam</span>
                <span className={cx("tabular font-semibold", asim ? "text-error-600" : "text-gray-800")}>
                  {boyutYazisi(toplam)} <span className="font-normal text-gray-500">/ {boyutYazisi(YUKLEME_SINIRI)}</span>
                </span>
              </div>
              <Meter ratio={toplam / YUKLEME_SINIRI} tone={asim ? "error" : toplam > YUKLEME_SINIRI * 0.8 ? "warning" : "success"} />
            </div>
          </div>
        ) : null}

        {asim ? <Alert variant="error">{sinirAsildiMesaji(toplam)}</Alert> : null}
        {hata ? <Alert variant="error">{hata}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={denetle} disabled={!md || asim || mesgul} loading={denetleniyor} startIcon={<ScanSearch />}>
            {denetleniyor ? "Denetleniyor…" : "Denetle"}
          </Button>
          <span className="text-theme-sm text-gray-500">Denetim hiçbir şey kaydetmez.</span>
          {md || gorseller.length ? (
            <Button variant="ghost" size="xs" onClick={sifirla} disabled={mesgul} className="ms-auto">
              Seçimi temizle
            </Button>
          ) : null}
        </div>
      </ComponentCard>

      {/* ── 2. Rapor ─────────────────────────────────────── */}
      {rapor ? <Rapor rapor={rapor} gorselAdresi={gorselAdresi} kaydedildi={kayit !== null} /> : null}

      {/* ── 3. Kaydet ────────────────────────────────────── */}
      {rapor && !kayit && rapor.sayilar.gecerli > 0 ? (
        <ComponentCard
          title="3. Kaydet"
          desc="Geçerli sorular tek bir içe aktarma olarak yazılır; reddedilenler atlanır ve geçmişte listelenir. Dosyalar kaydederken yeniden denetlenir."
        >
          <Checkbox
            checked={yayinla}
            onChange={(e) => setYayinla(e.target.checked)}
            disabled={mesgul}
            label="Doğrudan yayına al"
            description="İşaretlemezsen sorular taslak girer: listeden inceleyip toplu yayına alırsın. Yayındaki soru öğrenci testlerine seçilmeye başlar."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void kaydet()} disabled={mesgul || !md || asim} loading={kaydediliyor}>
              {kaydediliyor
                ? "Kaydediliyor…"
                : rapor.sayilar.gecerli + (yayinla ? " soruyu yayına al" : " soruyu taslak olarak kaydet")}
            </Button>
            {rapor.sayilar.reddedilen ? (
              <span className="text-theme-sm text-gray-500">{rapor.sayilar.reddedilen} soru atlanacak (raporda kırmızı).</span>
            ) : null}
          </div>
        </ComponentCard>
      ) : null}

      {kayit ? (
        <Card className="p-5 sm:px-6">
          <Alert
            variant="success"
            title={kayit.yazilan + " soru " + (kayit.yayinda ? "yayına alındı." : "taslak olarak kaydedildi.")}
            action={
              <>
                <ButtonLink href={"/checkup/sorular?parti=" + encodeURIComponent(kayit.partiId)} size="xs">
                  Soruları aç
                </ButtonLink>
                <Button variant="outline" size="xs" onClick={sifirla}>
                  Yeni içe aktarma
                </Button>
              </>
            }
          >
            {kayit.atlanan ? kayit.atlanan + " soru atlandı (raporda kırmızı). " : ""}
            {kayit.yeniKazanimlar.length ? "Yeni kazanımlar: " + kayit.yeniKazanimlar.join(", ") + ". " : ""}
            Aşağıdaki geçmişten bu içe aktarmayı geri alabilirsin.
          </Alert>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Rapor ─────────────────────────────────────────────────────

function Rapor({
  rapor,
  gorselAdresi,
  kaydedildi,
}: {
  rapor: IceAktarmaRaporu;
  gorselAdresi: (ad: string) => string;
  /** Kayıttan sonra aynı rapor gösteriliyor ("hiçbir şey kaydedilmedi" yazmasın). */
  kaydedildi: boolean;
}) {
  const [sekme, setSekme] = useState<Sekme>("hepsi");
  const s = rapor.sayilar;
  const sekmeler: { k: Sekme; etiket: string; sayi: number }[] = [
    { k: "hepsi", etiket: "Tümü", sayi: s.bulunan },
    { k: "reddedilen", etiket: "Reddedilen", sayi: s.reddedilen },
    { k: "uyarili", etiket: "Uyarılı", sayi: s.uyarili },
    { k: "gecerli", etiket: "Geçerli", sayi: s.gecerli },
  ];
  const gorunen = rapor.sorular.filter((q) =>
    sekme === "reddedilen" ? !q.gecerli : sekme === "uyarili" ? q.uyarilar.length > 0 : sekme === "gecerli" ? q.gecerli : true
  );

  return (
    <ComponentCard
      title="2. Denetim raporu"
      desc={
        <>
          <span className="font-medium text-gray-700">{rapor.dosyaAdi}</span> · {s.bulunan} soru bulundu.{" "}
          {kaydedildi ? "Geçerli sorular kaydedildi." : "Hiçbir şey kaydedilmedi."}
        </>
      }
      flush
    >
      <div className="space-y-4 border-b border-gray-100 p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Sayac etiket="Geçerli" deger={s.gecerli} ton="success" />
          <Sayac etiket="Reddedilen" deger={s.reddedilen} ton={s.reddedilen ? "error" : "gray"} />
          <Sayac etiket="Uyarılı" deger={s.uyarili} ton={s.uyarili ? "warning" : "gray"} />
          <Sayac etiket="Yeni kazanım" deger={s.yeniKazanim} ton="gray" alt={s.gorsel + " görsel"} />
        </dl>
        {rapor.genelUyarilar.map((u) => (
          <Alert key={u} variant="warning" compact>
            {u}
          </Alert>
        ))}
        {s.gecerli === 0 ? (
          <Alert variant="error" title="Kaydedilecek geçerli soru yok">
            Kırmızı hataları dosyada düzeltip yeniden denetle.
          </Alert>
        ) : null}
      </div>

      <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
        <SegmentedTabs
          label="Soru süzgeci"
          items={sekmeler.map((t) => ({ key: t.k, label: t.etiket, count: t.sayi, active: sekme === t.k, onClick: () => setSekme(t.k) }))}
        />
      </div>

      {gorunen.length === 0 ? (
        <p className="px-6 py-10 text-center text-theme-sm text-gray-500">Bu süzgece uyan soru yok.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {gorunen.map((q) => (
            <SoruSatiri key={q.sira} q={q} gorselAdresi={gorselAdresi} />
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}

const SAYAC_RENGI = { success: "text-success-700", error: "text-error-600", warning: "text-warning-700", gray: "text-gray-800" } as const;

function Sayac({
  etiket,
  deger,
  ton,
  alt,
}: {
  etiket: string;
  deger: number;
  ton: keyof typeof SAYAC_RENGI;
  /** Sayının yanında küçük not. */
  alt?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 px-3.5 py-2.5">
      <dt className="text-theme-xs text-gray-500">{etiket}</dt>
      <dd className="mt-0.5 flex items-baseline gap-2">
        <span className={cx("tabular font-display text-xl font-bold", SAYAC_RENGI[ton])}>{deger}</span>
        {alt ? <span className="text-theme-xs text-gray-500">{alt}</span> : null}
      </dd>
    </div>
  );
}

function SoruSatiri({ q, gorselAdresi }: { q: RaporSorusu; gorselAdresi: (ad: string) => string }) {
  const [acik, setAcik] = useState(false);
  const o = q.ozet;
  return (
    <li className="px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {q.gecerli ? (
          <Badge size="sm" color="success">
            Geçerli
          </Badge>
        ) : (
          <Badge size="sm" color="error">
            Reddedildi
          </Badge>
        )}
        {q.uyarilar.length ? (
          <Badge size="sm" color="warning">
            {q.uyarilar.length} uyarı
          </Badge>
        ) : null}
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-800">
          {q.sira}. {q.baslik}
          <span className="font-normal text-gray-500"> · satır {q.satir}</span>
          {q.id ? <code className={CODE + " ms-2"}>{q.id}</code> : null}
        </p>
        <Button variant="ghost" size="xs" onClick={() => setAcik((x) => !x)} aria-expanded={acik}>
          {acik ? "Önizlemeyi kapat" : "Önizle"}
        </Button>
      </div>

      {o ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-theme-xs text-gray-500">
          <span title={o.konuKodu}>{o.konu}</span>
          {o.seviye ? <span>{o.seviye.split(" — ")[0]}</span> : <span>seviyesiz</span>}
          <span>zorluk {o.zorluk}</span>
          <span>{o.sure} sn</span>
          <span>{o.sikSayisi} şık</span>
          {o.kazanim ? (
            <span className={MONO}>
              {o.kazanim}
              {o.yeniKazanim ? <span className="ms-1 font-sans text-brand-700">(yeni kazanım)</span> : null}
            </span>
          ) : null}
          {o.sinavlar.length ? <span className="text-brand-700">yalnızca {o.sinavlar.join(", ")}</span> : null}
          {o.gorselSayisi ? <span>{o.gorselSayisi} görsel</span> : null}
        </p>
      ) : null}

      {q.hatalar.length ? (
        <ul className="mt-2 space-y-1">
          {q.hatalar.map((h, i) => (
            <li key={i} className="flex gap-2 text-theme-sm text-error-600">
              <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {q.cift?.havuzdakiSoruId ? (
        <p className="mt-1 ps-6 text-theme-xs">
          <Link
            href={"/checkup/sorular/" + encodeURIComponent(q.cift.havuzdakiSoruId)}
            target="_blank"
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Havuzdaki aynı soruyu aç ↗
          </Link>
        </p>
      ) : q.cift?.dosyadaSatir ? (
        <p className="mt-1 ps-6 text-theme-xs text-gray-500">İlk geçtiği yer: satır {q.cift.dosyadaSatir}.</p>
      ) : null}
      {q.uyarilar.length ? (
        <ul className="mt-2 space-y-1">
          {q.uyarilar.map((u, i) => (
            <li key={i} className="flex gap-2 text-theme-sm text-warning-700">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{u}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {q.gecerli && !q.uyarilar.length ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-theme-xs text-success-700">
          <CircleCheck aria-hidden className="size-3.5" /> Sorun yok.
        </p>
      ) : null}

      {acik ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <ContentPreview markup={q.onizleme.soru} gorselAdresi={gorselAdresi} placeholder="(soru metni boş)" />
          <ol className="mt-3 space-y-1">
            {q.onizleme.secenekler.map((s, i) => (
              <li
                key={i}
                className={cx(
                  "flex items-start gap-2 rounded-lg px-2 py-1",
                  s.dogru ? "bg-success-50 ring-1 ring-success-200 ring-inset" : "bg-white"
                )}
              >
                <span className="w-5 shrink-0 text-theme-sm font-semibold text-gray-600">{s.harf})</span>
                <div className="min-w-0 flex-1">
                  <ContentPreview markup={s.metin} compact gorselAdresi={gorselAdresi} placeholder="(boş şık)" />
                </div>
                {s.dogru ? (
                  <Badge size="sm" color="success">
                    doğru
                  </Badge>
                ) : null}
              </li>
            ))}
            {q.onizleme.secenekler.length === 0 ? (
              <li className="flex items-center gap-2 text-theme-sm text-error-600">
                <CircleAlert aria-hidden className="size-4" /> Şık okunamadı (Seçenekler başlığı ve [ ] / [x] işaretleri).
              </li>
            ) : null}
          </ol>
          {q.onizleme.cozum ? (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="mb-1 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Çözüm</p>
              <ContentPreview markup={q.onizleme.cozum} gorselAdresi={gorselAdresi} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
