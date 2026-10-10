"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import {
  createQuestionAction,
  updateQuestionAction,
  type QuestionFormState,
} from "@/lib/checkup/actions/questions";
import { ERROR_TYPE_LABELS } from "@/lib/checkup/shared/error-types";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_LEVELS, QUESTION_LEVEL_LABEL } from "@/lib/checkup/format";
import { listeAdresi } from "@/lib/checkup/question-list";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field, FieldError, FieldHint } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { ContentPreview } from "./ContentPreview";
import { ImageUploader } from "./ImageUploader";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { CODE, MONO } from "./ui";

const initial: QuestionFormState = {};
const LABELS = ["A", "B", "C", "D", "E"];

export interface TopicOption {
  id: string;
  name: string;
  scope: string;
  /** Konunun geçtiği bütün sınavlar (Topic.examScopes). Hedef sınav bunlardan seçilir. */
  scopes?: string[];
}

export interface ObjectiveOption {
  id: string;
  topicId: string;
  code: string;
  name: string;
  /** Arşivdeki kazanım yalnızca bu sorunun kazanımıysa listede durur. */
  archived?: boolean;
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
  level: string;
  objectiveId: string;
  /** Hedef sınav (Question.examScopes). Boş = konunun her sınavı. */
  examScopes: string[];
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
  level: "",
  objectiveId: "",
  examScopes: [],
  version: 1,
  shownCount: 0,
};

const PREVIEW_BOX = "rounded-xl border border-gray-200 bg-gray-50 p-4";
const PREVIEW_LABEL = "mb-2 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase";

export function QuestionForm({
  topics,
  objectives = [],
  question,
  defaults,
  canEdit,
  returnQuery,
  sonrakiId = null,
}: {
  topics: TopicOption[];
  /** Kazanımlar — konuya göre süzülür. */
  objectives?: ObjectiveOption[];
  /** Düzenlenen soru. Yoksa form yeni soru kaydeder. */
  question?: QuestionInitial;
  /** Yeni soruda ön dolu alanlar ("kaydet ve yenisi", "benzerini oluştur"). */
  defaults?: Partial<QuestionInitial>;
  /** Görüntüleyici rolü formu görür ama kaydedemez (sunucu da reddeder). */
  canEdit: boolean;
  /**
   * Listenin süzgeç sorgusu: kaydedince ve vazgeçince oraya dönülür. Boş
   * metin "süzgeçsiz listeden geldim" demek; undefined "listeden gelmedim".
   */
  returnQuery?: string;
  /** Süzgeçli listede sıradaki soru — "Kaydet ve sonrakine geç" için. */
  sonrakiId?: string | null;
}) {
  const mevcut: QuestionInitial = question ?? { ...BOS, ...defaults };
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
   *     (aşağıdaki efekt; select'ler aria-label'larıyla bulunur). Select'i
   *     yeniden monte etmek ya da denetimli yapmak YETMİYOR: sıfırlama en
   *     sonda çalışıyor.
   */
  const [topicId, setTopicId] = useState(mevcut.topicId);
  const [status, setStatus] = useState(mevcut.status);
  const [difficulty, setDifficulty] = useState(String(mevcut.difficulty));
  const [targetTime, setTargetTime] = useState(String(mevcut.targetTimeSeconds));
  const [sourceRef, setSourceRef] = useState(mevcut.sourceRef);
  const [level, setLevel] = useState(mevcut.level);
  const [objectiveId, setObjectiveId] = useState(mevcut.objectiveId);
  const [hedefSinavlar, setHedefSinavlar] = useState<string[]>(mevcut.examScopes);
  const seciliKonu = topics.find((t) => t.id === topicId);
  const konuSinavlari = seciliKonu ? (seciliKonu.scopes?.length ? seciliKonu.scopes : [seciliKonu.scope]) : [];
  // Konunun sınavları + (eski veride) konu dışında kalmış seçili sınav: kaldırılabilsin diye görünür.
  const sinavSecenekleri = EXAM_SCOPES.filter((s) => konuSinavlari.includes(s) || hedefSinavlar.includes(s));
  const konununKazanimlari = objectives.filter((o) => o.topicId === topicId);
  const seciliKazanim = objectives.find((o) => o.id === objectiveId);
  const [errorTypes, setErrorTypes] = useState<string[]>(() =>
    Array.from({ length: 5 }, (_, i) => mevcut.errorTypes[i] ?? "")
  );

  const setErrorType = (i: number, value: string) =>
    setErrorTypes((prev) => prev.map((e, j) => (j === i ? value : e)));

  const formRef = useRef<HTMLFormElement>(null);
  /** Gönderim sürerken ayrılma uyarısı ve kısayollar devre dışı. */
  const gonderiliyor = useRef(false);

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
    setSelect("Seviye", level);
    setSelect("Kazanım", objectiveId);
    errorTypes.forEach((value, i) => setSelect(LABELS[i] + " şıkkının hata tipi", value));
    // Onay kutuları da sıfırlamada ilk hâline döner; durumdan geri yaz.
    f.querySelectorAll<HTMLInputElement>("input[data-hedef-sinav]").forEach((el) => {
      el.checked = hedefSinavlar.includes(el.value);
    });
  }, [state, topicId, status, difficulty, level, objectiveId, errorTypes, hedefSinavlar]);

  /*
   * Eylem döndüyse (yönlendirme olmadıysa) bir sorun vardır: koruma yeniden
   * devreye girer ve ilk hatalı alana kaydırılır — kaydet düğmesi sağ
   * sütunun dibinde, hata ise çoğu zaman ekranın dışında kalıyordu. Hatalı
   * alanı kitin Field'ı aria-invalid ile işaretliyor; alan dışı hatalar
   * (şıklar, hedef sınav) data-alan-hatasi taşıyor.
   */
  useEffect(() => {
    gonderiliyor.current = false;
    if (!state.error && !state.fields) return;
    const ilk = formRef.current?.querySelector('[data-alan-hatasi], [aria-invalid="true"]') ?? formRef.current;
    ilk?.scrollIntoView({ block: "center" });
  }, [state]);

  // ── Kaydedilmemiş değişiklik ─────────────────────────────────
  const ozet = JSON.stringify([
    stem,
    solution,
    choices,
    correctIndex,
    topicId,
    status,
    difficulty,
    targetTime,
    sourceRef,
    level,
    objectiveId,
    errorTypes,
    hedefSinavlar,
  ]);
  const [ilkOzet] = useState(ozet);
  const kirli = canEdit && ozet !== ilkOzet;

  useUnsavedGuard(kirli, gonderiliyor);

  // ── Klavye: Ctrl/⌘ + S ya da Ctrl/⌘ + Enter kaydeder ─────────
  useEffect(() => {
    if (!canEdit) return;
    const tus = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "s" && k !== "enter") return;
      // Tarayıcının "sayfayı kaydet" penceresi açılmasın.
      e.preventDefault();
      const f = formRef.current;
      if (!f || gonderiliyor.current) return;
      // Yeni soruda Ctrl+Shift+Enter: kaydet ve yenisini ekle.
      const yenisi =
        e.shiftKey && k === "enter" ? f.querySelector<HTMLButtonElement>('button[name="sonra"]') : null;
      f.requestSubmit(yenisi ?? undefined);
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [canEdit]);

  const setChoice = (i: number, value: string) =>
    setChoices((prev) => prev.map((c, j) => (j === i ? value : c)));

  const doluSikSayisi = choices.filter((c) => c.trim()).length;
  const hataSayisi = Object.keys(state.fields ?? {}).length;
  const geriAdres = listeAdresi(returnQuery ?? "");

  // Dolu şıktan önce boş şık: sunucu reddediyor (etiketler kayar, anahtar başka
  // şıkka geçerdi). Yazar kaydetmeden önce görsün.
  const doluMu = choices.map((c) => c.trim() !== "");
  const sonDolu = doluMu.lastIndexOf(true);
  const aradakiBos = doluMu.findIndex((d, i) => !d && i < sonDolu);
  const dogruBos = !doluMu[correctIndex] && doluSikSayisi > 0;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        gonderiliyor.current = true;
      }}
    >
      {duzenleme ? <input type="hidden" name="id" value={mevcut.id} /> : null}
      {returnQuery !== undefined ? <input type="hidden" name="geri" value={returnQuery} /> : null}
      {duzenleme && sonrakiId ? <input type="hidden" name="sonrakiId" value={sonrakiId} /> : null}
      <input type="hidden" name="correctIndex" value={correctIndex} />
      {errorTypes.map((value, i) => (
        <input key={i} type="hidden" name={"errorType_" + i} value={value} />
      ))}
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="difficulty" value={difficulty} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="objectiveId" value={objectiveId} />
      {hedefSinavlar.map((s) => (
        <input key={s} type="hidden" name="examScopes" value={s} />
      ))}

      <div className="space-y-4">
        {state.error ? <Alert variant="error">{state.error}</Alert> : null}
        {hataSayisi > 0 ? (
          <Alert variant="error" title="Kaydedilmedi">
            {hataSayisi === 1 ? "Bir alanda" : hataSayisi + " alanda"} düzeltilmesi gereken bir
            sorun var — kırmızı işaretli alanlara bakın.
          </Alert>
        ) : null}
        {!canEdit ? (
          <Alert variant="info">Görüntüleyici rolündesin: formu inceleyebilirsin ama kaydedemezsin.</Alert>
        ) : null}
        {duzenleme && mevcut.shownCount > 0 ? (
          <Alert variant="warning">
            Bu soru öğrencilere {mevcut.shownCount} kez soruldu. Cevap anahtarını değiştirirsen
            sürüm artar (şu an v{mevcut.version}) ve eski sonuçlar ayırt edilebilir kalır.
          </Alert>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Sol: içerik ─────────────────────────────── */}
        <div className="min-w-0 space-y-4 md:space-y-6">
          <ComponentCard
            title="Soru metni"
            desc={
              <>
                Formülleri <code className={CODE}>$…$</code> içine yaz; önizleme anında güncellenir.
              </>
            }
          >
            <Field label="Metin" error={state.fields?.stem}>
              <TextArea
                name="stem"
                required
                rows={7}
                value={stem}
                onChange={(e) => setStem(e.target.value)}
                className={cx(MONO, "leading-relaxed")}
                placeholder="Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?"
              />
            </Field>

            <details className="group text-theme-sm text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-700 select-none hover:text-brand-500">
                Yazım kuralları
              </summary>
              <ul className="mt-2 space-y-1.5 ps-4">
                <li>
                  Formül: <code className={CODE}>$x^2 + 1$</code> — satır içinde
                </li>
                <li>
                  Ortalanmış formül: <code className={CODE}>$$x = v \cdot t$$</code> — tek başına bir satırda
                </li>
                <li>
                  Öncül listesi (I, II, III): satırlara <code className={CODE}>- </code> ile başla
                </li>
                <li>
                  Gerçek dolar işareti: <code className={CODE}>\$</code>
                </li>
                <li>
                  Şekil: aşağıdaki yükleyiciyi kullan — metne <code className={CODE}>![alt](kimlik)</code> eklenir. Tek
                  başına bir satırdaysa ortalanmış şekil, cümle içindeyse satır içi simge olur.
                </li>
                <li>Boş satır yeni paragraf açar.</li>
                <li>
                  Kaydet: <kbd className={CODE}>Ctrl</kbd> + <kbd className={CODE}>S</kbd> (Mac’te{" "}
                  <kbd className={CODE}>⌘</kbd> + <kbd className={CODE}>S</kbd>)
                  {duzenleme && !sonrakiId ? null : (
                    <>
                      {" "}
                      · {duzenleme ? "kaydet ve sonrakine geç" : "kaydet ve yenisini ekle"}:{" "}
                      <kbd className={CODE}>Ctrl</kbd> + <kbd className={CODE}>Shift</kbd> +{" "}
                      <kbd className={CODE}>Enter</kbd>
                    </>
                  )}
                </li>
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
              {doluSikSayisi > 0 ? (
                // Test ekranındaki şık kartlarının sadeleştirilmiş eşi. Doğru şık
                // işaretli değil (öğrenci görmez); etiketler kaydedilecek sırayla.
                <ol className="mt-4 space-y-2" aria-label="Şıklar, öğrencinin göreceği sırayla">
                  {choices
                    .filter((c) => c.trim())
                    .map((c, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5">
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-theme-sm font-bold text-gray-600 ring-1 ring-gray-300 ring-inset"
                        >
                          {LABELS[i]}
                        </span>
                        <span className="sr-only">{LABELS[i]} şıkkı: </span>
                        <div className="min-w-0 flex-1">
                          <ContentPreview markup={c} compact placeholder="—" />
                        </div>
                      </li>
                    ))}
                </ol>
              ) : null}
            </div>
          </ComponentCard>

          <ComponentCard
            title="Şıklar"
            desc="Doğru şıkkı harfe tıklayarak seç. Hata tipi, öğrenci o çeldiriciyi seçtiğinde hangi hatayı yaptığını kaydeder."
            actions={
              <span className="tabular text-theme-xs text-gray-500">
                {doluSikSayisi} şık · doğru: <strong className="text-success-700">{LABELS[correctIndex]}</strong>
              </span>
            }
          >
            <div className="space-y-3">
              {state.fields?.choices ? (
                <div data-alan-hatasi>
                  <Alert variant="error" compact>
                    {state.fields.choices}
                  </Alert>
                </div>
              ) : null}
              {state.fields?.correctIndex ? (
                <div data-alan-hatasi>
                  <Alert variant="error" compact>
                    {state.fields.correctIndex}
                  </Alert>
                </div>
              ) : null}
              {aradakiBos !== -1 && !state.fields?.choices ? (
                <Alert variant="warning" compact>
                  {LABELS[aradakiBos]} şıkkı boş ama sonrasında dolu şık var. Boş şık yalnızca sonda
                  olabilir (4 şıklı soruda E boş kalır) — böyle kaydedilemez.
                </Alert>
              ) : null}
              {dogruBos ? (
                <Alert variant="warning" compact>
                  Doğru olarak işaretlenen {LABELS[correctIndex]} şıkkı boş.
                </Alert>
              ) : null}

              {choices.map((value, i) => {
                const dogru = i === correctIndex;
                return (
                  <div
                    key={i}
                    className={cx("rounded-xl border p-3 transition", dogru ? "border-success-500 bg-success-25" : "border-gray-200")}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setCorrectIndex(i)}
                        aria-label={LABELS[i] + " şıkkını doğru olarak işaretle"}
                        aria-pressed={dogru}
                        className={cx(
                          "mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border text-theme-sm font-bold transition",
                          dogru
                            ? "border-success-600 bg-success-600 text-white"
                            : "border-gray-300 text-gray-500 hover:border-success-600 hover:text-success-700"
                        )}
                      >
                        {LABELS[i]}
                      </button>

                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          name={"choice_" + i}
                          value={value}
                          onChange={(e) => setChoice(i, e.target.value)}
                          aria-label={LABELS[i] + " şıkkı"}
                          className={MONO}
                          placeholder={i === 4 ? "$180$  (boş bırakılırsa 4 şıklı soru)" : "$180$"}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
                            <ContentPreview markup={value} compact placeholder="—" />
                          </div>

                          {/* Doğru şıkta hata tipi yok: çeldirici değil. */}
                          {!dogru && value.trim() ? (
                            <Select
                              value={errorTypes[i]}
                              onChange={(e) => setErrorType(i, e.target.value)}
                              compact
                              wrapperClassName="w-full sm:w-auto sm:max-w-64"
                              aria-label={LABELS[i] + " şıkkının hata tipi"}
                            >
                              <option value="">Hata tipi (isteğe bağlı)</option>
                              {Object.entries(ERROR_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </Select>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ComponentCard>

          <ComponentCard
            title="Çözüm"
            desc={
              <>
                İsteğe bağlı ama <strong className="font-semibold text-gray-700">en çok işe yarayan alan</strong>:
                öğrenci test bitince yanlışının nasıl çözüldüğünü burada görüyor.
              </>
            }
          >
            <Field label="Adım adım çözüm" error={state.fields?.solution}>
              <TextArea
                name="solution"
                rows={6}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className={cx(MONO, "leading-relaxed")}
                placeholder={"Pisagor bağıntısından:\n\n$$|AC|^2 = |AB|^2 + |BC|^2$$\n\n$|AC| = 20$ bulunur."}
              />
            </Field>
            <div className={PREVIEW_BOX}>
              <p className={PREVIEW_LABEL}>Önizleme</p>
              <ContentPreview markup={solution} placeholder="Çözüm yazılmadı." />
            </div>
          </ComponentCard>
        </div>

        {/* ── Sağ: sınıflandırma + kaydet ─────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <ComponentCard title="Sınıflandırma">
            <div className="space-y-5">
              <Field label="Konu" required error={state.fields?.topicId}>
                <Select
                  aria-label="Konu"
                  required
                  value={topicId}
                  onChange={(e) => {
                    setTopicId(e.target.value);
                    // Kazanım konuya bağlı: konu değişince eskisi anlamsız.
                    setObjectiveId("");
                    // Yeni konunun sınavı olmayan hedefler düşer.
                    const yeni = topics.find((t) => t.id === e.target.value);
                    const izinli = yeni ? (yeni.scopes?.length ? yeni.scopes : [yeni.scope]) : [];
                    setHedefSinavlar((prev) => prev.filter((s) => izinli.includes(s)));
                  }}
                >
                  <option value="">Seç…</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {(EXAM_LABEL[t.scope] ?? t.scope) + " · " + t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <fieldset>
                <legend className={cx(labelClass, "mb-1.5")}>Hedef sınav</legend>
                {sinavSecenekleri.length === 0 ? (
                  <p className="text-theme-xs text-gray-500">Önce konu seç.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sinavSecenekleri.map((s) => (
                      <label
                        key={s}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-500"
                      >
                        <Checkbox
                          data-hedef-sinav
                          value={s}
                          checked={hedefSinavlar.includes(s)}
                          onChange={(e) =>
                            setHedefSinavlar((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                          }
                        />
                        {EXAM_LABEL[s] ?? s}
                      </label>
                    ))}
                  </div>
                )}
                {state.fields?.examScopes ? (
                  <div role="alert" data-alan-hatasi>
                    <FieldError>{state.fields.examScopes}</FieldError>
                  </div>
                ) : (
                  <FieldHint>
                    {hedefSinavlar.length
                      ? "Yalnızca seçilen sınavların testlerine girer."
                      : "Boş: konunun geçtiği her sınavda sorulabilir — normal durum. Yalnızca kısıtlama gerekiyorsa seç."}
                  </FieldHint>
                )}
              </fieldset>

              <Field label="Durum" error={state.fields?.status} hint="Yalnızca “Yayında” olan sorular teste seçilir.">
                <Select aria-label="Durum" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="DRAFT">Taslak</option>
                  <option value="REVIEW">İncelemede</option>
                  <option value="PUBLISHED">Yayında</option>
                  <option value="ARCHIVED">Arşiv</option>
                </Select>
              </Field>

              <Field
                label="Seviye"
                error={state.fields?.level}
                hint="Seviyeli check-up için. Boş bırakılırsa yalnızca klasik paketlerde çıkar."
              >
                <Select aria-label="Seviye" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="">Seviyesiz</option>
                  {QUESTION_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {QUESTION_LEVEL_LABEL[l]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Kazanım"
                error={state.fields?.objectiveId}
                hint={
                  !topicId
                    ? "Önce konu seç."
                    : seciliKazanim?.archived
                      ? "Bu kazanım arşivde: seviye 1 onu seçmez. Başka kazanım seç ya da kazanımı yayına al."
                      : konununKazanimlari.length === 0
                        ? "Bu konuda kazanım yok — Kazanımlar sayfasından ekle."
                        : "Seviye 1'de zorunlu: seviye 1 her kazanımdan bir soru sorar. Seviye 2-3 kazanımsız olabilir."
                }
              >
                <Select
                  aria-label="Kazanım"
                  value={objectiveId}
                  onChange={(e) => setObjectiveId(e.target.value)}
                  disabled={!topicId || konununKazanimlari.length === 0}
                >
                  <option value="">Kazanımsız</option>
                  {konununKazanimlari.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} · {o.name}
                      {o.archived ? " (arşivde)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Zorluk"
                error={state.fields?.difficulty}
                hint="Seçimde kolay/orta/zor bant dağılımı için kullanılır."
              >
                <Select aria-label="Zorluk" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="1">1 — çok kolay</option>
                  <option value="2">2 — kolay</option>
                  <option value="3">3 — orta</option>
                  <option value="4">4 — zor</option>
                  <option value="5">5 — çok zor</option>
                </Select>
              </Field>

              <Field
                label="Hedef süre (saniye)"
                error={state.fields?.targetTimeSeconds}
                hint="Bunun üstü öğrenciye “yavaş” olarak geri bildirilir."
              >
                <Input
                  name="targetTimeSeconds"
                  type="number"
                  min={10}
                  max={600}
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                />
              </Field>

              <Field label="Kaynak" optional error={state.fields?.sourceRef} hint="Örn: 2023 TYT / 12">
                <Input
                  name="sourceRef"
                  value={sourceRef}
                  onChange={(e) => setSourceRef(e.target.value)}
                  maxLength={200}
                  placeholder="2023 TYT / 12"
                />
              </Field>
            </div>
          </ComponentCard>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={pending} disabled={!canEdit} startIcon={<Save />} className="flex-1">
                {pending ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri kaydet" : "Soruyu kaydet"}
              </Button>
              <ButtonLink href={geriAdres} variant="outline">
                Vazgeç
              </ButtonLink>
            </div>
            {!duzenleme && canEdit ? (
              <Button type="submit" name="sonra" value="yeni" variant="outline" block disabled={pending}>
                Kaydet ve yenisini ekle
              </Button>
            ) : null}
            {duzenleme && canEdit && sonrakiId ? (
              // İnceleme turu: listedeki sıradaki soruya kaydedip geçer (sıra, kaydetmeden
              // ÖNCEKİ listeye göre — kaydedilen soru listenin başına zıplasa da zincir kopmaz).
              <Button type="submit" name="sonra" value="sonraki" variant="outline" block disabled={pending}>
                Kaydet ve sonrakine geç
              </Button>
            ) : null}
            {canEdit ? (
              <p className="text-theme-xs text-gray-500" aria-live="polite">
                {kirli ? "Kaydedilmemiş değişiklik var · " : ""}
                <kbd className={CODE}>Ctrl</kbd>/<kbd className={CODE}>⌘</kbd> + <kbd className={CODE}>S</kbd> kaydeder
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
