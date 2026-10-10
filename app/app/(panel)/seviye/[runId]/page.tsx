import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  ClipboardList,
  Lock,
  Play,
  RotateCcw,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { seviyeKarnesi, seviyeOzeti, sonrakiAdim } from "@/lib/level-report";
import { examShort } from "@/lib/exams";
import { seviyeBaslatAction, telafiBaslatAction } from "@/lib/actions/levels";
import { SubmitButton } from "@/components/ui/submit-button";
import { SeviyeSeridi } from "@/components/SeviyeSeridi";
import { MeterList, type MeterTone } from "@/components/tailadmin/charts/MeterList";
import { RadialGauge } from "@/components/tailadmin/charts/RadialGauge";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Seviyeli check-up" };

/*
 * Sıradaki adım kartlarının tonları. Kitin Card'ına zemin/kenar rengi
 * className ile verilemiyor (bg-white ve border-gray-200 kazanıyor), bu
 * yüzden tonlu kartın sınıfları burada tam yazılı. Telefonda ikon metnin
 * üstünde: uzun açıklama tam genişliği kullansın.
 */
const TON = {
  warning: { kutu: "border-warning-200 bg-warning-50", ikon: "bg-warning-100 text-warning-600" },
  error: { kutu: "border-error-200 bg-error-50", ikon: "bg-error-100 text-error-600" },
  success: { kutu: "border-success-200 bg-success-50", ikon: "bg-success-100 text-success-600" },
} as const;

/** Konu başarısı → çubuk rengi (eski eşikler: %60 ve %40). */
function konuTonu(oran: number): MeterTone {
  return oran >= 0.6 ? "success" : oran >= 0.4 ? "warning" : "error";
}

// Aşama sayısı kadar sütun: boş hücre gri dolgu olarak görünmesin.
const LG_SUTUN = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"];

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
    <div className="animate-fade mx-auto w-full max-w-4xl">
      {/* Sayfanın başlığı yoktu: telefonda ekran doğrudan seviye şeridiyle
          açılıyor, ekran okuyucu ilk başlık olarak bir kartın içini okuyordu.
          Şimdi kitin başlığı: iz (Testler › Seviyeli check-up) + h1. */}
      <PageBreadcrumb
        crumbs={[
          { href: "/paketler", label: "Testler" },
          { href: "/seviyeli", label: "Seviyeli check-up" },
        ]}
        pageTitle={`${sinav} seviyeli check-up`}
      />

      <div className="space-y-4 md:space-y-6">
        {hata ? <Alert variant="error">{hata}</Alert> : null}

        {/* ── Durum şeridi ─────────────────────────────────── */}
        <SeviyeSeridi
          ulasilan={karne.ulasilanSeviye}
          durduguSeviye={karne.durduguSeviye}
          bitti={bitti}
        />

        {/* ── Sıradaki adım ────────────────────────────────── */}
        {adim.tur === "TELAFI_BEKLIYOR" ? (
          <div className={cx("rounded-2xl border p-5 sm:p-6", TON.warning.kutu)}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl", TON.warning.ikon)}>
                <ClipboardList className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-gray-800">
                  Temel kazanımlarını teyit ediyoruz
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  Seviye 1&apos;de %{karne.seviye1Birlesik ? Math.round(karne.seviye1Birlesik.oran * 100) : 0}{" "}
                  çıktın. Barajın altında kaldığın için sınavı burada bitirmiyoruz:{" "}
                  <strong className="font-semibold text-gray-800">
                    {adim.kazanimSayisi} soruluk kısa bir tur
                  </strong>{" "}
                  daha var. Sorular yalnızca eksik çıkan kazanımlardan ve hepsi ilk
                  turda görmediğin sorular.
                </p>
                <form action={telafiBaslatAction} className="mt-5">
                  <input type="hidden" name="runId" value={runId} />
                  <SubmitButton size="md" className="max-sm:w-full" startIcon={<Play aria-hidden />}>
                    Devam et
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {adim.tur === "SEVIYE_HAZIR" ? (
          // Birincil adım: seviyeli check-up'ın lacivert bandı, beyaz düğme kitin outline'ı.
          <Card tone="dark" className="relative z-1 overflow-hidden p-5 sm:p-6">
            <GridShape />
            <p className="flex items-center gap-1.5 text-theme-xs font-semibold tracking-wider text-white/80 uppercase">
              <CircleCheck className="size-3.5 text-success-400" aria-hidden /> Seviye {adim.seviye - 1} geçildi
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-balance">
              Seviye {adim.seviye}&apos;ye hazırsın
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              {adim.seviye === 2
                ? "Bu testte iki konunun birleştiği ve birden fazla işlem adımı isteyen sorular var."
                : "Son test sınav standardında: analiz ve yorum soruları."}
            </p>
            <p className="tabular mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-theme-sm text-white/80">
              <span>{seviyeOzeti(karne.examScope, adim.seviye).soruSayisi} soru</span>
              <span>{seviyeOzeti(karne.examScope, adim.seviye).dakika} dakika</span>
            </p>
            <form action={seviyeBaslatAction} className="mt-5 flex flex-wrap gap-3">
              <input type="hidden" name="runId" value={runId} />
              <input type="hidden" name="seviye" value={adim.seviye} />
              <SubmitButton variant="outline" size="md" className="max-sm:w-full" startIcon={<Play aria-hidden />}>
                Şimdi başla
              </SubmitButton>
              {/* Koyu bantta ikincil düğme: şeffaf zemin, yarı saydam beyaz çerçeve. */}
              <ButtonLink href="/panel" variant="outline-light" size="md" className="max-sm:w-full">
                Sonra devam et
              </ButtonLink>
            </form>
            {/* Küçük yazı beyaz %80: lacivertte AA kontrastı rahat geçiyor
                (eski gradyanın açık ucunda beyaz %60 küçük yazı geçmiyordu). */}
            <p className="mt-3 text-theme-xs text-white/80">
              Ara verebilirsin — süre sen başlatınca işlemeye başlar.
            </p>
          </Card>
        ) : null}

        {durdu ? (
          <div className={cx("rounded-2xl border p-5 sm:p-6", TON.error.kutu)}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl", TON.error.ikon)}>
                <Lock className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-gray-800">
                  Seviye {adim.seviye}&apos;de kalıyoruz
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {adim.seviye === 1
                    ? "Üst seviyelere geçmek şu an işine yaramaz: temel kazanımlar oturmadan çok adımlı sorular senin seviyeni değil, eksiğini ölçer. Aşağıda hangi kazanımların eksik olduğu tek tek yazıyor."
                    : "Temel işlemlerin sağlam ama problem kurma ve çoklu işlemlerde eksiklerin var. Aşağıdaki karne hangi tipte takıldığını gösteriyor."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {bitti ? (
          <div className={cx("rounded-2xl border p-5 sm:p-6", TON.success.kutu)}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl", TON.success.ikon)}>
                <Trophy className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-gray-800">
                  Üç seviyeyi de tamamladın
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  Aşağıda ulaştığın seviye, hâlâ eksik görünen kazanımlar ve soru bazlı
                  süre analizin var.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Karne ────────────────────────────────────────── */}
        <ComponentCard
          title={karne.baslik}
          desc={`${sinav} · seviyeli check-up`}
          actions={<Badge size="sm">{sinav}</Badge>}
          flush
          className="overflow-hidden"
        >
          {/* Bölümler arasında tek çizgi: hangileri çizilirse çizilsin çift çizgi olmasın. */}
          <div className="divide-y divide-gray-100">
            {/* Aşama puanları — telefonda 2x2 (tek sütunda dört aşama ekranı
                boydan boya dolduruyordu). */}
            {karne.asamalar.length === 0 ? (
              <p className="bg-gray-50 px-5 py-4 text-theme-sm text-gray-500 sm:px-6">
                Henüz biten aşama yok. İlk aşamayı bitirdiğinde puanların ve eksik kazanımların
                burada görünür.
              </p>
            ) : (
              <div
                className={cx("grid grid-cols-2 gap-px bg-gray-100", LG_SUTUN[Math.min(karne.asamalar.length, 4)])}
              >
                {karne.asamalar.map((a, i) => (
                  <div
                    key={i}
                    className={cx(
                      "bg-white px-5 py-4 sm:px-6",
                      // Tek sayıda aşamada son hücre telefonda iki sütunu kaplar.
                      karne.asamalar.length % 2 === 1 && i === karne.asamalar.length - 1 && "col-span-2 lg:col-span-1"
                    )}
                  >
                    <p className="text-theme-xs font-medium tracking-wider text-gray-500 uppercase">
                      {a.telafiMi ? "Telafi turu" : `Seviye ${a.seviye}`}
                    </p>
                    <p className="tabular mt-1.5 font-display text-title-sm font-bold text-gray-800">
                      {a.dogru}
                      <span className="text-base font-medium text-gray-500">/{a.toplam}</span>
                    </p>
                    <p className="tabular mt-0.5 text-theme-sm text-gray-500">
                      %{Math.round(a.oran * 100)} · {a.yanlis}Y {a.bos}B
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Seviye 1 birleşik — kapının baktığı sayı */}
            {karne.seviye1Birlesik && karne.asamalar.filter((a) => a.seviye === 1).length > 1 ? (
              <div className="flex items-center gap-4 bg-gray-50 px-5 py-4 sm:px-6">
                {/* Dar gösterge (size="sm": küçük yazı, yaya değmez); telefonda metne yer kalsın. */}
                <div className="w-28 shrink-0 sm:w-32">
                  <RadialGauge value={karne.seviye1Birlesik.oran * 100} ariaLabel="Seviye 1 birleşik" size="sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Seviye 1 birleşik sonuç</p>
                  <p className="tabular mt-0.5 text-theme-sm text-gray-500">
                    Ana tur + telafi turu birlikte: {karne.seviye1Birlesik.dogru}/
                    {karne.seviye1Birlesik.toplam} doğru. Kapı bu sayıya baktı.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Eksik kazanımlar — karnenin asıl içeriği */}
            {karne.eksikKazanimlar.length > 0 ? (
              <section className="pt-5 pb-2">
                <div className="flex items-center gap-2 px-5 sm:px-6">
                  <Target className="size-4 shrink-0 text-error-500" aria-hidden />
                  <h3 className="text-sm font-semibold text-gray-800">
                    Eksik kazanımlar ({karne.eksikKazanimlar.length})
                  </h3>
                </div>
                <p className="mt-1 px-5 text-theme-sm text-gray-500 sm:px-6">
                  Bu kazanımlar sorulduğunda doğru cevaplayamadın. Çalışma sıran bu.
                </p>
                <ul className="mt-3 divide-y divide-gray-100">
                  {karne.eksikKazanimlar.map((k) => (
                    <li key={k.code} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                      <span aria-hidden className="mt-px shrink-0">
                        <Badge size="sm" color={k.dogru === 0 ? "error" : "warning"} className="tabular">
                          {k.dogru}/{k.soruldu}
                        </Badge>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-gray-800">{k.name}</span>
                        <span className="block text-theme-xs text-gray-500">{k.topicName}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Konu dağılımı — üst seviyelerde teşhis */}
            {karne.konuDagilimi.length > 0 ? (
              <section className="py-5">
                <h3 className="px-5 text-sm font-semibold text-gray-800 sm:px-6">
                  Üst seviyelerde en zorlandığın konular
                </h3>
                <p className="mt-1 px-5 text-theme-sm text-gray-500 sm:px-6">
                  En az iki soru görülen konular, zayıftan güçlüye.
                </p>
                {/* Çubuk 0-100 ölçeğinde (en iyi konuya göre değil), yanında doğru/toplam. */}
                <MeterList
                  max={100}
                  className="mt-4 px-5 sm:px-6"
                  items={karne.konuDagilimi.map((k) => {
                    const oran = k.toplam === 0 ? 0 : k.dogru / k.toplam;
                    return {
                      key: k.topicName,
                      label: k.topicName,
                      value: Math.round(oran * 100),
                      valueLabel: `${k.dogru}/${k.toplam}`,
                      tone: konuTonu(oran),
                    };
                  })}
                />
              </section>
            ) : null}

            {/* Yavaş sorular — şemanın istediği süre analizi */}
            {karne.yavasSorular.length > 0 ? (
              <section className="pt-5 pb-2">
                <div className="flex items-center gap-2 px-5 sm:px-6">
                  <Timer className="size-4 shrink-0 text-warning-500" aria-hidden />
                  <h3 className="text-sm font-semibold text-gray-800">Fazla vakit harcadığın sorular</h3>
                </div>
                <p className="mt-1 px-5 text-theme-sm text-gray-500 sm:px-6">
                  Hedef sürenin en az 1,3 katını geçenler. Doğru yaptıkların da burada:
                  sınavda o süre sende yok.
                </p>
                <ul className="mt-3 divide-y divide-gray-100">
                  {karne.yavasSorular.map((y, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                      <Badge size="sm" color={y.dogruMu ? "success" : "error"} className="tabular">
                        S{y.seviye}·{y.sortOrder}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-800">
                        {y.topicName}
                      </span>
                      <span className="tabular shrink-0 text-theme-sm text-gray-700">
                        {y.sureSn}sn
                        <span className="text-gray-500"> / {y.hedefSn}sn</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {durdu || bitti ? (
              <div className="px-5 py-4 sm:px-6">
                {durdu ? (
                  <ButtonLink href="/paketler" block endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
                    Eksiklerini kapatmak için test seç
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/gelisim" variant="outline" block>
                    Gelişimine bak
                  </ButtonLink>
                )}
              </div>
            ) : null}
          </div>
        </ComponentCard>

        {durdu ? (
          <Card className="flex gap-3 p-4 sm:p-5">
            <RotateCcw className="mt-0.5 size-5 shrink-0 text-gray-400" aria-hidden />
            <p className="text-theme-sm leading-relaxed text-gray-500">
              Seviyeli check-up&apos;ı eksiklerini kapattıktan sonra yeniden çözebilirsin.
              Aynı sorular gelmez — her denemede havuzdan yeni sorular seçilir.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
