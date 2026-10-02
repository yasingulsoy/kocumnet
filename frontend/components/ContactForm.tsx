"use client";

import { useState } from "react";
import { CircleCheck, Loader2, Send } from "lucide-react";
import { PUBLIC_BACKEND_URL } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Button, Field, INPUT_CLASS, cn } from "@/components/ui";

/**
 * İletişim formu — sitedeki TEK form bileşeni.
 *
 * ⚠️ Bundan önce sitede iki form vardı (hero ve iletişim sayfası) ve
 * İKİSİ DE ÖLÜYDÜ: ne `action` ne `onSubmit` vardı, "Gönder"e basınca sayfa
 * yenileniyor ve mesaj hiçbir yere gitmiyordu. Site aylardır form üzerinden
 * gelen hiçbir mesajı almıyordu.
 *
 * Artık backend'deki POST /api/contact ucuna bağlı. O uç: saatte 5 istek
 * sınırı, bal küpü alanı, uzunluk denetimi ve veritabanına kayıt + (SMTP
 * ayarlıysa) bildirim e-postası.
 */
type Durum = "idle" | "sending" | "sent" | "error";

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
  const [hatalar, setHatalar] = useState<Record<string, string>>({});
  const [genelHata, setGenelHata] = useState<string | null>(null);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const veri = Object.fromEntries(new FormData(form));

    setDurum("sending");
    setHatalar({});
    setGenelHata(null);

    try {
      const res = await fetch(`${PUBLIC_BACKEND_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...veri, locale, source }),
      });

      if (res.ok) {
        setDurum("sent");
        form.reset();
        return;
      }

      if (res.status === 429) {
        setDurum("error");
        setGenelHata(t.formTooMany);
        return;
      }

      // Sunucu alan bazında hata döndürdüyse ilgili alanın altında göster.
      const json = (await res.json().catch(() => null)) as
        | { fields?: Record<string, string>; error?: string }
        | null;
      setDurum("error");
      if (json?.fields && Object.keys(json.fields).length > 0) setHatalar(json.fields);
      else setGenelHata(json?.error ?? t.formError);
    } catch {
      setDurum("error");
      setGenelHata(t.formError);
    }
  }

  if (durum === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-ok/25 bg-ok-wash p-5">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" />
        <p className="text-body text-ink">{t.quickThanks}</p>
      </div>
    );
  }

  const gonderiliyor = durum === "sending";

  return (
    <form onSubmit={gonder} className="space-y-4" noValidate>
      {/*
        Bal küpü. Gerçek kullanıcı görmez, ekran okuyucu okumaz, otomatik
        doldurma dokunmaz — dolu gelirse backend mesajı sessizce yutar.
      */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
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
          placeholder={t.formNamePlaceholder}
          className={cn(INPUT_CLASS, hatalar.name && "border-bad focus:border-bad focus:ring-bad/12")}
        />
      </Field>

      <Field label={t.formEmail} error={hatalar.email}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.formEmailPlaceholder}
          className={cn(INPUT_CLASS, hatalar.email && "border-bad focus:border-bad focus:ring-bad/12")}
        />
      </Field>

      {compact ? null : (
        <Field label={t.formSubject}>
          <input name="subject" autoComplete="off" placeholder={t.formSubjectPlaceholder} className={INPUT_CLASS} />
        </Field>
      )}

      <Field label={t.formMessage} error={hatalar.message}>
        <textarea
          name="message"
          required
          rows={compact ? 4 : 6}
          placeholder={compact ? t.quickMessagePlaceholder : t.formMessagePlaceholder}
          className={cn(
            INPUT_CLASS,
            "resize-y",
            hatalar.message && "border-bad focus:border-bad focus:ring-bad/12"
          )}
        />
      </Field>

      {genelHata ? (
        <p role="alert" className="rounded-xl bg-bad-wash px-4 py-3 text-caption text-bad">
          {genelHata}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={gonderiliyor}>
        {gonderiliyor ? <Loader2 className="animate-spin" /> : <Send />}
        {gonderiliyor ? t.formSending : t.formSend}
      </Button>
    </form>
  );
}
