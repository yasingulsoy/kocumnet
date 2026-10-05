import Link from "next/link";
import clsx from "clsx";
import { ERROR_TYPE_LABELS, type ErrorTypeValue } from "@/lib/checkup/shared/error-types";
import { ESIK, ayirtEdicilik, gorunenR, rYaz, type Bulgu } from "@/lib/checkup/item-flags";
import type { QuestionAnalysis } from "@/lib/checkup/item-analysis";
import { percent, secondsLabel } from "@/lib/checkup/format";
import { Card, CardHeader, Meter, Notice, Pill, type Tone } from "./ui";

/**
 * Soru ekranındaki madde analizi kartı (sunucu bileşeni). Hesaplar
 * lib/checkup/item-analysis.ts'te; buradaki iş okunur kılmak.
 */
export function ItemAnalysisCard({ analysis, version }: { analysis: QuestionAnalysis; version: number }) {
  const { stats, groups } = analysis;
  const n = stats.n;

  const aciklama =
    n === 0
      ? "Bu sürüm (v" + version + ") henüz tamamlanmış bir testte sorulmadı."
      : "v" + version + " · tamamlanmış testlerde " + n + " cevap" +
        (analysis.olderVersionN > 0
          ? " · önceki sürümlerin " + analysis.olderVersionN + " cevabı hesaba katılmadı (anahtar değişti)"
          : "");

  return (
    <Card className="mb-6">
      {/* Listedeki "#analiz" bağlantıları buraya iner; mobil üst çubuğun altında kalmasın. */}
      <div id="analiz" className="scroll-mt-20" />
      <CardHeader
        title="Madde analizi"
        description={aciklama}
        action={
          <Link
            href="/checkup/sorular/analiz"
            className="text-caption font-medium text-brand hover:text-brand-hover"
          >
            Tüm sorular
          </Link>
        }
      />

      {n === 0 ? (
        <p className="px-5 py-4 text-caption text-ink-soft sm:px-6">
          Sorulunca doğru oranı, ayırt edicilik, şık dağılımı ve çözüm süresi burada görünür.
          Bulgular en az {ESIK.minN} cevapla değerlendirilir.
        </p>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          <Gostergeler analysis={analysis} />

          {n < ESIK.minN ? (
            <Notice tone="info">
              Az veri: {n} cevap. Bulgular en az {ESIK.minN}, ayırt edicilik bulguları en az{" "}
              {ESIK.minNR} cevapta değerlendirilir; şimdilik sayılara temkinli bak.
            </Notice>
          ) : null}

          <SikDagilimi analysis={analysis} />

          {groups ? (
            <p className="text-micro text-ink-faint">
              Üst / alt grup: testin geri kalanında en başarılı ve en başarısız %27 ({groups.size}&apos;er
              cevap). Doğru şıkkı üst grup, çeldiricileri alt grup daha çok seçmeli; tersi kırmızıyla
              işaretli.
            </p>
          ) : null}

          {n >= ESIK.minN ? <Bulgular liste={analysis.bulgular} /> : null}
        </div>
      )}
    </Card>
  );
}

function Gosterge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-sunk px-4 py-3">
      <p className="text-micro text-ink-faint">{label}</p>
      <p className="font-display tabular mt-1 text-num-sm font-bold text-ink">{value}</p>
      {sub ? <p className="mt-1 text-micro text-ink-faint">{sub}</p> : null}
    </div>
  );
}

function Gostergeler({ analysis }: { analysis: QuestionAnalysis }) {
  const { stats, groups } = analysis;
  const r = gorunenR(stats);
  const ae = ayirtEdicilik(r);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Gosterge
        label="Doğru oranı"
        value={analysis.p === null ? "—" : percent(analysis.p)}
        sub={stats.correct + " / " + stats.n + " · etiketli zorluk " + stats.difficulty}
      />
      <div className="rounded-xl border border-line bg-surface-sunk px-4 py-3">
        <p className="text-micro text-ink-faint">Ayırt edicilik</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display tabular text-num-sm font-bold text-ink">{rYaz(r)}</span>
          {r !== null ? <Pill tone={ae.ton}>{ae.etiket}</Pill> : null}
        </p>
        <p className="mt-1 text-micro text-ink-faint">
          {groups
            ? "doğru: üst grup " + percent(groups.upperP) + " · alt grup " + percent(groups.lowerP)
            : "en az " + ESIK.gosterR + " cevapta hesaplanır"}
        </p>
      </div>
      <Gosterge
        label="Boş bırakma"
        value={percent(stats.blank / stats.n)}
        sub={stats.blank + " cevap"}
      />
      <Gosterge
        label="Medyan süre"
        value={stats.medianMs === null ? "—" : secondsLabel(stats.medianMs)}
        sub={"hedef " + stats.targetTimeSeconds + " sn"}
      />
    </div>
  );
}

function SikDagilimi({ analysis }: { analysis: QuestionAnalysis }) {
  const { stats, groups, choices } = analysis;
  const n = stats.n;
  return (
    <div className="scroll-x rounded-xl border border-line">
      <table className="data-table min-w-[34rem]">
        <caption className="sr-only">Şıkların seçilme oranları</caption>
        <thead>
          <tr>
            <th scope="col">Şık</th>
            <th scope="col">Seçilme</th>
            {groups ? (
              <>
                <th scope="col" className="text-end">
                  Üst grup
                </th>
                <th scope="col" className="text-end">
                  Alt grup
                </th>
              </>
            ) : null}
            <th scope="col">Hata tipi</th>
          </tr>
        </thead>
        <tbody>
          {choices.map((c) => {
            const oran = n > 0 ? c.count / n : 0;
            // Doğru şıkta üst grup önde olmalı; çeldiricide alt grup.
            const ters =
              c.upper !== null && c.lower !== null && (c.isCorrect ? c.upper < c.lower : c.upper > c.lower);
            const olu = !c.isCorrect && n >= ESIK.minN && oran < ESIK.oluCeldirici;
            return (
              <tr key={c.id}>
                <td className="whitespace-nowrap">
                  <span
                    className={clsx(
                      "inline-flex size-7 items-center justify-center rounded-full text-micro font-bold",
                      c.isCorrect ? "bg-ok-fill text-white" : "bg-surface-sunk text-ink-soft ring-1 ring-inset ring-line"
                    )}
                  >
                    {c.label}
                  </span>
                  {c.isCorrect ? <span className="sr-only"> (doğru şık)</span> : null}
                </td>
                <td className="min-w-48">
                  <div className="flex items-center gap-3">
                    <div className="w-full max-w-56">
                      <Meter ratio={oran} tone={c.isCorrect ? "ok" : olu ? "neutral" : "brand"} />
                    </div>
                    <span className="tabular w-20 shrink-0 text-ink">
                      {percent(oran)} <span className="text-ink-faint">({c.count})</span>
                    </span>
                  </div>
                </td>
                {groups ? (
                  <>
                    <td className={clsx("text-end tabular", ters ? (c.isCorrect ? "text-bad" : "text-warn") : "text-ink-soft")}>
                      {c.upper === null ? "—" : percent(c.upper)}
                    </td>
                    <td className="text-end tabular text-ink-soft">{c.lower === null ? "—" : percent(c.lower)}</td>
                  </>
                ) : null}
                <td className="text-micro text-ink-faint">
                  {c.isCorrect
                    ? "doğru şık"
                    : c.errorType
                      ? ERROR_TYPE_LABELS[c.errorType as ErrorTypeValue] ?? c.errorType
                      : <span className="text-warn">girilmemiş</span>}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="text-micro font-semibold text-ink-faint">Boş</td>
            <td>
              <div className="flex items-center gap-3">
                <div className="w-full max-w-56">
                  <Meter ratio={n > 0 ? stats.blank / n : 0} tone="neutral" />
                </div>
                <span className="tabular w-20 shrink-0 text-ink">
                  {percent(n > 0 ? stats.blank / n : 0)} <span className="text-ink-faint">({stats.blank})</span>
                </span>
              </div>
            </td>
            {groups ? (
              <>
                <td className="text-end tabular text-ink-soft">{percent(groups.upperBlank)}</td>
                <td className="text-end tabular text-ink-soft">{percent(groups.lowerBlank)}</td>
              </>
            ) : null}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const TON: Record<Bulgu["ton"], Tone> = { bad: "bad", warn: "warn", info: "info" };

function Bulgular({ liste }: { liste: Bulgu[] }) {
  if (liste.length === 0) {
    return <Notice tone="ok">Belirgin bir sorun görünmüyor: doğru oranı, ayırt edicilik ve şıklar makul aralıkta.</Notice>;
  }
  return (
    <div>
      <h3 className="mb-2 font-display text-h4 font-semibold text-ink">Bulgular</h3>
      <ul className="space-y-2">
        {liste.map((b) => (
          <li key={b.key} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-line px-4 py-3">
            <Pill tone={TON[b.ton]}>{b.baslik}</Pill>
            <p className="min-w-0 flex-1 basis-64 text-caption text-ink-soft">{b.aciklama}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
