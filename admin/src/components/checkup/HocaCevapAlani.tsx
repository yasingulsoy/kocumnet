"use client";

import { useId, type CSSProperties } from "react";
import { Check, PenLine } from "lucide-react";
import { hucreDogrula, sayiYaz, type CevapGirdisi } from "@/lib/checkup/hoca/cevap";
import type { CevapAlani, CevapDegeri, TabloSatiri, TabloSutunu } from "@/lib/checkup/hoca/tipler";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Badge } from "@/components/tailadmin/ui/Badge";

/*
 * "Hocaya sorular" kartının cevap alanları, türe göre: Uygun / Değişsin,
 * seçenek, sayı, tablo. (Yazı sorusunun alanı ve not kutusu kartta.)
 * Alanlar ham metni tutar; doğrulama ve normalleştirme cevap.ts'te — kart
 * her çizimde doğrular, sunucu aynısını yeniden yapar.
 */

/** Kartın düzenleme durumu: her türün ham alanı (yalnızca sorunun türündeki kullanılır). */
export interface CevapFormu {
  karar: "uygun" | "degissin" | null;
  secilen: string[];
  sayi: string;
  hucreler: Record<string, Record<string, string>>;
  not: string;
}

export function formdan(deger: CevapDegeri | null, not: string | null): CevapFormu {
  return {
    karar: deger?.tur === "uygunMu" ? deger.karar : null,
    secilen: deger?.tur === "secenek" ? deger.secilen : [],
    sayi: deger?.tur === "sayi" ? sayiYaz(deger.sayi) : "",
    hucreler: deger?.tur === "tablo" ? deger.hucreler : {},
    not: not ?? "",
  };
}

/** Formdan eyleme giden ham cevap (cevapDogrula'nın girdisi). */
export function girdiye(alan: CevapAlani, f: CevapFormu): CevapGirdisi {
  switch (alan.tur) {
    case "uygunMu":
      return { deger: f.karar ? { tur: "uygunMu", karar: f.karar } : null, not: f.not };
    case "secenek":
      return { deger: f.secilen.length ? { tur: "secenek", secilen: f.secilen } : null, not: f.not };
    case "sayi":
      return { deger: f.sayi.trim() ? { tur: "sayi", sayi: f.sayi } : null, not: f.not };
    case "tablo":
      return { deger: { tur: "tablo", hucreler: f.hucreler }, not: f.not };
    case "metin":
      return { deger: null, not: f.not };
  }
}

const CEVAP_BASLIGI = "mb-3 text-base font-semibold text-gray-800";
/** Seçili seçeneğin yanında küçük işaret: kâğıda siyah-beyaz basılınca da seçim görünsün. */
const ISARET = "flex size-4 shrink-0 items-center justify-center rounded-full border-2";

// ─── Uygun / Değişsin ───────────────────────────────────────────────

const KARARLAR = [
  {
    deger: "uygun",
    etiket: "Uygun",
    alt: "Şu anki hâli kalsın",
    Ikon: Check,
    secili: "border-success-500 bg-success-50 text-success-700",
  },
  {
    deger: "degissin",
    etiket: "Değişsin",
    alt: "Nasıl olsun, isterseniz yazın",
    Ikon: PenLine,
    secili: "border-warning-500 bg-warning-50 text-warning-700",
  },
] as const;

export function UygunMuAlani({
  ad,
  karar,
  onSec,
}: {
  ad: string;
  karar: CevapFormu["karar"];
  onSec: (k: "uygun" | "degissin") => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={CEVAP_BASLIGI}>Cevabınız</legend>
      <div className="grid grid-cols-2 gap-3">
        {KARARLAR.map((o) => {
          const secili = karar === o.deger;
          return (
            <label
              key={o.deger}
              className={cx(
                "flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition select-none",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-500/30",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                secili ? o.secili : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <input
                type="radio"
                name={ad}
                value={o.deger}
                checked={secili}
                onChange={() => onSec(o.deger)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <span aria-hidden className={cx(ISARET, secili ? "border-current bg-current" : "border-gray-300")}>
                  {secili ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
                <o.Ikon className="size-5" aria-hidden />
                {o.etiket}
              </span>
              <span className="text-theme-xs leading-snug opacity-90 sm:text-sm">{o.alt}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ─── Seçenek ────────────────────────────────────────────────────────

export function SecenekAlani({
  ad,
  alan,
  secilen,
  onDegis,
}: {
  ad: string;
  alan: Extract<CevapAlani, { tur: "secenek" }>;
  secilen: string[];
  onDegis: (secilen: string[]) => void;
}) {
  const coklu = Boolean(alan.cokluSecim);
  return (
    <fieldset className="min-w-0">
      <legend className={CEVAP_BASLIGI}>
        Cevabınız
        {coklu ? <span className="ms-2 text-sm font-normal text-gray-500">(birden çok seçebilirsiniz)</span> : null}
      </legend>
      <div className="space-y-2.5">
        {alan.secenekler.map((o) => {
          const secili = secilen.includes(o.deger);
          return (
            <label
              key={o.deger}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                secili ? "border-brand-500 bg-brand-25" : "border-gray-200 bg-white hover:bg-gray-50"
              )}
            >
              <input
                type={coklu ? "checkbox" : "radio"}
                name={ad}
                value={o.deger}
                checked={secili}
                onChange={(e) => {
                  if (!coklu) onDegis([o.deger]);
                  else onDegis(e.target.checked ? [...secilen, o.deger] : secilen.filter((x) => x !== o.deger));
                }}
                className="mt-1 size-5 shrink-0 cursor-pointer accent-brand-500 disabled:cursor-not-allowed"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-gray-800">
                  {o.etiket}
                  {o.onerilen ? (
                    <Badge size="sm" color="primary">
                      önerimiz
                    </Badge>
                  ) : null}
                </span>
                {o.aciklama ? <span className="mt-1 block text-sm leading-relaxed text-gray-600">{o.aciklama}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ─── Sayı ───────────────────────────────────────────────────────────

export function SayiAlani({
  alan,
  metin,
  onDegis,
  hata,
}: {
  alan: Extract<CevapAlani, { tur: "sayi" }>;
  metin: string;
  onDegis: (metin: string) => void;
  hata?: string;
}) {
  const birim = alan.birim ? " " + alan.birim : "";
  const aralik =
    alan.enAz !== undefined && alan.enCok !== undefined
      ? `${sayiYaz(alan.enAz)} ile ${sayiYaz(alan.enCok)} arası`
      : alan.enAz !== undefined
        ? `en az ${sayiYaz(alan.enAz)}`
        : alan.enCok !== undefined
          ? `en çok ${sayiYaz(alan.enCok)}`
          : null;
  const ipucu = [
    alan.simdiki !== undefined ? `Şu an: ${sayiYaz(alan.simdiki)}${birim}` : null,
    aralik,
    alan.simdiki !== undefined ? "Boş bırakırsanız şu anki değer kalır." : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Field label={<span className="text-base font-semibold text-gray-800">Cevabınız</span>} hint={ipucu || undefined} error={hata}>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          inputMode="decimal"
          autoComplete="off"
          large
          fullWidth={false}
          className="tabular w-36"
          value={metin}
          placeholder={alan.simdiki !== undefined ? sayiYaz(alan.simdiki) : undefined}
          onChange={(e) => onDegis(e.target.value)}
        />
        {alan.birim ? <span className="text-base text-gray-700">{alan.birim}</span> : null}
      </div>
    </Field>
  );
}

// ─── Tablo ──────────────────────────────────────────────────────────

/** Hücrenin soluk yer tutucusu: sistemdeki şu anki değer (yoksa biçim örneği). */
function yerTutucu(satir: TabloSatiri, sutun: TabloSutunu): string {
  const v = satir.simdiki[sutun.anahtar];
  if (v !== null && v !== undefined && v !== "") return typeof v === "number" ? sayiYaz(v) : v;
  return sutun.tur === "tarih" ? "GG.AA.YYYY" : "—";
}

/** Sütun sayısı bunu geçerse tablo masaüstünde de satır satır kart olarak çizilir (hücreler daralmasın). */
const GENIS_TABLO_SINIRI = 4;

export function TabloAlani({
  alan,
  hucreler,
  onDegis,
}: {
  alan: Extract<CevapAlani, { tur: "tablo" }>;
  hucreler: CevapFormu["hucreler"];
  onDegis: (satir: string, sutun: string, deger: string) => void;
}) {
  const id = useId();
  const izgara = alan.sutunlar.length <= GENIS_TABLO_SINIRI;
  // md ve üstünde satırlar aynı ızgarada: satır başlığı + her sütun için eşit pay.
  const satirIzgarasi = "md:grid md:grid-cols-[11rem_repeat(var(--sutun),minmax(0,1fr))] md:items-start md:gap-3";
  return (
    <fieldset className="min-w-0" style={{ "--sutun": alan.sutunlar.length } as CSSProperties}>
      <legend className={CEVAP_BASLIGI}>Cevabınız</legend>
      <p className="mb-3 text-sm leading-relaxed text-gray-600">
        Soluk yazılar sistemdeki <strong className="font-semibold">şu anki</strong> değerler. Yalnızca değiştirmek istediğiniz
        hücreye yazın; boş bıraktığınız hücrede şu anki değer kalır.
      </p>
      {izgara ? (
        <div aria-hidden className={cx("hidden pb-2 text-sm font-semibold text-gray-700", satirIzgarasi)}>
          <span />
          {alan.sutunlar.map((c) => (
            <span key={c.anahtar} className="min-w-0">
              {c.baslik}
              {c.birim ? <span className="font-normal text-gray-500"> ({c.birim})</span> : null}
              {c.yardim ? <span className="block text-theme-xs font-normal text-gray-500">{c.yardim}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      <div className={cx("space-y-3", izgara && "md:space-y-0")}>
        {alan.satirlar.map((r) => {
          const satirId = `${id}-${r.anahtar}`;
          return (
            <div
              key={r.anahtar}
              role="group"
              aria-labelledby={satirId}
              className={cx(
                "rounded-xl border border-gray-200 p-3.5",
                izgara && "md:rounded-none md:border-0 md:border-t md:border-gray-100 md:px-0 md:py-2.5",
                izgara && satirIzgarasi
              )}
            >
              <p id={satirId} className={cx("mb-2 text-base font-semibold text-gray-800", izgara && "md:mb-0 md:pt-2.5 md:text-sm")}>
                {r.baslik}
              </p>
              <div className={cx("grid gap-3", izgara ? "md:contents" : "sm:grid-cols-2")}>
                {alan.sutunlar.map((c) => {
                  const hid = `${satirId}-${c.anahtar}`;
                  const deger = hucreler[r.anahtar]?.[c.anahtar] ?? "";
                  const d = hucreDogrula(c, deger);
                  const hata = d.ok ? null : d.hata;
                  return (
                    <div key={c.anahtar} className="min-w-0">
                      <label htmlFor={hid} className={cx("mb-1 block text-sm font-medium text-gray-700", izgara && "md:sr-only")}>
                        {c.baslik}
                        {c.birim ? <span className="font-normal text-gray-500"> ({c.birim})</span> : null}
                        {c.yardim && !izgara ? <span className="block text-theme-xs font-normal text-gray-500">{c.yardim}</span> : null}
                      </label>
                      <Input
                        id={hid}
                        value={deger}
                        autoComplete="off"
                        inputMode={c.tur === "sayi" ? "decimal" : undefined}
                        className="tabular"
                        placeholder={yerTutucu(r, c)}
                        aria-invalid={hata ? true : undefined}
                        aria-describedby={hata ? hid + "-hata" : undefined}
                        onChange={(e) => onDegis(r.anahtar, c.anahtar, e.target.value)}
                      />
                      {hata ? (
                        <p id={hid + "-hata"} className="mt-1 text-theme-xs font-medium text-error-600">
                          {hata}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
