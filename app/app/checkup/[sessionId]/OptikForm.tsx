"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  FileText,
  Loader2,
  LogIn,
  Printer,
  RefreshCw,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { saveAnswerAction, sinavDurumuAction, submitCheckupAction } from "@/lib/actions/checkup";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { cn } from "@/lib/cn";
import { KayitKuyrugu, depoyuSuz, sunucuylaBirlestir } from "@/lib/sinav-kuyrugu";
import { depoOku, depoSil, depoYaz, eskiDepolariTemizle } from "./sinav-deposu";

export interface OptikSoru {
  id: string;
  choices: { id: string; label: string }[];
  selectedChoiceId: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Gönderme penceresinde listelenen en fazla boş soru numarası. */
const ILK_N = 30;

/** Kâğıtta "sonra bak" yok; yerel depo yine aynı biçimde (boş küme). */
const BOS_KUME: ReadonlySet<string> = new Set();

/**
 * Kâğıt oturumunun optik formu: soru numarası × şık harfi kabarcıkları.
 *
 * Sayaç yok (öğrenci süresini kâğıtta tuttu); her işaret sınav ekranındaki
 * kayıt kuyruğundan geçip hemen sunucuya yazılır, bağlantı yoksa bu cihazda
 * bekler (lib/sinav-kuyrugu.ts, sinav-deposu.ts). Yarıda bırakan öğrenci
 * döndüğünde işaretleri yerinde bulur. "Cevapları gönder" mevcut bitirme
 * yolundan geçer; süreler 0 (sunucu da kâğıtta süre yazmıyor).
 *
 * Kabarcıklar 44 px: telefonda yanlış satıra dokunmak, optik formdaki en
 * pahalı hata. Aynı harfe tekrar dokunmak işareti siler (silgi).
 */
export function OptikForm({
  sessionId,
  packageName,
  durationMinutes,
  remainingMs,
  deadlineLabel,
  questions,
}: {
  sessionId: string;
  packageName: string;
  durationMinutes: number;
  /** Cevapları işlemenin son anına kalan süre (sunucu saati). */
  remainingMs: number;
  /** "23 Ekim Perşembe 14:30" — sunucuda biçimlenir (saat dilimi sabit). */
  deadlineLabel: string;
  questions: OptikSoru[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selectedChoiceId]))
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [bekleyen, setBekleyen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [oturumYok, setOturumYok] = useState(false);
  const [kapandi, setKapandi] = useState(remainingMs <= 0);
  const [gonderAcik, setGonderAcik] = useState(false);
  const [bitirHatasi, setBitirHatasi] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // ── kayıt kuyruğu ──────────────────────────────────────────
  const degisimRef = useRef<Record<string, number>>({});
  const senkronlaRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const kuyrukRef = useRef<KayitKuyrugu | null>(null);

  const kuyruk = useCallback((): KayitKuyrugu => {
    if (!kuyrukRef.current) {
      kuyrukRef.current = new KayitKuyrugu({
        kaydet: (questionId, kayit) =>
          saveAnswerAction({ sessionId, questionId, choiceId: kayit.choiceId, timeSpentMs: 0 }),
        bildir: (olay) => {
          switch (olay.tur) {
            case "durum":
              setSaveState(olay.durum);
              break;
            case "bekleyen":
              setBekleyen(olay.sayi);
              break;
            case "hata":
              setError(olay.mesaj);
              break;
            case "oturumYok":
              setOturumYok(true);
              break;
            case "kapandi":
              void senkronlaRef.current();
              break;
            case "sureDoldu":
              setKapandi(true);
              break;
            case "kaydedildi":
              degisimRef.current[olay.questionId] = olay.zaman;
              break;
            case "depola":
              if (kuyrukRef.current) depoYaz(sessionId, BOS_KUME, kuyrukRef.current.bekleyenler);
              break;
            default:
              break;
          }
        },
      });
    }
    return kuyrukRef.current;
  }, [sessionId]);

  useEffect(() => {
    const ref = kuyrukRef;
    return () => ref.current?.durdur();
  }, []);

  useEffect(() => {
    function onOnline() {
      kuyruk().sifirlaDeneme();
      void kuyruk().bosalt();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [kuyruk]);

  const kilitliRef = useRef(kapandi);
  useEffect(() => {
    kilitliRef.current = kapandi;
  }, [kapandi]);

  const isaretle = useCallback(
    (q: OptikSoru, choiceId: string) => {
      if (kilitliRef.current) return;
      const next = answers[q.id] === choiceId ? null : choiceId;
      setAnswers((prev) => ({ ...prev, [q.id]: next }));
      degisimRef.current[q.id] = Date.now();
      const k = kuyruk();
      k.ekle(q.id, { choiceId: next, timeSpentMs: 0 });
      depoYaz(sessionId, BOS_KUME, k.bekleyenler);
      setBekleyen(k.boyut);
      k.sifirlaDeneme();
      void k.bosalt();
    },
    [answers, kuyruk, sessionId]
  );

  // ── sunucuyla eşitleme ve yerel depo ───────────────────────
  const senkronla = useCallback(async () => {
    const basladi = Date.now();
    let res: Awaited<ReturnType<typeof sinavDurumuAction>>;
    try {
      res = await sinavDurumuAction(sessionId);
    } catch {
      return;
    }
    if (!res.ok) {
      if (res.kod === "OTURUM") setOturumYok(true);
      return;
    }
    if (res.status !== "IN_PROGRESS") {
      kilitliRef.current = true;
      depoSil(sessionId);
      router.replace(res.target);
      return;
    }
    if (res.remainingMs <= 0) setKapandi(true);
    const k = kuyruk();
    setAnswers((onceki) =>
      sunucuylaBirlestir(onceki, res.selections, (qid) => k.bekliyorMu(qid), degisimRef.current, basladi)
    );
  }, [kuyruk, router, sessionId]);

  useEffect(() => {
    senkronlaRef.current = senkronla;
  }, [senkronla]);

  useEffect(() => {
    let iptal = false;
    eskiDepolariTemizle(sessionId);
    const depo = depoOku(sessionId);
    void Promise.resolve().then(() => {
      if (iptal) return;
      if (depo) {
        const { kuyruk: kayitlar } = depoyuSuz(depo, questions);
        const k = kuyruk();
        const yerel: Record<string, string | null> = {};
        for (const [qid, kayit] of kayitlar) {
          k.ekle(qid, { choiceId: kayit.choiceId, timeSpentMs: 0 });
          degisimRef.current[qid] = depo.t;
          yerel[qid] = kayit.choiceId;
        }
        if (kayitlar.length > 0) {
          setAnswers((onceki) => ({ ...onceki, ...yerel }));
          setBekleyen(k.boyut);
          void k.bosalt();
        }
      }
      void senkronla();
    });
    return () => {
      iptal = true;
    };
  }, [kuyruk, questions, senkronla, sessionId]);

  // Sekmeye geri dönünce (ör. kitapçıktan) işaretleri tazele.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") void senkronlaRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Son an geldiğinde (48 saat açık bırakılan sekme) gönder.
  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setTimeout(() => setKapandi(true), Math.min(remainingMs, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [remainingMs]);

  useEffect(() => {
    if (bekleyen === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bekleyen]);

  // ── gönder ─────────────────────────────────────────────────
  const gonderiliyorRef = useRef(false);
  // `bitiren`: öğrenci "Gönder"e bastıysa STUDENT, işleme süresi dolduysa TIMEOUT (CheckupRunner ile aynı).
  const gonder = useCallback((bitiren: "STUDENT" | "TIMEOUT") => {
    if (gonderiliyorRef.current) return;
    gonderiliyorRef.current = true;
    setBitirHatasi(null);
    startSubmit(async () => {
      try {
        const k = kuyruk();
        let sonuc = await k.bosalt();
        for (let i = 0; i < 3 && sonuc === "tamam" && k.boyut > 0; i++) sonuc = await k.bosalt();
        if (sonuc === "oturum") {
          setBitirHatasi("Oturumun kapanmış. Tekrar giriş yap; işaretlerin bu cihazda saklı.");
          return;
        }
        if (sonuc !== "tamam" || k.boyut > 0) {
          setBitirHatasi("Bazı işaretlerin henüz kaydedilmedi. Bağlantını kontrol et; kaydedilince gönderebilirsin.");
          return;
        }
        depoSil(sessionId);
        try {
          const res = await submitCheckupAction(sessionId, undefined, bitiren);
          if (res?.error) {
            depoYaz(sessionId, BOS_KUME, k.bekleyenler);
            if (res.kod === "OTURUM") setOturumYok(true);
            setBitirHatasi(res.error);
          }
        } catch (e) {
          // Yönlendirme "redirect" hatasıyla geliyor; onu yutmak yönlendirmeyi durdurur.
          unstable_rethrow(e);
          setBitirHatasi("Bağlantı koptu, cevaplar gönderilemedi. İnternetin gelince tekrar dene.");
        }
      } finally {
        gonderiliyorRef.current = false;
      }
    });
  }, [kuyruk, sessionId]);

  const otomatikRef = useRef(false);
  useEffect(() => {
    if (!kapandi || otomatikRef.current) return;
    otomatikRef.current = true;
    gonder("TIMEOUT");
  }, [kapandi, gonder]);

  // ── türetilenler ───────────────────────────────────────────
  const isaretli = questions.filter((q) => Boolean(answers[q.id])).length;
  const bos = questions.length - isaretli;
  const bosNumaralar = questions.flatMap((q, i) => (answers[q.id] ? [] : [i + 1]));
  const kitapcik = `/kitapcik/${sessionId}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-3 sm:h-16 sm:gap-4 sm:px-6">
          <Link
            href="/panel"
            aria-label="Optik formdan çık"
            className="-ms-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-5" />
          </Link>
          <div className="hidden items-center gap-2.5 sm:flex">
            <Logo className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-theme-sm font-semibold text-gray-800">{packageName}</p>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 sm:text-theme-xs">
              <span className="tabular font-medium text-gray-700">
                {isaretli}/{questions.length} işaretli
              </span>
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1",
                  saveState === "saved" && "text-success-700",
                  saveState === "error" && "text-error-700",
                  saveState === "idle" && "invisible"
                )}
              >
                {saveState === "saving" ? (
                  <>
                    <Loader2 className="size-3 shrink-0 animate-spin" /> Kaydediliyor
                  </>
                ) : saveState === "error" ? (
                  <>
                    <TriangleAlert className="size-3 shrink-0" /> Kaydedilemedi
                  </>
                ) : (
                  <>
                    <Check className="size-3 shrink-0" /> Kaydedildi
                  </>
                )}
              </span>
            </div>
          </div>
          <ButtonLink href={kitapcik} variant="outline" size="xs" startIcon={<Printer />} className="shrink-0">
            Kitapçık
          </ButtonLink>
        </div>

        {oturumYok ? (
          <div role="status" className="border-t border-error-200 bg-error-50">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
              <TriangleAlert className="size-4 shrink-0 text-error-600" />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-error-700 sm:text-[13px]">
                <strong className="font-semibold">Oturumun kapanmış.</strong> İşaretlerin bu cihazda saklı; giriş
                yapınca kaldığın yerden devam edersin.
              </p>
              <Link
                href={`/giris?sonra=${encodeURIComponent(`/checkup/${sessionId}`)}`}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-error-700 ring-1 ring-error-200 ring-inset"
              >
                <LogIn className="size-3.5" /> Giriş yap
              </Link>
            </div>
          </div>
        ) : saveState === "error" && bekleyen > 0 ? (
          <div role="status" className="border-t border-error-200 bg-error-50">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
              <TriangleAlert className="size-4 shrink-0 text-error-600" />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-error-700 sm:text-[13px]">
                <strong className="font-semibold">{bekleyen} işaretin kaydedilmedi.</strong> Bağlantın gelince
                kendiliğinden yazılacak.
              </p>
              <button
                type="button"
                onClick={() => {
                  kuyruk().sifirlaDeneme();
                  void kuyruk().bosalt();
                }}
                className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-error-700 ring-1 ring-error-200 ring-inset"
              >
                <RefreshCw className="size-3.5" /> Dene
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 pb-32 pt-5 sm:px-6 sm:pt-6">
        {/* Nasıl: üç adım. Kitapçık bağlantısı burada da, üst çubukta da. */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base font-semibold text-gray-800 sm:text-lg">Kâğıtta çözüyorsun</h1>
              <ol className="mt-2 list-decimal space-y-1 ps-5 text-theme-sm leading-relaxed text-gray-600">
                <li>Kitapçığı yazdır ya da PDF olarak kaydet.</li>
                <li>
                  <span className="tabular">{durationMinutes}</span> dakika süre tutarak çöz.
                </li>
                <li>Cevaplarını aşağıya işle ve gönder; boş bıraktığın soruyu boş bırak.</li>
              </ol>
              <p className="mt-3 text-theme-sm text-gray-500">
                Son gün: <strong className="font-semibold text-gray-800">{deadlineLabel}</strong>. Bu ana kadar
                göndermezsen işaretlediklerinle puanlanır.
              </p>
              <ButtonLink href={kitapcik} variant="soft" size="sm" startIcon={<Printer />} className="mt-4 max-sm:w-full">
                Kitapçığı aç
              </ButtonLink>
            </div>
          </div>
        </Card>

        {error ? (
          <Alert variant="error" compact>
            {error}
          </Alert>
        ) : null}

        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-gray-800">Optik form</h2>
            <p className="text-theme-xs text-gray-500">Aynı harfe tekrar dokunmak işareti siler.</p>
          </div>
          {/* Sütunlar yukarıdan aşağı akar (gerçek optik form gibi): 1-20 ilk
              sütunda, 21-40 ikincide. Satır sütun ortasında bölünmez. */}
          <div className="mt-4 gap-x-10 md:columns-2 lg:columns-3">
            {questions.map((q, i) => {
              const secili = answers[q.id];
              return (
                <div
                  key={q.id}
                  role="radiogroup"
                  aria-label={`${i + 1}. soru`}
                  className="flex break-inside-avoid items-center gap-2 border-b border-gray-100 py-1.5 last:border-b-0"
                >
                  <span className="tabular w-7 shrink-0 text-end font-display text-theme-sm font-semibold text-gray-700">
                    {i + 1}
                  </span>
                  <div className="flex gap-1.5">
                    {q.choices.map((c) => {
                      const bu = secili === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={bu}
                          aria-label={`${i + 1}. soru ${c.label} şıkkı`}
                          disabled={kapandi}
                          onClick={() => isaretle(q, c.id)}
                          className={cn(
                            "flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-sm font-bold transition sm:size-10",
                            bu
                              ? "bg-brand-500 text-white shadow-theme-xs"
                              : "bg-white text-gray-600 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 hover:ring-gray-400"
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Gönder çubuğu — başparmak bölgesi */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-2.5 sm:px-6">
          <p className="tabular min-w-0 flex-1 text-theme-sm text-gray-500">
            <span className="font-semibold text-gray-800">{isaretli}</span> işaretli ·{" "}
            <span className="font-semibold text-gray-800">{bos}</span> boş
          </p>
          <Button onClick={() => setGonderAcik(true)} disabled={submitting || kapandi} startIcon={<Send />}>
            Cevapları gönder
          </Button>
        </div>
      </div>

      <Modal
        isOpen={gonderAcik && !kapandi}
        onClose={() => setGonderAcik(false)}
        title="Cevapları gönderiyor musun?"
        description="Gönderdikten sonra işaretlerini değiştiremezsin; sonucun hemen hesaplanır."
        size="sm"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-brand-50 p-3 text-center">
            <p className="tabular font-display text-2xl font-bold text-brand-500">{isaretli}</p>
            <p className="text-theme-xs text-gray-500">işaretli</p>
          </div>
          <div className={cn("rounded-xl p-3 text-center", bos > 0 ? "bg-warning-50" : "bg-gray-100")}>
            <p className={cn("tabular font-display text-2xl font-bold", bos > 0 ? "text-warning-700" : "text-gray-500")}>
              {bos}
            </p>
            <p className="text-theme-xs text-gray-500">boş</p>
          </div>
        </div>
        {bosNumaralar.length > 0 ? (
          <p className="tabular mt-4 text-theme-sm leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-800">Boş: </span>
            {bosNumaralar.slice(0, ILK_N).join(", ")}
            {bosNumaralar.length > ILK_N ? ` +${bosNumaralar.length - ILK_N}` : ""}
            <span className="block text-theme-xs text-gray-500">
              Kâğıtta işaretlediğin bir soru burada boşsa vazgeç ve işle.
            </span>
          </p>
        ) : null}
        {bekleyen > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-theme-sm leading-relaxed text-error-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {bekleyen} işaretin henüz kaydedilmedi. Gönder dediğinde önce onları yazmayı deneyeceğim.
          </p>
        ) : null}
        {bitirHatasi ? (
          <Alert variant="error" compact className="mt-4">
            {bitirHatasi}
          </Alert>
        ) : null}
        <div className="mt-6 flex gap-2.5">
          <Button variant="outline" onClick={() => setGonderAcik(false)} className="flex-1">
            Vazgeç
          </Button>
          <Button onClick={() => gonder("STUDENT")} loading={submitting} startIcon={<Send />} className="flex-1">
            {submitting ? "Hesaplanıyor…" : "Gönder"}
          </Button>
        </div>
      </Modal>

      {/* Son an geçti: işaretlenenlerle puanlanır; kapatılamaz. */}
      <Modal
        isOpen={kapandi}
        onClose={() => {}}
        dismissable={false}
        title="Cevap işleme süresi doldu"
        description={bitirHatasi ? undefined : "İşaretlediklerin değerlendiriliyor, birazdan sonuç ekranındasın."}
        size="sm"
      >
        {bitirHatasi ? (
          <>
            <Alert variant="error" compact>
              {bitirHatasi}
            </Alert>
            <div className="mt-6 flex gap-2.5">
              {oturumYok ? (
                <ButtonLink href={`/giris?sonra=${encodeURIComponent(`/checkup/${sessionId}`)}`} className="flex-1" startIcon={<LogIn />}>
                  Giriş yap
                </ButtonLink>
              ) : (
                <Button onClick={() => gonder("TIMEOUT")} loading={submitting} startIcon={<RefreshCw />} className="flex-1">
                  Tekrar dene
                </Button>
              )}
              <ButtonLink href="/panel" variant="outline" className="flex-1">
                Ana sayfa
              </ButtonLink>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <Loader2 className="size-5 shrink-0 animate-spin text-brand-500" aria-hidden />
            <p className="text-sm text-gray-500">
              <span className="tabular font-semibold text-gray-800">{isaretli}</span> işaretli,{" "}
              <span className="tabular font-semibold text-gray-800">{bos}</span> boş.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
