"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { savePackageAction } from "@/lib/checkup/actions/packages";
import type { PaketKayitSonucu } from "@/lib/checkup/package-save";
import { EXAM_LABEL, EXAM_SCOPES, QUESTION_STATUSES, QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { konuSinavdaMi } from "@/lib/checkup/shared/exam-scope";
import {
  AD_SINIR,
  MAX_KONU,
  MAX_PER_TOPIC,
  MIN_PER_TOPIC,
  OZET_SINIR,
  SLUG_SINIR,
  SURE_SINIR,
  bandTargets,
  konuHavuzu,
  slugOner,
  type HavuzSayisi,
  type KonuHavuzu,
} from "@/lib/checkup/package-rules";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { Card, CardHeader, Field, INPUT_CLASS, MONO, Notice, Pill, SELECT_CLASS, TEXTAREA_CLASS, buttonClass, type Tone } from "./ui";

/**
 * Katalog paketi düzenleyici (yalnızca yönetici/müdür; sayfa ve eylem
 * sunucuda denetler). Kurallar lib/checkup/package-rules.ts'te; sunucu
 * (package-save.ts) her birini yeniden denetler — buradaki denetimler
 * yazarken anında görülsün diye.
 */

export interface PaketKonusu {
  id: string;
  name: string;
  parentName: string | null;
  examScope: string;
  examScopes: string[];
}

export interface DuzenlenenPaket {
  id: string;
  slug: string;
  examScope: string;
  name: string;
  summary: string;
  durationMinutes: number;
  status: string;
  topics: { topicId: string; questionCount: number }[];
}

type Satir = { key: number; topicId: string; count: string };
type Hata = Extract<PaketKayitSonucu, { ok: false }>;

const HAVUZ_TON: Record<KonuHavuzu, Tone> = { ready: "ok", narrow: "warn", blocked: "bad" };
const HAVUZ_ETIKET: Record<KonuHavuzu, string> = { ready: "yeterli", narrow: "dar", blocked: "yetmiyor" };
const BOS_HAVUZ: HavuzSayisi = { have: 0, easy: 0, medium: 0, hard: 0 };

export function PackageEditor({
  paket,
  konular,
  havuz,
}: {
  /** Düzenlenen paket; yoksa yeni paket. */
  paket?: DuzenlenenPaket;
  konular: PaketKonusu[];
  /** havuz[sınav][konuId]: paketin çekebileceği yayındaki soru (öğrenci uygulamasının kuralıyla). */
  havuz: Record<string, Record<string, HavuzSayisi>>;
}) {
  const yeni = !paket;
  const router = useRouter();
  const [pending, start] = useTransition();
  const gonderiliyor = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [ad, setAd] = useState(paket?.name ?? "");
  const [ozet, setOzet] = useState(paket?.summary ?? "");
  const [sure, setSure] = useState(String(paket?.durationMinutes ?? 20));
  const [sinav, setSinav] = useState(paket?.examScope ?? "");
  const [slug, setSlug] = useState(paket?.slug ?? "");
  const [slugElle, setSlugElle] = useState(false);
  const [durum, setDurum] = useState(paket?.status ?? "DRAFT");
  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    paket
      ? paket.topics.map((t, i) => ({ key: i, topicId: t.topicId, count: String(t.questionCount) }))
      : [{ key: 0, topicId: "", count: String(MIN_PER_TOPIC) }]
  );
  const [sonrakiAnahtar, setSonrakiAnahtar] = useState(paket ? paket.topics.length : 1);
  const [hata, setHata] = useState<Hata | null>(null);

  // ── Adres (yalnızca yeni pakette, sonra kalıcı) ──────────────
  const onEk = sinav ? (EXAM_LABEL[sinav] ?? sinav) : "";
  const adTemiz = ad.trim();
  const slugKaynagi =
    onEk && !adTemiz.toLocaleLowerCase("tr-TR").startsWith(onEk.toLocaleLowerCase("tr-TR"))
      ? onEk + " " + adTemiz
      : adTemiz;
  const gorunenSlug = yeni && !slugElle ? slugOner(slugKaynagi) : slug;

  // ── Konu satırları: anında denetim ──────────────────────────
  const konuHaritasi = new Map(konular.map((k) => [k.id, k]));
  const sinavHavuzu = havuz[sinav] ?? {};
  const secenekler = sinav ? konular.filter((k) => konuSinavdaMi(k, sinav)) : [];
  const gruplar = new Map<string, PaketKonusu[]>();
  for (const k of secenekler) {
    const g = k.parentName ?? "Diğer";
    gruplar.set(g, [...(gruplar.get(g) ?? []), k]);
  }

  const satirDurumlari = satirlar.map((s, i) => {
    const n = Number(s.count);
    const sayiGecerli = s.count.trim() !== "" && Number.isInteger(n) && n >= MIN_PER_TOPIC && n <= MAX_PER_TOPIC;
    const konu = konuHaritasi.get(s.topicId);
    const ilk = satirlar.findIndex((x) => x.topicId === s.topicId);
    const h = sinavHavuzu[s.topicId] ?? BOS_HAVUZ;
    const sorun = !s.topicId
      ? "Konu seç."
      : ilk !== i
        ? "Bu konu " + (ilk + 1) + ". satırda zaten var."
        : !konu || !sinav || !konuSinavdaMi(konu, sinav)
          ? "Bu konu paketin sınavında yok."
          : !sayiGecerli
            ? "Soru sayısı " + MIN_PER_TOPIC + "–" + MAX_PER_TOPIC + " arası olmalı: daha azıyla konu seviyesi ölçülemez."
            : null;
    const havuzDurumu: KonuHavuzu | null = !sorun ? konuHavuzu(h.have, n) : null;
    const hedef = sayiGecerli ? bandTargets(n) : null;
    const eksikBant = hedef
      ? [h.easy < hedef.easy ? "kolay" : null, h.medium < hedef.medium ? "orta" : null, h.hard < hedef.hard ? "zor" : null].filter(Boolean)
      : [];
    return { n: sayiGecerli ? n : 0, h, sorun, havuzDurumu, eksikBant, sunucu: hata?.satirlar?.[i] };
  });

  const toplam = satirDurumlari.reduce((t, d) => t + d.n, 0);
  const gecerli = satirlar.length > 0 && satirDurumlari.every((d) => !d.sorun);
  const yayinlanabilir = gecerli && satirDurumlari.every((d) => d.havuzDurumu !== "blocked");
  const genelHavuz: KonuHavuzu = !yayinlanabilir
    ? "blocked"
    : satirDurumlari.some((d) => d.havuzDurumu === "narrow")
      ? "narrow"
      : "ready";
  const yayinEngeli = durum === "PUBLISHED" && !yayinlanabilir;

  // ── Kaydedilmemiş değişiklik ─────────────────────────────────
  const ozetMetni = JSON.stringify([ad, ozet, sure, sinav, gorunenSlug, durum, satirlar.map((s) => [s.topicId, s.count])]);
  const [ilkOzet, setIlkOzet] = useState(ozetMetni);
  const kirli = ozetMetni !== ilkOzet;
  useUnsavedGuard(kirli, gonderiliyor);

  // Ctrl/⌘ + S: formu gönderir (tarayıcının "sayfayı kaydet"i açılmasın).
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  const satirDegistir = (i: number, alan: Partial<Satir>) =>
    setSatirlar((onceki) => onceki.map((s, j) => (j === i ? { ...s, ...alan } : s)));
  const tasi = (i: number, yon: -1 | 1) =>
    setSatirlar((onceki) => {
      const j = i + yon;
      if (j < 0 || j >= onceki.length) return onceki;
      const kopya = [...onceki];
      [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
      return kopya;
    });
  const ekle = () => {
    setSatirlar((onceki) => [...onceki, { key: sonrakiAnahtar, topicId: "", count: String(MIN_PER_TOPIC) }]);
    setSonrakiAnahtar((k) => k + 1);
  };

  const kaydet = () => {
    if (pending) return;
    setHata(null);
    gonderiliyor.current = true;
    const gonderilen = ozetMetni;
    start(async () => {
      const r = await savePackageAction({
        id: paket?.id,
        slug: yeni ? gorunenSlug : undefined,
        examScope: yeni ? sinav : undefined,
        name: ad,
        summary: ozet,
        durationMinutes: sure,
        status: durum,
        topics: satirlar.map((s) => ({ topicId: s.topicId, questionCount: s.count })),
      });
      if (!r.ok) {
        gonderiliyor.current = false;
        setHata(r);
        toast.error(r.error ?? "Kaydedilmedi: işaretli alanlara bak.");
        return;
      }
      toast.success(r.yeni ? "Paket oluşturuldu (taslaksa yayına almayı unutma)." : "Paket kaydedildi.");
      if (r.yeni) {
        router.push("/checkup/paketler/" + r.id);
        return;
      }
      gonderiliyor.current = false;
      setIlkOzet(gonderilen);
      router.refresh();
    });
  };

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
        <Notice tone="info">
          Paket ayarları test başlarken kopyalanır: değişiklik yalnızca bundan sonra başlayan testleri etkiler.
          Süren ve bitmiş testler eski hâliyle kalır.
        </Notice>
        {hata?.error ? <Notice>{hata.error}</Notice> : null}
      </div>

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Paket" description="Öğrencinin katalogda gördüğü ad, özet ve süre." />
            <div className="space-y-4 p-5 sm:p-6">
              {yeni ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Sınav" htmlFor="paket-sinav" error={alanHatasi("examScope")} hint="Sonradan değişmez: yanlış götürme oranı ve konu kapsamı buna bağlı.">
                    <select
                      id="paket-sinav"
                      value={sinav}
                      onChange={(e) => setSinav(e.target.value)}
                      required
                      className={SELECT_CLASS}
                    >
                      <option value="">Seç…</option>
                      {EXAM_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {EXAM_LABEL[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Adres"
                    htmlFor="paket-slug"
                    error={alanHatasi("slug")}
                    hint="Kalıcı: paket oluşturulduktan sonra değişmez (bağlantılar ve kayıtlar buna bağlı)."
                  >
                    <input
                      id="paket-slug"
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
                      className={clsx(INPUT_CLASS, MONO)}
                      placeholder="tyt-geometri-2"
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-caption text-ink-soft">
                  {EXAM_LABEL[paket.examScope] ?? paket.examScope} ·{" "}
                  <span className={MONO + " rounded bg-surface-sunk px-1.5 py-0.5 text-micro text-ink"}>{paket.slug}</span>{" "}
                  <span className="text-ink-faint">— sınav ve adres kalıcıdır.</span>
                </p>
              )}

              <Field label="Ad" htmlFor="paket-ad" error={alanHatasi("name")}>
                <input
                  id="paket-ad"
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  required
                  minLength={AD_SINIR.min}
                  maxLength={AD_SINIR.max}
                  className={INPUT_CLASS}
                  placeholder="TYT Geometri"
                />
              </Field>

              <Field
                label="Özet"
                htmlFor="paket-ozet"
                error={alanHatasi("summary")}
                hint={ozet.trim().length + "/" + OZET_SINIR + " · Katalog kartında görünür; ne ölçtüğünü bir cümleyle söyle."}
              >
                <textarea
                  id="paket-ozet"
                  rows={2}
                  value={ozet}
                  onChange={(e) => setOzet(e.target.value)}
                  maxLength={OZET_SINIR + 50}
                  className={TEXTAREA_CLASS}
                  placeholder="Açılar, üçgenler, dörtgenler ve çemberde temel seviye ölçümü."
                />
              </Field>

              <Field
                label="Süre (dakika)"
                htmlFor="paket-sure"
                error={alanHatasi("durationMinutes")}
                hint={toplam > 0 ? toplam + " soru için " + Math.round((Number(sure) * 60) / toplam) + " sn/soru" : undefined}
              >
                <input
                  id="paket-sure"
                  type="number"
                  min={SURE_SINIR.min}
                  max={SURE_SINIR.max}
                  value={sure}
                  onChange={(e) => setSure(e.target.value)}
                  required
                  className={clsx(INPUT_CLASS, "max-w-40")}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Konu dağılımı"
              description={
                "Konu başına en az " +
                MIN_PER_TOPIC +
                " soru. Havuz: paketin sınavında sorulabilen yayındaki sorular (öğrenci uygulamasının seçim kuralıyla)."
              }
              action={
                <span className="text-micro tabular text-ink-faint">
                  {satirlar.length}/{MAX_KONU} konu · {toplam} soru
                </span>
              }
            />
            <div className="space-y-3 p-5 sm:p-6">
              {alanHatasi("topics") ? <Notice>{alanHatasi("topics")}</Notice> : null}
              {!sinav ? <Notice tone="info">Önce sınavı seç: konular sınava göre listelenir.</Notice> : null}

              <ol className="space-y-3">
                {satirlar.map((s, i) => {
                  const d = satirDurumlari[i];
                  const konu = konuHaritasi.get(s.topicId);
                  const listede = secenekler.some((k) => k.id === s.topicId);
                  const mesaj = d.sunucu ?? d.sorun;
                  return (
                    <li
                      key={s.key}
                      className={clsx(
                        "rounded-xl border p-3",
                        mesaj && s.topicId ? "border-bad/40 bg-bad-wash/40" : "border-line"
                      )}
                    >
                      <div className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_6.5rem_auto] sm:items-center">
                        <span className="hidden text-center text-micro font-semibold text-ink-faint tabular sm:block">{i + 1}</span>
                        <select
                          value={s.topicId}
                          onChange={(e) => satirDegistir(i, { topicId: e.target.value })}
                          aria-label={i + 1 + ". konu"}
                          disabled={!sinav}
                          className={SELECT_CLASS}
                        >
                          <option value="">Konu seç…</option>
                          {s.topicId && !listede && konu ? (
                            <option value={s.topicId}>{konu.name} (bu sınavda yok)</option>
                          ) : null}
                          {[...gruplar.entries()].map(([grup, liste]) => (
                            <optgroup key={grup} label={grup}>
                              {liste.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={MIN_PER_TOPIC}
                          max={MAX_PER_TOPIC}
                          value={s.count}
                          onChange={(e) => satirDegistir(i, { count: e.target.value })}
                          aria-label={i + 1 + ". konunun soru sayısı"}
                          className={clsx(INPUT_CLASS, "tabular")}
                        />
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => tasi(i, -1)}
                            disabled={i === 0}
                            className={buttonClass("ghost", "xs")}
                            aria-label={i + 1 + ". konuyu yukarı taşı"}
                          >
                            <ArrowUp aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => tasi(i, 1)}
                            disabled={i === satirlar.length - 1}
                            className={buttonClass("ghost", "xs")}
                            aria-label={i + 1 + ". konuyu aşağı taşı"}
                          >
                            <ArrowDown aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSatirlar((onceki) => onceki.filter((_, j) => j !== i))}
                            className={clsx(buttonClass("ghost", "xs"), "text-bad")}
                            aria-label={i + 1 + ". konuyu çıkar"}
                          >
                            <Trash2 aria-hidden />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro sm:ps-10">
                        {mesaj ? (
                          <span role={d.sunucu ? "alert" : undefined} className={s.topicId || d.sunucu ? "text-bad" : "text-ink-faint"}>
                            {mesaj}
                          </span>
                        ) : d.havuzDurumu ? (
                          <>
                            <Pill tone={HAVUZ_TON[d.havuzDurumu]}>Havuz {HAVUZ_ETIKET[d.havuzDurumu]}</Pill>
                            <span className="tabular text-ink-soft">
                              {d.h.have} yayında soru · paket {d.n} istiyor
                            </span>
                            <span className="tabular text-ink-faint">
                              kolay {d.h.easy} · orta {d.h.medium} · zor {d.h.hard}
                            </span>
                            {d.eksikBant.length ? (
                              <span className="text-warn">{d.eksikBant.join(", ")} bandı eksik (seçim gevşer, zorluk kayar)</span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <button
                type="button"
                onClick={ekle}
                disabled={!sinav || satirlar.length >= MAX_KONU}
                className={buttonClass("outline", "sm")}
              >
                <Plus aria-hidden /> Konu ekle
              </button>
            </div>
          </Card>
        </div>

        {/* ── Sağ: durum ve kaydet ─────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display tabular text-num-sm font-bold text-ink">{toplam}</p>
                <p className="text-micro text-ink-faint">
                  soru · {satirlar.length} konu · {Number(sure) || 0} dk
                </p>
              </div>
              <Pill tone={HAVUZ_TON[genelHavuz]}>
                {genelHavuz === "ready" ? "Başlatılabilir" : genelHavuz === "narrow" ? "Havuz dar" : "Başlatılamaz"}
              </Pill>
            </div>

            <div className="mt-4">
              <Field label="Durum" htmlFor="paket-durum" error={alanHatasi("status")}>
                <select id="paket-durum" value={durum} onChange={(e) => setDurum(e.target.value)} className={SELECT_CLASS}>
                  {QUESTION_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={s === "PUBLISHED" && !yayinlanabilir && durum !== "PUBLISHED"}>
                      {QUESTION_STATUS_LABEL[s]}
                      {s === "PUBLISHED" && !yayinlanabilir ? " — havuz yetmiyor" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {yayinEngeli ? (
                <p className="mt-2 text-micro text-bad">
                  Havuzu yetmeyen konu varken yayında kaydedilemez. Taslak seç; havuz dolunca yayına alırsın.
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={pending || yayinEngeli}
                className={clsx(buttonClass("primary", "md"), "flex-1")}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {pending ? "Kaydediliyor…" : yeni ? "Paketi oluştur" : "Değişiklikleri kaydet"}
              </button>
              <Link href="/checkup/paketler" className={buttonClass("outline", "md")}>
                Vazgeç
              </Link>
            </div>
            <p className="mt-3 text-micro text-ink-faint" aria-live="polite">
              {kirli ? "Kaydedilmemiş değişiklik var · " : ""}Ctrl/⌘ + S kaydeder.
            </p>
          </Card>
          <p className="px-1 text-micro text-ink-faint">
            Ücretli/ücretsiz ayarı burada değişmez{yeni ? "; yeni paket şemadaki varsayılanla ücretsiz başlar" : ""}. Yanlış
            götürme oranı sınavdan gelir.
          </p>
        </div>
      </div>
    </form>
  );
}
