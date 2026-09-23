"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, GraduationCap, Target } from "lucide-react";
import { tanismaAction, type TanismaState } from "@/lib/actions/onboarding";
import {
  EXAMS,
  GRADE_LABEL,
  SECILEBILIR_SINAVLAR,
  type ExamScopeValue,
  type GradeValue,
} from "@/lib/exams";
import { Alert, Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

const initial: TanismaState = {};

/**
 * İki adım: (1) sınav, (2) sınıf + hedef net.
 *
 * Tek ekranda altı sınav kartı + sınıf + hedef göstermek telefonda uzun bir
 * kaydırma oluyor; üç ayrı sayfa ise üç yükleme demek. İkisi arası: seçim
 * yapılınca ikinci adım açılıyor, geri dönmek tek dokunuş.
 */
export function TanismaForm({
  mevcutSinav,
  mevcutSinif,
  mevcutHedef,
}: {
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

  const sinavSec = (s: ExamScopeValue) => {
    setSinav(s);
    setSinif(EXAMS[s].grades.length === 1 ? EXAMS[s].grades[0] : "");
    setHedef(EXAMS[s].defaultTargetNet);
    setAdim(2);
  };

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      {/* Sunucuya giden değerler — görünen denetimlerden bağımsız. */}
      <input type="hidden" name="targetExam" value={sinav ?? ""} />
      <input type="hidden" name="grade" value={sinif} />
      <input type="hidden" name="targetNet" value={hedef} />

      {adim === 1 ? (
        <ul className="grid gap-2.5">
          {SECILEBILIR_SINAVLAR.map((s) => {
            const e = EXAMS[s];
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => sinavSec(s)}
                  className={cn(
                    "flex w-full touch-manipulation items-center gap-3 rounded-2xl border bg-surface p-4 text-start transition",
                    "active:scale-[0.995] [@media(hover:hover)]:hover:border-brand/50",
                    sinav === s ? "border-brand bg-brand-wash/40" : "border-line"
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-caption font-bold text-brand">
                    {e.short.split(" ")[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* Rozette zaten kısaltma var; başlıkta tekrar etmiyoruz
                        ("TYT — Temel Yeterlilik Testi" telefonda iki satıra düşüyordu). */}
                    <span className="block text-body font-semibold text-ink">
                      {e.name.includes("—") ? e.name.split("—")[1].trim() : e.name}
                    </span>
                    <span className="block text-caption text-ink-faint">
                      {e.audience} · matematik {e.mathQuestionCount} soru · {e.season}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-5">
          {/* Seçilen sınav — değiştirmek tek dokunuş */}
          <Card className="flex items-start gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-caption font-bold text-white">
              {bilgi?.short.split(" ")[0]}
            </span>
            <span className="min-w-0 flex-1">
              {/* Rozette kısaltma zaten var; başlıkta tekrar etmiyoruz. */}
              <span className="block text-body font-semibold text-ink">
                {bilgi && bilgi.name.includes("—") ? bilgi.name.split("—")[1].trim() : bilgi?.name}
              </span>
              <span className="mt-0.5 block text-caption leading-snug text-ink-faint">
                {bilgi?.blankAdvice}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAdim(1)}
              className="-me-1 shrink-0 rounded-lg px-3 py-2 text-caption font-semibold text-brand active:bg-brand-wash"
            >
              Değiştir
            </button>
          </Card>

          {/* Sınıf */}
          <fieldset>
            <legend className="flex items-center gap-2 text-body font-semibold text-ink">
              <GraduationCap className="size-4 text-brand" /> Hangi aşamadasın?
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {siniflar.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSinif(g)}
                  aria-pressed={sinif === g}
                  className={cn(
                    "min-h-11 touch-manipulation rounded-xl border px-4 text-body font-medium transition",
                    sinif === g
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-ink-soft active:bg-surface-sunk"
                  )}
                >
                  {GRADE_LABEL[g]}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Hedef net */}
          <fieldset>
            <legend className="flex items-center gap-2 text-body font-semibold text-ink">
              <Target className="size-4 text-brand" /> Matematikte hedefin kaç net?
            </legend>
            <p className="mt-1 text-caption text-ink-soft">
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
                className="h-11 flex-1 accent-[var(--brand)]"
              />
              <output className="font-display tabular w-16 shrink-0 text-center text-num-sm font-bold text-ink">
                {hedef}
              </output>
            </div>
          </fieldset>

          {/* Haftalık hedef */}
          <fieldset>
            <legend className="text-body font-semibold text-ink">Haftada kaç test?</legend>
            <p className="mt-1 text-caption text-ink-soft">
              Haftada bir check-up çoğu öğrenci için doğru tempo: ölçüm için yeterli,
              çalışmayı bölmeyecek kadar seyrek.
            </p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3].map((n) => (
                <label
                  key={n}
                  className={cn(
                    "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-body font-medium transition",
                    "has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white",
                    "border-line bg-surface text-ink-soft"
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

          <Button type="submit" size="lg" block disabled={pending || !sinif}>
            {pending ? "Kaydediliyor…" : "Hazırım, başlayalım"} <Check />
          </Button>
          {!sinif ? (
            <p className="text-center text-caption text-ink-faint">Devam etmek için aşamanı seç.</p>
          ) : null}
        </div>
      )}
    </form>
  );
}
