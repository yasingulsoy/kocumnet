"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, GraduationCap, Target } from "lucide-react";
import { tanismaAction, type TanismaState } from "@/lib/actions/onboarding";
import {
  EXAMS,
  GRADE_LABEL,
  SECILEBILIR_SINAVLAR,
  type ExamScopeValue,
  type GradeValue,
} from "@/lib/exams";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

const initial: TanismaState = {};

/** Aç/kapa düğmesi: seçili marka mavisi, seçilmemiş beyaz. 44 px dokunma hedefi. */
function secimSinifi(secili: boolean) {
  return secili
    ? "border-brand-500 bg-brand-500 text-white"
    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100";
}

/** "TYT — Temel Yeterlilik Testi" → "Temel Yeterlilik Testi": kısaltma zaten rozette. */
function uzunAd(ad: string) {
  return ad.includes("—") ? ad.split("—")[1].trim() : ad;
}

/**
 * İki adım: (1) sınav, (2) sınıf + hedef net.
 *
 * Tek ekranda altı sınav kartı + sınıf + hedef göstermek telefonda uzun bir
 * kaydırma oluyor; üç ayrı sayfa ise üç yükleme demek. İkisi arası: seçim
 * yapılınca ikinci adım açılıyor, geri dönmek tek dokunuş.
 *
 * Odak: adım değişince eski düğme DOM'dan kalkıyor ve odak sayfanın başına
 * düşüyordu (ekran okuyucu ve klavye kullanan öğrenci nerede olduğunu
 * kaybediyordu). Sınav seçilince ikinci adımın başlığına, "Değiştir"e
 * basılınca seçili sınavın düğmesine odak verilir.
 *
 * `hazirSinavlar`: yayında testi olan sınavlar. Olmayan "Yakında" etiketiyle
 * görünür, seçilebilir; ikinci adımda bunun ne demek olduğu yazar.
 */
export function TanismaForm({
  hazirSinavlar,
  mevcutSinav,
  mevcutSinif,
  mevcutHedef,
}: {
  hazirSinavlar: readonly string[];
  mevcutSinav: string | null;
  mevcutSinif: string | null;
  mevcutHedef: number | null;
}) {
  const [state, formAction, pending] = useActionState(tanismaAction, initial);

  const [sinav, setSinav] = useState<ExamScopeValue | null>(
    (SECILEBILIR_SINAVLAR as string[]).includes(String(mevcutSinav))
      ? (mevcutSinav as ExamScopeValue)
      : null
  );
  const [adim, setAdim] = useState<1 | 2>(mevcutSinav ? 2 : 1);

  const bilgi = sinav ? EXAMS[sinav] : null;
  const siniflar: readonly GradeValue[] = bilgi?.grades ?? [];

  const [sinif, setSinif] = useState<string>(
    mevcutSinif && siniflar.includes(mevcutSinif as GradeValue) ? mevcutSinif : ""
  );
  const [hedef, setHedef] = useState<number>(mevcutHedef ?? 0);

  // Odak yalnızca öğrenci adım değiştirdiğinde taşınır; sayfa açılışında değil.
  const odakTasi = useRef(false);
  const ikinciBaslik = useRef<HTMLHeadingElement>(null);
  const sinavListesi = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!odakTasi.current) return;
    odakTasi.current = false;
    if (adim === 2) ikinciBaslik.current?.focus();
    else sinavListesi.current?.querySelector<HTMLButtonElement>("[aria-pressed='true'], button")?.focus();
  }, [adim]);

  const sinavSec = (s: ExamScopeValue) => {
    setSinav(s);
    setSinif(EXAMS[s].grades.length === 1 ? EXAMS[s].grades[0] : "");
    setHedef(EXAMS[s].defaultTargetNet);
    odakTasi.current = true;
    setAdim(2);
  };
  const yakinda = (s: string) => !hazirSinavlar.includes(s);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      {/* Sunucuya giden değerler — görünen denetimlerden bağımsız. */}
      <input type="hidden" name="targetExam" value={sinav ?? ""} />
      <input type="hidden" name="grade" value={sinif} />
      <input type="hidden" name="targetNet" value={hedef} />

      {adim === 1 ? (
        <ul ref={sinavListesi} className="grid gap-3">
          {SECILEBILIR_SINAVLAR.map((s) => {
            const e = EXAMS[s];
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => sinavSec(s)}
                  aria-pressed={sinav === s}
                  className={cx(
                    "flex w-full cursor-pointer touch-manipulation items-center gap-4 rounded-2xl border p-4 text-start transition",
                    "hover:shadow-theme-md active:bg-gray-50",
                    sinav === s ? "border-brand-500 bg-brand-25" : "border-gray-200 bg-white hover:border-brand-300"
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-theme-sm font-bold text-brand-500">
                    {e.short.split(" ")[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Rozette zaten kısaltma var; başlıkta tekrar etmiyoruz
                        ("TYT — Temel Yeterlilik Testi" telefonda iki satıra düşüyordu). */}
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-base font-semibold text-gray-800">{uzunAd(e.name)}</span>
                      {yakinda(s) ? (
                        <Badge size="sm" color="light">
                          Yakında
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-theme-sm text-gray-500">
                      {e.audience} · matematik {e.mathQuestionCount} soru · {e.season}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-gray-400 rtl:rotate-180" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-5">
          {/* İkinci adımın başlığı: sınav seçilince odak buraya gelir (tabIndex -1: yalnızca programla). */}
          <h2
            ref={ikinciBaslik}
            tabIndex={-1}
            className="font-display text-lg font-semibold text-gray-800 focus:outline-hidden!"
          >
            Biraz da seni tanıyalım
          </h2>
          {/* Seçilen sınav — değiştirmek tek dokunuş */}
          <Card tone="brand" className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-theme-sm font-bold text-white">
              {bilgi?.short.split(" ")[0]}
            </span>
            <span className="min-w-0 flex-1">
              {/* Rozette kısaltma zaten var; başlıkta tekrar etmiyoruz. */}
              <span className="block text-base font-semibold text-gray-800">{bilgi ? uzunAd(bilgi.name) : null}</span>
              <span className="mt-0.5 block text-theme-sm leading-snug text-gray-500">{bilgi?.blankAdvice}</span>
            </span>
            <Button
              variant="soft"
              size="xs"
              onClick={() => {
                odakTasi.current = true;
                setAdim(1);
              }}
              className="shrink-0"
            >
              Değiştir
            </Button>
          </Card>

          {/* Testi henüz olmayan sınav: bilerek seçsin, pano boş gelince şaşırmasın. */}
          {sinav && yakinda(sinav) ? (
            <Alert variant="info">
              {bilgi?.short} testleri hazırlanıyor. Yine de seçebilirsin: testler hazır olunca ana sayfanda görünür, bu
              arada diğer sınavların testlerini çözebilirsin.
            </Alert>
          ) : null}

          {/* Üç soru tek kartta, aralarında ince çizgi. Dolgu sarmalayıcıda:
              dolgulu fieldset'te legend dolgunun dışına (kenara) çizilir. */}
          <Card className="divide-y divide-gray-100">
            {/* Sınıf */}
            <div className="p-5 sm:p-6">
              <fieldset>
                <legend className="flex items-center gap-2 text-base font-semibold text-gray-800">
                  <GraduationCap className="size-4 text-brand-500" aria-hidden /> Hangi aşamadasın?
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {siniflar.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSinif(g)}
                      aria-pressed={sinif === g}
                      className={cx(
                        "min-h-11 cursor-pointer touch-manipulation rounded-lg border px-4 text-sm font-medium transition",
                        secimSinifi(sinif === g)
                      )}
                    >
                      {GRADE_LABEL[g]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Hedef net */}
            <div className="p-5 sm:p-6">
              <fieldset>
                <legend className="flex items-center gap-2 text-base font-semibold text-gray-800">
                  <Target className="size-4 text-brand-500" aria-hidden /> Matematikte hedefin kaç net?
                </legend>
                <p className="mt-1 text-theme-sm text-gray-500">
                  {bilgi?.short} matematikte {bilgi?.mathQuestionCount} soru var. Hedefini sonra
                  profilinden değiştirebilirsin.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={bilgi?.mathQuestionCount ?? 40}
                    step={1}
                    value={hedef}
                    onChange={(e) => setHedef(Number(e.target.value))}
                    aria-label="Hedef net"
                    className="h-11 min-w-0 flex-1 cursor-pointer accent-brand-500"
                  />
                  <output className="tabular w-16 shrink-0 text-center font-display text-title-sm font-semibold text-gray-800">
                    {hedef}
                  </output>
                </div>
              </fieldset>
            </div>

            {/* Haftalık hedef */}
            <div className="p-5 sm:p-6">
              <fieldset>
                <legend className="text-base font-semibold text-gray-800">Haftada kaç test?</legend>
                <p className="mt-1 text-theme-sm text-gray-500">
                  Haftada bir check-up çoğu öğrenci için doğru tempo: ölçüm için yeterli,
                  çalışmayı bölmeyecek kadar seyrek.
                </p>
                <div className="mt-3 flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <label
                      key={n}
                      className={cx(
                        "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition",
                        "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                        "has-checked:border-brand-500 has-checked:bg-brand-500 has-checked:text-white",
                        // Radyo görünmez: klavye odağı etiketin çerçevesinde görünsün.
                        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500"
                      )}
                    >
                      <input
                        type="radio"
                        name="weeklyTestGoal"
                        value={n}
                        defaultChecked={n === 1}
                        className="sr-only"
                      />
                      {n} test
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Card>

          <Button
            type="submit"
            size="md"
            block
            loading={pending}
            disabled={!sinif}
            endIcon={pending ? undefined : <Check />}
          >
            {pending ? "Kaydediliyor…" : "Hazırım, başlayalım"}
          </Button>
          {!sinif ? (
            <p className="text-center text-theme-sm text-gray-500">Devam etmek için aşamanı seç.</p>
          ) : null}
        </div>
      )}
    </form>
  );
}
