"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleSlash,
  Clock,
  Hourglass,
  ListChecks,
  LogOut,
  Play,
  Repeat,
  Scale,
} from "lucide-react";
import { checkupBaslat, type EylemSonucu } from "@/lib/eylemler/checkup";
import { dakikaMetni, goturmeMetni } from "@/lib/bicim";
import type { KatalogTuru } from "@/lib/tipler";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";

type Hata = Extract<EylemSonucu, { ok: false }>;

/**
 * Tür seçimi ve başlamadan önceki kural ekranı. Tür seçilince kurallar
 * gösterilir; "Başla" check-up'ı açar ve sunucu eylemi test ekranına yönlendirir.
 */
export function TurSecimi({
  sinavId,
  sinavAd,
  yanlisGoturme,
  turler,
}: {
  sinavId: number;
  sinavAd: string;
  yanlisGoturme: number | null;
  turler: KatalogTuru[];
}) {
  const [secili, setSecili] = useState<KatalogTuru | null>(null);
  const [hata, setHata] = useState<Hata | null>(null);
  const [bekliyor, baslat] = useTransition();
  const kuralBasligi = useRef<HTMLHeadingElement>(null);
  const listeBasligi = useRef<HTMLHeadingElement>(null);
  const oncekiSecim = useRef<KatalogTuru | null>(null);

  // Adım değişince odak yeni adımın başlığına gitsin (ekran okuyucu ve klavye kaybolmasın).
  // İlk çizimde odak taşınmaz.
  useEffect(() => {
    if (oncekiSecim.current === secili) return;
    oncekiSecim.current = secili;
    (secili ? kuralBasligi : listeBasligi).current?.focus();
  }, [secili]);

  function sec(tur: KatalogTuru) {
    setHata(null);
    setSecili(tur);
  }

  function basla() {
    if (!secili) return;
    setHata(null);
    baslat(async () => {
      // Başarılıysa eylem /test/[id]'ye yönlendirir; buraya yalnızca hata döner.
      const sonuc = await checkupBaslat(sinavId, secili.id);
      if (sonuc && !sonuc.ok) setHata(sonuc);
    });
  }

  if (turler.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Hourglass />}
          title="Check-up türleri hazırlanıyor"
          description={`${sinavAd} için check-up'lar çok yakında burada.`}
        />
      </Card>
    );
  }

  if (!secili) {
    return (
      <section aria-labelledby="tur-baslik">
        <h2 id="tur-baslik" ref={listeBasligi} tabIndex={-1} className="mb-4 font-display text-h3 font-semibold text-gray-800 outline-none">
          Check-up türünü seç
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {turler.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => sec(t)}
                disabled={!t.hazir}
                aria-describedby={`tur-${t.id}-bilgi`}
                className={cx(
                  "flex h-full w-full flex-col rounded-2xl border bg-white p-5 text-start transition sm:p-6",
                  t.hazir
                    ? "cursor-pointer border-gray-200 hover:border-brand-300 hover:shadow-theme-md"
                    : "cursor-not-allowed border-dashed border-gray-300 bg-gray-50"
                )}
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className={cx("font-display text-h3 font-semibold", t.hazir ? "text-gray-800" : "text-gray-600")}>{t.ad}</span>
                  {t.hazir ? null : (
                    <Badge color="light" size="sm" startIcon={<Hourglass />}>
                      Hazırlanıyor
                    </Badge>
                  )}
                </span>
                {t.aciklama ? <span className="mt-2 block text-body text-gray-600">{t.aciklama}</span> : null}
                <span id={`tur-${t.id}-bilgi`} className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-5 text-sm text-gray-700">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-4 text-gray-500" aria-hidden />
                    {t.soruSayisi} soru
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 text-gray-500" aria-hidden />
                    {dakikaMetni(t.sureDakika)}
                  </span>
                  {t.hazir ? null : <span className="sr-only">Bu tür henüz hazır değil, başlatılamaz.</span>}
                </span>
                {t.hazir ? (
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-500">
                    Bu türü seç
                    <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const kurallar = [
    { Ikon: ListChecks, metin: `${secili.soruSayisi} soru var.` },
    {
      Ikon: Clock,
      metin: `${dakikaMetni(secili.sureDakika)} süren var. "Başla"ya bastığında süre başlar ve durmaz.`,
    },
    {
      Ikon: Scale,
      metin:
        yanlisGoturme === null
          ? "Netin, sınavın yanlış götürme kuralına göre hesaplanır; kuralı raporunda görürsün."
          : `${goturmeMetni(yanlisGoturme)} Emin olmadığın soruyu boş bırakmak bu yüzden önemli.`,
    },
    { Ikon: CircleSlash, metin: "İstediğin soruyu boş bırakabilirsin." },
    { Ikon: Repeat, metin: "Sorular arasında serbestçe gezebilir, önceki sorulara dönebilirsin." },
    {
      Ikon: LogOut,
      metin: "Çıkarsan kaldığın yerden devam edersin. Ama süre sen ekranda olmasan da işlemeye devam eder.",
    },
  ];

  return (
    <section aria-labelledby="kural-baslik">
      <Card tone="brand" className="p-5 sm:p-8">
        <p className="text-caption font-semibold tracking-wide text-brand-600 uppercase">
          {sinavAd} · {secili.ad}
        </p>
        <h2 id="kural-baslik" ref={kuralBasligi} tabIndex={-1} className="mt-1 font-display text-h2 font-semibold text-gray-800 outline-none">
          Başlamadan önce
        </h2>
        <ul className="mt-6 space-y-4">
          {kurallar.map(({ Ikon, metin }) => (
            <li key={metin} className="flex gap-3 text-body text-gray-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <Ikon className="size-4" aria-hidden />
              </span>
              <span className="pt-1">{metin}</span>
            </li>
          ))}
        </ul>

        {hata ? (
          <Alert
            variant={hata.kod === "ACIK_CHECKUP_VAR" ? "warning" : "error"}
            title={hata.kod === "ACIK_CHECKUP_VAR" ? "Yarım kalan bir check-up'ın var" : "Başlatılamadı"}
            className="mt-6"
            action={
              hata.kod === "ACIK_CHECKUP_VAR" && hata.checkupId ? (
                <ButtonLink href={`/test/${hata.checkupId}`} size="sm" endIcon={<ArrowRight className="rtl:rotate-180" />}>
                  Devam et
                </ButtonLink>
              ) : undefined
            }
          >
            {hata.kod === "ACIK_CHECKUP_VAR"
              ? "Yeni bir check-up başlatmadan önce onu bitirmelisin. Kaldığın yerden devam edebilirsin."
              : hata.mesaj}
          </Alert>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <Button variant="ghost" size="md" onClick={() => setSecili(null)} startIcon={<ArrowLeft className="rtl:rotate-180" />} disabled={bekliyor}>
            Başka tür seç
          </Button>
          <Button size="md" onClick={basla} loading={bekliyor} startIcon={<Play />} className="sm:ms-auto sm:min-w-48">
            Başla
          </Button>
        </div>
      </Card>
    </section>
  );
}
