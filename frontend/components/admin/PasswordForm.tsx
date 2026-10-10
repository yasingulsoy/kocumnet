"use client";

import { KeyRound } from "lucide-react";
import { changePasswordAction } from "@/lib/admin/actions";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";
import { useFormAction } from "./useFormAction";

export function PasswordForm() {
  // Başarıda alanlar temizlenir; hatada (ör. "mevcut parola hatalı") yeni parola silinmez.
  const { state, pending, formProps } = useFormAction(changePasswordAction, { sifirlaBasarida: true });

  return (
    <form {...formProps} className="space-y-5">
      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.message}</Alert> : null}
      <Field label="Mevcut parola" required>
        <Input name="mevcut" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Yeni parola" hint="En az 10 karakter. Uzun bir cümle, karmaşık kısa bir paroladan daha güçlüdür." required>
        <Input name="yeni" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </Field>
      <Field label="Yeni parola (tekrar)" error={state.fields?.yeni2} required>
        <Input name="yeni2" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </Field>
      <Button type="submit" loading={pending} startIcon={<KeyRound />}>
        {pending ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}

/**
 * TailAdmin'in profil sayfasındaki "Change Password" düğmesi: form bir
 * pencerede açılır. Pencere kapanınca form da kapanır (bir dahaki açılış temiz).
 */
export function PasswordDialogButton() {
  const { isOpen, openModal, closeModal } = useModal();
  return (
    <>
      <Button variant="outline" size="xs" startIcon={<KeyRound />} onClick={openModal}>
        Parolayı değiştir
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        size="sm"
        title="Parolayı değiştir"
        description="Değişiklikten sonra diğer cihazlardaki oturumlar kapanır; bu cihaz açık kalır."
      >
        <PasswordForm />
      </Modal>
    </>
  );
}
