"use client";

import { useActionState, useState } from "react";
import { FileText, Monitor, Play, Printer } from "lucide-react";
import { startCheckupAction, type StartState } from "@/lib/actions/checkup";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { cn } from "@/lib/cn";

const initial: StartState = {};

type Mod = "ONLINE" | "PAPER";

/**
 * Testi başlatır. Kâğıt açıksa önce biçim seçilir: "Ekranda çöz" (sayaç)
 * ya da "Kâğıtta çöz" (kitapçık + optik form). Seçim gerçek radyo düğmesi:
 * ok tuşlarıyla gezilir, ekran okuyucu grup adını okur. Varsayılan ekran —
 * kâğıt, bilerek seçilen bir şey.
 */
export function StartButton({
  slug,
  resume,
  durationMinutes,
  kagitAcik = false,
  kagitSuresiSaat = 48,
}: {
  slug: string;
  resume: boolean;
  durationMinutes: number;
  /** Bu paket kâğıtta çözülebilir mi (seviyeli ve kontrol testi değil). */
  kagitAcik?: boolean;
  /** Cevapları optik forma işleme süresi (lib/deneme.ts). */
  kagitSuresiSaat?: number;
}) {
  const [state, formAction, pending] = useActionState(startCheckupAction, initial);
  const [mod, setMod] = useState<Mod>("ONLINE");
  const secimVar = kagitAcik && !resume;
  const kagit = secimVar && mod === "PAPER";

  const secenekler: { deger: Mod; baslik: string; aciklama: string; Icon: typeof Monitor }[] = [
    {
      deger: "ONLINE",
      baslik: "Ekranda çöz",
      aciklama: "Sayaç çalışır, cevapların anında kaydedilir.",
      Icon: Monitor,
    },
    {
      deger: "PAPER",
      baslik: "Kâğıtta çöz",
      aciklama: `Kitapçığı yazdır, süreni kendin tut; cevaplarını ${kagitSuresiSaat} saat içinde optik forma işle.`,
      Icon: FileText,
    },
  ];

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="packageSlug" value={slug} />
      {/*
        Gönderilen değer GİZLİ alanda: React 19 eylem bitince form.reset()
        çağırıyor; radyolar DOM'da varsayılana dönüyor, durum değişmediği için
        React düzeltmiyor. Hata alıp yeniden gönderen öğrencinin "kâğıt"
        seçimi sessizce "ekran"a dönerdi. Gizli alanın değeri durumdan yazılır.
      */}
      <input type="hidden" name="mode" value={secimVar ? mod : "ONLINE"} />
      {secimVar ? (
        <fieldset>
          <legend className="sr-only">Nasıl çözeceksin?</legend>
          <div className="grid gap-2">
            {secenekler.map(({ deger, baslik, aciklama, Icon }) => {
              const secili = mod === deger;
              return (
                <label
                  key={deger}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-200",
                    secili ? "border-brand-500 bg-brand-25" : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <input
                    type="radio"
                    name="mode-secimi"
                    value={deger}
                    checked={secili}
                    onChange={() => setMod(deger)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      secili ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-800">{baslik}</span>
                    <span className="mt-0.5 block text-theme-xs leading-relaxed text-gray-500">{aciklama}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}
      {/* Bekleme halkası ve kilit kitin Button'ında (loading): ikinci dokunuş istek açmaz. */}
      <Button
        type="submit"
        size="md"
        block
        loading={pending}
        startIcon={kagit ? <Printer aria-hidden /> : <Play aria-hidden />}
      >
        {pending
          ? "Hazırlanıyor…"
          : resume
            ? "Kaldığın yerden devam et"
            : kagit
              ? "Kitapçığı hazırla"
              : "Teste başla"}
      </Button>
      {!resume ? (
        <p className="text-center text-theme-xs text-gray-500">
          {kagit
            ? `Sayaç çalışmaz. Önerilen süre ${durationMinutes} dakika; cevapları işlemek için ${kagitSuresiSaat} saatin var.`
            : `Başladığında ${durationMinutes} dakikalık süre işlemeye başlar.`}
        </p>
      ) : null}
    </form>
  );
}
