"use client";

import { useActionState, useTransition } from "react";
import toast from "react-hot-toast";
import { KeyRound } from "lucide-react";
import {
  grantEntitlementAction,
  revokeEntitlementAction,
  type GrantState,
} from "@/lib/checkup/actions/students";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

const initial: GrantState = {};

/**
 * Erişim hakkı ver.
 *
 * İki satış biçimi tek formdan çıkıyor:
 *   paket seç + süresiz  → tek seferlik alım (o paket, süresiz)
 *   "Tüm paketler" + gün → abonelik
 */
export function GrantForm({
  userId,
  packages,
}: {
  userId: string;
  /** Yalnızca ücretli paketler — ücretsiz pakete hak vermenin anlamı yok. */
  packages: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(grantEntitlementAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />

      {state.error ? <Alert variant="error" compact>{state.error}</Alert> : null}
      {state.ok ? <Alert variant="success" compact>{state.ok}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kapsam">
          <Select name="packageId" defaultValue={packages[0]?.id ?? "all"}>
            <option value="all">Tüm paketler (abonelik)</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Süre">
          <Select name="days" defaultValue="0">
            <option value="0">Süresiz</option>
            <option value="30">30 gün</option>
            <option value="90">90 gün</option>
            <option value="180">180 gün</option>
            <option value="365">1 yıl</option>
          </Select>
        </Field>
      </div>

      <Field label="Not" optional hint="Ör. havale dekont no, promosyon kodu. Uyuşmazlıkta kayıt olur.">
        <Input name="note" maxLength={200} placeholder="Havale — 21.09.2026" />
      </Field>

      <Button type="submit" size="xs" loading={pending} startIcon={<KeyRound />}>
        {pending ? "Veriliyor…" : "Erişim hakkı ver"}
      </Button>
    </form>
  );
}

/** Hakkı geri al. Satır silinmiyor, revokedAt işaretleniyor (kayıt kalsın). */
export function RevokeButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const onayla = useOnay();

  return (
    <Button
      variant="danger-outline"
      size="xs"
      loading={pending}
      onClick={async () => {
        const evet = await onayla({
          title: `"${label}" erişimi geri alınsın mı?`,
          description: "Öğrenci bu kapsamda yeni test başlatamaz. Hak silinmez; kim, ne zaman geri aldı kayıtta kalır.",
          confirmLabel: "Geri al",
          tone: "danger",
        });
        if (!evet) return;
        start(async () => {
          const res = await revokeEntitlementAction(id);
          if (res.ok) toast.success("Erişim geri alındı.");
          else toast.error(res.error ?? "Geri alınamadı.");
        });
      }}
    >
      Geri al
    </Button>
  );
}
