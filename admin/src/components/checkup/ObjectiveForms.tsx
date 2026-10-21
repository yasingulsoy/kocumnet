"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import toast from "react-hot-toast";
import { NotebookText, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  createObjectiveAction,
  deleteObjectiveAction,
  saveObjectiveSummaryAction,
  updateObjectiveAction,
  type ObjectiveFormState,
} from "@/lib/checkup/actions/objectives";
import { OZET_KARTI_SINIRI } from "@/lib/checkup/content-limits";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { damgaAdi } from "@/lib/checkup/question-note";
import { markupToContent } from "@/lib/checkup/shared/question-markup";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field, FieldHint } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { ContentPreview } from "./ContentPreview";
import { useOnay } from "./Onay";
import { CODE, MONO } from "./ui";

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
  /** Özet kartının yazımı (Objective.summary); yoksa boş. */
  summaryMarkup: string;
  /** Kartı en son kim yazdı ("e-posta (#id)"). */
  summaryStaff: string | null;
  /** Kart yazım biçiminin temsil edemediği blok içeriyor (elle girilmiş tablo): düzenleme kapalı. */
  summaryLocked: boolean;
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

/**
 * Kazanım özet kartı: öğrenci uygulamasında, yanlış yapılan kazanımın altında
 * (sonuç ekranı, defter) çıkan kısa kart. Yazım biçimi soru formuyla aynı
 * (`$…$`, `$$…$$`, `- ` öncül); adım ayırıcı yok, OZET_KARTI_SINIRI karakter.
 * Görüntüleyici kartı okur, yazamaz (sunucu da reddeder).
 */
export function ObjectiveSummaryEditor({ row, canEdit }: { row: ObjectiveRow; canEdit: boolean }) {
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState(row.summaryMarkup);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onayla = useOnay();

  const temiz = metin.trim();
  const fazla = temiz.length > OZET_KARTI_SINIRI;
  const ayirici = useMemo(() => markupToContent(metin).blocks.some((b) => b.type === "step_break"), [metin]);
  const degisti = temiz !== row.summaryMarkup.trim();
  const yazilabilir = canEdit && !row.summaryLocked;

  if (!acik) {
    if (!row.summaryMarkup && !canEdit) return null;
    return (
      <Button
        variant="ghost"
        size="xs"
        startIcon={<NotebookText />}
        onClick={() => {
          setMetin(row.summaryMarkup);
          setHata(null);
          setAcik(true);
        }}
        aria-label={row.code + " özet kartı"}
      >
        {row.summaryMarkup ? "Özet kartı" : "Özet ekle"}
      </Button>
    );
  }

  const kaydet = (yeni: string) =>
    start(async () => {
      const r = await saveObjectiveSummaryAction(row.id, yeni);
      if (!r.ok) {
        setHata(r.error);
        return;
      }
      toast.success(row.code + (r.silindi ? ": özet kartı kaldırıldı." : ": özet kartı kaydedildi."));
      setAcik(false);
    });

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") setAcik(false);
      }}
      className="mt-2 w-full space-y-3 rounded-xl border border-brand-100 bg-brand-25 p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-theme-sm font-semibold text-gray-800">
          Özet kartı · <code className={CODE}>{row.code}</code>
        </p>
        {row.summaryStaff ? (
          <span className="text-theme-xs text-gray-500" title={row.summaryStaff}>
            son yazan {damgaAdi(row.summaryStaff)}
          </span>
        ) : null}
      </div>

      {row.summaryLocked ? (
        <Alert variant="warning" compact>
          Kart yazım biçiminin temsil edemediği bir blok (tablo) içeriyor; burada kaydetmek onu silerdi, düzenleme kapalı.
        </Alert>
      ) : null}
      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}

      {yazilabilir ? (
        <Field
          label="Özet"
          error={
            fazla
              ? `Kart ${OZET_KARTI_SINIRI} karakteri aşıyor (${temiz.length}).`
              : ayirici
                ? "Özet kartında tek başına --- satırı olamaz: kart tek parça açılır."
                : undefined
          }
          hint={
            <>
              <span className="tabular">
                {temiz.length}/{OZET_KARTI_SINIRI}
              </span>{" "}
              · 3-5 satır: kural, formül, bir örnek. Formül <code className={CODE}>$…$</code>, öncül listesi{" "}
              <code className={CODE}>- </code>. Boş bırakıp kaydedersen kart kalkar.
            </>
          }
        >
          <TextArea
            rows={5}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            className={cx(MONO, "leading-relaxed")}
            // Özet ekle'ye basınca doğrudan yazmaya başlanabilsin.
            autoFocus
            placeholder={"3 ile bölünebilme: rakamlar toplamı 3'ün katıysa sayı 3'e bölünür.\n\n$$123 \to 1+2+3 = 6$$"}
          />
        </Field>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="mb-2 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Öğrencinin göreceği kart</p>
        <ContentPreview markup={metin} placeholder="Özet kartı yok." />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {yazilabilir ? (
          <>
            <Button
              size="xs"
              startIcon={<Save />}
              loading={pending}
              disabled={!degisti || fazla || ayirici}
              onClick={() => kaydet(metin)}
            >
              Kaydet
            </Button>
            {row.summaryMarkup ? (
              <Button
                variant="danger-outline"
                size="xs"
                disabled={pending}
                onClick={async () => {
                  const evet = await onayla({
                    title: row.code + " özet kartı kaldırılsın mı?",
                    description: "Öğrenci bu kazanımın altında özet kartı görmez.",
                    confirmLabel: "Kaldır",
                    tone: "danger",
                  });
                  if (evet) kaydet("");
                }}
              >
                Kartı kaldır
              </Button>
            ) : null}
          </>
        ) : null}
        <Button variant="ghost" size="xs" onClick={() => setAcik(false)} startIcon={<X />}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
