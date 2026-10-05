"use client";

import { useState, useTransition, type FormEvent } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createObjectiveAction,
  deleteObjectiveAction,
  updateObjectiveAction,
  type ObjectiveFormState,
} from "@/lib/checkup/actions/objectives";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { Field, INPUT_CLASS, MONO, Notice, SELECT_CLASS, buttonClass } from "./ui";

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

function ScopeChecks({ secili, name = "examScopes" }: { secili: string[]; name?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EXAM_SCOPES.map((k) => (
        <label
          key={k}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-micro text-ink-soft has-[:checked]:border-brand has-[:checked]:bg-brand-wash has-[:checked]:text-brand has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
        >
          <input type="checkbox" name={name} value={k} defaultChecked={secili.includes(k)} className="size-3 accent-brand" />
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
      className="space-y-4"
    >
      {state.error ? <Notice>{state.error}</Notice> : null}

      <Field label="Konu" error={state.fields?.topicId} htmlFor="kazanim-konu">
        <select id="kazanim-konu" name="topicId" required className={SELECT_CLASS} defaultValue="">
          <option value="">Seç…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {(EXAM_LABEL[t.scope] ?? t.scope) + " · " + t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field
          label="Kod"
          htmlFor="kazanim-kod"
          error={state.fields?.code}
          hint="Soru dosyalarında geçen kalıcı kod. Örn: TYT.PROB.03"
        >
          <input
            id="kazanim-kod"
            name="code"
            required
            maxLength={40}
            autoComplete="off"
            className={clsx(INPUT_CLASS, MONO, "uppercase")}
            placeholder="TYT.PROB.03"
          />
        </Field>
        <Field label="Kazanım" htmlFor="kazanim-ad" error={state.fields?.name} hint="Öğrencinin karnesinde bu cümle görünür.">
          <input
            id="kazanim-ad"
            name="name"
            required
            maxLength={200}
            className={INPUT_CLASS}
            placeholder="Yüzde problemlerinde kâr-zarar oranını hesaplar"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-caption font-medium text-ink">Hangi sınavlarda ölçülür</legend>
        <ScopeChecks secili={[]} />
        <p className="mt-1.5 text-micro text-ink-faint">Hiçbiri seçilmezse konunun geçtiği her sınavda.</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Durum" htmlFor="kazanim-durum" hint="Yalnızca “Yayında” kazanımlar seviye 1'e girer.">
          <select id="kazanim-durum" name="status" defaultValue="DRAFT" className={SELECT_CLASS}>
            {QUESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sıra" htmlFor="kazanim-sira" hint="Konu içindeki sırası (karne düzeni).">
          <input
            id="kazanim-sira"
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={0}
            className={INPUT_CLASS}
          />
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
  const [state, setState] = useState<ObjectiveFormState>({});
  const [pending, start] = useTransition();
  const [silPending, startSil] = useTransition();

  if (!acik) {
    return (
      <div className="flex items-center gap-1">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => {
                setState({});
                setAcik(true);
              }}
              className={buttonClass("ghost", "xs")}
              aria-label={row.code + " kazanımını düzenle"}
            >
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
              aria-label={row.code + " kazanımını sil"}
            >
              <Trash2 />
            </button>
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
      className="mt-2 w-full space-y-3 rounded-xl border border-brand/20 bg-brand-wash/40 p-3"
    >
      <input type="hidden" name="id" value={row.id} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Kod" htmlFor={"kod-" + row.id} error={state.fields?.code}>
          <input
            id={"kod-" + row.id}
            name="code"
            defaultValue={row.code}
            required
            maxLength={40}
            autoComplete="off"
            className={clsx(INPUT_CLASS, MONO, "h-9 uppercase")}
          />
        </Field>
        <Field label="Kazanım" htmlFor={"ad-" + row.id} error={state.fields?.name}>
          <input
            id={"ad-" + row.id}
            name="name"
            defaultValue={row.name}
            required
            maxLength={200}
            className={clsx(INPUT_CLASS, "h-9")}
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
        <select name="status" defaultValue={row.status} className={clsx(SELECT_CLASS, "h-9")} aria-label="Durum">
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUESTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={row.sortOrder}
          className={clsx(INPUT_CLASS, "h-9")}
          aria-label="Sıra"
        />
        <div className="flex gap-1">
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <Loader2 className="animate-spin" /> : null} Kaydet
          </button>
          <button
            type="button"
            onClick={() => setAcik(false)}
            className={buttonClass("ghost", "sm")}
            aria-label="Düzenlemeyi kapat"
          >
            <X />
          </button>
        </div>
      </div>
    </form>
  );
}
