"use client";

import { useState } from "react";
import { Loader2, Send, UserPlus } from "lucide-react";
import { inviteStaffAction, updateStaffAction } from "@/lib/admin/actions";
import { ROLE_DESCRIPTION, ROLE_LABEL, STAFF_ROLES, type Staff, type StaffRole, type StaffUser } from "@/lib/admin/types";
import { Button, CHECKBOX_CLASS, Field, INPUT_CLASS, Notice, SELECT_CLASS, cn } from "./ui";
import { useFormAction } from "./useFormAction";

/**
 * Rol seçimi kart olarak: her rolün ne yapabildiği seçerken görünür.
 * Eskiden açılır listede "Yönetici — Her şey: personel ekler/siler…" gibi
 * uzun satırlardı; telefonda kesiliyordu.
 */
function RolSecimi({ varsayilan, hata }: { varsayilan: StaffRole; hata?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-caption font-medium text-ink">Rol</legend>
      <div className="grid gap-2">
        {STAFF_ROLES.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:bg-surface-hover has-checked:border-brand has-checked:bg-brand-wash"
          >
            <input type="radio" name="role" value={r} defaultChecked={r === varsayilan} className="mt-1 size-4 accent-brand" />
            <span className="min-w-0">
              <span className="block text-caption font-semibold text-ink">{ROLE_LABEL[r]}</span>
              <span className="block text-micro leading-relaxed text-ink-soft">{ROLE_DESCRIPTION[r]}</span>
            </span>
          </label>
        ))}
      </div>
      {hata ? <span className="mt-1.5 block text-caption text-bad">{hata}</span> : null}
    </fieldset>
  );
}

/**
 * Yeni personel. Varsayılan yol DAVET: parola yazılmaz, kişiye e-postayla
 * parola belirleme bağlantısı gider. Parola alanı yalnızca SMTP yokken
 * (geçici parola) kullanılır.
 */
export function InviteForm({ mailAcik }: { mailAcik: boolean }) {
  // Hatada yazılanlar kalır (ör. "bu e-posta kullanılıyor"); başarıda form temizlenir.
  const { state, pending, formProps } = useFormAction(inviteStaffAction, { sifirlaBasarida: true });

  return (
    <form {...formProps} className="space-y-4">
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" error={state.fields?.first_name}>
          <input name="first_name" required maxLength={100} autoComplete="off" className={INPUT_CLASS} />
        </Field>
        <Field label="Soyad" error={state.fields?.last_name}>
          <input name="last_name" required maxLength={100} autoComplete="off" className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="E-posta" error={state.fields?.email} hint="Davet bu adrese gider; giriş de bununla yapılır.">
        <input name="email" type="email" required maxLength={255} autoComplete="off" className={INPUT_CLASS} />
      </Field>
      <RolSecimi varsayilan="editor" hata={state.fields?.role} />
      {!mailAcik ? (
        <Field label="Geçici parola" hint="E-posta gönderimi kapalı; davet yollanamıyor. Parolayı kişiye güvenli bir kanaldan ilet, ilk girişte değiştirsin.">
          <input name="password" type="password" minLength={10} required autoComplete="new-password" className={INPUT_CLASS} />
        </Field>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : mailAcik ? <Send /> : <UserPlus />}
        {pending ? "Gönderiliyor…" : mailAcik ? "Davet gönder" : "Hesap aç"}
      </Button>
    </form>
  );
}

export function StaffEditForm({ user, me }: { user: StaffUser; me: Staff }) {
  const { state, pending, formProps } = useFormAction(updateStaffAction);
  const yonetici = me.role === "admin";
  const kendisi = me.id === user.id;
  const rolKilitli = !yonetici || (kendisi && user.role === "admin");
  const [rol, setRol] = useState<StaffRole>(user.role);

  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad">
          <input name="first_name" defaultValue={user.first_name ?? ""} required maxLength={100} className={INPUT_CLASS} />
        </Field>
        <Field label="Soyad">
          <input name="last_name" defaultValue={user.last_name ?? ""} required maxLength={100} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-posta" hint={yonetici ? undefined : "Yalnızca yönetici değiştirebilir."}>
          <input name="email" type="email" defaultValue={user.email} readOnly={!yonetici} maxLength={255} className={cn(INPUT_CLASS, !yonetici && "bg-surface-sunk")} />
        </Field>
        <Field label="Telefon">
          <input name="phone" type="tel" defaultValue={user.phone ?? ""} maxLength={20} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kullanıcı adı" hint="İsteğe bağlı; e-posta yerine bununla da girilebilir.">
          <input name="username" defaultValue={user.username === user.email ? "" : user.username} maxLength={50} className={INPUT_CLASS} />
        </Field>
        <Field
          label="Rol"
          hint={
            rolKilitli
              ? yonetici
                ? "Kendi yönetici rolünü düşüremezsin."
                : "Yalnızca yönetici değiştirebilir."
              : ROLE_DESCRIPTION[rol]
          }
        >
          <select
            name="role"
            value={rol}
            onChange={(e) => setRol(e.target.value as StaffRole)}
            disabled={rolKilitli}
            className={SELECT_CLASS}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {/*
       * Kendi hesabında kutucuk kilitli. Kilitli (disabled) alan formla
       * GİTMEZ: eskiden bu yüzden "aktif değil" sayılıyor ve kişi kendi
       * kaydını hiç kaydedemiyordu ("Kendi hesabınızı pasifleştiremezsiniz").
       */}
      {kendisi ? <input type="hidden" name="is_active" value="on" /> : null}
      <label className="flex items-start gap-3">
        <input type="checkbox" name={kendisi ? undefined : "is_active"} defaultChecked={user.is_active} disabled={kendisi} className={cn(CHECKBOX_CLASS, "mt-0.5")} />
        <span>
          <span className="block text-caption font-medium text-ink">Hesap aktif</span>
          <span className="block text-micro text-ink-faint">Kapalıysa giriş yapamaz; açık oturumları da düşer.</span>
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </form>
  );
}
