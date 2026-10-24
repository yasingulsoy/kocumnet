"use client";

import { memo, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import toast from "react-hot-toast";
import { ChevronDown, CircleCheck, Clock, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { hocaCevapKaydetAction, hocaCevapTemizleAction, hocaUygulandiAction, hocaUygulandiGeriAlAction } from "@/lib/checkup/actions/hoca";
import { DURUM_ETIKETI, NOT_SINIRI, UYGULAMA_NOTU_SINIRI, cevapDogrula, kararliJson, metniTemizle } from "@/lib/checkup/hoca/cevap";
import type { CevapDegeri, CevapDurumu, HocaSorusu } from "@/lib/checkup/hoca/tipler";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { SayiAlani, SecenekAlani, TabloAlani, UygunMuAlani, formdan, girdiye, type CevapFormu } from "./HocaCevapAlani";
import { useOnay } from "./Onay";

/*
 * "Hocaya sorular" — tek soru kartı: soru, "şu an sistemde", önerimiz,
 * açılır "neden / örnek", türe göre cevap alanı, not, Kaydet. Yönetim için
 * "uygulandı" işareti. Kurallar cevap.ts'te; yetki sunucuda (actions/hoca.ts).
 *
 * Form yerel durumda; kaydedilen hâl (taban) eylemin döndürdüğü normalize
 * cevaptır. "Kaydedilmemiş değişiklik" ikisinin farkı — sayfaya bildirilir
 * (sayfadan çıkarken uyarı).
 */

/** Sunucunun karta verdiği kayıt: tarihler sunucuda biçimlenmiş (hydration farkı olmasın). */
export interface KayitGorunumu {
  durum: CevapDurumu;
  /** Bu sorunun ŞU ANKİ hâline göre okunmuş değer. */
  deger: CevapDegeri | null;
  /** Kayıtlı değer soru sonradan değiştiği için uymuyor. */
  uyumsuz: boolean;
  not: string | null;
  cevaplayan: string | null;
  cevaplayanTam: string | null;
  cevapZamani: string | null;
  /** answeredAt (ISO): "uygulandı" işareti bu cevaba bağlanır. */
  surum: string | null;
  uygulama: { zaman: string; kim: string; kimTam: string | null; not: string | null } | null;
}

export interface HocaYetkisi {
  /** Cevap yazabilir (admin, müdür, editör). */
  yazabilir: boolean;
  /** "Uygulandı" işaretler, dökümü indirir (admin, müdür). */
  yonetebilir: boolean;
}

interface Taban {
  deger: CevapDegeri | null;
  not: string | null;
  uyumsuz: boolean;
}

function tabanDan(k: KayitGorunumu | undefined): Taban {
  return { deger: k?.deger ?? null, not: k?.not ?? null, uyumsuz: Boolean(k?.uyumsuz) };
}

/** Karşılaştırma anahtarı. Uyumsuz kayıt hiçbir formla eşit sayılmaz: yeniden kaydedilebilsin. */
function tabanAnahtari(t: Taban): string {
  return t.uyumsuz ? "!uyumsuz" : kararliJson({ deger: t.deger, not: t.not });
}

const DURUM_RENGI = { bekliyor: "light", cevaplandi: "info", uygulandi: "success" } as const;

function DurumRozeti({ durum }: { durum: CevapDurumu }) {
  return (
    <Badge
      size="md"
      color={DURUM_RENGI[durum]}
      startIcon={durum === "uygulandi" ? <CircleCheck /> : durum === "bekliyor" ? <Clock /> : undefined}
    >
      {DURUM_ETIKETI[durum]}
    </Badge>
  );
}

/** Açılır-kapanır metin ("Neden soruyoruz?", "Örnek"). Yazdırırken sayfa hepsini açar. */
function Acilir({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-gray-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 text-gray-500 transition group-open:rotate-180 print:hidden" />
        {baslik}
      </summary>
      <p className="px-4 pb-4 text-base leading-relaxed whitespace-pre-line text-gray-700">{children}</p>
    </details>
  );
}

/** Yönetim: "uygulandı" işaretle / işareti kaldır. Kartın formunun DIŞINDA (iç içe form olmasın). */
function UygulamaDugmeleri({ anahtar, kayit, kirli }: { anahtar: string; kayit: KayitGorunumu; kirli: boolean }) {
  const [acik, setAcik] = useState(false);
  const [not, setNot] = useState("");
  const [pending, start] = useTransition();
  const alanRef = useRef<HTMLInputElement>(null);
  const temiz = metniTemizle(not);
  const fazla = temiz.length > UYGULAMA_NOTU_SINIRI;

  if (kayit.durum === "uygulandi") {
    return (
      <Button
        variant="ghost"
        size="xs"
        startIcon={<Undo2 />}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await hocaUygulandiGeriAlAction(anahtar);
            if (r.ok) toast.success("“Uygulandı” işareti kaldırıldı.");
            else toast.error(r.error);
          })
        }
      >
        “Uygulandı” işaretini kaldır
      </Button>
    );
  }
  if (kayit.durum !== "cevaplandi" || !kayit.surum) return null;
  const surum = kayit.surum;

  if (!acik) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          startIcon={<CircleCheck />}
          disabled={kirli}
          onClick={() => {
            flushSync(() => setAcik(true));
            alanRef.current?.focus();
          }}
        >
          Uygulandı olarak işaretle
        </Button>
        {kirli ? <span className="text-theme-xs text-gray-500">Önce cevaptaki değişikliği kaydedin.</span> : null}
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || fazla) return;
        start(async () => {
          const r = await hocaUygulandiAction(anahtar, surum, not);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success("Uygulandı olarak işaretlendi.");
          setAcik(false);
          setNot("");
        });
      }}
    >
      <Field
        label="Ne yapıldı?"
        optional
        className="min-w-0 flex-[1_1_16rem]"
        error={fazla ? `Not ${UYGULAMA_NOTU_SINIRI} karakteri aşıyor (${temiz.length}).` : undefined}
      >
        <Input ref={alanRef} compact value={not} onChange={(e) => setNot(e.target.value)} placeholder="Örn. Soru sayısı 45'e çekildi." />
      </Field>
      <Button type="submit" size="xs" loading={pending} disabled={fazla} startIcon={<CircleCheck />}>
        İşaretle
      </Button>
      <Button variant="ghost" size="xs" disabled={pending} onClick={() => setAcik(false)}>
        Vazgeç
      </Button>
    </form>
  );
}

export interface HocaSoruKartiProps {
  soru: HocaSorusu;
  numara: string;
  kayit: KayitGorunumu | undefined;
  yetki: HocaYetkisi;
  /** Süzgeç dışı: kart çizili kalır (yazılan kaybolmasın), yalnızca gizlenir. */
  gizli: boolean;
  kirliBildir: (anahtar: string, kirli: boolean) => void;
}

export const HocaSoruKarti = memo(function HocaSoruKarti({ soru, numara, kayit, yetki, gizli, kirliBildir }: HocaSoruKartiProps) {
  const alan = soru.cevap;
  const metinSorusu = alan.tur === "metin";
  const baslikId = useId();
  const notId = useId();
  const onayla = useOnay();
  const notRef = useRef<HTMLTextAreaElement>(null);

  const [taban, setTaban] = useState<Taban>(() => tabanDan(kayit));
  const [form, setForm] = useState<CevapFormu>(() => formdan(kayit?.deger ?? null, kayit?.not ?? null));
  const [notAcik, setNotAcik] = useState(() => Boolean(kayit?.not) || (kayit?.deger?.tur === "uygunMu" && kayit.deger.karar === "degissin"));
  const [hata, setHata] = useState<string | null>(null);
  const [geriBildirim, setGeriBildirim] = useState<"kaydedildi" | "kaldirildi" | null>(null);
  const [pending, start] = useTransition();

  const girdi = girdiye(alan, form);
  const dogrulama = cevapDogrula(soru, girdi);
  // Yalnızca değerin hatası (not uzunluğu ayrıca gösteriliyor): sayı kutusunun altına.
  const degerDogrulamasi = cevapDogrula(soru, { deger: girdi.deger });
  const kirli = !dogrulama.ok || kararliJson({ deger: dogrulama.deger, not: dogrulama.not }) !== tabanAnahtari(taban);
  const kayitliVar = taban.uyumsuz || taban.deger !== null || taban.not !== null;
  const notUzunlugu = metniTemizle(form.not).length;
  const notFazla = notUzunlugu > NOT_SINIRI;

  // Sayfa (çıkış uyarısı, alttaki şerit) hangi kartta kaydedilmemiş değişiklik olduğunu bilsin.
  useEffect(() => {
    kirliBildir(soru.anahtar, kirli);
  }, [kirliBildir, soru.anahtar, kirli]);
  useEffect(() => () => kirliBildir(soru.anahtar, false), [kirliBildir, soru.anahtar]);

  const degistir = (f: (x: CevapFormu) => CevapFormu) => {
    setForm(f);
    setGeriBildirim(null);
    setHata(null);
  };

  const notuAc = () => {
    flushSync(() => setNotAcik(true));
    notRef.current?.focus();
  };

  const kaydet = () => {
    if (!yetki.yazabilir || pending) return;
    if (!dogrulama.ok) {
      setHata(dogrulama.hata);
      return;
    }
    const gonderilen = form;
    start(async () => {
      const r = await hocaCevapKaydetAction(soru.anahtar, girdiye(alan, gonderilen));
      if (!r.ok) {
        setHata(r.error);
        toast.error(r.error);
        return;
      }
      setHata(null);
      setTaban({ deger: r.deger, not: r.not, uyumsuz: false });
      // Normalize hâl (ör. 1.6.2027 → 01.06.2027) forma döner; bu arada yazılmaya devam edildiyse dokunma.
      setForm((cur) => (cur === gonderilen ? formdan(r.deger, r.not) : cur));
      setGeriBildirim(r.silindi ? "kaldirildi" : "kaydedildi");
    });
  };

  const temizle = async () => {
    const evet = await onayla({
      title: "Bu sorunun cevabı silinsin mi?",
      description:
        kayit?.durum === "uygulandi"
          ? "Cevap “uygulandı” olarak işaretli. Silerseniz soru yeniden “bekliyor” olur."
          : "Soru yeniden “bekliyor” olur; sistemdeki şu anki hâli geçerli kalır.",
      confirmLabel: "Cevabı sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!evet) return;
    start(async () => {
      const r = await hocaCevapTemizleAction(soru.anahtar);
      if (!r.ok) {
        setHata(r.error);
        toast.error(r.error);
        return;
      }
      setTaban({ deger: null, not: null, uyumsuz: false });
      setForm(formdan(null, null));
      setNotAcik(false);
      setGeriBildirim("kaldirildi");
    });
  };

  const durum = kayit?.durum ?? "bekliyor";
  const notEtiketi = form.karar === "degissin" ? "Nasıl değişsin?" : "Not";

  return (
    <article
      id={"soru-" + soru.anahtar}
      hidden={gizli}
      aria-labelledby={baslikId}
      className={cx(
        "scroll-mt-24 rounded-2xl border bg-white p-4 sm:p-6 print:break-inside-avoid print:rounded-none print:border-gray-300 print:p-4",
        soru.oncelik === "acil" && durum === "bekliyor" ? "border-error-200" : "border-gray-200"
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h3 id={baslikId} className="min-w-0 flex-[1_1_14rem] font-display text-lg leading-snug font-semibold text-balance text-gray-800">
          <span className="tabular me-2 text-brand-500">{numara}</span>
          {soru.baslik}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {soru.oncelik === "acil" ? (
            <Badge size="md" variant="solid" color="error">
              Acil
            </Badge>
          ) : null}
          <DurumRozeti durum={durum} />
        </div>
      </header>

      <p className="mt-3 text-base leading-relaxed whitespace-pre-line text-gray-800 sm:text-lg">{soru.soru}</p>

      {soru.simdi ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-700">Şu an sistemde:</p>
          <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-gray-700">{soru.simdi}</p>
        </div>
      ) : null}

      {soru.oneri ? (
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-25 p-4">
          <p className="text-sm font-semibold text-brand-500">Önerimiz:</p>
          <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-gray-700">{soru.oneri}</p>
        </div>
      ) : null}

      {soru.neden || soru.ornek ? (
        <div className="mt-3 space-y-2">
          {soru.neden ? <Acilir baslik="Neden soruyoruz?">{soru.neden}</Acilir> : null}
          {soru.ornek ? <Acilir baslik="Örnek">{soru.ornek}</Acilir> : null}
        </div>
      ) : null}

      <form
        className="mt-5 border-t border-gray-100 pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          kaydet();
        }}
        onKeyDown={(e) => {
          // Yazı kutusunda Ctrl+Enter da kaydeder (Enter yeni satır).
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            kaydet();
          }
        }}
      >
        {/* Görüntüleyicide bütün alanlar kapalı; nedeni aşağıda yazar. */}
        <fieldset disabled={!yetki.yazabilir} className="min-w-0 space-y-4 [&_input]:text-base [&_textarea]:text-base">
          {taban.uyumsuz ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
              Bu soru siz cevapladıktan sonra değişti; önceki seçiminiz artık uymuyor. Lütfen yeniden cevaplayın.
            </p>
          ) : null}

          {alan.tur === "uygunMu" ? (
            <UygunMuAlani
              ad={"karar-" + soru.anahtar}
              karar={form.karar}
              onSec={(k) => {
                degistir((f) => ({ ...f, karar: k }));
                if (k === "degissin") notuAc();
              }}
            />
          ) : alan.tur === "secenek" ? (
            <SecenekAlani
              ad={"secenek-" + soru.anahtar}
              alan={alan}
              secilen={form.secilen}
              onDegis={(s) => degistir((f) => ({ ...f, secilen: s }))}
            />
          ) : alan.tur === "sayi" ? (
            <SayiAlani
              alan={alan}
              metin={form.sayi}
              onDegis={(s) => degistir((f) => ({ ...f, sayi: s }))}
              hata={degerDogrulamasi.ok ? undefined : degerDogrulamasi.hata}
            />
          ) : alan.tur === "tablo" ? (
            <TabloAlani
              alan={alan}
              hucreler={form.hucreler}
              onDegis={(satir, sutun, v) =>
                degistir((f) => ({ ...f, hucreler: { ...f.hucreler, [satir]: { ...f.hucreler[satir], [sutun]: v } } }))
              }
            />
          ) : (
            <Field
              label={<span className="text-base font-semibold text-gray-800">Cevabınız</span>}
              hint={
                <>
                  {alan.ipucu ? alan.ipucu + " · " : ""}
                  <span className="tabular">
                    {notUzunlugu}/{NOT_SINIRI}
                  </span>
                </>
              }
              error={notFazla ? `Cevap ${NOT_SINIRI} karakteri aşıyor (${notUzunlugu}).` : undefined}
            >
              <TextArea rows={6} value={form.not} onChange={(e) => degistir((f) => ({ ...f, not: e.target.value }))} className="leading-relaxed" />
            </Field>
          )}

          {metinSorusu ? null : notAcik || form.not ? (
            <Field
              htmlFor={notId}
              label={notEtiketi}
              optional
              hint={
                <>
                  <span className="tabular">
                    {notUzunlugu}/{NOT_SINIRI}
                  </span>
                  {form.karar === "degissin" ? " · Kısaca yazmanız yeter; yazmazsanız biz size sorarız." : ""}
                </>
              }
              error={notFazla ? `Not ${NOT_SINIRI} karakteri aşıyor (${notUzunlugu}).` : undefined}
            >
              <TextArea
                ref={notRef}
                id={notId}
                rows={3}
                value={form.not}
                onChange={(e) => degistir((f) => ({ ...f, not: e.target.value }))}
                className="leading-relaxed"
              />
            </Field>
          ) : yetki.yazabilir ? (
            <Button variant="ghost" size="xs" startIcon={<Plus />} onClick={notuAc} className="print:hidden">
              Not ekle
            </Button>
          ) : null}
        </fieldset>

        {yetki.yazabilir ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
            <Button type="submit" size="sm" loading={pending} disabled={!kirli} startIcon={<Save />}>
              Kaydet
            </Button>
            {kirli && !pending ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setForm(formdan(taban.deger, taban.not));
                  setHata(null);
                }}
              >
                Vazgeç
              </Button>
            ) : null}
            <p role="status" aria-live="polite" className="text-sm">
              {pending ? (
                <span className="text-gray-500">Kaydediliyor…</span>
              ) : kirli ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-warning-700">
                  <span aria-hidden className="size-2 rounded-full bg-warning-500" />
                  Kaydedilmemiş değişiklik
                </span>
              ) : geriBildirim === "kaydedildi" ? (
                <span className="font-medium text-success-700">Kaydedildi ✓</span>
              ) : geriBildirim === "kaldirildi" ? (
                <span className="text-gray-600">Cevap kaldırıldı; soru bekliyor.</span>
              ) : null}
            </p>
            {kayitliVar && !kirli && !pending ? (
              <Button variant="ghost" size="xs" className="ms-auto" startIcon={<Trash2 />} onClick={temizle}>
                Cevabı sil
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 print:hidden">Görüntüleyici rolündesiniz: cevabı okuyabilir, değiştiremezsiniz.</p>
        )}
        {hata ? (
          <p role="alert" className="mt-2 text-sm font-medium text-error-600">
            {hata}
          </p>
        ) : null}
        {kirli && kayit?.durum === "uygulandi" && yetki.yazabilir ? (
          <p className="mt-2 text-sm text-gray-600 print:hidden">
            Bu cevap sisteme işlendi. Değiştirip kaydederseniz “uygulandı” işareti kalkar; değişikliği yeniden işleriz.
          </p>
        ) : null}
      </form>

      {kayit && durum !== "bekliyor" ? (
        <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-500">
          <p>
            Cevaplayan: <span title={kayit.cevaplayanTam ?? undefined}>{kayit.cevaplayan ?? "—"}</span>
            {kayit.cevapZamani ? " · " + kayit.cevapZamani : ""}
          </p>
          {kayit.uygulama ? (
            <p className="text-success-700">
              <CircleCheck aria-hidden className="me-1 inline size-4 align-[-3px]" />
              Uygulandı: {kayit.uygulama.zaman} · <span title={kayit.uygulama.kimTam ?? undefined}>{kayit.uygulama.kim}</span>
              {kayit.uygulama.not ? <span className="text-gray-700"> — {kayit.uygulama.not}</span> : null}
            </p>
          ) : null}
          {yetki.yonetebilir ? (
            <div className="pt-2 print:hidden">
              <UygulamaDugmeleri anahtar={soru.anahtar} kayit={kayit} kirli={kirli} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});
