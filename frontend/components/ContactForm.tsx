"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CircleCheck, Loader2, Mail, Send } from "lucide-react";
import { PUBLIC_BACKEND_URL } from "@/lib/api";
import { SITE_BRAND } from "@/lib/site-brand";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button, Field, INPUT_CLASS, cn } from "@/components/ui";

/**
 * İletişim formu — sitedeki TEK form bileşeni.
 *
 * ⚠️ Bundan önce sitede iki form vardı (hero ve iletişim sayfası) ve
 * İKİSİ DE ÖLÜYDÜ: ne `action` ne `onSubmit` vardı, "Gönder"e basınca sayfa
 * yenileniyor ve mesaj hiçbir yere gitmiyordu.
 *
 * Backend'deki POST /api/contact ucuna bağlı. O uç: IP başına saatte 5 istek
 * (HATALI istekler de sayılır), bal küpü alanı, uzunluk denetimi, kayıt ve
 * (SMTP ayarlıysa) bildirim e-postası.
 *
 * Doğrulama tarayıcıda da yapılıyor, backend'in kurallarıyla birebir:
 * - eksik alanla gönderilen her deneme saatlik 5 hakkın birini yakıyordu;
 * - backend'in hata metinleri yalnızca Türkçe — İngilizce ve Arapça
 *   ziyaretçi Türkçe hata görüyordu. Artık metin her zaman sözlükten gelir;
 *   backend'den yalnızca HANGİ alanın hatalı olduğu alınır.
 */

type Alan = "name" | "email" | "message";
type Durum = "idle" | "sending" | "sent" | "error";

const ALANLAR: Alan[] = ["name", "email", "message"];

/** Backend'deki (routes/contact.js) kurallar ve sınırlar. */
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SINIR = { name: 120, email: 255, subject: 200, message: 5000 } as const;

function dogrula(alan: Alan, deger: string, t: Dictionary["contact"]): string {
  if (alan === "name") {
    return deger.replace(/\s+/g, " ").trim().length < 2 ? t.errName : "";
  }
  if (alan === "email") {
    const v = deger.trim();
    if (!v) return t.errEmail;
    return EPOSTA.test(v) ? "" : t.errEmailInvalid;
  }
  const v = deger.trim();
  if (!v) return t.errMessage;
  return v.length < 10 ? t.errMessageShort : "";
}

/**
 * Sunucu mesajı alamazsa yazılanlar kaybolmasın: aynı içerikle açılan bir
 * e-posta bağlantısı. Backend kapalıyken, sınır aşılınca ya da ağ kopunca
 * ziyaretçinin elinde yeniden yazmadan gönderebileceği bir yol kalır.
 * Bazı posta programları ~2000 karakterden uzun mailto adreslerini kesiyor;
 * mesaj gerekirse kısaltılır, sonuna "…" konur.
 */
const MAILTO_SINIRI = 1800;

function postaBaglantisi(veri: Record<string, string>): string {
  const konu = (veri.subject ?? "").trim() || SITE_BRAND.name;
  const imza = [veri.name, veri.email].map((s) => (s ?? "").trim()).filter(Boolean).join("\n");
  const adres = (mesaj: string) =>
    `mailto:${SITE_BRAND.email}?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(`${mesaj}\n\n${imza}`)}`;

  let mesaj = (veri.message ?? "").trim();
  if (adres(mesaj).length <= MAILTO_SINIRI) return adres(mesaj);
  while (mesaj.length > 0 && adres(`${mesaj}…`).length > MAILTO_SINIRI) {
    mesaj = mesaj.slice(0, Math.floor(mesaj.length * 0.9));
  }
  return adres(`${mesaj.trimEnd()}…`);
}

export function ContactForm({
  dict,
  locale,
  source = "contact",
  compact,
}: {
  dict: Dictionary;
  locale: Locale;
  /** Hangi formdan geldiği — panelde mesajın kaynağı olarak görünür. */
  source?: "contact" | "hero";
  /** Dar alanlarda (yan sütun) konu alanı gizlenir. */
  compact?: boolean;
}) {
  const t = dict.contact;
  const [durum, setDurum] = useState<Durum>("idle");
  const [hatalar, setHatalar] = useState<Partial<Record<Alan, string>>>({});
  const [genelHata, setGenelHata] = useState<string | null>(null);
  /** Gönderim başarısızsa: aynı mesajla açılan e-posta bağlantısı. */
  const [yedekPosta, setYedekPosta] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const basariRef = useRef<HTMLDivElement>(null);

  // Gönderilince form kayboluyor; odak <body>'ye düşmesin, sonuç okunsun.
  useEffect(() => {
    if (durum === "sent") basariRef.current?.focus();
  }, [durum]);

  function alanaOdaklan(alan: Alan) {
    const el = formRef.current?.elements.namedItem(alan);
    if (el instanceof HTMLElement) el.focus();
  }

  function alanHatasiniGuncelle(alan: Alan, deger: string, bosIseGoster: boolean) {
    const mesaj = dogrula(alan, deger, t);
    if (!deger.trim() && !bosIseGoster) return;
    setHatalar((onceki) => (onceki[alan] === mesaj ? onceki : { ...onceki, [alan]: mesaj || undefined }));
  }

  /** Alandan çıkınca: yazılmış ama hatalı değeri hemen söyle; boş alanı göndere kadar dürtme. */
  function cikinca(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const alan = e.currentTarget.name as Alan;
    alanHatasiniGuncelle(alan, e.currentTarget.value, Boolean(hatalar[alan]));
  }

  /** Yazarken: hata gösteriliyorsa düzeldiği an kalksın. */
  function degisince(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const alan = e.currentTarget.name as Alan;
    if (hatalar[alan]) alanHatasiniGuncelle(alan, e.currentTarget.value, true);
  }

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const veri = Object.fromEntries(new FormData(form)) as Record<string, string>;

    const yeniHatalar: Partial<Record<Alan, string>> = {};
    for (const alan of ALANLAR) {
      const mesaj = dogrula(alan, veri[alan] ?? "", t);
      if (mesaj) yeniHatalar[alan] = mesaj;
    }
    // Hata metni ve aria-describedby DOM'a yazılmadan odaklanırsak ekran
    // okuyucu alanı hatasız okuyabilir; önce işle, sonra odaklan.
    flushSync(() => {
      setGenelHata(null);
      setYedekPosta(null);
      setHatalar(yeniHatalar);
    });
    const ilkHata = ALANLAR.find((a) => yeniHatalar[a]);
    if (ilkHata) {
      alanaOdaklan(ilkHata);
      return;
    }

    setDurum("sending");
    try {
      const res = await fetch(`${PUBLIC_BACKEND_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...veri, locale, source }),
      });

      if (res.ok) {
        form.reset();
        setDurum("sent");
        return;
      }

      setDurum("error");
      if (res.status === 429) {
        setGenelHata(t.formTooMany);
        setYedekPosta(postaBaglantisi(veri));
        return;
      }

      // Backend alan hatası döndürdüyse yalnızca HANGİ alan olduğunu al;
      // metni (Türkçe) değil, bu dilin mesajını göster.
      const json = (await res.json().catch(() => null)) as { fields?: Record<string, string> } | null;
      const sunucu: Partial<Record<Alan, string>> = {};
      for (const alan of ALANLAR) {
        if (json?.fields?.[alan]) {
          sunucu[alan] =
            dogrula(alan, veri[alan] ?? "", t) ||
            (alan === "name" ? t.errName : alan === "email" ? t.errEmailInvalid : t.errMessageShort);
        }
      }
      const ilkSunucuHatasi = ALANLAR.find((a) => sunucu[a]);
      if (ilkSunucuHatasi) {
        flushSync(() => setHatalar(sunucu));
        alanaOdaklan(ilkSunucuHatasi);
      } else {
        // Alan hatası değil: sunucu ya da yanlış adres (404, 5xx). Sorun
        // ziyaretçinin bağlantısında değil; "bağlantınızı kontrol edin" demeyiz.
        setGenelHata(t.formErrorServer);
        setYedekPosta(postaBaglantisi(veri));
      }
    } catch {
      // Ağ hatası: istek hiç ulaşmadı.
      setDurum("error");
      setGenelHata(t.formError);
      setYedekPosta(postaBaglantisi(veri));
    }
  }

  if (durum === "sent") {
    return (
      <div
        ref={basariRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-ok/25 bg-ok-wash p-5 focus:outline-none"
      >
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <p className="text-body text-ink">{t.quickThanks}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 ms-6"
          onClick={() => {
            setHatalar({});
            setGenelHata(null);
            setDurum("idle");
          }}
        >
          {t.formSendAnother}
        </Button>
      </div>
    );
  }

  const gonderiliyor = durum === "sending";
  const hataSinifi = (alan: Alan) =>
    cn(INPUT_CLASS, hatalar[alan] && "border-bad focus:border-bad focus:ring-bad/12");

  return (
    /*
      method="post": JS yüklenmeden (yavaş bağlantı, hidrasyon öncesi) gönderilirse
      tarayıcı formu GET ile yollar ve ad/e-posta/mesaj adres çubuğuna, geçmişe
      ve sunucu günlüklerine düşerdi. POST'ta veri kaybolur ama sızmaz.
    */
    <form ref={formRef} onSubmit={gonder} method="post" className="space-y-4" noValidate>
      {/*
        Bal küpü. Gerçek kullanıcı görmez, ekran okuyucu okumaz, sekme ile
        gelinmez — dolu gelirse backend mesajı sessizce yutar.
        Eskiden `-left-[9999px]` ile ekran dışına itiliyordu: Arapça (sağdan
        sola) sayfada sola taşan içerik kaydırılabilir olduğu için iletişim
        sayfası 10.000 piksellik yatay kaydırma çubuğu kazanıyordu. sr-only
        kutusu 1px'lik, kırpılmış ve yerinde: hiçbir yöne taşmaz.
      */}
      <div aria-hidden className="sr-only">
        <label>
          Web sitesi
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field label={t.formName} error={hatalar.name}>
        <input
          name="name"
          required
          autoComplete="name"
          maxLength={SINIR.name}
          placeholder={t.formNamePlaceholder}
          onBlur={cikinca}
          onChange={degisince}
          className={hataSinifi("name")}
        />
      </Field>

      <Field label={t.formEmail} error={hatalar.email}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={SINIR.email}
          placeholder={t.formEmailPlaceholder}
          onBlur={cikinca}
          onChange={degisince}
          className={hataSinifi("email")}
        />
      </Field>

      {compact ? null : (
        <Field
          label={
            <>
              {t.formSubject} <span className="font-normal text-ink-faint">({t.formOptional})</span>
            </>
          }
        >
          <input
            name="subject"
            autoComplete="off"
            maxLength={SINIR.subject}
            placeholder={t.formSubjectPlaceholder}
            className={INPUT_CLASS}
          />
        </Field>
      )}

      <Field label={t.formMessage} error={hatalar.message}>
        <textarea
          name="message"
          required
          rows={compact ? 4 : 6}
          maxLength={SINIR.message}
          placeholder={compact ? t.quickMessagePlaceholder : t.formMessagePlaceholder}
          onBlur={cikinca}
          onChange={degisince}
          className={cn(hataSinifi("message"), "resize-y")}
        />
      </Field>

      {genelHata ? (
        <div role="alert" className="rounded-xl bg-bad-wash px-4 py-3 text-caption text-bad">
          <p>{genelHata}</p>
          {yedekPosta ? (
            <>
              <a
                href={yedekPosta}
                className="mt-2.5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3.5 py-2 font-semibold text-brand ring-1 ring-line transition hover:bg-brand-wash"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                {t.formMailCta}
              </a>
              <p className="mt-2 text-ink-soft">
                {t.formMailHint}{" "}
                <a href={`mailto:${SITE_BRAND.email}`} className="font-medium text-brand underline-offset-2 hover:underline">
                  {SITE_BRAND.email}
                </a>
              </p>
            </>
          ) : (
            <p className="mt-1 text-ink-soft">
              {t.formFallback}{" "}
              <a href={`mailto:${SITE_BRAND.email}`} className="font-medium text-brand underline-offset-2 hover:underline">
                {SITE_BRAND.email}
              </a>
            </p>
          )}
        </div>
      ) : null}

      <Button type="submit" size="lg" block disabled={gonderiliyor}>
        {gonderiliyor ? <Loader2 className="animate-spin" aria-hidden /> : <Send className="rtl:-scale-x-100" aria-hidden />}
        {gonderiliyor ? t.formSending : t.formSend}
      </Button>
    </form>
  );
}
