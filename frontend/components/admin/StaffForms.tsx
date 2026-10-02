"use client";

import { useActionState } from "react";
import { Loader2, Send, UserPlus } from "lucide-react";
import { inviteStaffAction, updateStaffAction } from "@/lib/admin/actions";
import { ROLE_DESCRIPTION, ROLE_LABEL, STAFF_ROLES, type FormState, type Staff, type StaffUser } from "@/lib/admin/types";
import { Button, CHECKBOX_CLASS, Field, INPUT_CLASS, Notice, SELECT_CLASS, cn } from "./ui";

const initial: FormState = {};

/**
 * Yeni personel. Varsayılan yol DAVET: parola yazılmaz, kişiye e-postayla
 * parola belirleme bağlantısı gider. Parola alanı yalnızca SMTP yokken
 * (geçici parola) kullanılır.
 */
export function InviteForm({ mailAcik }: { mailAcik: boolean }) {
  const [state, action, pending] = useActionState(inviteStaffAction, initial);

  return (
    <form action={action} className="space-y-4" key={state.ok ? "sifirla" : "form"}>
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" error={state.fields?.first_name}>
          <input name="first_name" required maxLength={100} className={INPUT_CLASS} />
        </Field>
        <Field label="Soyad" error={state.fields?.last_name}>
          <input name="last_name" required maxLength={100} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="E-posta" error={state.fields?.email} hint="Davet bu adrese gider; giriş de bununla yapılır.">
        <input name="email" type="email" required maxLength={255} className={INPUT_CLASS} />
      </Field>
      <Field label="Rol" error={state.fields?.role}>
        <select name="role" defaultValue="editor" className={SELECT_CLASS}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]} — {ROLE_DESCRIPTION[r]}
            </option>
          ))}
        </select>
      </Field>
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
  const [state, action, pending] = useActionState(updateStaffAction, initial);
  const yonetici = me.role === "admin";
  const kendisi = me.id === user.id;

  return (
    <form action={action} className="space-y-4">
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
          <input name="phone" defaultValue={user.phone ?? ""} maxLength={20} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kullanıcı adı" hint="İsteğe bağlı; e-posta yerine bununla da girilebilir.">
          <input name="username" defaultValue={user.username === user.email ? "" : user.username} maxLength={50} className={INPUT_CLASS} />
        </Field>
        <Field label="Rol" hint={yonetici ? (kendisi ? "Kendi yönetici rolünü düşüremezsin." : undefined) : "Yalnızca yönetici değiştirebilir."}>
          <select name="role" defaultValue={user.role} disabled={!yonetici || (kendisi && user.role === "admin")} className={SELECT_CLASS}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="is_active" defaultChecked={user.is_active} disabled={kendisi} className={cn(CHECKBOX_CLASS, "mt-0.5")} />
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
