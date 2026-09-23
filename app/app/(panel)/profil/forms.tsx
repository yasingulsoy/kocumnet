"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type ProfileState,
} from "@/lib/actions/profile";
import { hedefGuncelleAction, type TanismaState } from "@/lib/actions/onboarding";
import {
  EXAMS,
  GRADE_LABEL,
  SECILEBILIR_SINAVLAR,
  type ExamScopeValue,
  type GradeValue,
} from "@/lib/exams";
import { Alert, Button, Field, INPUT_CLASS } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const initial: ProfileState = {};

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad soyad" error={state.fields?.name}>
          <input name="name" defaultValue={name} required className={INPUT_CLASS} />
        </Field>
        <Field label="E-posta" hint="E-posta değiştirilemez.">
          <input value={email} disabled className={cn(INPUT_CLASS, "bg-surface-sunk text-ink-soft")} />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}

/**
 * Hedef kartı — sınav, aşama, hedef net ve haftalık tempo.
 *
 * Tanışma ekranının kalıcı hâli. Ayrı bir form olmasının sebebi: bu dört
 * alan birbirine bağlı (sınav değişince geçerli sınıflar ve hedefin üst
 * sınırı değişiyor) ve hepsi tek bir sunucu eyleminde doğrulanıyor.
 */
export function HedefForm({
  targetExam,
  grade,
  targetNet,
  weeklyTestGoal,
}: {
  targetExam: string | null;
  grade: string | null;
  targetNet: number | null;
  weeklyTestGoal: number | null;
}) {
  const [state, formAction, pending] = useActionState<TanismaState, FormData>(
    hedefGuncelleAction,
    {}
  );

  const [sinav, setSinav] = useState<ExamScopeValue>(
    (SECILEBILIR_SINAVLAR as readonly string[]).includes(String(targetExam))
      ? (targetExam as ExamScopeValue)
      : SECILEBILIR_SINAVLAR[0]
  );
  const bilgi = EXAMS[sinav];

  const [sinif, setSinif] = useState<string>(
    grade && bilgi.grades.includes(grade as GradeValue) ? grade : ""
  );
  const [hedef, setHedef] = useState<number>(
    Math.min(targetNet ?? bilgi.defaultTargetNet, bilgi.mathQuestionCount)
  );

  function sinavSec(s: ExamScopeValue) {
    setSinav(s);
    // Yeni sınavda geçersiz kalan seçimleri düzelt: 8. sınıf seçiliyken
    // ALES'e geçen birine "8. sınıf" yazılı kalmamalı.
    setSinif(EXAMS[s].grades.length === 1 ? EXAMS[s].grades[0] : "");
    setHedef(Math.min(hedef, EXAMS[s].mathQuestionCount) || EXAMS[s].defaultTargetNet);
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      <input type="hidden" name="targetExam" value={sinav} />
      <input type="hidden" name="grade" value={sinif} />
      <input type="hidden" name="targetNet" value={hedef} />

      <fieldset>
        <legend className="text-caption font-medium text-ink">Hazırlandığın sınav</legend>
        <div className="scroll-x mt-2 flex gap-2">
          {SECILEBILIR_SINAVLAR.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sinavSec(s)}
              aria-pressed={s === sinav}
              className={cn(
                "min-h-11 shrink-0 touch-manipulation rounded-xl border px-4 text-body font-semibold transition",
                s === sinav
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-soft active:bg-surface-sunk"
              )}
            >
              {EXAMS[s].short}
            </button>
          ))}
        </div>
        <p className="mt-2 text-micro text-ink-faint">
          Sınavı değiştirmek test kataloğunu ve önerileri değiştirir. Geçmiş sonuçların durur.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-caption font-medium text-ink">Hangi aşamadasın?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {bilgi.grades.map((g) => (
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

      <fieldset>
        <legend className="text-caption font-medium text-ink">
          Matematikte hedefin kaç net?
        </legend>
        <div className="mt-2 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={bilgi.mathQuestionCount}
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
        <p className="mt-1 text-micro text-ink-faint">
          {bilgi.short} matematikte {bilgi.mathQuestionCount} soru var.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-caption font-medium text-ink">Haftada kaç test?</legend>
        <div className="mt-2 flex gap-2">
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
                defaultChecked={n === (weeklyTestGoal ?? 1)}
                className="sr-only"
              />
              {n} test
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending || !sinif}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Kaydediliyor…" : "Hedefi kaydet"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mevcut parola" error={state.fields?.current}>
          <PasswordInput name="current" autoComplete="current-password" required />
        </Field>
        <Field label="Yeni parola" error={state.fields?.next} hint="En az 8 karakter.">
          <PasswordInput name="next" autoComplete="new-password" required minLength={8} />
        </Field>
      </div>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}

export function DeleteAccount() {
  const [acik, setAcik] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccountAction, initial);

  return (
    <>
      <Button variant="danger" onClick={() => setAcik(true)}>
        <Trash2 /> Hesabımı sil
      </Button>

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        title="Hesabını silmek istediğine emin misin?"
        description="Bu işlem geri alınamaz."
      >
        <ul className="space-y-1.5 rounded-xl bg-bad-wash p-4 text-sm text-ink-soft">
          <li>• Tüm test sonuçların ve konu haritan silinir</li>
          <li>• Erişim hakların iptal olur</li>
          <li>• Aynı e-postayla yeniden kayıt olsan da geçmişin geri gelmez</li>
        </ul>

        <form action={formAction} className="mt-5 space-y-4">
          <Field label="Onaylamak için parolanı yaz" error={state.fields?.password}>
            <PasswordInput name="password" autoComplete="current-password" required autoFocus />
          </Field>
          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setAcik(false)} className="flex-1">
              Vazgeç
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="flex-1 bg-bad-fill text-white shadow-none hover:bg-bad"
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {pending ? "Siliniyor…" : "Kalıcı olarak sil"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
