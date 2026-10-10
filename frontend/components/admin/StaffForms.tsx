"use client";

import { useState } from "react";
import { Send, UserPlus } from "lucide-react";
import { inviteStaffAction, updateStaffAction } from "@/lib/admin/actions";
import { ROLE_DESCRIPTION, ROLE_LABEL, STAFF_ROLES, type Staff, type StaffRole, type StaffUser } from "@/lib/admin/types";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field, FieldError } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Radio } from "@/components/tailadmin/form/Radio";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useFormAction } from "./useFormAction";

/**
 * Rol seçimi kart olarak: her rolün ne yapabildiği seçerken görünür.
 * Eskiden açılır listede "Yönetici — Her şey: personel ekler/siler…" gibi
 * uzun satırlardı; telefonda kesiliyordu.
 */
function RolSecimi({ varsayilan, hata }: { varsayilan: StaffRole; hata?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-gray-700">Rol</legend>
      <div className="grid gap-2">
        {STAFF_ROLES.map((r) => (
          <Radio key={r} name="role" value={r} defaultChecked={r === varsayilan} card label={ROLE_LABEL[r]} description={ROLE_DESCRIPTION[r]} />
        ))}
      </div>
      {hata ? <FieldError>{hata}</FieldError> : null}
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
    <form {...formProps} className="space-y-5">
      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.message}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad" error={state.fields?.first_name} required>
          <Input name="first_name" required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Soyad" error={state.fields?.last_name} required>
          <Input name="last_name" required maxLength={100} autoComplete="off" />
        </Field>
      </div>
      <Field label="E-posta" error={state.fields?.email} hint="Davet bu adrese gider; giriş de bununla yapılır." required>
        <Input name="email" type="email" required maxLength={255} autoComplete="off" />
      </Field>
      <RolSecimi varsayilan="editor" hata={state.fields?.role} />
      {!mailAcik ? (
        <Field
          label="Geçici parola"
          hint="E-posta gönderimi kapalı; davet yollanamıyor. Parolayı kişiye güvenli bir kanaldan ilet, ilk girişte değiştirsin."
          required
        >
          <Input name="password" type="password" minLength={10} required autoComplete="new-password" />
        </Field>
      ) : null}
      <Button type="submit" loading={pending} startIcon={mailAcik ? <Send /> : <UserPlus />}>
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
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="id" value={user.id} />
      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.message}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad" required>
          <Input name="first_name" defaultValue={user.first_name ?? ""} required maxLength={100} />
        </Field>
        <Field label="Soyad" required>
          <Input name="last_name" defaultValue={user.last_name ?? ""} required maxLength={100} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="E-posta" hint={yonetici ? undefined : "Yalnızca yönetici değiştirebilir."}>
          <Input name="email" type="email" defaultValue={user.email} readOnly={!yonetici} maxLength={255} />
        </Field>
        <Field label="Telefon" optional>
          <Input name="phone" type="tel" defaultValue={user.phone ?? ""} maxLength={20} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kullanıcı adı" optional hint="E-posta yerine bununla da girilebilir.">
          <Input name="username" defaultValue={user.username === user.email ? "" : user.username} maxLength={50} />
        </Field>
        <Field
          label="Rol"
          hint={rolKilitli ? (yonetici ? "Kendi yönetici rolünü düşüremezsin." : "Yalnızca yönetici değiştirebilir.") : ROLE_DESCRIPTION[rol]}
        >
          <Select name="role" value={rol} onChange={(e) => setRol(e.target.value as StaffRole)} disabled={rolKilitli}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {/*
       * Kendi hesabında kutucuk kilitli. Kilitli (disabled) alan formla
       * GİTMEZ: eskiden bu yüzden "aktif değil" sayılıyor ve kişi kendi
       * kaydını hiç kaydedemiyordu ("Kendi hesabınızı pasifleştiremezsiniz").
       */}
      {kendisi ? <input type="hidden" name="is_active" value="on" /> : null}
      <Checkbox
        name={kendisi ? undefined : "is_active"}
        defaultChecked={user.is_active}
        disabled={kendisi}
        label="Hesap aktif"
        description="Kapalıysa giriş yapamaz; açık oturumları da düşer."
      />
      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
