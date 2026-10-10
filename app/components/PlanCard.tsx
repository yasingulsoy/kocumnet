"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BookOpen, Check, ClipboardCheck, PencilLine, Play, Target, Undo2, X } from "lucide-react";
import { konuTekrarBaslat, planIsiAction, planIsiSilAction } from "@/lib/actions/plan";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PlanGorunumu } from "@/lib/plan";

type PlanIsi = PlanGorunumu["items"][number];

/** 45 → "45 dakika", 120 → "2 saat", 135 → "2 saat 15 dakika" ("~0 saat 45 dakika" yazmasın). */
function sureMetni(dakika: number) {
  const saat = Math.floor(dakika / 60);
  const dk = dakika % 60;
  if (saat === 0) return `${dk} dakika`;
  return dk === 0 ? `${saat} saat` : `${saat} saat ${dk} dakika`;
}

/** Plandan çıkarılan iş bu kadar süre "geri al" ile geri getirilebilir. */
const GERI_AL_MS = 6_000;

const SIMGE = {
  STUDY: BookOpen,
  SOLVE: PencilLine,
  REVIEW: Target,
  RETEST: ClipboardCheck,
} as const;

/**
 * İş başlığından konu adını düşür.
 *
 * Başlıklar veritabanında tam yazılı ("Bölme ve Bölünebilme konu tekrarı"):
 * bildirimlerde ve erişilebilirlik etiketlerinde tek başına anlamlı olmalı.
 * Ama kartta konu adı zaten grup başlığında duruyor; dört satırda dört kez
 * tekrar etmesi telefonda her satırı iki satıra çıkarıyordu.
 */
function kisaBaslik(title: string, topicName: string | null) {
  if (!topicName || !title.startsWith(topicName)) return title;
  const kalan = title.slice(topicName.length).trim();
  if (!kalan) return title;
  return kalan.charAt(0).toLocaleUpperCase("tr-TR") + kalan.slice(1);
}

/**
 * Haftalık plan kartı — panonun en üstündeki tek iş listesi.
 *
 * Tasarım kararları:
 *  - Kontrol testi (RETEST) işaretlenemez, ÇÖZÜLÜR. Öğrenci "40 soru çözdüm"
 *    diyebilir; 5 soruluk kontrol testini geçtiğini söyleyemez.
 *  - İş silinebilir: koç da öğrencinin "bu hafta buna vaktim yok" itirazını
 *    dinler. Kabul edilmiş bir plan yapılır, dayatılan plan duvar kâğıdı olur.
 *  - İşler KONUYA göre gruplanır: hafta iki konudan ibaret olduğu için
 *    öğrencinin gördüğü şey sekiz iş değil, iki konu olmalı.
 */
export function PlanCard({ plan, haftaEtiketi }: { plan: PlanGorunumu; haftaEtiketi: string }) {
  const [items, setItems] = useState(plan.items);
  const [, start] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  const biten = items.filter((i) => i.done).length;
  const kalanDakika = items.filter((i) => !i.done).reduce((t, i) => t + i.estimatedMinutes, 0);

  const gruplar = useMemo(() => {
    const harita = new Map<string, { baslik: string | null; isler: PlanIsi[] }>();
    for (const i of items) {
      const anahtar = i.topicId ?? "_";
      const g = harita.get(anahtar) ?? { baslik: i.topicName, isler: [] };
      g.isler.push(i);
      harita.set(anahtar, g);
    }
    return [...harita.values()];
  }, [items]);

  /*
   * İşaretleme ANINDA ekranda: ağ turunu beklemek kutuyu "takılmış" gösterir.
   * Sunucu reddederse geri alıyoruz ve sebebini yazıyoruz — sessizce eski
   * hâle dönmek, öğrencinin işaretlediğini sanmasına yol açardı.
   */
  const degistir = (id: string, done: boolean) => {
    setHata(null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done } : i)));
    start(async () => {
      const res = await planIsiAction(id, done);
      if (!res.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !done } : i)));
        setHata(res.error ?? "İşaretlenemedi.");
      }
    });
  };

  /*
   * Çıkarma GERİ ALINABİLİR: X telefonda satırın başparmak tarafında duruyor
   * ve tek yanlış dokunuş işi kalıcı olarak siliyordu (haftanın planı yeniden
   * üretilemiyor). İş önce ekrandan kalkıyor; sunucuya ancak birkaç saniye
   * sonra gidiyor. Sayfadan çıkılırsa bekleyen çıkarma hemen gönderilir.
   */
  const [kaldirilan, setKaldirilan] = useState<PlanIsi | null>(null);
  const bekleyenRef = useRef<{ isi: PlanIsi; sira: number } | null>(null);
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geriKoy = (isi: PlanIsi, sira: number) =>
    setItems((prev) => {
      const s = prev.filter((i) => i.id !== isi.id);
      s.splice(Math.min(sira, s.length), 0, isi);
      return s;
    });

  const kesinlestir = useCallback(() => {
    if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    zamanlayiciRef.current = null;
    const b = bekleyenRef.current;
    if (!b) return;
    bekleyenRef.current = null;
    setKaldirilan(null);
    start(async () => {
      const res = await planIsiSilAction(b.isi.id);
      if (!res.ok) {
        geriKoy(b.isi, b.sira);
        setHata(res.error ?? "Silinemedi.");
      }
    });
  }, []);

  const sil = (id: string) => {
    kesinlestir(); // önceki bekleyen çıkarma varsa önce onu gönder
    const sira = items.findIndex((i) => i.id === id);
    if (sira === -1) return;
    setHata(null);
    bekleyenRef.current = { isi: items[sira], sira };
    setKaldirilan(items[sira]);
    setItems((prev) => prev.filter((i) => i.id !== id));
    zamanlayiciRef.current = setTimeout(kesinlestir, GERI_AL_MS);
  };

  const geriAl = () => {
    if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    zamanlayiciRef.current = null;
    const b = bekleyenRef.current;
    bekleyenRef.current = null;
    setKaldirilan(null);
    if (b) geriKoy(b.isi, b.sira);
  };

  useEffect(() => {
    const bekleyen = bekleyenRef;
    const zamanlayici = zamanlayiciRef;
    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      if (bekleyen.current) void planIsiSilAction(bekleyen.current.isi.id);
    };
  }, []);

  return (
    <ComponentCard
      title="Bu hafta"
      desc={haftaEtiketi}
      badge={
        items.length > 0 ? (
          <Badge size="sm" color={biten === items.length ? "success" : "light"}>
            <span className="tabular">
              {biten}/{items.length} iş
            </span>
          </Badge>
        ) : null
      }
      tone="brand"
      flush
    >
      {plan.coachNote ? (
        <p className="border-b border-gray-100 bg-brand-25 px-5 py-3 text-theme-sm leading-relaxed text-gray-700 sm:px-6">
          <span className="font-semibold text-gray-800">Koç notu:</span> {plan.coachNote}
        </p>
      ) : null}

      {hata ? (
        <p role="alert" className="border-b border-error-100 bg-error-50 px-5 py-2.5 text-theme-sm font-medium text-error-700 sm:px-6">
          {hata}
        </p>
      ) : null}

      {/* Bütün işler çıkarıldıysa "0/0 · haftanın işleri bitti" yazmasın. */}
      {items.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <p className="min-w-0 flex-1 text-theme-sm leading-relaxed text-gray-500">
            <span className="font-semibold text-gray-800">Bu haftanın planında iş kalmadı.</span> Gelecek
            haftanın planı, o hafta çözdüğün ilk check-up&apos;tan çıkar.
          </p>
          <ButtonLink href="/paketler" variant="soft" size="xs" className="max-sm:w-full">
            Testlere göz at
          </ButtonLink>
        </div>
      ) : null}

      {/* Haftada en fazla iki konu olduğu için geniş ekranda yan yana:
          tek sütunda kart boşuna uzuyordu. */}
      <div className="lg:grid lg:grid-cols-2">
        {gruplar.map((g, gi) => {
          const grupBiten = g.isler.filter((i) => i.done).length;
          return (
            <section
              key={g.baslik ?? gi}
              className={cx(gi > 0 && "border-t border-gray-100 lg:border-s lg:border-t-0")}
            >
              {g.baslik ? (
                <h3 className="flex items-center gap-2 bg-gray-50 px-5 py-2.5 sm:px-6">
                  <span className="min-w-0 flex-1 truncate text-theme-sm font-semibold text-gray-700">{g.baslik}</span>
                  <span
                    className={cx(
                      "tabular shrink-0 text-theme-xs font-medium",
                      grupBiten === g.isler.length ? "text-success-700" : "text-gray-500"
                    )}
                  >
                    {grupBiten}/{g.isler.length}
                  </span>
                </h3>
              ) : null}

              <ul className="divide-y divide-gray-100">
                {g.isler.map((i) => {
                  const Icon = SIMGE[i.kind];
                  const etiket = kisaBaslik(i.title, g.baslik);
                  return (
                    <li key={i.id} className="group flex items-center gap-3 px-5 py-2 sm:px-6">
                      {i.verifiable ? (
                        // Kontrol testi: kutu değil, düğme. İşaretlenmez, çözülür.
                        <span
                          className={cx(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border",
                            i.done ? "border-success-500 bg-success-500 text-white" : "border-gray-300 text-gray-500"
                          )}
                          aria-hidden
                        >
                          {i.done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                        </span>
                      ) : (
                        <Checkbox
                          id={"plan-isi-" + i.id}
                          checked={i.done}
                          onChange={(e) => degistir(i.id, e.target.checked)}
                          aria-label={i.title}
                        />
                      )}

                      {/* Metne dokunmak da işaretler: küçük kutuyu telefonda
                          tutturmak zordu. Kontrol testi işaretlenmez. */}
                      <label
                        htmlFor={i.verifiable ? undefined : "plan-isi-" + i.id}
                        className={cx("min-w-0 flex-1 py-1.5", !i.verifiable && "cursor-pointer")}
                      >
                        <span
                          className={cx(
                            "block truncate text-theme-sm leading-snug font-medium",
                            i.done ? "text-gray-500 line-through" : "text-gray-800"
                          )}
                        >
                          {etiket}
                        </span>
                        <span className="tabular block text-theme-xs text-gray-500">
                          ~{i.estimatedMinutes} dk
                          {i.verifiable && !i.done ? <span className="ms-1.5 text-brand-500">sistem doğrular</span> : null}
                        </span>
                      </label>

                      {i.verifiable && !i.done && i.topicId ? (
                        <form action={konuTekrarBaslat} className="shrink-0">
                          <input type="hidden" name="topicId" value={i.topicId} />
                          <SubmitButton size="xs" pendingText="Açılıyor…" startIcon={<Play />}>
                            Çöz
                          </SubmitButton>
                        </form>
                      ) : !i.verifiable ? (
                        <button
                          type="button"
                          onClick={() => sil(i.id)}
                          aria-label={`${i.title} işini plandan çıkar`}
                          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 opacity-0 transition group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 active:bg-gray-100 max-sm:opacity-70"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {kaldirilan ? (
        <div role="status" className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-5 py-2 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-theme-sm text-gray-500">
            <span className="font-semibold text-gray-800">{kisaBaslik(kaldirilan.title, kaldirilan.topicName)}</span>{" "}
            plandan çıkarıldı.
          </p>
          <Button variant="soft" size="xs" onClick={geriAl} startIcon={<Undo2 />}>
            Geri al
          </Button>
        </div>
      ) : null}

      {/* Plan haftada bir kez, o haftanın ilk check-up'ından çıkıyor: "sıradaki
          check-up'ı çöz, yeni plan al" sözü aynı hafta içinde doğru değildi. */}
      {items.length > 0 ? (
        <p className="border-t border-gray-100 px-5 py-3 text-theme-xs leading-relaxed text-gray-500 sm:px-6">
          {biten === items.length
            ? "Haftanın işleri bitti. Gelecek haftanın planı, o hafta çözdüğün ilk check-up'tan çıkar."
            : `Kalan iş ~${sureMetni(kalanDakika)}. Kontrol testini sen işaretleyemezsin: çözünce kendiliğinden kapanır.`}
        </p>
      ) : null}
    </ComponentCard>
  );
}
