"use client";

import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createObjectiveAction,
  deleteObjectiveAction,
  updateObjectiveAction,
  type ObjectiveFormState,
} from "@/lib/checkup/actions/objectives";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { Field, INPUT_CLASS, MONO, Notice, SELECT_CLASS, buttonClass } from "./ui";

const initial: ObjectiveFormState = {};

export const EXAM_SCOPE_LABEL: Record<string, string> = {
  LGS: "LGS",
  TYT: "TYT",
  AYT: "AYT",
  KPSS_LISANS: "KPSS Lisans",
  KPSS_ONLISANS: "KPSS Önlisans",
  DGS: "DGS",
  ALES: "ALES",
};

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

function ScopeChecks({ secili, name = "examScopes" }: { secili: string[]; name?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(EXAM_SCOPE_LABEL).map(([k, v]) => (
        <label
          key={k}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-micro text-ink-soft has-[:checked]:border-brand has-[:checked]:bg-brand-wash has-[:checked]:text-brand"
        >
          <input type="checkbox" name={name} value={k} defaultChecked={secili.includes(k)} className="size-3 accent-brand" />
          {v}
        </label>
      ))}
    </div>
  );
}

/** Yeni kazanım. */
export function ObjectiveCreateForm({ topics }: { topics: TopicOpt[] }) {
  const [state, action, pending] = useActionState(createObjectiveAction, initial);

  return (
    <form action={action} className="space-y-4" key={state.ok ?? "form"}>
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}

      <Field label="Konu" error={state.fields?.topicId}>
        <select name="topicId" required className={SELECT_CLASS} defaultValue="">
          <option value="">Seç…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.scope} · {t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Kod" error={state.fields?.code} hint="Soru dosyalarında geçen kalıcı kod. Örn: TYT.PROB.03">
          <input name="code" required maxLength={40} className={clsx(INPUT_CLASS, MONO, "uppercase")} placeholder="TYT.PROB.03" />
        </Field>
        <Field label="Kazanım" error={state.fields?.name} hint="Öğrencinin karnesinde bu cümle görünür.">
          <input name="name" required maxLength={200} className={INPUT_CLASS} placeholder="Yüzde problemlerinde kâr-zarar oranını hesaplar" />
        </Field>
      </div>
      <Field label="Hangi sınavlarda ölçülür" hint="Hiçbiri seçilmezse konunun geçtiği her sınavda.">
        <ScopeChecks secili={[]} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Durum" hint="Yalnızca “Yayında” kazanımlar seviye 1'e girer.">
          <select name="status" defaultValue="DRAFT" className={SELECT_CLASS}>
            {QUESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sıra" hint="Konu içindeki sırası (karne düzeni).">
          <input name="sortOrder" type="number" min={0} max={9999} defaultValue={0} className={INPUT_CLASS} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        {pending ? "Ekleniyor…" : "Kazanım ekle"}
      </button>
    </form>
  );
}

/** Satır içi düzenleme: ad, kod, sınavlar, durum, sıra. */
export function ObjectiveRowEditor({ row, canEdit }: { row: ObjectiveRow; canEdit: boolean }) {
  const [acik, setAcik] = useState(false);
  const [state, action, pending] = useActionState(updateObjectiveAction, initial);
  const [silPending, startSil] = useTransition();

  if (!acik) {
    return (
      <div className="flex items-center gap-1">
        {canEdit ? (
          <>
            <button type="button" onClick={() => setAcik(true)} className={buttonClass("ghost", "xs")} aria-label="Düzenle">
              <Pencil /> Düzenle
            </button>
            <button
              type="button"
              disabled={silPending || row.questionCount > 0}
              title={row.questionCount > 0 ? "Sorusu olan kazanım silinmez; arşivle." : "Sil"}
              onClick={() => {
                if (!window.confirm(`${row.code} silinsin mi?`)) return;
                startSil(async () => {
                  const r = await deleteObjectiveAction(row.id);
                  if (r.ok) toast.success(`${row.code} silindi.`);
                  else toast.error(r.error ?? "Silinemedi.");
                });
              }}
              className={clsx(buttonClass("ghost", "xs"), "text-bad disabled:text-ink-muted")}
              aria-label="Sil"
            >
              <Trash2 />
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-3 rounded-xl border border-brand/20 bg-brand-wash/40 p-3">
      <input type="hidden" name="id" value={row.id} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Kod" error={state.fields?.code}>
          <input name="code" defaultValue={row.code} required maxLength={40} className={clsx(INPUT_CLASS, MONO, "h-9 uppercase")} />
        </Field>
        <Field label="Kazanım" error={state.fields?.name}>
          <input name="name" defaultValue={row.name} required maxLength={200} className={clsx(INPUT_CLASS, "h-9")} />
        </Field>
      </div>
      <ScopeChecks secili={row.examScopes} />
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <select name="status" defaultValue={row.status} className={clsx(SELECT_CLASS, "h-9")} aria-label="Durum">
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUESTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input name="sortOrder" type="number" min={0} max={9999} defaultValue={row.sortOrder} className={clsx(INPUT_CLASS, "h-9")} aria-label="Sıra" />
        <div className="flex gap-1">
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <Loader2 className="animate-spin" /> : null} Kaydet
          </button>
          <button type="button" onClick={() => setAcik(false)} className={buttonClass("ghost", "sm")} aria-label="Kapat">
            <X />
          </button>
        </div>
      </div>
    </form>
  );
}
