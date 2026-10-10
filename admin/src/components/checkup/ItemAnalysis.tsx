import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ERROR_TYPE_LABELS, type ErrorTypeValue } from "@/lib/checkup/shared/error-types";
import { ESIK, ayirtEdicilik, gorunenR, rYaz, type Bulgu } from "@/lib/checkup/item-flags";
import type { QuestionAnalysis } from "@/lib/checkup/item-analysis";
import { percent, secondsLabel } from "@/lib/checkup/format";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { BULGU_COLOR, Meter } from "./ui";

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
    <ComponentCard
      // Listedeki "#analiz" bağlantıları buraya iner; yapışkan üst çubuğun altında kalmasın.
      id="analiz"
      className="mb-6 scroll-mt-24"
      title="Madde analizi"
      desc={aciklama}
      actions={
        <Link
          href="/checkup/sorular/analiz"
          className="inline-flex items-center gap-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
        >
          Tüm sorular <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
        </Link>
      }
    >
      {n === 0 ? (
        <p className="text-theme-sm text-gray-500">
          Sorulunca doğru oranı, ayırt edicilik, şık dağılımı ve çözüm süresi burada görünür.
          Bulgular en az {ESIK.minN} cevapla değerlendirilir.
        </p>
      ) : (
        <>
          <Gostergeler analysis={analysis} />

          {n < ESIK.minN ? (
            <Alert variant="info" compact>
              Az veri: {n} cevap. Bulgular en az {ESIK.minN}, ayırt edicilik bulguları en az{" "}
              {ESIK.minNR} cevapta değerlendirilir; şimdilik sayılara temkinli bak.
            </Alert>
          ) : null}

          <SikDagilimi analysis={analysis} />

          {groups ? (
            <p className="text-theme-xs text-gray-500">
              Üst / alt grup: testin geri kalanında en başarılı ve en başarısız %27 ({groups.size}&apos;er
              cevap). Doğru şıkkı üst grup, çeldiricileri alt grup daha çok seçmeli; tersi kırmızıyla
              işaretli.
            </p>
          ) : null}

          {n >= ESIK.minN ? <Bulgular liste={analysis.bulgular} /> : null}
        </>
      )}
    </ComponentCard>
  );
}

function Gosterge({ label, value, sub, badge }: { label: string; value: string; sub?: string; badge?: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-theme-xs text-gray-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="tabular font-display text-xl font-bold text-gray-800">{value}</span>
        {badge}
      </p>
      {sub ? <p className="mt-1 text-theme-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

const AYIRT_RENK: Record<"ok" | "neutral" | "warn" | "bad", BadgeColor> = {
  ok: "success",
  neutral: "light",
  warn: "warning",
  bad: "error",
};

function Gostergeler({ analysis }: { analysis: QuestionAnalysis }) {
  const { stats, groups } = analysis;
  const r = gorunenR(stats);
  const ae = ayirtEdicilik(r);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Gosterge
        label="Doğru oranı"
        value={analysis.p === null ? "—" : percent(analysis.p)}
        sub={stats.correct + " / " + stats.n + " · etiketli zorluk " + stats.difficulty}
      />
      <Gosterge
        label="Ayırt edicilik"
        value={rYaz(r)}
        badge={
          r !== null ? (
            <Badge size="sm" color={AYIRT_RENK[ae.ton]}>
              {ae.etiket}
            </Badge>
          ) : null
        }
        sub={
          groups
            ? "doğru: üst grup " + percent(groups.upperP) + " · alt grup " + percent(groups.lowerP)
            : "en az " + ESIK.gosterR + " cevapta hesaplanır"
        }
      />
      <Gosterge label="Boş bırakma" value={percent(stats.blank / stats.n)} sub={stats.blank + " cevap"} />
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
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <Table>
        <caption className="sr-only">Şıkların seçilme oranları</caption>
        <TableHeader>
          <TableRow>
            <TableCell isHeader>Şık</TableCell>
            <TableCell isHeader>Seçilme</TableCell>
            {groups ? (
              <>
                <TableCell isHeader align="end" nowrap>
                  Üst grup
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Alt grup
                </TableCell>
              </>
            ) : null}
            <TableCell isHeader>Hata tipi</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {choices.map((c) => {
            const oran = n > 0 ? c.count / n : 0;
            // Doğru şıkta üst grup önde olmalı; çeldiricide alt grup.
            const ters =
              c.upper !== null && c.lower !== null && (c.isCorrect ? c.upper < c.lower : c.upper > c.lower);
            const olu = !c.isCorrect && n >= ESIK.minN && oran < ESIK.oluCeldirici;
            return (
              <TableRow key={c.id}>
                <TableCell nowrap>
                  <span
                    className={cx(
                      "inline-flex size-7 items-center justify-center rounded-full text-theme-xs font-bold",
                      c.isCorrect ? "bg-success-600 text-white" : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 ring-inset"
                    )}
                  >
                    {c.label}
                  </span>
                  {c.isCorrect ? <span className="sr-only"> (doğru şık)</span> : null}
                </TableCell>
                <TableCell className="min-w-48">
                  <div className="flex items-center gap-3">
                    <div className="w-full max-w-56">
                      <Meter ratio={oran} tone={c.isCorrect ? "success" : olu ? "gray" : "brand"} />
                    </div>
                    <span className="tabular w-20 shrink-0 text-gray-800">
                      {percent(oran)} <span className="text-gray-500">({c.count})</span>
                    </span>
                  </div>
                </TableCell>
                {groups ? (
                  <>
                    <TableCell align="end">
                      <span className={cx("tabular", ters ? (c.isCorrect ? "font-semibold text-error-600" : "text-warning-700") : undefined)}>
                        {c.upper === null ? "—" : percent(c.upper)}
                      </span>
                    </TableCell>
                    <TableCell align="end" className="tabular">
                      {c.lower === null ? "—" : percent(c.lower)}
                    </TableCell>
                  </>
                ) : null}
                <TableCell>
                  <span className="text-theme-xs">
                    {c.isCorrect ? (
                      "doğru şık"
                    ) : c.errorType ? (
                      (ERROR_TYPE_LABELS[c.errorType as ErrorTypeValue] ?? c.errorType)
                    ) : (
                      <span className="text-warning-700">girilmemiş</span>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow>
            <TableCell>
              <span className="text-theme-xs font-semibold">Boş</span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="w-full max-w-56">
                  <Meter ratio={n > 0 ? stats.blank / n : 0} tone="gray" />
                </div>
                <span className="tabular w-20 shrink-0 text-gray-800">
                  {percent(n > 0 ? stats.blank / n : 0)} <span className="text-gray-500">({stats.blank})</span>
                </span>
              </div>
            </TableCell>
            {groups ? (
              <>
                <TableCell align="end" className="tabular">
                  {percent(groups.upperBlank)}
                </TableCell>
                <TableCell align="end" className="tabular">
                  {percent(groups.lowerBlank)}
                </TableCell>
              </>
            ) : null}
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function Bulgular({ liste }: { liste: Bulgu[] }) {
  if (liste.length === 0) {
    return (
      <Alert variant="success" compact>
        Belirgin bir sorun görünmüyor: doğru oranı, ayırt edicilik ve şıklar makul aralıkta.
      </Alert>
    );
  }
  return (
    <div>
      <h3 className="mb-2 font-display text-base font-semibold text-gray-800">Bulgular</h3>
      <ul className="space-y-2">
        {liste.map((b) => (
          <li key={b.key} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-gray-200 px-4 py-3">
            <Badge size="sm" color={BULGU_COLOR[b.ton]}>
              {b.baslik}
            </Badge>
            <p className="min-w-0 flex-1 basis-64 text-theme-sm text-gray-500">{b.aciklama}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
