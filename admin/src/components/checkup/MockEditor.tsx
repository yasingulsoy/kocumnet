"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  ListRestart,
  Plus,
  Replace,
  Save,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  copyMockAction,
  fillMockAction,
  saveMockAction,
  searchMockQuestionsAction,
  similarMockQuestionAction,
} from "@/lib/checkup/actions/mocks";
import type { DenemeKayitSonucu, DenemeSorusu } from "@/lib/checkup/mock";
import {
  CEZA_SINIRI,
  DENEME_SORU_SINIRI,
  ZORLUKLAR,
  denemeEngelleri,
  hedefDagilim,
  listeDurumu,
  zorlukHedefi,
  type DenemeHedefi,
} from "@/lib/checkup/mock-rules";
import { AD_SINIR, OZET_SINIR, SLUG_SINIR, SURE_SINIR, slugOner } from "@/lib/checkup/package-rules";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_STATUSES, QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { BarChart } from "@/components/tailadmin/charts/BarChart";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { useOnay } from "./Onay";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { CODE, MONO, Meter, QUESTION_STATUS_COLOR } from "./ui";

/**
 * Deneme oluşturucu (yalnızca yönetici/müdür; sayfa ve eylemler sunucuda
 * denetler). Kurallar lib/checkup/mock-rules.ts'te — göstergeler ve yayın
 * engelleri burada canlı, kayıtta sunucuda yeniden hesaplanır.
 *
 * Liste düzenleyicinin durumunda tutulur; "Dağılıma göre doldur", arama ve
 * "Benzeriyle değiştir" yalnızca öneri getirir, hiçbir şey "Kaydet"e kadar
 * yazılmaz.
 */

export interface DuzenlenenDeneme {
  id: string;
  slug: string;
  examScope: string;
  name: string;
  summary: string;
  questionCount: number;
  durationMinutes: number;
  penaltyRatio: number;
  status: string;
  /** Başlatılmış oturum sayısı: > 0 ise liste ve puanlama kilitli. */
  oturum: number;
}

type Hata = Extract<DenemeKayitSonucu, { ok: false }>;
type Varsayilan = { soruSayisi: number; sure: number; ceza: number };

const cezaMetni = (n: number) => String(Math.round(n * 10000) / 10000);

export function MockEditor({
  deneme,
  sorular,
  hedefler,
  konuSirasi,
  varsayilanlar,
}: {
  deneme?: DuzenlenenDeneme;
  /** Kayıtlı liste, kitapçık sırasıyla. */
  sorular: DenemeSorusu[];
  /** Sınav → hedef ağırlıklar (Topic.examWeights, yaprak konular). */
  hedefler: Record<string, DenemeHedefi[]>;
  /** Konu → müfredat sırası ("Konu sırasına diz"). */
  konuSirasi: Record<string, number>;
  /** Sınav → yeni denemenin varsayılanları (shared/exams.ts). */
  varsayilanlar: Record<string, Varsayilan>;
}) {
  const yeni = !deneme;
  const kilitli = (deneme?.oturum ?? 0) > 0;
  const router = useRouter();
  const onayla = useOnay();
  const [pending, start] = useTransition();
  const [mesgul, setMesgul] = useState<string | null>(null);
  const gonderiliyor = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [ad, setAd] = useState(deneme?.name ?? "");
  const [ozet, setOzet] = useState(deneme?.summary ?? "");
  const [sinav, setSinav] = useState(deneme?.examScope ?? "");
  const [slug, setSlug] = useState(deneme?.slug ?? "");
  const [slugElle, setSlugElle] = useState(false);
  const [soruSayisi, setSoruSayisi] = useState(String(deneme?.questionCount ?? ""));
  const [sure, setSure] = useState(String(deneme?.durationMinutes ?? ""));
  const [ceza, setCeza] = useState(deneme ? cezaMetni(deneme.penaltyRatio) : "");
  const [durum, setDurum] = useState(deneme?.status ?? "DRAFT");
  const [liste, setListe] = useState<DenemeSorusu[]>(sorular);
  /** "Benzeriyle değiştir"in çıkardıkları: aynı soru geri gelip gidip durmasın. */
  const [degistirilenler, setDegistirilenler] = useState<string[]>([]);
  const [rapor, setRapor] = useState<{ eklenen: number; eksikler: string[]; notlar: string[] } | null>(null);
  const [hata, setHata] = useState<Hata | null>(null);

  // ── Adres (yalnızca yeni denemede, sonra kalıcı) ──────────────
  const onEk = sinav ? (EXAM_LABEL[sinav] ?? sinav) : "";
  const adTemiz = ad.trim();
  const slugKaynagi =
    onEk && !adTemiz.toLocaleLowerCase("tr-TR").startsWith(onEk.toLocaleLowerCase("tr-TR")) ? onEk + " " + adTemiz : adTemiz;
  const gorunenSlug = yeni && !slugElle ? slugOner(slugKaynagi) : slug;

  // ── Göstergeler ──────────────────────────────────────────────
  const n = Number(soruSayisi);
  const sayiGecerli = Number.isInteger(n) && n >= DENEME_SORU_SINIRI.min && n <= DENEME_SORU_SINIRI.max;
  const hedefListesi = useMemo(() => hedefler[sinav] ?? [], [hedefler, sinav]);
  const hedef = useMemo(() => hedefDagilim(hedefListesi, sayiGecerli ? n : 0), [hedefListesi, n, sayiGecerli]);
  const durumOzeti = listeDurumu(sayiGecerli ? n : 0, liste);
  const engeller = sayiGecerli ? denemeEngelleri(durumOzeti) : ["Soru sayısını gir."];
  const yayinEngeli = durum === "PUBLISHED" && engeller.length > 0;

  const dagilim = useMemo(() => {
    const listede = new Map<string, { ad: string; n: number }>();
    for (const q of liste) listede.set(q.topicId, { ad: q.konu, n: (listede.get(q.topicId)?.n ?? 0) + 1 });
    const satirlar = hedefListesi.map((h) => ({ topicId: h.topicId, ad: h.ad, hedef: hedef.get(h.topicId) ?? 0, listede: listede.get(h.topicId)?.n ?? 0 }));
    const hedefte = new Set(hedefListesi.map((h) => h.topicId));
    for (const [topicId, v] of listede) if (!hedefte.has(topicId)) satirlar.push({ topicId, ad: v.ad, hedef: 0, listede: v.n });
    return satirlar.filter((s) => s.hedef > 0 || s.listede > 0);
  }, [liste, hedefListesi, hedef]);

  const zorluk = useMemo(() => {
    const zh = zorlukHedefi(sayiGecerli ? n : 0);
    return {
      listede: ZORLUKLAR.map((z) => liste.filter((q) => q.difficulty === z).length),
      hedef: ZORLUKLAR.map((z) => zh.get(z) ?? 0),
    };
  }, [liste, n, sayiGecerli]);

  // ── Kaydedilmemiş değişiklik ─────────────────────────────────
  const ozetMetni = JSON.stringify([ad, ozet, sinav, gorunenSlug, soruSayisi, sure, ceza, durum, liste.map((q) => q.id)]);
  const [ilkOzet, setIlkOzet] = useState(ozetMetni);
  const kirli = ozetMetni !== ilkOzet;
  useUnsavedGuard(kirli, gonderiliyor);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  const sinavSec = (s: string) => {
    setSinav(s);
    // Sınav seçilince varsayılanlar dolar; yazar değiştirebilir.
    const v = varsayilanlar[s];
    if (v) {
      setSoruSayisi(String(v.soruSayisi));
      setSure(String(v.sure));
      setCeza(cezaMetni(v.ceza));
    }
  };

  // ── Liste işlemleri ──────────────────────────────────────────
  const idler = liste.map((q) => q.id);
  const dolu = sayiGecerli && liste.length >= n;
  const tasi = (i: number, yon: -1 | 1) =>
    setListe((l) => {
      const j = i + yon;
      if (j < 0 || j >= l.length) return l;
      const k = [...l];
      [k[i], k[j]] = [k[j], k[i]];
      return k;
    });
  const cikar = (id: string) => setListe((l) => l.filter((q) => q.id !== id));
  const ekle = (q: DenemeSorusu) => setListe((l) => (l.some((x) => x.id === q.id) ? l : [...l, q]));

  /** Tek seferde bir sunucu işi; hangi düğmenin döndüğü `mesgul`da. */
  const calistir = (hangisi: string, is: () => Promise<void>) => {
    setMesgul(hangisi);
    start(async () => {
      try {
        await is();
      } finally {
        setMesgul(null);
      }
    });
  };

  const doldur = () =>
    calistir("doldur", async () => {
      const r = await fillMockAction({ sinav, soruSayisi: n, mevcut: idler, paketId: deneme?.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setListe((l) => [...l, ...r.eklenen.filter((q) => !l.some((x) => x.id === q.id))]);
      setRapor({ eklenen: r.eklenen.length, eksikler: r.eksikler, notlar: r.notlar });
      if (r.eklenen.length) toast.success(r.eklenen.length + " soru eklendi (kaydetmeyi unutma).");
    });

  const benzer = (q: DenemeSorusu) =>
    calistir("benzer:" + q.id, async () => {
      const r = await similarMockQuestionAction({ sinav, questionId: q.id, haric: [...idler, ...degistirilenler], paketId: deneme?.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (!r.soru) {
        toast.error("“" + q.konu + "” konusunda listede olmayan başka yayında soru kalmadı.");
        return;
      }
      const yeniSoru = r.soru;
      setListe((l) => l.map((x) => (x.id === q.id ? yeniSoru : x)));
      setDegistirilenler((d) => [...d, q.id]);
      toast.success("Değiştirildi: zorluk " + q.difficulty + " → " + yeniSoru.difficulty);
    });

  const konuSirasinaDiz = () =>
    setListe((l) =>
      [...l].sort(
        (a, b) =>
          (konuSirasi[a.topicId] ?? 1e6) - (konuSirasi[b.topicId] ?? 1e6) ||
          a.difficulty - b.difficulty ||
          (a.id < b.id ? -1 : 1)
      )
    );

  // ── Kaydet ───────────────────────────────────────────────────
  const kaydet = () => {
    if (pending) return;
    setHata(null);
    gonderiliyor.current = true;
    const gonderilen = ozetMetni;
    calistir("kaydet", async () => {
      const r = await saveMockAction({
        id: deneme?.id,
        slug: yeni ? gorunenSlug : undefined,
        examScope: yeni ? sinav : undefined,
        name: ad,
        summary: ozet,
        questionCount: soruSayisi,
        durationMinutes: sure,
        penaltyRatio: ceza,
        status: durum,
        questionIds: idler,
      });
      if (!r.ok) {
        gonderiliyor.current = false;
        setHata(r);
        toast.error(r.error ?? "Kaydedilmedi: işaretli alanlara bak.");
        return;
      }
      toast.success(r.yeni ? "Deneme oluşturuldu." : "Deneme kaydedildi.");
      if (r.yeni) {
        router.push("/checkup/paketler/" + r.id);
        return;
      }
      gonderiliyor.current = false;
      setIlkOzet(gonderilen);
      router.refresh();
    });
  };

  const kopyala = () =>
    calistir("kopya", async () => {
      if (!deneme) return;
      const r = await copyMockAction(deneme.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Kopyası taslak olarak açıldı.");
      router.push("/checkup/paketler/" + r.id);
    });

  const alanHatasi = (alan: string) => hata?.fields?.[alan];

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        kaydet();
      }}
    >
      <div className="space-y-4">
        <Alert variant="info" compact>
          Denemede herkes aynı soruları aynı sırayla çözer; yüzdelik ancak böyle anlamlı. Deneme bir kez başlatılınca soru
          listesi ve puanlama ayarları kilitlenir.
        </Alert>
        {kilitli ? (
          <Alert
            variant="warning"
            title={"Bu deneme " + deneme!.oturum + " kez başlatıldı: liste ve puanlama kilitli"}
            action={
              <Button variant="outline" size="xs" startIcon={<CopyPlus />} onClick={kopyala} loading={mesgul === "kopya"}>
                Kopyasını oluştur
              </Button>
            }
          >
            Ad, özet ve yayın durumu değişebilir. Soru eklemek, çıkarmak, sırayı ya da süreyi değiştirmek için kopyasını oluştur:
            aynı ayarlarla taslak bir deneme açılır.
          </Alert>
        ) : null}
        {hata?.error ? <Alert variant="error">{hata.error}</Alert> : null}
      </div>

      <div className="mt-4 grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4 md:space-y-6">
          {/* ── Deneme ayarları ─────────────────────────────── */}
          <ComponentCard title="Deneme" desc="Öğrencinin katalogda gördüğü ad ve sınavın koşulları.">
            <div className="space-y-5">
              {yeni ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Sınav"
                    required
                    error={alanHatasi("examScope")}
                    hint={liste.length ? "Liste boşalmadan sınav değişmez (sorular sınava göre seçildi)." : "Seçince soru sayısı, süre ve yanlış götürme dolar."}
                  >
                    <Select value={sinav} onChange={(e) => sinavSec(e.target.value)} required disabled={liste.length > 0}>
                      <option value="">Seç…</option>
                      {EXAM_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {EXAM_LABEL[s] ?? s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Adres" required error={alanHatasi("slug")} hint="Kalıcı: oluşturulduktan sonra değişmez.">
                    <Input
                      value={gorunenSlug}
                      onChange={(e) => {
                        setSlugElle(true);
                        setSlug(e.target.value.toLowerCase());
                      }}
                      required
                      minLength={SLUG_SINIR.min}
                      maxLength={SLUG_SINIR.max}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      autoComplete="off"
                      className={MONO}
                      placeholder="tyt-deneme-1"
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-theme-sm text-gray-500">
                  {EXAM_LABEL[deneme.examScope] ?? deneme.examScope} · <code className={CODE}>{deneme.slug}</code> — sınav ve
                  adres kalıcıdır.
                </p>
              )}

              <Field label="Ad" required error={alanHatasi("name")}>
                <Input
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  required
                  minLength={AD_SINIR.min}
                  maxLength={AD_SINIR.max}
                  placeholder="TYT Matematik Deneme 1"
                />
              </Field>
              <Field label="Özet" error={alanHatasi("summary")} hint={ozet.trim().length + "/" + OZET_SINIR + " · Katalog kartında görünür."}>
                <TextArea rows={2} value={ozet} onChange={(e) => setOzet(e.target.value)} maxLength={OZET_SINIR + 50} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Soru sayısı" required error={alanHatasi("questionCount")} hint={sinav && varsayilanlar[sinav] ? "Sınavda " + varsayilanlar[sinav].soruSayisi : undefined}>
                  <Input
                    type="number"
                    min={DENEME_SORU_SINIRI.min}
                    max={DENEME_SORU_SINIRI.max}
                    value={soruSayisi}
                    onChange={(e) => setSoruSayisi(e.target.value)}
                    disabled={kilitli}
                    required
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Süre (dakika)"
                  required
                  error={alanHatasi("durationMinutes")}
                  hint={sayiGecerli && Number(sure) > 0 ? Math.round((Number(sure) * 60) / n) + " sn/soru" : undefined}
                >
                  <Input
                    type="number"
                    min={SURE_SINIR.min}
                    max={SURE_SINIR.max}
                    value={sure}
                    onChange={(e) => setSure(e.target.value)}
                    disabled={kilitli}
                    required
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Yanlış götürme"
                  required
                  error={alanHatasi("penaltyRatio")}
                  hint={"0,25 = 4 yanlış 1 doğru · 0 = götürmez" + (sinav && varsayilanlar[sinav] ? " · sınavda " + cezaMetni(varsayilanlar[sinav].ceza) : "")}
                >
                  <Input
                    inputMode="decimal"
                    value={ceza}
                    onChange={(e) => setCeza(e.target.value)}
                    disabled={kilitli}
                    required
                    pattern="[0-9]+([.,][0-9]{1,4})?"
                    title={"0 ile " + CEZA_SINIRI.max + " arası, en fazla 4 hane"}
                    className="tabular"
                  />
                </Field>
              </div>
            </div>
          </ComponentCard>

          {/* ── Soru listesi ────────────────────────────────── */}
          <ComponentCard
            title="Soru listesi"
            desc="Kitapçık sırası. Öğrenci soruları bu sırayla görür."
            badge={
              <Badge size="sm" color={sayiGecerli && liste.length === n ? "success" : "warning"} className="tabular">
                {liste.length}/{sayiGecerli ? n : "?"}
              </Badge>
            }
            flush
          >
            <div className="flex flex-wrap items-center gap-2 border-y border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
              <Button
                size="xs"
                startIcon={<Sparkles />}
                onClick={doldur}
                loading={mesgul === "doldur"}
                disabled={kilitli || !sinav || !sayiGecerli || dolu || pending}
                title={!sinav ? "Önce sınavı seç" : dolu ? "Liste dolu" : undefined}
              >
                Dağılıma göre doldur
              </Button>
              <Button variant="outline" size="xs" startIcon={<ListRestart />} onClick={konuSirasinaDiz} disabled={kilitli || liste.length < 2}>
                Konu sırasına diz
              </Button>
              <Button
                variant="ghost"
                size="xs"
                startIcon={<Trash2 />}
                disabled={kilitli || liste.length === 0}
                onClick={async () => {
                  const evet = await onayla({
                    title: "Liste boşaltılsın mı?",
                    description: liste.length + " soru listeden çıkar (kaydedene kadar hiçbir şey yazılmaz).",
                    confirmLabel: "Boşalt",
                    tone: "warning",
                  });
                  if (evet) {
                    setListe([]);
                    setRapor(null);
                  }
                }}
              >
                Listeyi boşalt
              </Button>
            </div>

            {rapor ? (
              <div className="space-y-2 border-b border-gray-100 px-4 py-3 sm:px-6">
                <Alert
                  variant={rapor.eksikler.length ? "warning" : "success"}
                  compact
                  title={rapor.eklenen + " soru eklendi" + (rapor.eksikler.length ? "; bazı konularda havuz yetmedi" : "")}
                  onClose={() => setRapor(null)}
                  closeLabel="Raporu kapat"
                >
                  {rapor.eksikler.length || rapor.notlar.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 ps-4">
                      {rapor.eksikler.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                      {rapor.notlar.map((e) => (
                        <li key={e} className="text-gray-600">
                          {e}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "Hedef dağılım tuttu. Sırayı gözden geçirip kaydet."
                  )}
                </Alert>
              </div>
            ) : null}

            {liste.length === 0 ? (
              <p className="px-6 py-8 text-center text-theme-sm text-gray-500">
                {sinav ? "Liste boş. “Dağılıma göre doldur” ya da aşağıdan arayıp ekle." : "Önce sınavı seç."}
              </p>
            ) : (
              <ol className="divide-y divide-gray-100">
                {liste.map((q, i) => {
                  const sunucuHatasi = hata?.sorular?.[q.id];
                  return (
                    <li
                      key={q.id}
                      className={cx(
                        // Telefonda düğmeler metnin altına iner (360 px), genişte sağda.
                        "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:px-6",
                        sunucuHatasi && "bg-error-25"
                      )}
                    >
                      <span className="tabular pt-0.5 text-end text-theme-xs font-semibold text-gray-500">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={"/checkup/sorular/" + encodeURIComponent(q.id)}
                          target="_blank"
                          className="line-clamp-2 text-theme-sm text-gray-800 hover:text-brand-500"
                        >
                          {q.ozet || "(metinsiz soru)"}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-theme-xs text-gray-500">
                          <span>{q.konu}</span>
                          <span>zorluk {q.difficulty}</span>
                          {q.status !== "PUBLISHED" ? (
                            <Badge size="sm" color={QUESTION_STATUS_COLOR[q.status]}>
                              {QUESTION_STATUS_LABEL[q.status]}
                            </Badge>
                          ) : null}
                          {!q.sinavda ? (
                            <Badge size="sm" color="error">
                              bu sınavda sorulamaz
                            </Badge>
                          ) : null}
                          {q.digerDeneme ? <span className="text-warning-700">{q.digerDeneme} denemede daha</span> : null}
                          {q.shownCount ? <span>{q.shownCount} kez soruldu</span> : null}
                          {q.sourceRef ? <span className="truncate">{q.sourceRef}</span> : null}
                        </p>
                        {sunucuHatasi ? (
                          <p role="alert" className="mt-1 text-theme-xs text-error-600">
                            {sunucuHatasi}
                          </p>
                        ) : null}
                      </div>
                      {kilitli ? null : (
                        <div className="col-start-2 flex items-start gap-0.5 sm:col-start-auto sm:justify-end">
                          <Button variant="ghost" size="xs" onClick={() => tasi(i, -1)} disabled={i === 0} aria-label={i + 1 + ". soruyu yukarı taşı"}>
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => tasi(i, 1)}
                            disabled={i === liste.length - 1}
                            aria-label={i + 1 + ". soruyu aşağı taşı"}
                          >
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => benzer(q)}
                            loading={mesgul === "benzer:" + q.id}
                            disabled={pending}
                            aria-label={i + 1 + ". soruyu benzeriyle değiştir"}
                            title="Benzeriyle değiştir: aynı konu, yakın zorluk"
                          >
                            <Replace aria-hidden />
                          </Button>
                          <Button variant="danger-outline" size="xs" onClick={() => cikar(q.id)} aria-label={i + 1 + ". soruyu çıkar"}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {!kilitli && sinav ? (
              <SoruAra
                sinav={sinav}
                haric={idler}
                paketId={deneme?.id}
                dolu={dolu}
                onEkle={(q) => {
                  ekle(q);
                  toast.success("Eklendi: " + (liste.length + 1) + ". soru");
                }}
              />
            ) : null}
          </ComponentCard>
        </div>

        {/* ── Sağ: durum, göstergeler, kaydet ──────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tabular font-display text-title-sm font-bold text-gray-800">
                  {liste.length}
                  <span className="text-base font-medium text-gray-500"> / {sayiGecerli ? n : "?"}</span>
                </p>
                <p className="text-theme-xs text-gray-500">
                  soru · {Number(sure) || 0} dk
                  {sayiGecerli && liste.length < n ? " · " + (n - liste.length) + " eksik" : ""}
                </p>
              </div>
              <Badge size="sm" color={engeller.length ? "error" : "success"}>
                {engeller.length ? "Yayınlanamaz" : "Yayınlanabilir"}
              </Badge>
            </div>

            {engeller.length ? (
              <ul className="mt-3 space-y-1.5">
                {engeller.map((e) => (
                  <li key={e} className="flex gap-1.5 text-theme-xs text-error-600">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {hata?.engeller?.length ? (
              <Alert variant="error" compact className="mt-3" title="Sunucu yayını reddetti">
                <ul className="list-disc ps-4">
                  {hata.engeller.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            <div className="mt-5">
              <Field label="Durum" error={alanHatasi("status")}>
                <Select value={durum} onChange={(e) => setDurum(e.target.value)}>
                  {QUESTION_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={s === "PUBLISHED" && engeller.length > 0 && durum !== "PUBLISHED"}>
                      {QUESTION_STATUS_LABEL[s]}
                      {s === "PUBLISHED" && engeller.length > 0 ? " — liste hazır değil" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              {yayinEngeli ? (
                <p className="mt-2 text-theme-xs text-error-600">Liste hazır değilken yayında kaydedilemez. Taslak seç.</p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="submit" loading={mesgul === "kaydet"} disabled={yayinEngeli || pending} startIcon={<Save />} className="flex-1">
                {mesgul === "kaydet" ? "Kaydediliyor…" : yeni ? "Denemeyi oluştur" : "Değişiklikleri kaydet"}
              </Button>
              <ButtonLink href="/checkup/paketler" variant="outline">
                Vazgeç
              </ButtonLink>
            </div>
            <p className="mt-3 text-theme-xs text-gray-500" aria-live="polite">
              {kirli ? "Kaydedilmemiş değişiklik var · " : ""}Ctrl/⌘ + S kaydeder.
            </p>
          </Card>

          <ComponentCard
            title="Konu dağılımı"
            titleAs="h3"
            desc={
              hedefListesi.length
                ? "Hedef: gerçek sınavda konu başına ortalama soru (examWeights), soru sayısına ölçekli."
                : sinav
                  ? "Bu sınavın konularında ağırlık tanımlı değil; hedef yok."
                  : "Sınav seçilince hedef görünür."
            }
          >
            {dagilim.length === 0 ? (
              <p className="text-theme-sm text-gray-500">Gösterilecek konu yok.</p>
            ) : (
              <ul className="space-y-3">
                {dagilim.map((d) => {
                  const ton = d.hedef === 0 ? "brand" : d.listede === d.hedef ? "success" : d.listede < d.hedef ? "warning" : "brand";
                  return (
                    <li key={d.topicId} className="text-theme-xs">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-gray-700" title={d.ad}>
                          {d.ad}
                        </span>
                        <span className="tabular shrink-0 font-semibold text-gray-800">
                          {d.listede}
                          <span className="font-normal text-gray-500">
                            {d.hedef ? " / " + d.hedef : " · hedef dışı"}
                            {d.hedef && d.listede > d.hedef ? " (+" + (d.listede - d.hedef) + ")" : ""}
                          </span>
                        </span>
                      </div>
                      <Meter ratio={d.hedef ? d.listede / d.hedef : 1} tone={ton} />
                    </li>
                  );
                })}
              </ul>
            )}
          </ComponentCard>

          <ComponentCard title="Zorluk dağılımı" titleAs="h3" desc="1 çok kolay … 5 çok zor. Hedef: 1-5'e dengeli.">
            <BarChart
              ariaLabel="Zorluk dağılımı: listede ve hedef"
              categories={ZORLUKLAR.map(String)}
              series={[
                { name: "Listede", data: zorluk.listede },
                { name: "Hedef", data: zorluk.hedef },
              ]}
              height={130}
            />
          </ComponentCard>
        </div>
      </div>
    </form>
  );
}

/** Elle ekleme: metin, kimlik ya da kaynakla arama (paketin sınavında sorulabilenler). */
function SoruAra({
  sinav,
  haric,
  paketId,
  dolu,
  onEkle,
}: {
  sinav: string;
  haric: string[];
  paketId?: string;
  dolu: boolean;
  onEkle: (q: DenemeSorusu) => void;
}) {
  const [metin, setMetin] = useState("");
  const [hepsi, setHepsi] = useState(false);
  const [sonuc, setSonuc] = useState<DenemeSorusu[] | null>(null);
  const [pending, start] = useTransition();

  const ara = () =>
    start(async () => {
      const r = await searchMockQuestionsAction({ sinav, ara: metin, haric, hepsi, paketId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSonuc(r.sorular);
    });

  const gorunen = sonuc?.filter((q) => !haric.includes(q.id)) ?? null;

  return (
    <div className="space-y-3 border-t border-gray-100 px-4 py-4 sm:px-6">
      <p className="text-theme-sm font-semibold text-gray-800">Elle ekle</p>
      {/* Form içinde form olmaz: Enter aramayı başlatır, kaydetmeyi değil. */}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Ara" className="min-w-0 grow basis-56">
          <Input
            type="search"
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ara();
              }
            }}
            placeholder="Metin, kaynak ya da #kimlik…"
            compact
            startIcon={<Search />}
          />
        </Field>
        <Button variant="outline" size="xs" onClick={ara} loading={pending}>
          Ara
        </Button>
      </div>
      <Checkbox checked={hepsi} onChange={(e) => setHepsi(e.target.checked)} label="Yayında olmayanları da göster (taslak, inceleme)" />
      {dolu ? <p className="text-theme-xs text-warning-700">Liste dolu: eklemek için önce bir soru çıkar ya da soru sayısını artır.</p> : null}

      {gorunen ? (
        gorunen.length === 0 ? (
          <p className="text-theme-sm text-gray-500">Bu sınavda sorulabilen, listede olmayan eşleşme yok.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {gorunen.map((q) => (
              <li key={q.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-theme-sm text-gray-800">{q.ozet || "(metinsiz soru)"}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-theme-xs text-gray-500">
                    <span>{q.konu}</span>
                    <span>zorluk {q.difficulty}</span>
                    {q.status !== "PUBLISHED" ? <span className="text-warning-700">{QUESTION_STATUS_LABEL[q.status]}</span> : null}
                    {q.digerDeneme ? <span className="text-warning-700">{q.digerDeneme} denemede</span> : null}
                    <span className={MONO}>#{q.id.slice(-6)}</span>
                  </p>
                </div>
                <Button variant="outline" size="xs" startIcon={<Plus />} onClick={() => onEkle(q)} disabled={dolu}>
                  Ekle
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
