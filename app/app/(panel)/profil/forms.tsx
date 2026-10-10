"use client";

import { useActionState, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
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
import { mailTercihAction, type AbonelikState } from "@/lib/actions/abonelik";
import { PasswordInput } from "@/components/ui/password-input";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { hintClass, labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";

const initial: ProfileState = {};

/** Aç/kapa düğmeleri (sınav, aşama): seçili marka mavisi, seçilmemiş beyaz. 44 px dokunma hedefi. */
function secimSinifi(secili: boolean) {
  return secili
    ? "border-brand-500 bg-brand-500 text-white"
    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100";
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? (
        <Alert variant="success" compact>
          {state.ok}
        </Alert>
      ) : null}
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad soyad" error={state.fields?.name}>
          <Input name="name" defaultValue={name} required />
        </Field>
        <Field label="E-posta" hint="E-posta değiştirilemez.">
          <Input value={email} disabled />
        </Field>
      </div>

      <Button type="submit" loading={pending}>
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
    <form action={formAction} className="space-y-6">
      {state.ok ? (
        <Alert variant="success" compact>
          {state.ok}
        </Alert>
      ) : null}
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}

      <input type="hidden" name="targetExam" value={sinav} />
      <input type="hidden" name="grade" value={sinif} />
      <input type="hidden" name="targetNet" value={hedef} />

      <fieldset>
        <legend className={labelClass}>Hazırlandığın sınav</legend>
        {/* Kaydırma şeridi odak çerçevesini kırpmasın: içte 4 px pay, dışta eksi pay (yer değişmez). */}
        <div className="scroll-x -m-1 mt-1 flex gap-2 p-1">
          {SECILEBILIR_SINAVLAR.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sinavSec(s)}
              aria-pressed={s === sinav}
              className={cx(
                "min-h-11 shrink-0 cursor-pointer touch-manipulation rounded-lg border px-4 text-sm font-semibold transition",
                secimSinifi(s === sinav)
              )}
            >
              {EXAMS[s].short}
            </button>
          ))}
        </div>
        <p className={hintClass}>
          Sınavı değiştirmek test kataloğunu ve önerileri değiştirir. Geçmiş sonuçların durur.
        </p>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Hangi aşamadasın?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {bilgi.grades.map((g) => (
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

      <fieldset>
        <legend className={labelClass}>Matematikte hedefin kaç net?</legend>
        <div className="mt-2 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={bilgi.mathQuestionCount}
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
        <p className={hintClass}>
          {bilgi.short} matematikte {bilgi.mathQuestionCount} soru var.
        </p>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Haftada kaç test?</legend>
        <div className="mt-2 flex gap-2">
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
                defaultChecked={n === (weeklyTestGoal ?? 1)}
                className="sr-only"
              />
              {n} test
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" loading={pending} disabled={!sinif}>
        {pending ? "Kaydediliyor…" : "Hedefi kaydet"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.ok ? (
        <Alert variant="success" compact>
          {state.ok}
        </Alert>
      ) : null}
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}

      <Field label="Mevcut parola" error={state.fields?.current}>
        <PasswordInput name="current" autoComplete="current-password" required />
      </Field>
      <Field label="Yeni parola" error={state.fields?.next} hint="En az 8 karakter.">
        <PasswordInput name="next" autoComplete="new-password" required minLength={8} />
      </Field>

      <Button type="submit" block loading={pending} startIcon={<KeyRound />}>
        {pending ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}

/** Güvenlik kartındaki "Parolayı değiştir": form kitin penceresinde açılır. */
export function PasswordDialogButton() {
  const { isOpen, openModal, closeModal } = useModal();

  return (
    <>
      <Button variant="outline" startIcon={<KeyRound />} onClick={openModal}>
        Parolayı değiştir
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        size="sm"
        title="Parolayı değiştir"
        description="Değiştirdiğinde diğer cihazlardaki oturumların kapanır"
      >
        <PasswordForm />
      </Modal>
    </>
  );
}

export function DeleteAccount() {
  const { isOpen, openModal, closeModal } = useModal();
  const [state, formAction, pending] = useActionState(deleteAccountAction, initial);

  return (
    <>
      {/* Dolu kırmızı yalnızca penceredeki son onayda; kartta çerçeveli. */}
      <Button variant="danger-outline" startIcon={<Trash2 />} onClick={openModal}>
        Hesabımı sil
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        size="sm"
        title="Hesabını silmek istediğine emin misin?"
        description="Bu işlem geri alınamaz."
      >
        <ul className="space-y-1.5 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-gray-700">
          <li>• Tüm test sonuçların ve konu haritan silinir</li>
          <li>• Erişim hakların iptal olur</li>
          <li>• Aynı e-postayla yeniden kayıt olsan da geçmişin geri gelmez</li>
        </ul>

        <form action={formAction} className="mt-5 space-y-5">
          <Field label="Onaylamak için parolanı yaz" error={state.fields?.password}>
            <PasswordInput name="password" autoComplete="current-password" required autoFocus />
          </Field>
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeModal} className="flex-1">
              Vazgeç
            </Button>
            <Button type="submit" variant="danger" loading={pending} startIcon={<Trash2 />} className="flex-1">
              {pending ? "Siliniyor…" : "Kalıcı olarak sil"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Haftalık posta
// ─────────────────────────────────────────────────────────────

const abonelikBaslangic: AbonelikState = {};

export function MailTercihForm({ optOut }: { optOut: boolean }) {
  const [state, formAction, pending] = useActionState(mailTercihAction, abonelikBaslangic);
  const acik = state.ok ? !state.kapali : !optOut;

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-between gap-4">
      <Checkbox
        name="haftalik"
        defaultChecked={acik}
        label="Haftalık koçluk postası"
        description="Her pazartesi o haftanın planı e-postana gelir. Parola ve hesap postaları bundan ayrı."
        wrapperClassName="min-w-0 grow basis-64"
      />
      <div className="flex items-center gap-3">
        {state.ok ? (
          <span role="status" className="text-theme-sm text-success-700">
            Kaydedildi.
          </span>
        ) : null}
        <Button type="submit" variant="outline" loading={pending}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}
