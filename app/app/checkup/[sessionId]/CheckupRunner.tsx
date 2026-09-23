"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Clock,
  Flag,
  Keyboard,
  LayoutGrid,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { saveAnswerAction, submitCheckupAction } from "@/lib/actions/checkup";
import { Alert, Button, Logo } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

export interface RunnerChoice {
  id: string;
  label: string;
  content: ReactNode;
}

export interface RunnerQuestion {
  id: string;
  order: number;
  topicName: string;
  stem: ReactNode;
  choices: RunnerChoice[];
  selectedChoiceId: string | null;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

/**
 * Soru paleti. Bileşen DIŞARIDA tanımlı: render içinde tanımlansaydı her
 * çizimde yeni bir bileşen kimliği oluşur, React paleti söküp yeniden kurardı.
 */
function Palet({
  questions,
  answers,
  index,
  onGoTo,
}: {
  questions: RunnerQuestion[];
  answers: Record<string, string | null>;
  index: number;
  onGoTo: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
      {questions.map((q, i) => {
        const dolu = Boolean(answers[q.id]);
        const aktif = i === index;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onGoTo(i)}
            aria-current={aktif ? "true" : undefined}
            aria-label={"Soru " + (i + 1) + (dolu ? ", işaretli" : ", boş")}
            className={cn(
              "tabular flex aspect-square touch-manipulation items-center justify-center rounded-lg text-[13px] font-semibold transition",
              aktif
                ? "bg-brand-deep text-white shadow-card"
                : dolu
                  ? "bg-brand-wash text-brand ring-1 ring-inset ring-brand/20 hover:bg-brand-wash-strong"
                  : "bg-surface text-ink-faint ring-1 ring-inset ring-line hover:ring-line-strong"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Bekleyen kayıt: aynı soru için son işaret neyse o gider. */
interface BekleyenKayit {
  choiceId: string | null;
  timeSpentMs: number;
}

/** Süre uyarılarının eşiği (ms) ve metni — her eşik bir kez duyurulur. */
const SURE_UYARILARI = [
  { esik: 5 * 60_000, metin: "5 dakika kaldı." },
  { esik: 60_000, metin: "1 dakika kaldı. Boş sorulara işaret koy." },
] as const;

/**
 * Sınav modu. Uygulama çerçevesi (kenar çubuğu, sekme çubuğu) YOK: test
 * sırasında dikkati dağıtan her şey kaldırılıyor.
 *
 * Masaüstü: sağda sabit soru paleti. Mobil: palet alttan açılan tabakada,
 * önceki/sonraki başparmağın ulaştığı alt çubukta.
 *
 * Şıklar neden gerçek `<input type="radio">` değil: aynı şıkka tekrar
 * dokunmak işareti KALDIRIYOR (optik formda silgi). Radyo düğmesi bir kez
 * seçildikten sonra boşaltılamaz; bunu taklit etmek için yazılacak kod,
 * role="radio" düğmelerden daha kırılgan olurdu.
 */
export function CheckupRunner({
  sessionId,
  packageName,
  questions,
  remainingMs,
}: {
  sessionId: string;
  packageName: string;
  questions: RunnerQuestion[];
  remainingMs: number;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selectedChoiceId]))
  );
  const [remaining, setRemaining] = useState(remainingMs);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [bekleyen, setBekleyen] = useState(0);
  const [duyuru, setDuyuru] = useState("");
  const [bitirAcik, setBitirAcik] = useState(false);
  const [cikisAcik, setCikisAcik] = useState(false);
  const [paletAcik, setPaletAcik] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const current = questions[index];

  // ── süre ölçümü ────────────────────────────────────────────
  // Soru başına harcanan süre konu bazlı hız analizinin girdisi.
  const spentRef = useRef<Record<string, number>>({});
  // Date.now() render sırasında çağrılamaz (saflık kuralı) — bağlandıktan
  // sonra kuruyoruz; efektler her etkileşimden önce çalışır.
  const shownAtRef = useRef(0);

  useEffect(() => {
    shownAtRef.current = Date.now();
  }, []);

  const flushTime = useCallback(() => {
    const qid = questions[index]?.id;
    if (!qid) return;
    const now = Date.now();
    spentRef.current[qid] = (spentRef.current[qid] ?? 0) + (now - shownAtRef.current);
    shownAtRef.current = now;
  }, [index, questions]);

  /*
   * Sekme arkaya atıldığında sayacı durdur.
   *
   * Yoksa: telefonu kilitleyip yarım saat sonra dönen öğrencinin o sorusu
   * "30 dakika sürdü" diye kaydediliyor ve konu bazlı hız analizi çöp oluyor.
   * Sınav SÜRESİ işlemeye devam eder (o sunucunun saati) — burada duran tek
   * şey soru başına harcanan süre.
   */
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") flushTime();
      else shownAtRef.current = Date.now();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flushTime]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= questions.length) return;
      flushTime();
      setIndex(next);
      // Uzun bir sorudan sonra yeni soru ekranın ortasında açılmasın.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [flushTime, questions.length]
  );

  // ── cevap kaydı: kuyruk + yeniden deneme ───────────────────
  /*
   * Neden kuyruk: mobil internet kopar. Eski akışta kayıt isteği başarısız
   * olduğunda cevap yalnızca ekranda kalıyordu — öğrenci işaretli görüyor,
   * sunucuda hiçbir şey yok, test bitince o soru boş sayılıyordu. Şimdi
   * kayıt kuyrukta bekliyor, bağlantı gelince yazılıyor ve testi bitirmeden
   * ÖNCE kuyruğun boşalması bekleniyor.
   */
  const kuyrukRef = useRef<Map<string, BekleyenKayit>>(new Map());
  const calisiyorRef = useRef(false);
  const denemeRef = useRef(0);
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kendini yeniden çağırabilmek için (backoff) sabit bir tutamak: efektler
  // ve zamanlayıcılar hep bunun üzerinden çağırır.
  const bosaltRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  const bosalt = useCallback(async (): Promise<boolean> => {
    if (zamanlayiciRef.current) {
      clearTimeout(zamanlayiciRef.current);
      zamanlayiciRef.current = null;
    }
    if (kuyrukRef.current.size === 0) return true;
    // Zaten bir tur dönüyorsa onun bitmesini bekleyen çağrıya "henüz değil"
    // demek yeterli: tur, kuyruğa yeni eklenenleri de görür.
    if (calisiyorRef.current) return false;

    calisiyorRef.current = true;
    setSaveState("saving");

    try {
      while (kuyrukRef.current.size > 0) {
        const [qid, veri] = kuyrukRef.current.entries().next().value!;
        const res = await saveAnswerAction({
          sessionId,
          questionId: qid,
          choiceId: veri.choiceId,
          timeSpentMs: veri.timeSpentMs,
        });

        if (!res.ok) {
          // Sunucu "oturum kapandı / süre doldu" diyorsa tekrar denemek
          // işe yaramaz; hatayı gösterip kuyruğu bırakıyoruz.
          setError(res.error ?? "Cevap kaydedilemedi.");
          throw new Error("kayit-basarisiz");
        }

        // Öğrenci bu sırada şıkkı değiştirdiyse yeni kayıt kuyrukta kalsın.
        if (kuyrukRef.current.get(qid) === veri) kuyrukRef.current.delete(qid);
        setBekleyen(kuyrukRef.current.size);
      }

      denemeRef.current = 0;
      setSaveState("saved");
      setError(null);
      return true;
    } catch {
      setSaveState("error");
      const gecikme = Math.min(30_000, 1_000 * 2 ** denemeRef.current);
      denemeRef.current += 1;
      zamanlayiciRef.current = setTimeout(() => {
        void bosaltRef.current();
      }, gecikme);
      return false;
    } finally {
      calisiyorRef.current = false;
      setBekleyen(kuyrukRef.current.size);
    }
  }, [sessionId]);

  useEffect(() => {
    bosaltRef.current = bosalt;
  }, [bosalt]);

  useEffect(() => {
    return () => {
      if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    };
  }, []);

  // Bağlantı geri geldiğinde beklemeden dene.
  useEffect(() => {
    function onOnline() {
      denemeRef.current = 0;
      void bosaltRef.current();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const select = useCallback(
    (choiceId: string) => {
      const q = questions[index];
      // Aynı şıkka tekrar dokunmak işareti kaldırır — optik formda silgiyle
      // aynı davranış.
      const next = answers[q.id] === choiceId ? null : choiceId;

      setAnswers((prev) => ({ ...prev, [q.id]: next }));
      flushTime();

      kuyrukRef.current.set(q.id, {
        choiceId: next,
        timeSpentMs: Math.round(spentRef.current[q.id] ?? 0),
      });
      setBekleyen(kuyrukRef.current.size);
      denemeRef.current = 0;
      void bosaltRef.current();
    },
    [answers, flushTime, index, questions]
  );

  // ── geri sayım ─────────────────────────────────────────────
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setRemaining(Math.max(0, remainingMs - (Date.now() - started)));
    }, 500);
    return () => clearInterval(id);
  }, [remainingMs]);

  const doSubmit = useCallback(() => {
    flushTime();
    startSubmit(async () => {
      // Bekleyen cevaplar YAZILMADAN puanlama yapılamaz: yoksa öğrencinin
      // işaretlediğini gördüğü soru boş sayılır.
      const yazildi = await bosaltRef.current();
      if (!yazildi) {
        setError(
          "Bazı cevapların henüz kaydedilmedi. Bağlantını kontrol et; kaydedilince testi bitirebilirsin."
        );
        return;
      }
      const res = await submitCheckupAction(sessionId, { ...spentRef.current });
      // Yönlendirme olduysa buraya hiç gelinmez.
      if (res?.error) setError(res.error);
    });
  }, [flushTime, sessionId]);

  useEffect(() => {
    if (remaining > 0 || autoSubmittedRef.current) return;
    // Süre bitti: otomatik bitir. Sunucu süreyi zaten denetliyor; bu yalnızca
    // öğrenciyi boş ekranda bırakmamak için.
    autoSubmittedRef.current = true;
    doSubmit();
  }, [remaining, doSubmit]);

  // ── süre duyuruları ────────────────────────────────────────
  /*
   * Sayacın kendisi aria-live DEĞİL: saniye saniye okunan bir sayaç ekran
   * okuyucu kullanan öğrencinin soruyu duymasını imkânsız kılar. Eşikleri
   * bir kez duyuruyoruz.
   */
  const duyurulanRef = useRef<number[]>([]);
  useEffect(() => {
    for (const u of SURE_UYARILARI) {
      if (remaining <= u.esik && !duyurulanRef.current.includes(u.esik)) {
        duyurulanRef.current.push(u.esik);
        setDuyuru(u.metin);
      }
    }
  }, [remaining]);

  // ── kazara çıkışı önle ─────────────────────────────────────
  /*
   * Android'de geri hareketi (ve masaüstünde geri düğmesi) testin ortasında
   * öğrenciyi dışarı atıyordu. Cevaplar kayıtlı olsa bile süre işlediği için
   * bu gerçek bir kayıp: geri hareketini yakalayıp çıkış onayını açıyoruz.
   */
  useEffect(() => {
    history.pushState({ kocumTest: true }, "");
    function onPop() {
      history.pushState({ kocumTest: true }, "");
      setCikisAcik(true);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Kuyrukta yazılmamış cevap varken sekmeyi kapatmak veri kaybı.
  useEffect(() => {
    if (bekleyen === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bekleyen]);

  // ── klavye ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (bitirAcik || cikisAcik || paletAcik) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName))
        return;

      const q = questions[index];
      const key = e.key.toUpperCase();
      const byLabel = q.choices.find((c) => c.label === key);
      const byNumber = /^[1-5]$/.test(key) ? q.choices[Number(key) - 1] : undefined;

      if (byLabel || byNumber) {
        e.preventDefault();
        select((byLabel ?? byNumber)!.id);
      } else if (e.key === "ArrowRight") {
        goTo(index + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bitirAcik, cikisAcik, goTo, index, paletAcik, questions, select]);

  const isaretli = Object.values(answers).filter(Boolean).length;
  const bos = questions.length - isaretli;
  const son = index === questions.length - 1;
  const kritik = remaining < 2 * 60_000;
  const azaliyor = remaining < 5 * 60_000;

  return (
    <div className="min-h-screen bg-bg">
      {/* Üst çubuk */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:h-16 sm:gap-5 sm:px-6">
          <button
            type="button"
            onClick={() => setCikisAcik(true)}
            aria-label="Testten çık"
            className="-ms-1.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-soft transition hover:bg-surface-hover hover:text-ink"
          >
            <X className="size-5" />
          </button>

          <div className="hidden items-center gap-2.5 sm:flex">
            <Logo className="size-7" />
            <p className="max-w-[16rem] truncate text-sm font-semibold text-ink">{packageName}</p>
          </div>

          {/* İlerleme */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[11px] text-ink-soft sm:text-xs">
              <span className="tabular shrink-0 font-medium">
                {isaretli}/{questions.length} işaretli
              </span>
              {/* Kayıt durumu telefonda da görünür: mobilde simge, sm+ metin.
                  Eskiden sm:flex ile saklıydı ve kayıt hatası telefonda hiç
                  belli olmuyordu. */}
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 transition",
                  saveState === "saving" && "text-ink-faint",
                  saveState === "saved" && "text-ok",
                  saveState === "error" && "text-bad",
                  saveState === "idle" && "invisible"
                )}
              >
                {saveState === "saving" ? (
                  <>
                    <Loader2 className="size-3 shrink-0 animate-spin" />
                    <span className="max-sm:hidden">Kaydediliyor</span>
                  </>
                ) : saveState === "error" ? (
                  <>
                    <TriangleAlert className="size-3 shrink-0" />
                    <span className="truncate">Kaydedilemedi</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3 shrink-0" />
                    <span className="max-sm:hidden">Kaydedildi</span>
                  </>
                )}
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunk ring-1 ring-inset ring-line sm:mt-1.5"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={isaretli}
              aria-label="İşaretlenen soru sayısı"
            >
              <div
                className="bg-brand-gradient h-full rounded-full transition-[width] duration-300"
                style={{ width: (isaretli / questions.length) * 100 + "%" }}
              />
            </div>
          </div>

          {/* Süre — kritikte yanıp sönmüyor: son iki dakikada ekranda titreyen
              bir sayaç, matematik sorusu çözen öğrenciyi sorudan koparıyor. */}
          <div
            className={cn(
              "tabular flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-mono text-[15px] font-bold transition sm:px-3 sm:py-2",
              kritik
                ? "bg-bad-fill text-white"
                : azaliyor
                  ? "bg-warn-wash text-warn ring-1 ring-inset ring-warn/25"
                  : "bg-surface-sunk text-ink ring-1 ring-inset ring-line"
            )}
            role="timer"
            aria-live="off"
            aria-label={"Kalan süre " + formatClock(remaining)}
          >
            <Clock className="size-4" aria-hidden />
            {formatClock(remaining)}
          </div>
          <span className="sr-only" aria-live="polite">
            {duyuru}
          </span>
        </div>

        {/* Bağlantı uyarısı — başlığa yapışık, kaydırınca da görünür. */}
        {saveState === "error" && bekleyen > 0 ? (
          <div className="border-t border-bad/20 bg-bad-wash">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
              <TriangleAlert className="size-4 shrink-0 text-bad" />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-bad sm:text-[13px]">
                <strong className="font-semibold">{bekleyen} cevabın kaydedilmedi.</strong>{" "}
                Bağlantın gelince kendiliğinden yazılacak.
              </p>
              <button
                type="button"
                onClick={() => {
                  denemeRef.current = 0;
                  void bosaltRef.current();
                }}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-bad ring-1 ring-inset ring-bad/25"
              >
                <RefreshCw className="size-3.5" /> Dene
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-32 pt-5 sm:px-6 sm:pt-6 lg:grid-cols-[1fr_280px] lg:pb-12">
        {/* Soru */}
        <div className="min-w-0">
          {error ? <Alert className="mb-4">{error}</Alert> : null}

          <article
            key={current.id}
            className="animate-rise rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-8"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display tabular flex h-7 min-w-7 items-center justify-center rounded-lg bg-brand-deep px-2 text-[13px] font-bold text-white sm:h-8 sm:min-w-8 sm:text-sm">
                {index + 1}
              </span>
              <span className="rounded-full bg-surface-sunk px-2.5 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line sm:py-1 sm:text-xs">
                {current.topicName}
              </span>
            </div>

            <div className="mt-4 text-read leading-relaxed text-ink sm:mt-5">{current.stem}</div>

            <div role="radiogroup" aria-label="Şıklar" className="mt-5 space-y-2 sm:mt-6 sm:space-y-2.5">
              {current.choices.map((choice) => {
                const secili = answers[current.id] === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={secili}
                    onClick={() => select(choice.id)}
                    className={cn(
                      "group flex w-full touch-manipulation items-center gap-3 rounded-xl border-2 px-3 py-3 text-start transition sm:gap-4 sm:px-4",
                      "min-h-[var(--tap-comfort)]",
                      secili
                        ? "border-brand bg-brand-wash"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunk active:bg-surface-sunk"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                        secili
                          ? "bg-brand text-white"
                          : "bg-surface-sunk text-ink-soft ring-1 ring-inset ring-line-strong group-hover:ring-ink-faint"
                      )}
                    >
                      {choice.label}
                    </span>
                    <span className="min-w-0 flex-1 text-body text-ink sm:text-base">
                      {choice.content}
                    </span>
                    {secili ? <CircleCheck className="size-5 shrink-0 text-brand" /> : null}
                  </button>
                );
              })}
            </div>
          </article>

          {/* Masaüstü gezinme */}
          <div className="mt-5 hidden items-center justify-between lg:flex">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft /> Önceki
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-ink-faint">
              <Keyboard className="size-3.5" /> A–E işaretle · ← → gez · aynı şık işareti kaldırır
            </p>
            {son ? (
              <Button onClick={() => setBitirAcik(true)} disabled={submitting}>
                <Flag /> Testi bitir
              </Button>
            ) : (
              <Button onClick={() => goTo(index + 1)}>
                Sonraki <ArrowRight />
              </Button>
            )}
          </div>
        </div>

        {/* Masaüstü soru paleti */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="text-sm font-semibold text-ink">Sorular</p>
            <div className="mt-3">
              <Palet questions={questions} answers={answers} index={index} onGoTo={goTo} />
            </div>
            <div className="mt-4 flex gap-4 border-t border-line pt-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-wash ring-1 ring-brand/30" />
                <span className="tabular">{isaretli}</span> işaretli
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-surface ring-1 ring-line-strong" />
                <span className="tabular">{bos}</span> boş
              </span>
            </div>
            <Button
              variant="soft"
              block
              className="mt-4"
              onClick={() => setBitirAcik(true)}
              disabled={submitting}
            >
              <Flag /> Testi bitir
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobil alt çubuk — başparmak bölgesi */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pt-2.5 sm:px-4">
          <Button
            variant="secondary"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Önceki soru"
            className="px-3.5"
          >
            <ArrowLeft />
          </Button>
          <Button variant="secondary" onClick={() => setPaletAcik(true)} className="flex-1">
            <LayoutGrid />
            <span className="tabular">
              {index + 1} / {questions.length}
            </span>
          </Button>
          {son ? (
            <Button onClick={() => setBitirAcik(true)} disabled={submitting} className="flex-1">
              <Flag /> Bitir
            </Button>
          ) : (
            <Button onClick={() => goTo(index + 1)} className="flex-1">
              Sonraki <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {/* Mobil soru paleti */}
      <Dialog
        open={paletAcik}
        onClose={() => setPaletAcik(false)}
        title="Sorular"
        description={isaretli + " işaretli · " + bos + " boş"}
        variant="sheet"
      >
        <Palet
          questions={questions}
          answers={answers}
          index={index}
          onGoTo={(i) => {
            goTo(i);
            setPaletAcik(false);
          }}
        />
        <Button
          variant="soft"
          block
          className="mt-5"
          onClick={() => {
            setPaletAcik(false);
            setBitirAcik(true);
          }}
        >
          <Flag /> Testi bitir
        </Button>
      </Dialog>

      {/* Bitirme onayı */}
      <Dialog
        open={bitirAcik}
        onClose={() => setBitirAcik(false)}
        title="Testi bitirmek istiyor musun?"
        description="Bitirdikten sonra cevaplarını değiştiremezsin."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-wash p-4 text-center">
            <p className="font-display tabular text-2xl font-bold text-brand">{isaretli}</p>
            <p className="text-xs text-ink-soft">işaretli</p>
          </div>
          <div
            className={cn("rounded-xl p-4 text-center", bos > 0 ? "bg-warn-wash" : "bg-surface-sunk")}
          >
            <p
              className={cn(
                "font-display tabular text-2xl font-bold",
                bos > 0 ? "text-warn" : "text-ink-faint"
              )}
            >
              {bos}
            </p>
            <p className="text-xs text-ink-soft">boş</p>
          </div>
        </div>
        {bos > 0 ? (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            Boş sorular nete girmez ama konu haritanda &quot;bilmiyorum&quot; olarak sayılır.
          </p>
        ) : null}
        {bekleyen > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-bad">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {bekleyen} cevabın henüz kaydedilmedi. Bitir dediğinde önce onları yazmayı deneyeceğim.
          </p>
        ) : null}
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" onClick={() => setBitirAcik(false)} className="flex-1">
            Devam et
          </Button>
          <Button onClick={doSubmit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="animate-spin" /> : <Flag />}
            {submitting ? "Hesaplanıyor…" : "Bitir"}
          </Button>
        </div>
      </Dialog>

      {/* Çıkış onayı */}
      <Dialog open={cikisAcik} onClose={() => setCikisAcik(false)} title="Testten çıkmak istiyor musun?">
        <p className="text-sm leading-relaxed text-ink-soft">
          Cevapların kayıtlı, istediğin zaman kaldığın yerden devam edebilirsin.{" "}
          <strong className="font-semibold text-ink">Ama süre işlemeye devam eder:</strong>{" "}
          <span className="tabular font-semibold text-ink">{formatClock(remaining)}</span> kaldı.
        </p>
        <div className="mt-5 flex gap-2.5">
          <Button variant="secondary" onClick={() => setCikisAcik(false)} className="flex-1">
            Teste dön
          </Button>
          <Link
            href="/panel"
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-bad-wash text-sm font-semibold text-bad transition hover:bg-bad-fill hover:text-white"
          >
            Çık
          </Link>
        </div>
      </Dialog>
    </div>
  );
}
