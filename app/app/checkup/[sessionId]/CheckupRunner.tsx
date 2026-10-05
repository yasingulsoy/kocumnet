"use client";

import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CircleCheck,
  Clock,
  Flag,
  Hourglass,
  Keyboard,
  LayoutGrid,
  Loader2,
  LogIn,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { saveAnswerAction, sinavDurumuAction, submitCheckupAction } from "@/lib/actions/checkup";
import { Alert, Button, LinkButton, Logo } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  KayitKuyrugu,
  depoyuSuz,
  sonrakiBosIndeks,
  sunucuylaBirlestir,
  uyariEsigi,
} from "@/lib/sinav-kuyrugu";
import {
  depoOku,
  depoSil,
  depoYaz,
  eskiDepolariTemizle,
  type SinavDeposu,
} from "./sinav-deposu";

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

function hareketAzalt() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── küçük parçalar ───────────────────────────────────────────

/**
 * Soru paleti. Bileşen DIŞARIDA tanımlı: render içinde tanımlansaydı her
 * çizimde yeni bir bileşen kimliği oluşur, React paleti söküp yeniden kurardı.
 */
function Palet({
  questions,
  answers,
  sonraBak,
  index,
  onGoTo,
}: {
  questions: RunnerQuestion[];
  answers: Record<string, string | null>;
  sonraBak: ReadonlySet<string>;
  index: number;
  onGoTo: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
      {questions.map((q, i) => {
        const dolu = Boolean(answers[q.id]);
        const aktif = i === index;
        const sonra = sonraBak.has(q.id);
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onGoTo(i)}
            aria-current={aktif ? "true" : undefined}
            aria-label={
              "Soru " + (i + 1) + (dolu ? ", işaretli" : ", boş") + (sonra ? ", sonra bakılacak" : "")
            }
            className={cn(
              "tabular relative flex aspect-square touch-manipulation items-center justify-center rounded-lg text-[13px] font-semibold transition",
              aktif
                ? "bg-brand-deep text-white shadow-card"
                : dolu
                  ? "bg-brand-wash text-brand ring-1 ring-inset ring-brand/20 hover:bg-brand-wash-strong"
                  : "bg-surface text-ink-faint ring-1 ring-inset ring-line hover:ring-line-strong"
            )}
          >
            {i + 1}
            {sonra ? (
              <span
                aria-hidden
                className="absolute -end-1 -top-1 size-3 rounded-full bg-warn-fill ring-2 ring-surface"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Bitirme diyaloğunda listelenen en fazla soru numarası. */
const ILK_N = 24;

/** Bitirme diyaloğundaki soru numarası listesi: dokununca o soruya gider. */
function NumaraListesi({
  baslik,
  indeksler,
  ton,
  onSec,
}: {
  baslik: string;
  indeksler: number[];
  ton: "warn" | "neutral";
  onSec: (i: number) => void;
}) {
  if (indeksler.length === 0) return null;
  // 50 soruluk seviye aşamasında liste diyaloğu boydan boya kaplamasın.
  const gosterilen = indeksler.slice(0, ILK_N);
  const kalan = indeksler.length - gosterilen.length;
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-ink">{baslik}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {gosterilen.map((i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSec(i)}
              aria-label={`${i + 1}. soruya git`}
              className={cn(
                "tabular flex size-10 touch-manipulation items-center justify-center rounded-lg text-[13px] font-semibold ring-1 ring-inset transition",
                ton === "warn"
                  ? "bg-warn-wash text-warn ring-warn/30 hover:bg-surface"
                  : "bg-surface text-ink-soft ring-line-strong hover:bg-surface-hover"
              )}
            >
              {i + 1}
            </button>
          </li>
        ))}
        {kalan > 0 ? (
          <li className="tabular flex h-10 items-center px-1.5 text-[13px] font-medium text-ink-faint">
            +{kalan} soru
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

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
  const router = useRouter();
  const baslikId = useId();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selectedChoiceId]))
  );
  const [sonraBak, setSonraBak] = useState<ReadonlySet<string>>(() => new Set());
  const [remaining, setRemaining] = useState(remainingMs);
  const [error, setError] = useState<string | null>(null);
  const [bitirHatasi, setBitirHatasi] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [bekleyen, setBekleyen] = useState(0);
  const [ardisikHata, setArdisikHata] = useState(0);
  const [oturumYok, setOturumYok] = useState(false);
  const [sunucuKapatti, setSunucuKapatti] = useState(false);
  const [kayipCevap, setKayipCevap] = useState(0);
  const [duyuru, setDuyuru] = useState("");
  const [konum, setKonum] = useState("");
  const [kapatilanUyari, setKapatilanUyari] = useState<number | null>(null);
  const [bitirAcik, setBitirAcik] = useState(false);
  const [cikisAcik, setCikisAcik] = useState(false);
  const [paletAcik, setPaletAcik] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const current = questions[index];
  const sureBitti = remaining <= 0;
  /** Süre bitti ya da sunucu "süre doldu" dedi: artık yalnızca bitirme var. */
  const kapandi = sureBitti || sunucuKapatti;

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

  // ── gezinme + odak ─────────────────────────────────────────
  const soruRef = useRef<HTMLElement>(null);
  const baslikRef = useRef<HTMLHeadingElement>(null);
  const odakTasiRef = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= questions.length) return;
      flushTime();
      // Odak eski sorunun içindeyse (ör. şık düğmesi) soru değişince belgenin
      // başına düşer; klavyeyle gezen öğrenci yerini kaybeder. Yeni sorunun
      // başlığına taşıyoruz.
      odakTasiRef.current = Boolean(soruRef.current?.contains(document.activeElement));
      setIndex(next);
      // Ekran okuyucu yeni soruyu duysun (sayaç gibi sürekli değil, tek cümle).
      setKonum(`Soru ${next + 1} / ${questions.length}`);
      // Uzun bir sorudan sonra yeni soru ekranın ortasında açılmasın.
      window.scrollTo({ top: 0, behavior: hareketAzalt() ? "auto" : "smooth" });
    },
    [flushTime, questions.length]
  );

  useEffect(() => {
    if (!odakTasiRef.current) return;
    odakTasiRef.current = false;
    baslikRef.current?.focus({ preventScroll: true });
  }, [index]);

  // ── cevap kaydı kuyruğu + "sonra bak" + yerel depo ─────────
  /*
   * Kuyruğun kuralları (tek tur, geri adımlı tekrar, kalıcı hata kodları)
   * saf bir modülde: lib/sinav-kuyrugu.ts — birim testleri smoke'ta. Burada
   * yalnızca kuyruğun olayları ekran durumuna bağlanıyor.
   */
  const sonraRef = useRef<ReadonlySet<string>>(new Set());
  /** Soru başına son yerel değişiklik / kayıt zamanı — eşitleme yeni işareti ezmesin. */
  const degisimRef = useRef<Record<string, number>>({});
  // Kuyruk "test kapandı" deyince eşitlemeyi çağırabilmek için sabit tutamak.
  const senkronlaRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const kuyrukRef = useRef<KayitKuyrugu | null>(null);

  /** Kuyruk ilk kullanımda kurulur; yalnızca olay işleyicileri ve efektler çağırır. */
  const kuyruk = useCallback((): KayitKuyrugu => {
    if (!kuyrukRef.current) {
      kuyrukRef.current = new KayitKuyrugu({
        kaydet: (questionId, kayit) =>
          saveAnswerAction({
            sessionId,
            questionId,
            choiceId: kayit.choiceId,
            timeSpentMs: kayit.timeSpentMs,
          }),
        bildir: (olay) => {
          switch (olay.tur) {
            case "durum":
              setSaveState(olay.durum);
              break;
            case "bekleyen":
              setBekleyen(olay.sayi);
              break;
            case "ardisikHata":
              setArdisikHata(olay.sayi);
              break;
            case "hata":
              setError(olay.mesaj);
              break;
            case "oturumYok":
              setOturumYok(true);
              break;
            case "kayip":
              setKayipCevap(olay.toplam);
              break;
            case "kapandi":
              // Test başka bir yerde bitirilmiş: eşitleme sonuca götürür.
              void senkronlaRef.current();
              break;
            case "sureDoldu":
              setSunucuKapatti(true);
              break;
            case "kaydedildi":
              degisimRef.current[olay.questionId] = olay.zaman;
              break;
            case "depola":
              if (kuyrukRef.current) {
                depoYaz(sessionId, sonraRef.current, kuyrukRef.current.bekleyenler);
              }
              break;
          }
        },
      });
    }
    return kuyrukRef.current;
  }, [sessionId]);

  const depoyuYaz = useCallback(() => {
    depoYaz(sessionId, sonraRef.current, kuyruk().bekleyenler);
  }, [kuyruk, sessionId]);

  const sonraDegistir = useCallback(
    (qid: string) => {
      const s = new Set(sonraRef.current);
      if (s.has(qid)) s.delete(qid);
      else s.add(qid);
      sonraRef.current = s;
      setSonraBak(s);
      depoyuYaz();
    },
    [depoyuYaz]
  );

  useEffect(() => {
    // Ekran kapanırken bekleyen yeniden deneme zamanlayıcısı kalmasın.
    const ref = kuyrukRef;
    return () => ref.current?.durdur();
  }, []);

  // Bağlantı geri geldiğinde beklemeden dene.
  useEffect(() => {
    function onOnline() {
      kuyruk().sifirlaDeneme();
      void kuyruk().bosalt();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [kuyruk]);

  /** Süre dolduktan sonra şık işaretlenmez (diyalog açık, bu ikinci kilit). */
  const kilitliRef = useRef(false);
  useEffect(() => {
    kilitliRef.current = kapandi;
  }, [kapandi]);

  const select = useCallback(
    (choiceId: string) => {
      if (kilitliRef.current) return;
      const q = questions[index];
      // Aynı şıkka tekrar dokunmak işareti kaldırır — optik formda silgiyle
      // aynı davranış.
      const next = answers[q.id] === choiceId ? null : choiceId;

      setAnswers((prev) => ({ ...prev, [q.id]: next }));
      flushTime();
      degisimRef.current[q.id] = Date.now();

      const k = kuyruk();
      k.ekle(q.id, {
        choiceId: next,
        timeSpentMs: Math.round(spentRef.current[q.id] ?? 0),
      });
      depoyuYaz();
      setBekleyen(k.boyut);
      k.sifirlaDeneme();
      void k.bosalt();
    },
    [answers, depoyuYaz, flushTime, index, kuyruk, questions]
  );

  // ── geri sayım ─────────────────────────────────────────────
  /*
   * Bitiş anı bir referansta: sunucuyla eşitleme onu düzeltebiliyor. Sayaç
   * Date.now() ile ilerliyor (performance.now() bazı cihazlarda uykudayken
   * duruyor; sınav süresi ise duvar saatiyle işliyor).
   */
  const bitisRef = useRef(0);

  useEffect(() => {
    bitisRef.current = Date.now() + remainingMs;
    const id = setInterval(() => {
      setRemaining(Math.max(0, bitisRef.current - Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [remainingMs]);

  // ── sunucuyla eşitleme ─────────────────────────────────────
  /*
   * Next geri/ileri gezinmede bu sayfanın ESKİ çıktısını önbellekten geri
   * getiriyor: "Çık" deyip panoya giden ve geri tuşuyla dönen öğrenci ilk
   * açılıştaki kalan süreyi ve işaretleri görüyordu. Ekran açılınca ve sekmeye
   * geri dönülünce süreyi ve işaretleri sunucudan tazeliyoruz.
   */
  const sonSenkronRef = useRef(0);

  const senkronla = useCallback(async () => {
    const basladi = Date.now();
    sonSenkronRef.current = basladi;
    let res: Awaited<ReturnType<typeof sinavDurumuAction>>;
    try {
      res = await sinavDurumuAction(sessionId);
    } catch {
      return; // Bağlantı yok: eldeki hâlle devam.
    }
    if (!res.ok) {
      if (res.kod === "OTURUM") setOturumYok(true);
      return;
    }
    if (res.status !== "IN_PROGRESS") {
      // Test başka bir yerde bitti (başka sekme, süre dolunca bakım işi):
      // ekranı göstermeye devam etmek anlamsız.
      kilitliRef.current = true;
      depoSil(sessionId);
      router.replace(res.target);
      return;
    }
    bitisRef.current = Date.now() + res.remainingMs;
    setRemaining(res.remainingMs);
    // Yerelde bekleyen ya da istek yoldayken değişen işaret daha yeni (kural
    // ve testi lib/sinav-kuyrugu.ts).
    const k = kuyruk();
    setAnswers((onceki) =>
      sunucuylaBirlestir(onceki, res.selections, (qid) => k.bekliyorMu(qid), degisimRef.current, basladi)
    );
  }, [kuyruk, router, sessionId]);

  useEffect(() => {
    senkronlaRef.current = senkronla;
  }, [senkronla]);

  /** Yerel depodan "sonra bak" işaretlerini ve yazılmamış cevapları geri yükler. */
  const geriYukle = useCallback(
    (depo: SinavDeposu) => {
      const { sonra, kuyruk: kayitlar } = depoyuSuz(depo, questions);
      sonraRef.current = sonra;
      setSonraBak(sonra);

      const k = kuyruk();
      const yerel: Record<string, string | null> = {};
      for (const [qid, kayit] of kayitlar) {
        k.ekle(qid, kayit);
        degisimRef.current[qid] = depo.t;
        yerel[qid] = kayit.choiceId;
      }
      if (kayitlar.length > 0) {
        setAnswers((onceki) => ({ ...onceki, ...yerel }));
        setBekleyen(k.boyut);
        void k.bosalt();
      }
    },
    [kuyruk, questions]
  );

  useEffect(() => {
    let iptal = false;
    eskiDepolariTemizle(sessionId);
    const depo = depoOku(sessionId);
    // Durum güncellemeleri efekt gövdesinde değil, bir sonraki mikro görevde.
    void Promise.resolve().then(() => {
      if (iptal) return;
      if (depo) geriYukle(depo);
      void senkronla();
    });
    return () => {
      iptal = true;
    };
  }, [geriYukle, senkronla, sessionId]);

  /*
   * Sekme arkaya atıldığında soru sayacını durdur.
   *
   * Yoksa: telefonu kilitleyip yarım saat sonra dönen öğrencinin o sorusu
   * "30 dakika sürdü" diye kaydediliyor ve konu bazlı hız analizi çöp oluyor.
   * Sınav SÜRESİ işlemeye devam eder (o sunucunun saati) — burada duran tek
   * şey soru başına harcanan süre. Geri dönünce süreyi sunucudan tazeliyoruz.
   */
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        flushTime();
        return;
      }
      shownAtRef.current = Date.now();
      if (Date.now() - sonSenkronRef.current > 15_000) void senkronlaRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flushTime]);

  // ── bitir ──────────────────────────────────────────────────
  const gonderiliyorRef = useRef(false);

  const doSubmit = useCallback(() => {
    // Süre bitişi ile "Bitir" düğmesi aynı anda gelirse ikinci gönderim olmasın.
    if (gonderiliyorRef.current) return;
    gonderiliyorRef.current = true;
    flushTime();
    setBitirHatasi(null);
    startSubmit(async () => {
      try {
        // Bekleyen cevaplar YAZILMADAN puanlama yapılamaz: yoksa öğrencinin
        // işaretlediğini gördüğü soru boş sayılır.
        const k = kuyruk();
        let sonuc = await k.bosalt();
        // Bu arada kuyruğa eklenen olduysa (ör. yerel depodan geri yüklenen
        // cevaplar) onların turunu da bekle.
        for (let i = 0; i < 3 && sonuc === "tamam" && k.boyut > 0; i++) {
          sonuc = await k.bosalt();
        }
        if (sonuc === "oturum") {
          setBitirHatasi("Oturumun kapanmış. Tekrar giriş yap; cevapların bu cihazda saklı.");
          return;
        }
        if (sonuc !== "tamam" || k.boyut > 0) {
          setBitirHatasi(
            "Bazı cevapların henüz kaydedilmedi. Bağlantını kontrol et; kaydedilince testi bitirebilirsin."
          );
          return;
        }

        depoSil(sessionId);
        try {
          const res = await submitCheckupAction(sessionId, { ...spentRef.current });
          // Yönlendirme olduysa buraya hiç gelinmez.
          if (res?.error) {
            depoyuYaz();
            if (res.kod === "OTURUM") setOturumYok(true);
            setBitirHatasi(res.error);
          }
        } catch (e) {
          // Sunucu eylemi yönlendirince söz "redirect" hatasıyla reddediliyor;
          // onu yutmak yönlendirmeyi durdurur.
          unstable_rethrow(e);
          depoyuYaz();
          setBitirHatasi("Bağlantı koptu, test bitirilemedi. İnternetin gelince tekrar dene.");
        }
      } finally {
        gonderiliyorRef.current = false;
      }
    });
  }, [depoyuYaz, flushTime, kuyruk, sessionId]);

  // Süre bitti ya da sunucu "süre doldu" dedi: otomatik bitir. Sunucu süreyi
  // zaten denetliyor; bu, öğrenciyi boş ekranda bırakmamak için.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!kapandi || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    doSubmit();
  }, [kapandi, doSubmit]);

  // Süre dolduktan sonra bitirme bağlantı yüzünden kaldıysa, bağlantı
  // gelince kendiliğinden tekrar dene.
  useEffect(() => {
    if (!kapandi || !bitirHatasi || oturumYok) return;
    const tekrar = () => doSubmit();
    window.addEventListener("online", tekrar);
    return () => window.removeEventListener("online", tekrar);
  }, [kapandi, bitirHatasi, oturumYok, doSubmit]);

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

  // Kuyrukta yazılmamış cevap varken sekmeyi kapatmak riskli (yerel depo
  // gizli sekmede tutmayabilir). "Yenile" düğmesi bilerek yeniliyor.
  const yenileniyorRef = useRef(false);
  useEffect(() => {
    if (bekleyen === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!yenileniyorRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bekleyen]);

  // ── klavye ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (bitirAcik || cikisAcik || paletAcik || kapandi) return;
      // Ctrl+C (kopyala) C şıkkını, Ctrl+A (tümünü seç) A şıkkını işaretliyordu.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const hedef = e.target;
      if (
        hedef instanceof HTMLElement &&
        (hedef.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(hedef.tagName))
      )
        return;

      if (e.key === "ArrowRight") {
        goTo(index + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        goTo(index - 1);
        return;
      }
      // Basılı tutulan harf işareti art arda açıp kapatmasın.
      if (e.repeat) return;

      const q = questions[index];
      const key = e.key.toUpperCase();
      const byLabel = q.choices.find((c) => c.label === key);
      const byNumber = /^[1-5]$/.test(key) ? q.choices[Number(key) - 1] : undefined;

      if (byLabel || byNumber) {
        e.preventDefault();
        select((byLabel ?? byNumber)!.id);
      } else if (key === "S") {
        e.preventDefault();
        sonraDegistir(q.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bitirAcik, cikisAcik, goTo, index, kapandi, paletAcik, questions, select, sonraDegistir]);

  // ── türetilenler ───────────────────────────────────────────
  const isaretli = questions.filter((q) => Boolean(answers[q.id])).length;
  const bos = questions.length - isaretli;
  const bosIndeksler = questions.flatMap((q, i) => (answers[q.id] ? [] : [i]));
  const sonraIndeksler = questions.flatMap((q, i) => (sonraBak.has(q.id) ? [i] : []));
  const son = index === questions.length - 1;
  const kritik = remaining < 2 * 60_000;
  const azaliyor = remaining < 5 * 60_000;
  const sonraMi = sonraBak.has(current.id);
  const harfler = current.choices.map((c) => c.label);

  /** Bulunduğun sorudan sonraki ilk boş (başa sararak). */
  const sonrakiBos = sonrakiBosIndeks(bosIndeksler, index);

  // Son dakikalar uyarısı: 5 ve 1 dakika eşiklerinde birer kez; kapatılabilir.
  const esik = uyariEsigi(remaining);
  const uyariGoster = esik !== null && !kapandi && kapatilanUyari !== esik;

  const soruyaGit = (i: number) => {
    setBitirAcik(false);
    setPaletAcik(false);
    goTo(i);
  };

  return (
    <div className="min-h-screen bg-canvas">
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
          <span className="sr-only" aria-live="polite">
            {konum}
          </span>
        </div>

        {/* Oturum düştü: tekrar denemek işe yaramaz, giriş gerekir. */}
        {oturumYok && !kapandi ? (
          <div role="status" className="border-t border-bad/20 bg-bad-wash">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
              <TriangleAlert className="size-4 shrink-0 text-bad" />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-bad sm:text-[13px]">
                <strong className="font-semibold">Oturumun kapanmış.</strong> Cevapların bu cihazda
                saklı; giriş yapınca kaldığın yerden devam edersin.
              </p>
              <Link
                href="/giris"
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-bad ring-1 ring-inset ring-bad/25"
              >
                <LogIn className="size-3.5" /> Giriş yap
              </Link>
            </div>
          </div>
        ) : saveState === "error" && bekleyen > 0 && !kapandi ? (
          /* Bağlantı uyarısı — başlığa yapışık, kaydırınca da görünür. */
          <div role="status" className="border-t border-bad/20 bg-bad-wash">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
              <TriangleAlert className="size-4 shrink-0 text-bad" />
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-bad sm:text-[13px]">
                <strong className="font-semibold">{bekleyen} cevabın kaydedilmedi.</strong>{" "}
                {ardisikHata >= 3
                  ? "Sorun sürerse sayfayı yenile; cevapların bu cihazda saklı."
                  : "Bağlantın gelince kendiliğinden yazılacak."}
              </p>
              {ardisikHata >= 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    yenileniyorRef.current = true;
                    window.location.reload();
                  }}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-bad ring-1 ring-inset ring-bad/25"
                >
                  <RefreshCw className="size-3.5" /> Yenile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    kuyruk().sifirlaDeneme();
                    void kuyruk().bosalt();
                  }}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-bad ring-1 ring-inset ring-bad/25"
                >
                  <RefreshCw className="size-3.5" /> Dene
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Son dakikalar: kaç boş ve "sonra bak" kaldığını söyler, oraya götürür.
            Yanıp sönmez; eşik başına bir kez görünür, kapatılabilir. */}
        {uyariGoster ? (
          <div className="border-t border-warn/25 bg-warn-wash">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5 sm:px-6">
              <Hourglass className="size-4 shrink-0 text-warn" aria-hidden />
              <p className="tabular min-w-0 flex-1 text-[12px] leading-snug text-warn sm:text-[13px]">
                <strong className="font-semibold">
                  Son {Math.max(1, Math.ceil(remaining / 60_000))} dakika.
                </strong>{" "}
                {bos > 0 ? `${bos} boş` : "Boş sorun yok"}
                {sonraIndeksler.length > 0 ? ` · ${sonraIndeksler.length} sonra bak` : ""}
              </p>
              {sonrakiBos !== null ? (
                <button
                  type="button"
                  onClick={() => goTo(sonrakiBos)}
                  className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-warn ring-1 ring-inset ring-warn/25"
                >
                  Boşa git <ArrowRight className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setKapatilanUyari(esik)}
                aria-label="Uyarıyı kapat"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-warn transition hover:bg-surface"
              >
                <X className="size-4" />
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
            ref={soruRef}
            aria-labelledby={baslikId}
            className="animate-rise rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-8"
          >
            <div className="flex items-center gap-2">
              <h2
                id={baslikId}
                ref={baslikRef}
                tabIndex={-1}
                className="font-display tabular flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-brand-deep px-2 text-[13px] font-bold text-white sm:h-8 sm:min-w-8 sm:text-sm"
              >
                <span className="sr-only">Soru </span>
                {index + 1}
                <span className="sr-only"> / {questions.length}</span>
              </h2>
              <span className="min-w-0 truncate rounded-full bg-surface-sunk px-2.5 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line sm:py-1 sm:text-xs">
                {current.topicName}
              </span>
              {/* Emin olmadığın soruyu işaretle, bitirmeden önce tek listede gör. */}
              <button
                type="button"
                onClick={() => sonraDegistir(current.id)}
                aria-pressed={sonraMi}
                className={cn(
                  "ms-auto flex min-h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold ring-1 ring-inset transition sm:text-[13px]",
                  sonraMi
                    ? "bg-warn-wash text-warn ring-warn/30"
                    : "bg-surface text-ink-soft ring-line hover:bg-surface-hover hover:text-ink"
                )}
              >
                {sonraMi ? (
                  <BookmarkCheck className="size-4" aria-hidden />
                ) : (
                  <Bookmark className="size-4" aria-hidden />
                )}
                Sonra bak
              </button>
            </div>

            <div className="mt-4 text-read leading-relaxed text-ink sm:mt-5">{current.stem}</div>

            <div
              role="radiogroup"
              aria-label={`Soru ${index + 1} şıkları`}
              className="mt-5 space-y-2 sm:mt-6 sm:space-y-2.5"
            >
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
          <div className="mt-5 hidden items-center justify-between gap-4 lg:flex">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft /> Önceki
            </Button>
            <p className="flex items-center gap-1.5 text-center text-xs text-ink-faint">
              <Keyboard className="size-3.5 shrink-0" /> {harfler[0]}–{harfler[harfler.length - 1]}{" "}
              işaretle · S sonra bak · ← → gez · aynı şık işareti kaldırır
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
              <Palet
                questions={questions}
                answers={answers}
                sonraBak={sonraBak}
                index={index}
                onGoTo={goTo}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-wash ring-1 ring-brand/30" />
                <span className="tabular">{isaretli}</span> işaretli
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-surface ring-1 ring-line-strong" />
                <span className="tabular">{bos}</span> boş
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warn-fill" />
                <span className="tabular">{sonraIndeksler.length}</span> sonra bak
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
          <Button
            variant="secondary"
            onClick={() => setPaletAcik(true)}
            aria-label={`Soru listesi, ${index + 1} / ${questions.length}`}
            className="flex-1"
          >
            <LayoutGrid />
            <span className="tabular">
              {index + 1} / {questions.length}
            </span>
            {sonraIndeksler.length > 0 ? (
              <span
                aria-hidden
                className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-fill px-1 text-[11px] font-bold text-white"
              >
                {sonraIndeksler.length}
              </span>
            ) : null}
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
        open={paletAcik && !kapandi}
        onClose={() => setPaletAcik(false)}
        title="Sorular"
        description={
          isaretli +
          " işaretli · " +
          bos +
          " boş" +
          (sonraIndeksler.length > 0 ? " · " + sonraIndeksler.length + " sonra bak" : "")
        }
        variant="sheet"
      >
        <Palet
          questions={questions}
          answers={answers}
          sonraBak={sonraBak}
          index={index}
          onGoTo={soruyaGit}
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
        open={bitirAcik && !kapandi}
        onClose={() => setBitirAcik(false)}
        title="Testi bitirmek istiyor musun?"
        description="Bitirdikten sonra cevaplarını değiştiremezsin."
      >
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-brand-wash p-3 text-center">
            <p className="font-display tabular text-2xl font-bold text-brand">{isaretli}</p>
            <p className="text-xs text-ink-soft">işaretli</p>
          </div>
          <div
            className={cn("rounded-xl p-3 text-center", bos > 0 ? "bg-warn-wash" : "bg-surface-sunk")}
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
          <div
            className={cn(
              "rounded-xl p-3 text-center",
              sonraIndeksler.length > 0 ? "bg-warn-wash" : "bg-surface-sunk"
            )}
          >
            <p
              className={cn(
                "font-display tabular text-2xl font-bold",
                sonraIndeksler.length > 0 ? "text-warn" : "text-ink-faint"
              )}
            >
              {sonraIndeksler.length}
            </p>
            <p className="text-xs text-ink-soft">sonra bak</p>
          </div>
        </div>

        <NumaraListesi
          baslik="Boş bıraktıkların"
          indeksler={bosIndeksler}
          ton="neutral"
          onSec={soruyaGit}
        />
        <NumaraListesi
          baslik="Sonra bakacakların"
          indeksler={sonraIndeksler}
          ton="warn"
          onSec={soruyaGit}
        />

        {bos > 0 ? (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            Boş sorular nete girmez ama konu haritanda &quot;bilmiyorum&quot; olarak sayılır.
          </p>
        ) : null}
        {bekleyen > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-bad">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {bekleyen} cevabın henüz kaydedilmedi. Bitir dediğinde önce onları yazmayı deneyeceğim.
          </p>
        ) : null}
        {bitirHatasi ? <Alert className="mt-4">{bitirHatasi}</Alert> : null}
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
      <Dialog
        open={cikisAcik && !kapandi}
        onClose={() => setCikisAcik(false)}
        title="Testten çıkmak istiyor musun?"
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          Cevapların kayıtlı, istediğin zaman kaldığın yerden devam edebilirsin.{" "}
          <strong className="font-semibold text-ink">Ama süre işlemeye devam eder:</strong>{" "}
          <span className="tabular font-semibold text-ink">{formatClock(remaining)}</span> kaldı.
        </p>
        {bekleyen > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {bekleyen} cevabın henüz sunucuya ulaşmadı. Bu cihazda saklı; teste döndüğünde
            gönderilir.
          </p>
        ) : null}
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

      {/* Süre doldu — kapatılamaz: öğrenci teste geri dönemez, sonuca gider. */}
      <Dialog
        open={kapandi}
        onClose={() => {}}
        dismissable={false}
        title="Süre doldu"
        description={
          bitirHatasi
            ? undefined
            : "Kaydedilen cevapların değerlendiriliyor, birazdan sonuç ekranındasın."
        }
      >
        {bitirHatasi ? (
          <>
            <Alert>{bitirHatasi}</Alert>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Kaydedilen cevapların kaybolmaz. Bağlantın gelince kendiliğinden tekrar deneyeceğim;
              bu ekranı kapatsan da sonucun hesaplanıp Gelişim sayfana düşer.
            </p>
            <div className="mt-5 flex gap-2.5">
              {oturumYok ? (
                <LinkButton href="/giris" className="flex-1">
                  <LogIn /> Giriş yap
                </LinkButton>
              ) : (
                <Button onClick={doSubmit} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tekrar dene
                </Button>
              )}
              <LinkButton href="/panel" variant="secondary" className="flex-1">
                Ana sayfa
              </LinkButton>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-surface-sunk p-4">
            <Loader2 className="size-5 shrink-0 animate-spin text-brand" aria-hidden />
            <p className="text-sm text-ink-soft">
              <span className="tabular font-semibold text-ink">{isaretli}</span> işaretli,{" "}
              <span className="tabular font-semibold text-ink">{bos}</span> boş.
            </p>
          </div>
        )}
        {kayipCevap > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Son {kayipCevap} işaretin süre dolduktan sonra ulaştığı için kaydedilemedi.
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
