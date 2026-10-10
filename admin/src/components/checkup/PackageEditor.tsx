"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
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
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { CODE, MONO } from "./ui";

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

const HAVUZ_RENGI: Record<KonuHavuzu, BadgeColor> = { ready: "success", narrow: "warning", blocked: "error" };
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
        <Alert variant="info" compact>
          Paket ayarları test başlarken kopyalanır: değişiklik yalnızca bundan sonra başlayan testleri etkiler.
          Süren ve bitmiş testler eski hâliyle kalır.
        </Alert>
        {hata?.error ? <Alert variant="error">{hata.error}</Alert> : null}
      </div>

      <div className="mt-4 grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 md:space-y-6">
          <ComponentCard title="Paket" desc="Öğrencinin katalogda gördüğü ad, özet ve süre.">
            <div className="space-y-5">
              {yeni ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Sınav"
                    required
                    error={alanHatasi("examScope")}
                    hint="Sonradan değişmez: yanlış götürme oranı ve konu kapsamı buna bağlı."
                  >
                    <Select value={sinav} onChange={(e) => setSinav(e.target.value)} required>
                      <option value="">Seç…</option>
                      {EXAM_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {EXAM_LABEL[s] ?? s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Adres"
                    required
                    error={alanHatasi("slug")}
                    hint="Kalıcı: paket oluşturulduktan sonra değişmez (bağlantılar ve kayıtlar buna bağlı)."
                  >
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
                      placeholder="tyt-geometri-2"
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-theme-sm text-gray-500">
                  {EXAM_LABEL[paket.examScope] ?? paket.examScope} · <code className={CODE}>{paket.slug}</code>{" "}
                  — sınav ve adres kalıcıdır.
                </p>
              )}

              <Field label="Ad" required error={alanHatasi("name")}>
                <Input
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  required
                  minLength={AD_SINIR.min}
                  maxLength={AD_SINIR.max}
                  placeholder="TYT Geometri"
                />
              </Field>

              <Field
                label="Özet"
                error={alanHatasi("summary")}
                hint={ozet.trim().length + "/" + OZET_SINIR + " · Katalog kartında görünür; ne ölçtüğünü bir cümleyle söyle."}
              >
                <TextArea
                  rows={2}
                  value={ozet}
                  onChange={(e) => setOzet(e.target.value)}
                  maxLength={OZET_SINIR + 50}
                  placeholder="Açılar, üçgenler, dörtgenler ve çemberde temel seviye ölçümü."
                />
              </Field>

              <Field
                label="Süre (dakika)"
                required
                error={alanHatasi("durationMinutes")}
                hint={toplam > 0 ? toplam + " soru için " + Math.round((Number(sure) * 60) / toplam) + " sn/soru" : undefined}
              >
                <Input
                  type="number"
                  min={SURE_SINIR.min}
                  max={SURE_SINIR.max}
                  value={sure}
                  onChange={(e) => setSure(e.target.value)}
                  required
                  fullWidth={false}
                  className="w-40"
                />
              </Field>
            </div>
          </ComponentCard>

          <ComponentCard
            title="Konu dağılımı"
            desc={
              "Konu başına en az " +
              MIN_PER_TOPIC +
              " soru. Havuz: paketin sınavında sorulabilen yayındaki sorular (öğrenci uygulamasının seçim kuralıyla)."
            }
            actions={
              <span className="tabular text-theme-xs text-gray-500">
                {satirlar.length}/{MAX_KONU} konu · {toplam} soru
              </span>
            }
          >
            <div className="space-y-3">
              {alanHatasi("topics") ? <Alert variant="error" compact>{alanHatasi("topics")}</Alert> : null}
              {!sinav ? (
                <Alert variant="info" compact>
                  Önce sınavı seç: konular sınava göre listelenir.
                </Alert>
              ) : null}

              <ol className="space-y-3">
                {satirlar.map((s, i) => {
                  const d = satirDurumlari[i];
                  const konu = konuHaritasi.get(s.topicId);
                  const listede = secenekler.some((k) => k.id === s.topicId);
                  const mesaj = d.sunucu ?? d.sorun;
                  return (
                    <li
                      key={s.key}
                      className={cx("rounded-xl border p-3", mesaj && s.topicId ? "border-error-300 bg-error-25" : "border-gray-200")}
                    >
                      <div className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_6.5rem_auto] sm:items-center">
                        <span className="tabular hidden text-center text-theme-xs font-semibold text-gray-500 sm:block">{i + 1}</span>
                        <Select
                          value={s.topicId}
                          onChange={(e) => satirDegistir(i, { topicId: e.target.value })}
                          aria-label={i + 1 + ". konu"}
                          disabled={!sinav}
                        >
                          <option value="">Konu seç…</option>
                          {s.topicId && !listede && konu ? <option value={s.topicId}>{konu.name} (bu sınavda yok)</option> : null}
                          {[...gruplar.entries()].map(([grup, liste]) => (
                            <optgroup key={grup} label={grup}>
                              {liste.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          min={MIN_PER_TOPIC}
                          max={MAX_PER_TOPIC}
                          value={s.count}
                          onChange={(e) => satirDegistir(i, { count: e.target.value })}
                          aria-label={i + 1 + ". konunun soru sayısı"}
                          className="tabular"
                        />
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => tasi(i, -1)}
                            disabled={i === 0}
                            aria-label={i + 1 + ". konuyu yukarı taşı"}
                          >
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => tasi(i, 1)}
                            disabled={i === satirlar.length - 1}
                            aria-label={i + 1 + ". konuyu aşağı taşı"}
                          >
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button
                            variant="danger-outline"
                            size="xs"
                            onClick={() => setSatirlar((onceki) => onceki.filter((_, j) => j !== i))}
                            aria-label={i + 1 + ". konuyu çıkar"}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs sm:ps-10">
                        {mesaj ? (
                          <span role={d.sunucu ? "alert" : undefined} className={s.topicId || d.sunucu ? "text-error-600" : "text-gray-500"}>
                            {mesaj}
                          </span>
                        ) : d.havuzDurumu ? (
                          <>
                            <Badge size="sm" color={HAVUZ_RENGI[d.havuzDurumu]}>
                              Havuz {HAVUZ_ETIKET[d.havuzDurumu]}
                            </Badge>
                            <span className="tabular text-gray-600">
                              {d.h.have} yayında soru · paket {d.n} istiyor
                            </span>
                            <span className="tabular text-gray-500">
                              kolay {d.h.easy} · orta {d.h.medium} · zor {d.h.hard}
                            </span>
                            {d.eksikBant.length ? (
                              <span className="text-warning-700">{d.eksikBant.join(", ")} bandı eksik (seçim gevşer, zorluk kayar)</span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <Button variant="outline" size="xs" onClick={ekle} disabled={!sinav || satirlar.length >= MAX_KONU} startIcon={<Plus />}>
                Konu ekle
              </Button>
            </div>
          </ComponentCard>
        </div>

        {/* ── Sağ: durum ve kaydet ─────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tabular font-display text-title-sm font-bold text-gray-800">{toplam}</p>
                <p className="text-theme-xs text-gray-500">
                  soru · {satirlar.length} konu · {Number(sure) || 0} dk
                </p>
              </div>
              <Badge size="sm" color={HAVUZ_RENGI[genelHavuz]}>
                {genelHavuz === "ready" ? "Başlatılabilir" : genelHavuz === "narrow" ? "Havuz dar" : "Başlatılamaz"}
              </Badge>
            </div>

            <div className="mt-5">
              <Field label="Durum" error={alanHatasi("status")}>
                <Select value={durum} onChange={(e) => setDurum(e.target.value)}>
                  {QUESTION_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={s === "PUBLISHED" && !yayinlanabilir && durum !== "PUBLISHED"}>
                      {QUESTION_STATUS_LABEL[s]}
                      {s === "PUBLISHED" && !yayinlanabilir ? " — havuz yetmiyor" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              {yayinEngeli ? (
                <p className="mt-2 text-theme-xs text-error-600">
                  Havuzu yetmeyen konu varken yayında kaydedilemez. Taslak seç; havuz dolunca yayına alırsın.
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="submit" loading={pending} disabled={yayinEngeli} startIcon={<Save />} className="flex-1">
                {pending ? "Kaydediliyor…" : yeni ? "Paketi oluştur" : "Değişiklikleri kaydet"}
              </Button>
              <ButtonLink href="/checkup/paketler" variant="outline">
                Vazgeç
              </ButtonLink>
            </div>
            <p className="mt-3 text-theme-xs text-gray-500" aria-live="polite">
              {kirli ? "Kaydedilmemiş değişiklik var · " : ""}Ctrl/⌘ + S kaydeder.
            </p>
          </Card>
          <p className="px-1 text-theme-xs text-gray-500">
            Ücretli/ücretsiz ayarı burada değişmez{yeni ? "; yeni paket şemadaki varsayılanla ücretsiz başlar" : ""}. Yanlış
            götürme oranı sınavdan gelir.
          </p>
        </div>
      </div>
    </form>
  );
}
