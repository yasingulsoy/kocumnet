"use client";

import { useMemo, useState, useTransition } from "react";
import { BookOpen, Check, ClipboardCheck, PencilLine, Play, Target, X } from "lucide-react";
import { konuTekrarBaslat, planIsiAction, planIsiSilAction } from "@/lib/actions/plan";
import { Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PlanGorunumu } from "@/lib/plan";

type PlanIsi = PlanGorunumu["items"][number];

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

  const sil = (id: string) => {
    start(async () => {
      const res = await planIsiSilAction(id);
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
      else setHata(res.error ?? "Silinemedi.");
    });
  };

  return (
    <Card className="border-brand/25 shadow-raised">
      <CardHeader
        className="p-4 sm:p-6"
        title={
          <span className="flex flex-wrap items-baseline gap-x-2">
            Bu hafta
            <span className="text-caption font-normal text-ink-faint">{haftaEtiketi}</span>
          </span>
        }
        action={
          <span className="tabular text-caption font-semibold text-ink-soft">
            {biten}/{items.length}
          </span>
        }
      />

      {plan.coachNote ? (
        <p className="border-y border-line bg-brand-wash/40 px-4 py-3 text-body leading-relaxed text-ink sm:px-6">
          <span className="font-semibold">Koç notu:</span> {plan.coachNote}
        </p>
      ) : null}

      {hata ? (
        <p
          role="alert"
          className="border-b border-line bg-bad-wash px-4 py-2 text-caption text-bad sm:px-6"
        >
          {hata}
        </p>
      ) : null}

      {/* Haftada en fazla iki konu olduğu için geniş ekranda yan yana:
          tek sütunda kart boşuna uzuyordu. */}
      <div className="lg:grid lg:grid-cols-2">
        {gruplar.map((g, gi) => {
          const grupBiten = g.isler.filter((i) => i.done).length;
          return (
            <section
              key={g.baslik ?? gi}
              className={cn(
                gi > 0 && "border-t-4 border-bg lg:border-s lg:border-line lg:border-t-0",
              )}
            >
              {g.baslik ? (
                <h3 className="flex items-center gap-2 bg-surface-sunk px-4 py-2 sm:px-6">
                  <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">
                    {g.baslik}
                  </span>
                  <span
                    className={cn(
                      "tabular shrink-0 text-micro font-semibold",
                      grupBiten === g.isler.length ? "text-ok" : "text-ink-faint",
                    )}
                  >
                    {grupBiten}/{g.isler.length}
                  </span>
                </h3>
              ) : null}

              <ul className="divide-y divide-line">
                {g.isler.map((i) => {
                  const Icon = SIMGE[i.kind];
                  const etiket = kisaBaslik(i.title, g.baslik);
                  return (
                    <li key={i.id} className="group flex items-center gap-3 px-4 py-2 sm:px-6">
                      {i.verifiable ? (
                        // Kontrol testi: kutu değil, düğme. İşaretlenmez, çözülür.
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                            i.done
                              ? "border-ok bg-ok text-white"
                              : "border-line-strong text-ink-faint",
                          )}
                          aria-hidden
                        >
                          {i.done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={i.done}
                          onChange={(e) => degistir(i.id, e.target.checked)}
                          aria-label={i.title}
                          className="size-6 shrink-0 cursor-pointer rounded-md border-2 border-line-strong accent-[var(--ok)]"
                        />
                      )}

                      <span className="min-w-0 flex-1 py-1">
                        <span
                          className={cn(
                            "block truncate text-body leading-snug",
                            i.done ? "text-ink-faint line-through" : "text-ink",
                          )}
                        >
                          {etiket}
                        </span>
                        <span className="tabular block text-micro text-ink-faint">
                          ~{i.estimatedMinutes} dk
                          {i.verifiable && !i.done ? (
                            <span className="ms-1.5 text-brand">sistem doğrular</span>
                          ) : null}
                        </span>
                      </span>

                      {i.verifiable && !i.done && i.topicId ? (
                        <form action={konuTekrarBaslat} className="shrink-0">
                          <input type="hidden" name="topicId" value={i.topicId} />
                          <button
                            type="submit"
                            className="flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-caption font-semibold text-white active:bg-brand-hover"
                          >
                            <Play className="size-3.5" /> Çöz
                          </button>
                        </form>
                      ) : !i.verifiable ? (
                        <button
                          type="button"
                          onClick={() => sil(i.id)}
                          aria-label={`${i.title} işini plandan çıkar`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 active:bg-surface-sunk max-sm:opacity-60"
                        >
                          <X className="size-4" />
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

      <p className="border-t border-line px-4 py-2.5 text-micro text-ink-faint sm:px-6">
        {biten === items.length
          ? "Haftanın işleri bitti. Sıradaki check-up'ı çözüp yeni plan alabilirsin."
          : `Kalan iş ~${Math.floor(kalanDakika / 60)} saat ${kalanDakika % 60} dakika. Kontrol testini sen işaretleyemezsin: çözünce kendiliğinden kapanır.`}
      </p>
    </Card>
  );
}
