import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  ClipboardList,
  Lock,
  Play,
  Target,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { seviyeKarnesi, seviyeOzeti, sonrakiAdim } from "@/lib/level-report";
import { examShort } from "@/lib/exams";
import { seviyeBaslatAction, telafiBaslatAction } from "@/lib/actions/levels";
import { ScoreRing } from "@/components/ui/charts";
import { Alert, Badge, Card, CardHeader, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { SeviyeSeridi } from "@/components/SeviyeSeridi";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Seviyeli check-up" };

export default async function SeviyePage({
  params,
  searchParams,
}: PageProps<"/seviye/[runId]">) {
  const { runId } = await params;
  const sp = await searchParams;
  const hata = typeof sp.hata === "string" ? sp.hata : null;

  const user = await requirePageUser();
  const [karne, adim] = await Promise.all([
    seviyeKarnesi(runId, user.id),
    sonrakiAdim(runId, user.id),
  ]);

  if (!karne || !adim) notFound();

  // Yarım kalan aşama varsa karne değil test gösterilir.
  if (adim.tur === "DEVAM_EDEN_ASAMA") redirect(`/checkup/${adim.sessionId}`);

  const durdu = adim.tur === "DURDU";
  const bitti = adim.tur === "BITTI";
  const sinav = examShort(karne.examScope);

  return (
    <div className="animate-fade space-y-5 sm:space-y-6">
      {/* Sayfanın başlığı yoktu: telefonda ekran doğrudan seviye şeridiyle
          açılıyor, ekran okuyucu ilk başlık olarak bir kartın içini okuyordu. */}
      <div>
        <Link
          href="/paketler"
          className="inline-flex min-h-9 items-center gap-1.5 text-caption font-medium text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Testler
        </Link>
        <h1 className="font-display mt-1 text-h2 font-bold tracking-tight text-ink">
          {sinav} seviyeli check-up
        </h1>
      </div>

      {hata ? <Alert>{hata}</Alert> : null}

      {/* ── Durum şeridi ─────────────────────────────────── */}
      <SeviyeSeridi
        ulasilan={karne.ulasilanSeviye}
        durduguSeviye={karne.durduguSeviye}
        bitti={bitti}
      />

      {/* ── Sıradaki adım ────────────────────────────────── */}
      {adim.tur === "TELAFI_BEKLIYOR" ? (
        <Card className="border-warn/30 bg-warn-wash/40 p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warn-wash text-warn">
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-h3 font-semibold text-ink">
                Temel kazanımlarını teyit ediyoruz
              </h2>
              <p className="mt-2 text-body leading-relaxed text-ink-soft">
                Seviye 1&apos;de %{karne.seviye1Birlesik ? Math.round(karne.seviye1Birlesik.oran * 100) : 0}{" "}
                çıktın. Barajın altında kaldığın için sınavı burada bitirmiyoruz:{" "}
                <strong className="font-semibold text-ink">
                  {adim.kazanimSayisi} soruluk kısa bir tur
                </strong>{" "}
                daha var. Sorular yalnızca eksik çıkan kazanımlardan ve hepsi ilk
                turda görmediğin sorular.
              </p>
              <form action={telafiBaslatAction} className="mt-5">
                <input type="hidden" name="runId" value={runId} />
                <SubmitButton size="lg" className="max-sm:w-full">
                  <Play /> Devam et
                </SubmitButton>
              </form>
            </div>
          </div>
        </Card>
      ) : null}

      {adim.tur === "SEVIYE_HAZIR" ? (
        <Card className="bg-brand-gradient overflow-hidden border-0 p-5 text-white shadow-brand sm:p-6">
          <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-white/90">
            <CircleCheck className="size-3.5" /> Seviye {adim.seviye - 1} geçildi
          </p>
          <h2 className="font-display mt-2 text-h2 font-bold text-balance">
            Seviye {adim.seviye}&apos;ye hazırsın
          </h2>
          <p className="mt-2 text-body text-white/85">
            {adim.seviye === 2
              ? "Bu testte iki konunun birleştiği ve birden fazla işlem adımı isteyen sorular var."
              : "Son test sınav standardında: analiz ve yorum soruları."}
          </p>
          <p className="tabular mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-white/90">
            <span>{seviyeOzeti(karne.examScope, adim.seviye).soruSayisi} soru</span>
            <span>{seviyeOzeti(karne.examScope, adim.seviye).dakika} dakika</span>
          </p>
          <form action={seviyeBaslatAction} className="mt-5 flex flex-wrap gap-2.5">
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="seviye" value={adim.seviye} />
            <SubmitButton variant="white" size="lg" className="max-sm:w-full">
              <Play /> Şimdi başla
            </SubmitButton>
            <LinkButton href="/panel" variant="outlineLight" size="lg" className="max-sm:w-full">
              Sonra devam et
            </LinkButton>
          </form>
          {/* Gradyanın açık ucunda beyaz %60 küçük yazı AA kontrastın altındaydı. */}
          <p className="mt-3 text-micro text-white/85">
            Ara verebilirsin — süre sen başlatınca işlemeye başlar.
          </p>
        </Card>
      ) : null}

      {durdu ? (
        <Card className="border-bad/25 bg-bad-wash/40 p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bad-wash text-bad">
              <Lock className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-h3 font-semibold text-ink">
                Seviye {adim.seviye}&apos;de kalıyoruz
              </h2>
              <p className="mt-2 text-body leading-relaxed text-ink-soft">
                {adim.seviye === 1
                  ? "Üst seviyelere geçmek şu an işine yaramaz: temel kazanımlar oturmadan çok adımlı sorular senin seviyeni değil, eksiğini ölçer. Aşağıda hangi kazanımların eksik olduğu tek tek yazıyor."
                  : "Temel işlemlerin sağlam ama problem kurma ve çoklu işlemlerde eksiklerin var. Aşağıdaki karne hangi tipte takıldığını gösteriyor."}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {bitti ? (
        <Card className="border-ok/30 bg-ok-wash/40 p-5 sm:p-6">
          <h2 className="font-display text-h3 font-semibold text-ink">
            Üç seviyeyi de tamamladın
          </h2>
          <p className="mt-2 text-body leading-relaxed text-ink-soft">
            Aşağıda ulaştığın seviye, hâlâ eksik görünen kazanımlar ve soru bazlı
            süre analizin var.
          </p>
        </Card>
      ) : null}

      {/* ── Karne ────────────────────────────────────────── */}
      <Card>
        <CardHeader
          className="p-4 sm:p-6"
          title={karne.baslik}
          description={`${sinav} · seviyeli check-up`}
          action={<Badge tone="brand">{sinav}</Badge>}
        />

        {/* Aşama puanları — telefonda 2x2 (tek sütunda dört aşama ekranı
            boydan boya dolduruyordu). */}
        {karne.asamalar.length === 0 ? (
          <p className="border-y border-line bg-surface-sunk px-4 py-4 text-caption text-ink-soft sm:px-6">
            Henüz biten aşama yok. İlk aşamayı bitirdiğinde puanların ve eksik kazanımların
            burada görünür.
          </p>
        ) : null}
        <div
          className={cn(
            "grid grid-cols-2 gap-px overflow-hidden border-y border-line bg-line empty:hidden",
            // Aşama sayısı kadar sütun: boş hücre gri dolgu olarak görünmesin.
            ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"][
              Math.min(karne.asamalar.length, 4)
            ]
          )}
        >
          {karne.asamalar.map((a, i) => (
            <div
              key={i}
              className={cn(
                "bg-surface p-4",
                // Tek sayıda aşamada son hücre telefonda iki sütunu kaplar.
                karne.asamalar.length % 2 === 1 && i === karne.asamalar.length - 1 && "col-span-2 lg:col-span-1"
              )}
            >
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {a.telafiMi ? "Telafi turu" : `Seviye ${a.seviye}`}
              </p>
              <p className="font-display tabular mt-1.5 text-num-sm font-bold text-ink">
                {a.dogru}
                <span className="text-body font-medium text-ink-faint">/{a.toplam}</span>
              </p>
              <p className="tabular mt-0.5 text-caption text-ink-soft">
                %{Math.round(a.oran * 100)} · {a.yanlis}Y {a.bos}B
              </p>
            </div>
          ))}
        </div>

        {/* Seviye 1 birleşik — kapının baktığı sayı */}
        {karne.seviye1Birlesik && karne.asamalar.filter((a) => a.seviye === 1).length > 1 ? (
          <div className="flex items-center gap-4 border-b border-line bg-surface-sunk px-4 py-4 sm:px-6">
            <ScoreRing
              value={karne.seviye1Birlesik.oran * 100}
              size={64}
              stroke={7}
              label={`Seviye 1 birleşik: yüzde ${Math.round(karne.seviye1Birlesik.oran * 100)}`}
            >
              <span className="font-display tabular text-caption font-bold text-ink">
                %{Math.round(karne.seviye1Birlesik.oran * 100)}
              </span>
            </ScoreRing>
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">Seviye 1 birleşik sonuç</p>
              <p className="tabular mt-0.5 text-caption text-ink-soft">
                Ana tur + telafi turu birlikte: {karne.seviye1Birlesik.dogru}/
                {karne.seviye1Birlesik.toplam} doğru. Kapı bu sayıya baktı.
              </p>
            </div>
          </div>
        ) : null}

        {/* Eksik kazanımlar — karnenin asıl içeriği */}
        {karne.eksikKazanimlar.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 px-4 pt-5 sm:px-6">
              <Target className="size-4 text-bad" />
              <h3 className="text-body font-semibold text-ink">
                Eksik kazanımlar ({karne.eksikKazanimlar.length})
              </h3>
            </div>
            <p className="px-4 pt-1 text-caption text-ink-soft sm:px-6">
              Bu kazanımlar sorulduğunda doğru cevaplayamadın. Çalışma sıran bu.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {karne.eksikKazanimlar.map((k) => (
                <li key={k.code} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-micro font-bold",
                      k.dogru === 0 ? "bg-bad-wash text-bad" : "bg-warn-wash text-warn"
                    )}
                    aria-hidden
                  >
                    {k.dogru}/{k.soruldu}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-ink">{k.name}</span>
                    <span className="block text-micro text-ink-faint">{k.topicName}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Konu dağılımı — üst seviyelerde teşhis */}
        {karne.konuDagilimi.length > 0 ? (
          <section className="border-t border-line">
            <h3 className="px-4 pt-5 text-body font-semibold text-ink sm:px-6">
              Üst seviyelerde en zorlandığın konular
            </h3>
            <p className="px-4 pt-1 text-caption text-ink-soft sm:px-6">
              En az iki soru görülen konular, zayıftan güçlüye.
            </p>
            <ul className="mt-3 space-y-2 px-4 pb-1 sm:px-6">
              {karne.konuDagilimi.map((k) => {
                const oran = k.toplam === 0 ? 0 : k.dogru / k.toplam;
                return (
                  <li key={k.topicName} className="flex items-center gap-2 sm:gap-3">
                    <span className="min-w-0 flex-1 truncate text-caption text-ink">
                      {k.topicName}
                    </span>
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-sunk sm:w-24">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          oran >= 0.6 ? "bg-ok-fill" : oran >= 0.4 ? "bg-warn-fill" : "bg-bad-fill"
                        )}
                        style={{ width: `${Math.round(oran * 100)}%` }}
                      />
                    </span>
                    <span className="tabular w-10 shrink-0 text-end text-micro text-ink-faint">
                      {k.dogru}/{k.toplam}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* Yavaş sorular — şemanın istediği süre analizi */}
        {karne.yavasSorular.length > 0 ? (
          <section className="border-t border-line">
            <div className="flex items-center gap-2 px-4 pt-5 sm:px-6">
              <Timer className="size-4 text-warn" />
              <h3 className="text-body font-semibold text-ink">Fazla vakit harcadığın sorular</h3>
            </div>
            <p className="px-4 pt-1 text-caption text-ink-soft sm:px-6">
              Hedef sürenin en az 1,3 katını geçenler. Doğru yaptıkların da burada:
              sınavda o süre sende yok.
            </p>
            <ul className="mt-3 divide-y divide-line pb-1">
              {karne.yavasSorular.map((y, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
                  <Badge tone={y.dogruMu ? "ok" : "bad"}>
                    S{y.seviye}·{y.sortOrder}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-caption text-ink">
                    {y.topicName}
                  </span>
                  <span className="tabular shrink-0 text-caption text-ink-soft">
                    {y.sureSn}sn
                    <span className="text-ink-faint"> / {y.hedefSn}sn</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="border-t border-line px-4 py-4 sm:px-6">
          {durdu ? (
            <LinkButton href="/paketler" block>
              Eksiklerini kapatmak için test seç <ArrowRight />
            </LinkButton>
          ) : bitti ? (
            <LinkButton href="/gelisim" variant="secondary" block>
              Gelişimine bak
            </LinkButton>
          ) : null}
        </div>
      </Card>

      {durdu ? (
        <Card className="flex gap-3 p-4 sm:p-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-ink-faint" />
          <p className="text-caption leading-relaxed text-ink-soft">
            Seviyeli check-up&apos;ı eksiklerini kapattıktan sonra yeniden çözebilirsin.
            Aynı sorular gelmez — her denemede havuzdan yeni sorular seçilir.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
