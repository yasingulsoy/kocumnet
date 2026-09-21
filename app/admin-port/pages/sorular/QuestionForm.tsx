"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createQuestionAction,
  updateQuestionAction,
  type QuestionFormState,
} from "@/lib/actions/admin";
import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import { ContentPreview } from "@/components/ContentPreview";
import { ImageUploader } from "@/components/ImageUploader";
import { Alert, Button, Card, Field, INPUT_CLASS } from "@/components/ui";

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

export function QuestionForm({
  topics,
  question,
}: {
  topics: TopicOption[];
  question?: QuestionInitial;
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
   * React 19, form eylemi bittiginde formu kendiliginden sifirliyor.
   * Metin alanlari denetimli olduklari icin durumdan geri yaziliyor, ama
   * <select> DOM'da varsayilana donuyor ve React durumu degismedigi icin
   * duzeltmiyor. Sonuc: dogrulama hatasi alan admin sectigi konuyu SESSIZCE
   * kaybeder ve farkinda olmadan yanlis konuya kaydedebilir.
   *
   * Cozum: select'ler yalnizca arayuz; forma giden deger asagidaki GIZLI
   * alanlardan okunuyor. React gizli alana value niteligini de yazdigi icin
   * form.reset() onlari degistiremiyor (correctIndex ayni desenle calisiyordu).
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

  /*
   * Gizli alanlar dogru degeri tasiyor ama GORUNEN select yine de bos
   * kaliyor: form.reset() onu DOM'da varsayilana dondurdu ve React'in
   * durumu degismedigi icin fark gormuyor. Eylem sonucu her degistiginde
   * key'i degistirip select'leri yeniden monte ediyoruz; durumdan cizilip
   * ekran gercegi gosteriyor.
   */
  /*
   * Gorunen select'i eylemden sonra DURUMDAN geri yaziyoruz.
   *
   * Sira su: eylem biter -> React yeni durumla cizer -> React 19 formu
   * SIFIRLAR. Sifirlama en sonda oldugu icin select'i yeniden monte etmek
   * ya da denetimli yapmak yetmiyor; React'in kendi degeri degismedigi icin
   * de geri yazmiyor. Bu yuzden DOM'a elle yaziyoruz.
   *
   * Gonderilen deger zaten gizli alanlardan geliyor; burasi sadece ekranin
   * gercegi gostermesi icin.
   */
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
  }, [state, topicId, status, difficulty]);

  const setChoice = (i: number, value: string) =>
    setChoices((prev) => prev.map((c, j) => (j === i ? value : c)));

  const doluSikSayisi = choices.filter((c) => c.trim()).length;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {duzenleme ? <input type="hidden" name="id" value={mevcut.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      {duzenleme && mevcut.shownCount > 0 ? (
        <Alert tone="warn">
          Bu soru {mevcut.shownCount} kez soruldu. Cevap anahtarını değiştirirsen sürüm
          artar (şu an v{mevcut.version}) ve eski sonuçlar ayırt edilebilir kalır.
        </Alert>
      ) : null}

      {/* Soru metni */}
      <Card className="p-5">
        <Field label="Soru metni" error={state.fields?.stem}>
          <textarea
            name="stem"
            required
            rows={6}
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            className={INPUT_CLASS + " font-mono text-sm leading-relaxed"}
            placeholder={"Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?"}
          />
        </Field>

        <details className="mt-2 text-xs text-ink-soft">
          <summary className="cursor-pointer select-none font-medium">Yazım kuralları</summary>
          <ul className="mt-2 space-y-1 ps-4">
            <li>
              Formül: <code className="font-mono">$x^2 + 1$</code> — satır içinde
            </li>
            <li>
              Ortalanmış formül: <code className="font-mono">$$x = v \cdot t$$</code> — tek
              başına bir satırda
            </li>
            <li>
              Öncül listesi (I, II, III): satırlara{" "}
              <code className="font-mono">- </code> ile başla
            </li>
            <li>
              Gerçek dolar işareti: <code className="font-mono">\$</code>
            </li>
            <li>
              Şekil: aşağıdaki yükleyiciyi kullan — metne{" "}
              <code className="font-mono">![alt](kimlik)</code> eklenir. Tek başına bir
              satırdaysa ortalanmış şekil, cümle içindeyse satır içi simge olur.
            </li>
            <li>Boş satır yeni paragraf açar.</li>
          </ul>
        </details>

        <div className="mt-3">
          <ImageUploader
            onInsert={(markup) =>
              // Metnin sonuna ayrı bir satır olarak ekliyoruz: tek başına duran
              // ![...](...) blok görsel olur, paragraf içine karışırsa satır içi.
              setStem((prev) => (prev.trimEnd() ? prev.trimEnd() + "\n\n" : "") + markup + "\n")
            }
          />
        </div>

        <div className="mt-4 rounded-lg border border-line bg-surface-sunk p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Önizleme
          </p>
          <ContentPreview markup={stem} placeholder="Soru metnini yaz, burada görünecek." />
        </div>
      </Card>

      {/* Şıklar */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Şıklar</h2>
          <p className="text-xs text-ink-faint">
            {doluSikSayisi} şık · doğru: {LABELS[correctIndex]}
          </p>
        </div>

        {state.fields?.choices ? (
          <div className="mt-3">
            <Alert>{state.fields.choices}</Alert>
          </div>
        ) : null}
        {state.fields?.correctIndex ? (
          <div className="mt-3">
            <Alert>{state.fields.correctIndex}</Alert>
          </div>
        ) : null}

        <input type="hidden" name="correctIndex" value={correctIndex} />
        {errorTypes.map((value, i) => (
          <input key={i} type="hidden" name={"errorType_" + i} value={value} />
        ))}

        <div className="mt-4 space-y-3">
          {choices.map((value, i) => {
            const dogru = i === correctIndex;
            return (
              <div
                key={i}
                className={
                  "rounded-lg border p-3 transition " +
                  (dogru ? "border-ok bg-ok-wash/40" : "border-line")
                }
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setCorrectIndex(i)}
                    aria-label={LABELS[i] + " şıkkını doğru olarak işaretle"}
                    aria-pressed={dogru}
                    className={
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition " +
                      (dogru
                        ? "border-ok bg-ok text-white"
                        : "border-line-strong text-ink-soft hover:border-ok hover:text-ok")
                    }
                  >
                    {LABELS[i]}
                  </button>

                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      name={"choice_" + i}
                      value={value}
                      onChange={(e) => setChoice(i, e.target.value)}
                      className={INPUT_CLASS + " font-mono text-sm"}
                      placeholder={i === 4 ? "$180$  (boş bırakılırsa 4 şıklı soru)" : "$180$"}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1 rounded border border-line bg-surface-sunk px-3 py-1.5">
                        <ContentPreview markup={value} compact placeholder="—" />
                      </div>

                      {/* Doğru şıkta hata tipi yok: çeldirici değil. */}
                      {!dogru && value.trim() ? (
                        <select
                          value={errorTypes[i]}
                          onChange={(e) => setErrorType(i, e.target.value)}
                          className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink-soft"
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

        <p className="mt-3 text-xs text-ink-faint">
          Doğru şıkkı harfe tıklayarak seç. Hata tipi, öğrencinin o çeldiriciyi seçtiğinde
          hangi hatayı yaptığını kaydeder.
        </p>
      </Card>

      {/* Çözüm */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Çözüm</h2>
        <p className="mt-1 text-xs text-ink-soft">
          İsteğe bağlı ama <strong className="font-semibold">en çok işe yarayan alan</strong>:
          öğrenci test bittikten sonra yanlışının nasıl çözüldüğünü burada görüyor.
          Soru metniyle aynı yazım biçimi geçerli.
        </p>

        <div className="mt-3">
          <Field label="Adım adım çözüm" error={state.fields?.solution}>
            <textarea
              name="solution"
              rows={5}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              className={INPUT_CLASS + " font-mono text-sm leading-relaxed"}
              placeholder={"Pisagor bağıntısından:\n\n$$|AC|^2 = |AB|^2 + |BC|^2$$\n\n$|AC| = 20$ bulunur."}
            />
          </Field>
        </div>

        <div className="mt-3 rounded-lg border border-line bg-surface-sunk p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Önizleme
          </p>
          <ContentPreview markup={solution} placeholder="Çözüm yazılmadı." />
        </div>
      </Card>

      {/* Sınıflandırma */}
      <Card className="p-5">
        <input type="hidden" name="topicId" value={topicId} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="difficulty" value={difficulty} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Konu" error={state.fields?.topicId}>
            <select
              aria-label="Konu"
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Seç…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.scope} · {t.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Durum" error={state.fields?.status}>
            <select
              aria-label="Durum"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={INPUT_CLASS}
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
            hint="1 kolay … 5 zor. Seçimde bant dağılımı için kullanılır."
          >
            <select
              aria-label="Zorluk"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={INPUT_CLASS}
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
            error={state.fields?.targetTimeSeconds}
            hint="Bu sürenin üstü öğrenciye 'yavaş' olarak geri bildirilir."
          >
            <input
              name="targetTimeSeconds"
              type="number"
              min={10}
              max={600}
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Kaynak"
              error={state.fields?.sourceRef}
              hint="İsteğe bağlı. Örn: 2023 TYT / 12"
            >
              <input
                name="sourceRef"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                className={INPUT_CLASS}
                placeholder="2023 TYT / 12"
              />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri kaydet" : "Soruyu kaydet"}
        </Button>
        <Link
          href="/admin/sorular"
          className="text-sm font-medium text-ink-soft hover:text-ink"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
