"use client";

import { useState, useTransition, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createObjectiveAction,
  deleteObjectiveAction,
  updateObjectiveAction,
  type ObjectiveFormState,
} from "@/lib/checkup/actions/objectives";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field, FieldHint } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";
import { MONO } from "./ui";

/*
 * Formlar `<form action>` ile DEĞİL, onSubmit'te action'ı elle çağırarak
 * gönderiliyor. React 19 form eylemi bitince formu sıfırlıyor: kodu zaten
 * kullanılan bir kazanımda yazar "Bu kod zaten kullanılıyor" uyarısıyla
 * birlikte bütün yazdıklarını kaybediyordu. Elle çağırınca sıfırlama yok;
 * başarıda formu biz temizliyoruz.
 */

export interface TopicOpt {
  id: string;
  name: string;
  scope: string;
}

export interface ObjectiveRow {
  id: string;
  topicId: string;
  code: string;
  name: string;
  examScopes: string[];
  status: string;
  sortOrder: number;
  /** Yayındaki seviye-1 soru sayısı. 2'nin altı: seviye 1'de bu kazanım ölçülemez. */
  l1Count: number;
  questionCount: number;
}

const DURUM_SECENEKLERI = QUESTION_STATUSES.map((s) => ({ value: s, label: QUESTION_STATUS_LABEL[s] }));

function ScopeChecks({ secili, name = "examScopes" }: { secili: string[]; name?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EXAM_SCOPES.map((k) => (
        <label
          key={k}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-500"
        >
          <Checkbox name={name} value={k} defaultChecked={secili.includes(k)} />
          {EXAM_LABEL[k]}
        </label>
      ))}
    </div>
  );
}

/** Formu sıfırlamadan gönderir; gönderen düğmeyi (varsa) FormData'ya katar. */
function formVerisi(e: FormEvent<HTMLFormElement>): FormData {
  e.preventDefault();
  const submitter = (e.nativeEvent as SubmitEvent).submitter;
  return new FormData(e.currentTarget, submitter ?? undefined);
}

/** Yeni kazanım. */
export function ObjectiveCreateForm({ topics }: { topics: TopicOpt[] }) {
  const [state, setState] = useState<ObjectiveFormState>({});
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        const form = e.currentTarget;
        const fd = formVerisi(e);
        start(async () => {
          const r = await createObjectiveAction({}, fd);
          setState(r);
          if (!r.ok) return;
          toast.success(r.ok);
          // Konu, sınavlar ve durum kalsın; sıra bir artsın: aynı konuya art
          // arda kazanım girilir. Yalnızca kod ve ad temizlenir.
          const el = (ad: string) => form.elements.namedItem(ad);
          const kod = el("code");
          const isim = el("name");
          const sira = el("sortOrder");
          if (kod instanceof HTMLInputElement) kod.value = "";
          if (isim instanceof HTMLInputElement) isim.value = "";
          if (sira instanceof HTMLInputElement) sira.value = String((Number(fd.get("sortOrder")) || 0) + 1);
          if (kod instanceof HTMLInputElement) kod.focus();
        });
      }}
      className="space-y-5"
    >
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Konu" required error={state.fields?.topicId}>
        <Select name="topicId" required defaultValue="">
          <option value="">Seç…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {(EXAM_LABEL[t.scope] ?? t.scope) + " · " + t.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <Field label="Kod" required error={state.fields?.code} hint="Soru dosyalarında geçen kalıcı kod. Örn: TYT.PROB.03">
          <Input name="code" required maxLength={40} autoComplete="off" className={cx(MONO, "uppercase")} placeholder="TYT.PROB.03" />
        </Field>
        <Field label="Kazanım" required error={state.fields?.name} hint="Öğrencinin karnesinde bu cümle görünür.">
          <Input name="name" required maxLength={200} placeholder="Yüzde problemlerinde kâr-zarar oranını hesaplar" />
        </Field>
      </div>
      <fieldset>
        <legend className={cx(labelClass, "mb-1.5")}>Hangi sınavlarda ölçülür</legend>
        <ScopeChecks secili={[]} />
        <FieldHint>Hiçbiri seçilmezse konunun geçtiği her sınavda.</FieldHint>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Durum" hint="Yalnızca “Yayında” kazanımlar seviye 1'e girer.">
          <Select name="status" defaultValue="DRAFT" options={DURUM_SECENEKLERI} />
        </Field>
        <Field label="Sıra" hint="Konu içindeki sırası (karne düzeni).">
          <Input name="sortOrder" type="number" min={0} max={9999} defaultValue={0} />
        </Field>
      </div>
      <Button type="submit" loading={pending} startIcon={<Plus />}>
        {pending ? "Ekleniyor…" : "Kazanım ekle"}
      </Button>
    </form>
  );
}

/** Satır içi düzenleme: ad, kod, sınavlar, durum, sıra. */
export function ObjectiveRowEditor({ row, canEdit }: { row: ObjectiveRow; canEdit: boolean }) {
  const [acik, setAcik] = useState(false);
  const [state, setState] = useState<ObjectiveFormState>({});
  const [pending, start] = useTransition();
  const [silPending, startSil] = useTransition();
  const onayla = useOnay();

  if (!acik) {
    return (
      <div className="flex items-center gap-1">
        {canEdit ? (
          <>
            <Button
              variant="ghost"
              size="xs"
              startIcon={<Pencil />}
              onClick={() => {
                setState({});
                setAcik(true);
              }}
              aria-label={row.code + " kazanımını düzenle"}
            >
              Düzenle
            </Button>
            <Button
              variant="danger-outline"
              size="xs"
              loading={silPending}
              disabled={row.questionCount > 0}
              title={row.questionCount > 0 ? "Sorusu olan kazanım silinmez; arşivle." : "Sil"}
              onClick={async () => {
                const evet = await onayla({
                  title: row.code + " silinsin mi?",
                  description: "Kazanım kalıcı olarak silinir; sorusu yok.",
                  confirmLabel: "Sil",
                  tone: "danger",
                });
                if (!evet) return;
                startSil(async () => {
                  const r = await deleteObjectiveAction(row.id);
                  if (r.ok) toast.success(`${row.code} silindi.`);
                  else toast.error(r.error ?? "Silinemedi.");
                });
              }}
              aria-label={row.code + " kazanımını sil"}
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        const fd = formVerisi(e);
        start(async () => {
          const r = await updateObjectiveAction({}, fd);
          if (r.ok) {
            toast.success(row.code + " kaydedildi.");
            setAcik(false);
          } else {
            setState(r);
          }
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setAcik(false);
      }}
      className="mt-2 w-full space-y-3 rounded-xl border border-brand-100 bg-brand-25 p-3"
    >
      <input type="hidden" name="id" value={row.id} />
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Kod" error={state.fields?.code}>
          <Input name="code" defaultValue={row.code} required maxLength={40} autoComplete="off" compact className={cx(MONO, "uppercase")} />
        </Field>
        <Field label="Kazanım" error={state.fields?.name}>
          <Input
            name="name"
            defaultValue={row.name}
            required
            maxLength={200}
            compact
            // Düzenle'ye basınca doğrudan yazmaya başlanabilsin.
            autoFocus
          />
        </Field>
      </div>
      <fieldset>
        <legend className="sr-only">Hangi sınavlarda ölçülür</legend>
        <ScopeChecks secili={row.examScopes} />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <Select name="status" defaultValue={row.status} compact aria-label="Durum" options={DURUM_SECENEKLERI} />
        <Input name="sortOrder" type="number" min={0} max={9999} defaultValue={row.sortOrder} compact aria-label="Sıra" />
        <div className="flex gap-1">
          <Button type="submit" size="xs" loading={pending}>
            Kaydet
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setAcik(false)} aria-label="Düzenlemeyi kapat">
            <X aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  );
}
