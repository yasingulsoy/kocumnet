"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  createQuestionAction,
  updateQuestionAction,
  type QuestionFormState,
} from "@/lib/checkup/actions/questions";
import { ERROR_TYPE_LABELS } from "@/lib/checkup/shared/error-types";
import { ContentPreview } from "./ContentPreview";
import { ImageUploader } from "./ImageUploader";
import {
  Card,
  CardHeader,
  Field,
  INPUT_CLASS,
  MONO,
  Notice,
  SELECT_CLASS,
  SMALL_SELECT_CLASS,
  TEXTAREA_CLASS,
  buttonClass,
} from "./ui";

const initial: QuestionFormState = {};
const LABELS = ["A", "B", "C", "D", "E"];

export interface TopicOption {
  id: string;
  name: string;
  scope: string;
}

export interface QuestionInitial {
  id: string;
  topicId: string;
  stem: string;
  solution: string;
  choices: string[];
  correctIndex: number;
  errorTypes: (string | null)[];
  difficulty: number;
  targetTimeSeconds: number;
  status: string;
  sourceRef: string;
  version: number;
  shownCount: number;
}

const BOS: QuestionInitial = {
  id: "",
  topicId: "",
  stem: "",
  solution: "",
  choices: ["", "", "", "", ""],
  correctIndex: 0,
  errorTypes: [null, null, null, null, null],
  difficulty: 3,
  targetTimeSeconds: 75,
  status: "DRAFT",
  sourceRef: "",
  version: 1,
  shownCount: 0,
};

const PREVIEW_BOX =
  "rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60";
const PREVIEW_LABEL =
  "mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
const CODE = "rounded bg-gray-100 px-1 py-0.5 text-theme-xs dark:bg-white/5 " + MONO;

export function QuestionForm({
  topics,
  question,
  canEdit,
}: {
  topics: TopicOption[];
  question?: QuestionInitial;
  /** Görüntüleyici rolü formu görür ama kaydedemez (sunucu da reddeder). */
  canEdit: boolean;
}) {
  const mevcut = question ?? BOS;
  const duzenleme = Boolean(question);

  const [state, formAction, pending] = useActionState(
    duzenleme ? updateQuestionAction : createQuestionAction,
    initial
  );

  const [stem, setStem] = useState(mevcut.stem);
  const [solution, setSolution] = useState(mevcut.solution);
  const [choices, setChoices] = useState<string[]>(() => {
    const c = [...mevcut.choices];
    while (c.length < 5) c.push("");
    return c;
  });
  const [correctIndex, setCorrectIndex] = useState(mevcut.correctIndex);

  /*
   * React 19, form eylemi bittiğinde formu kendiliğinden SIFIRLIYOR.
   * Metin alanları denetimli oldukları için durumdan geri yazılıyor, ama
   * <select> DOM'da varsayılana dönüyor ve React (kendi değeri değişmediği
   * için) düzeltmiyor. Sonuç: doğrulama hatası alan yazar seçtiği konuyu
   * SESSİZCE kaybeder ve farkında olmadan yanlış konuya kaydedebilir.
   *
   * Çözüm iki parça, ikisi de gerekli — KALDIRMAYIN:
   *  1. Forma giden değerler aşağıdaki GİZLİ alanlardan okunuyor. React gizli
   *     alana value niteliğini de yazdığı için form.reset() onları bozamıyor.
   *  2. Görünen select'ler eylemden sonra durumdan DOM'a elle geri yazılıyor
   *     (aşağıdaki efekt). Select'i yeniden monte etmek ya da denetimli yapmak
   *     YETMİYOR: sıfırlama en sonda çalışıyor.
   */
  const [topicId, setTopicId] = useState(mevcut.topicId);
  const [status, setStatus] = useState(mevcut.status);
  const [difficulty, setDifficulty] = useState(String(mevcut.difficulty));
  const [targetTime, setTargetTime] = useState(String(mevcut.targetTimeSeconds));
  const [sourceRef, setSourceRef] = useState(mevcut.sourceRef);
  const [errorTypes, setErrorTypes] = useState<string[]>(() =>
    Array.from({ length: 5 }, (_, i) => mevcut.errorTypes[i] ?? "")
  );

  const setErrorType = (i: number, value: string) =>
    setErrorTypes((prev) => prev.map((e, j) => (j === i ? value : e)));

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const f = formRef.current;
    if (!f) return;
    const setSelect = (label: string, value: string) => {
      const el = f.querySelector<HTMLSelectElement>('select[aria-label="' + label + '"]');
      if (el && el.value !== value) el.value = value;
    };
    setSelect("Konu", topicId);
    setSelect("Durum", status);
    setSelect("Zorluk", difficulty);
    errorTypes.forEach((value, i) => setSelect(LABELS[i] + " şıkkının hata tipi", value));
  }, [state, topicId, status, difficulty, errorTypes]);

  const setChoice = (i: number, value: string) =>
    setChoices((prev) => prev.map((c, j) => (j === i ? value : c)));

  const doluSikSayisi = choices.filter((c) => c.trim()).length;
  const hataSayisi = Object.keys(state.fields ?? {}).length;

  return (
    <form ref={formRef} action={formAction}>
      {duzenleme ? <input type="hidden" name="id" value={mevcut.id} /> : null}
      <input type="hidden" name="correctIndex" value={correctIndex} />
      {errorTypes.map((value, i) => (
        <input key={i} type="hidden" name={"errorType_" + i} value={value} />
      ))}
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="difficulty" value={difficulty} />

      <div className="space-y-4">
        {state.error ? <Notice>{state.error}</Notice> : null}
        {hataSayisi > 0 ? (
          <Notice title="Kaydedilmedi">
            {hataSayisi === 1 ? "Bir alanda" : hataSayisi + " alanda"} düzeltilmesi gereken bir
            sorun var — kırmızı işaretli alanlara bakın.
          </Notice>
        ) : null}
        {!canEdit ? (
          <Notice tone="info">
            Görüntüleyici rolündesin: formu inceleyebilirsin ama kaydedemezsin.
          </Notice>
        ) : null}
        {duzenleme && mevcut.shownCount > 0 ? (
          <Notice tone="warn">
            Bu soru öğrencilere {mevcut.shownCount} kez soruldu. Cevap anahtarını değiştirirsen
            sürüm artar (şu an v{mevcut.version}) ve eski sonuçlar ayırt edilebilir kalır.
          </Notice>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Sol: içerik ─────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Soru metni"
              description={
                <>
                  Formülleri <code className={CODE}>$…$</code> içine yaz; önizleme anında
                  güncellenir.
                </>
              }
            />
            <div className="space-y-4 p-5 sm:p-6">
              <Field label="Metin" htmlFor="stem" error={state.fields?.stem}>
                <textarea
                  id="stem"
                  name="stem"
                  required
                  rows={7}
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  className={clsx(TEXTAREA_CLASS, MONO, "leading-relaxed")}
                  placeholder="Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?"
                />
              </Field>

              <details className="group text-theme-sm text-gray-600 dark:text-gray-400">
                <summary className="cursor-pointer select-none font-medium text-gray-700 hover:text-brand-500 dark:text-gray-300">
                  Yazım kuralları
                </summary>
                <ul className="mt-2 space-y-1.5 ps-4">
                  <li>
                    Formül: <code className={CODE}>$x^2 + 1$</code> — satır içinde
                  </li>
                  <li>
                    Ortalanmış formül: <code className={CODE}>$$x = v \cdot t$$</code> — tek
                    başına bir satırda
                  </li>
                  <li>
                    Öncül listesi (I, II, III): satırlara <code className={CODE}>- </code> ile başla
                  </li>
                  <li>
                    Gerçek dolar işareti: <code className={CODE}>\$</code>
                  </li>
                  <li>
                    Şekil: aşağıdaki yükleyiciyi kullan — metne{" "}
                    <code className={CODE}>![alt](kimlik)</code> eklenir. Tek başına bir satırdaysa
                    ortalanmış şekil, cümle içindeyse satır içi simge olur.
                  </li>
                  <li>Boş satır yeni paragraf açar.</li>
                </ul>
              </details>

              {canEdit ? (
                <ImageUploader
                  onInsert={(markup) =>
                    // Ayrı bir satır olarak ekliyoruz: tek başına duran ![...](...)
                    // blok görsel olur, paragraf içine karışırsa satır içi simge.
                    setStem((prev) => (prev.trimEnd() ? prev.trimEnd() + "\n\n" : "") + markup + "\n")
                  }
                />
              ) : null}

              <div className={PREVIEW_BOX}>
                <p className={PREVIEW_LABEL}>Öğrencinin göreceği</p>
                <ContentPreview markup={stem} placeholder="Soru metnini yaz, burada görünecek." />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Şıklar"
              description="Doğru şıkkı harfe tıklayarak seç. Hata tipi, öğrenci o çeldiriciyi seçtiğinde hangi hatayı yaptığını kaydeder."
              action={
                <span className="text-theme-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {doluSikSayisi} şık · doğru: <strong className="text-success-600">{LABELS[correctIndex]}</strong>
                </span>
              }
            />
            <div className="space-y-3 p-5 sm:p-6">
              {state.fields?.choices ? <Notice>{state.fields.choices}</Notice> : null}
              {state.fields?.correctIndex ? <Notice>{state.fields.correctIndex}</Notice> : null}

              {choices.map((value, i) => {
                const dogru = i === correctIndex;
                return (
                  <div
                    key={i}
                    className={clsx(
                      "rounded-xl border p-3 transition",
                      dogru
                        ? "border-success-500/60 bg-success-50/60 dark:border-success-500/40 dark:bg-success-500/10"
                        : "border-gray-200 dark:border-gray-800"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(i)}
                        aria-label={LABELS[i] + " şıkkını doğru olarak işaretle"}
                        aria-pressed={dogru}
                        className={clsx(
                          "mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition",
                          dogru
                            ? "border-success-500 bg-success-500 text-white"
                            : "border-gray-300 text-gray-500 hover:border-success-500 hover:text-success-600 dark:border-gray-700 dark:text-gray-400"
                        )}
                      >
                        {LABELS[i]}
                      </button>

                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          name={"choice_" + i}
                          value={value}
                          onChange={(e) => setChoice(i, e.target.value)}
                          aria-label={LABELS[i] + " şıkkı"}
                          className={clsx(INPUT_CLASS, MONO)}
                          placeholder={i === 4 ? "$180$  (boş bırakılırsa 4 şıklı soru)" : "$180$"}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900/60">
                            <ContentPreview markup={value} compact placeholder="—" />
                          </div>

                          {/* Doğru şıkta hata tipi yok: çeldirici değil. */}
                          {!dogru && value.trim() ? (
                            <select
                              value={errorTypes[i]}
                              onChange={(e) => setErrorType(i, e.target.value)}
                              className={SMALL_SELECT_CLASS}
                              aria-label={LABELS[i] + " şıkkının hata tipi"}
                            >
                              <option value="">Hata tipi (isteğe bağlı)</option>
                              {Object.entries(ERROR_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Çözüm"
              description={
                <>
                  İsteğe bağlı ama <strong className="font-semibold">en çok işe yarayan alan</strong>:
                  öğrenci test bitince yanlışının nasıl çözüldüğünü burada görüyor.
                </>
              }
            />
            <div className="space-y-4 p-5 sm:p-6">
              <Field label="Adım adım çözüm" htmlFor="solution" error={state.fields?.solution}>
                <textarea
                  id="solution"
                  name="solution"
                  rows={6}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className={clsx(TEXTAREA_CLASS, MONO, "leading-relaxed")}
                  placeholder={"Pisagor bağıntısından:\n\n$$|AC|^2 = |AB|^2 + |BC|^2$$\n\n$|AC| = 20$ bulunur."}
                />
              </Field>
              <div className={PREVIEW_BOX}>
                <p className={PREVIEW_LABEL}>Önizleme</p>
                <ContentPreview markup={solution} placeholder="Çözüm yazılmadı." />
              </div>
            </div>
          </Card>
        </div>

        {/* ── Sağ: sınıflandırma + kaydet ─────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <Card>
            <CardHeader title="Sınıflandırma" />
            <div className="space-y-4 p-5">
              <Field label="Konu" error={state.fields?.topicId}>
                <select
                  aria-label="Konu"
                  required
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Seç…</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.scope} · {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Durum"
                error={state.fields?.status}
                hint="Yalnızca “Yayında” olan sorular teste seçilir."
              >
                <select
                  aria-label="Durum"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="DRAFT">Taslak</option>
                  <option value="REVIEW">İncelemede</option>
                  <option value="PUBLISHED">Yayında</option>
                  <option value="ARCHIVED">Arşiv</option>
                </select>
              </Field>

              <Field
                label="Zorluk"
                error={state.fields?.difficulty}
                hint="Seçimde kolay/orta/zor bant dağılımı için kullanılır."
              >
                <select
                  aria-label="Zorluk"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="1">1 — çok kolay</option>
                  <option value="2">2 — kolay</option>
                  <option value="3">3 — orta</option>
                  <option value="4">4 — zor</option>
                  <option value="5">5 — çok zor</option>
                </select>
              </Field>

              <Field
                label="Hedef süre (saniye)"
                htmlFor="targetTimeSeconds"
                error={state.fields?.targetTimeSeconds}
                hint="Bunun üstü öğrenciye “yavaş” olarak geri bildirilir."
              >
                <input
                  id="targetTimeSeconds"
                  name="targetTimeSeconds"
                  type="number"
                  min={10}
                  max={600}
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>

              <Field
                label="Kaynak"
                htmlFor="sourceRef"
                error={state.fields?.sourceRef}
                hint="İsteğe bağlı. Örn: 2023 TYT / 12"
              >
                <input
                  id="sourceRef"
                  name="sourceRef"
                  value={sourceRef}
                  onChange={(e) => setSourceRef(e.target.value)}
                  maxLength={200}
                  className={INPUT_CLASS}
                  placeholder="2023 TYT / 12"
                />
              </Field>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending || !canEdit}
              className={clsx(buttonClass("primary", "md"), "flex-1")}
            >
              {pending ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri kaydet" : "Soruyu kaydet"}
            </button>
            <Link href="/checkup/sorular" className={buttonClass("outline", "md")}>
              Vazgeç
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
