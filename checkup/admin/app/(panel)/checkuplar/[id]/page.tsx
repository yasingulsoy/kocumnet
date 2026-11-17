import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleSlash, Hourglass, Percent, Sigma, XCircle } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { MeterList } from "@/components/tailadmin/charts/MeterList";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { SoruGorseli, SoruHtml } from "@/components/SoruHtml";
import { YetkiYok } from "@/components/YetkiYok";
import { api } from "@/lib/backend";
import { goturmeMetni, kimlikMi, ondalik, sayi, sure, tarihSaat } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Rapor, RaporGrubu } from "@/lib/tipler";

export const metadata: Metadata = { title: "Check-up raporu" };

/**
 * Bir öğrencinin check-up raporu — öğrenci uygulamasındaki raporun aynı
 * verisi (GET /api/admin/checkuplar/:id/rapor). Yalnızca YONETICI (KVKK).
 */
export default async function RaporSayfasi({ params }: PageProps<"/checkuplar/[id]">) {
  const { yetkili } = await yoneticiGerekli("YONETICI");
  if (!yetkili) return <YetkiYok aciklama="Öğrenci raporları kişisel veridir (KVKK); yalnızca YÖNETİCİ rolü görebilir." />;
  const { id } = await params;
  if (!kimlikMi(id)) notFound();

  const s = await api<Rapor>(`/admin/checkuplar/${id}/rapor`);
  if (!s.ok) {
    if (s.hata.kod === "BULUNAMADI") notFound();
    if (s.hata.kod === "HAZIR_DEGIL") {
      return (
        <>
          <PageBreadcrumb pageTitle={`Check-up #${id}`} crumbs={[{ href: "/ogrenciler", label: "Öğrenciler" }]} currentLabel="Rapor" />
          <Alert variant="info" title="Rapor henüz yok">
            Bu check-up devam ediyor; öğrenci bitirince (ya da süre dolunca) rapor oluşur.
          </Alert>
        </>
      );
    }
    throw new Error(s.hata.mesaj);
  }
  const r = s.veri;
  const o = r.ozet;

  return (
    <>
      <PageBreadcrumb
        pageTitle={`${r.sinav.ad} · ${r.tur.ad}`}
        crumbs={[
          { href: "/ogrenciler", label: "Öğrenciler" },
          ...(r.ogrenci ? [{ href: `/ogrenciler/${r.ogrenci.id}`, label: r.ogrenci.adSoyad }] : []),
        ]}
        currentLabel={`Rapor #${r.id}`}
        description={`${r.ogrenci ? `${r.ogrenci.adSoyad} · ` : ""}${tarihSaat(r.baslangic)} – ${tarihSaat(r.bitis)} · ${sure(r.sureSaniye)} · Yanlış götürme: ${goturmeMetni(o.yanlisGoturme)}`}
        actions={
          r.ogrenci ? (
            <ButtonLink href={`/ogrenciler/${r.ogrenci.id}`} size="xs" variant="outline">
              Öğrenci
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Net" value={ondalik(o.net)} icon={<Sigma />} tone="brand" hint={`${sayi(o.soruSayisi)} soruda`} />
        <MetricCard label="Doğru" value={sayi(o.dogru)} icon={<CheckCircle2 />} tone="success" />
        <MetricCard label="Yanlış" value={sayi(o.yanlis)} icon={<XCircle />} tone="error" />
        <MetricCard label="Boş" value={sayi(o.bos)} icon={<CircleSlash />} />
        <MetricCard label="Başarı" value={`%${sayi(o.basari)}`} icon={<Percent />} tone="warning" hint={<span className="inline-flex items-center gap-1"><Hourglass className="size-3" aria-hidden />{sure(r.sureSaniye)}</span>} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ComponentCard title="Dersler" flush>
          <GrupTablosu gruplar={r.dersler} />
        </ComponentCard>
        <ComponentCard title="En zayıf kazanımlar" desc="En az 2 sorusu olup başarısı %50'nin altında kalanlar (en fazla 5).">
          {r.zayiflar.length === 0 ? (
            <p className="text-sm text-gray-500">Belirgin bir zayıflık yok.</p>
          ) : (
            <MeterList
              wrap
              max={100}
              items={r.zayiflar.map((z) => ({
                key: `${z.seviye}-${z.id}`,
                label: z.kod ? `${z.kod} · ${z.ad}` : z.ad,
                value: z.basari,
                valueLabel: `%${z.basari}`,
                meta: `${z.ustAd} · ${z.dogru}/${z.soru} doğru`,
                tone: "error" as const,
                badge: (
                  <Badge size="sm" color="light">
                    {z.seviye === "kazanim" ? "Kazanım" : "Alt kazanım"}
                  </Badge>
                ),
              }))}
            />
          )}
        </ComponentCard>
      </div>

      <ComponentCard title="Konular" className="mt-6" flush>
        <GrupTablosu gruplar={r.konular} ust={(g) => (g as RaporGrubu & { dersAd: string }).dersAd} ustBaslik="Ders" />
      </ComponentCard>

      <ComponentCard title="Kazanımlar" className="mt-6" flush>
        <GrupTablosu
          gruplar={r.kazanimlar}
          ust={(g) => (g as RaporGrubu & { konuAd: string }).konuAd}
          ustBaslik="Konu"
          kod={(g) => (g as RaporGrubu & { kod: string | null }).kod}
        />
      </ComponentCard>

      <ComponentCard title="Cevap incelemesi" desc="Her soru, öğrencinin seçimi, doğru şık ve çözüm." className="mt-6">
        <ol className="space-y-6">
          {r.inceleme.map((q) => (
            <li key={q.sira} className="rounded-xl border border-gray-200 p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 font-display text-sm font-semibold text-gray-700">
                  {q.sira}
                </span>
                {q.sonuc === "dogru" ? (
                  <Badge size="sm" color="success">
                    Doğru
                  </Badge>
                ) : q.sonuc === "yanlis" ? (
                  <Badge size="sm" color="error">
                    Yanlış
                  </Badge>
                ) : (
                  <Badge size="sm" color="light">
                    Boş
                  </Badge>
                )}
                <span className="text-theme-xs text-gray-500">
                  {q.ders} › {q.konu} › {q.kazanim} › {q.altKazanim}
                </span>
              </div>
              <SoruHtml html={q.metinHtml} />
              {q.gorselId ? <SoruGorseli id={q.gorselId} className="mt-3" /> : null}
              <ul className="mt-4 space-y-2">
                {q.siklar.map((k) => {
                  const secildi = k.id === q.secilenSikId;
                  return (
                    <li
                      key={k.id}
                      className={cx(
                        "rounded-lg border px-3 py-2 text-sm",
                        k.dogru ? "border-success-300 bg-success-25" : secildi ? "border-error-300 bg-error-25" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cx(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                            k.dogru ? "bg-success-500 text-white" : secildi ? "bg-error-500 text-white" : "bg-gray-100 text-gray-700"
                          )}
                        >
                          {k.harf}
                        </span>
                        <SoruHtml html={k.metinHtml} className="min-w-0 flex-1" />
                        {secildi ? <span className="shrink-0 text-theme-xs font-medium text-gray-600">öğrencinin seçimi</span> : null}
                        {k.dogru ? <span className="shrink-0 text-theme-xs font-medium text-success-700">doğru cevap</span> : null}
                      </div>
                      {k.aciklama ? <p className="mt-1.5 ps-8 text-theme-xs text-gray-600">{k.aciklama}</p> : null}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                <p className="mb-1 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">Çözüm</p>
                <SoruHtml html={q.cozumHtml} className="text-sm" />
              </div>
            </li>
          ))}
        </ol>
      </ComponentCard>
    </>
  );
}

function GrupTablosu({
  gruplar,
  ust,
  ustBaslik,
  kod,
}: {
  gruplar: RaporGrubu[];
  ust?: (g: RaporGrubu) => string;
  ustBaslik?: string;
  kod?: (g: RaporGrubu) => string | null;
}) {
  if (gruplar.length === 0) return <p className="px-5 py-6 text-sm text-gray-500">Veri yok.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {ust ? <TableCell isHeader>{ustBaslik}</TableCell> : null}
          <TableCell isHeader>Ad</TableCell>
          <TableCell isHeader align="end">
            Soru
          </TableCell>
          <TableCell isHeader align="end">
            D
          </TableCell>
          <TableCell isHeader align="end">
            Y
          </TableCell>
          <TableCell isHeader align="end">
            B
          </TableCell>
          <TableCell isHeader align="end">
            Net
          </TableCell>
          <TableCell isHeader>Başarı</TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gruplar.map((g) => (
          <TableRow key={g.id}>
            {ust ? <TableCell className="min-w-32 text-theme-xs">{ust(g)}</TableCell> : null}
            <TableCell className="min-w-48">
              {kod?.(g) ? <span className="me-1.5 font-mono text-theme-xs text-gray-500">{kod(g)}</span> : null}
              <span className="text-gray-800">{g.ad}</span>
            </TableCell>
            <TableCell align="end" className="tabular">
              {sayi(g.soru)}
            </TableCell>
            <TableCell align="end" className="tabular">
              {sayi(g.dogru)}
            </TableCell>
            <TableCell align="end" className="tabular">
              {sayi(g.yanlis)}
            </TableCell>
            <TableCell align="end" className="tabular">
              {sayi(g.bos)}
            </TableCell>
            <TableCell align="end" className="tabular font-medium">
              {ondalik(g.net)}
            </TableCell>
            <TableCell className="min-w-36">
              <span className="flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <span
                    className={cx("block h-full rounded-full", g.basari >= 70 ? "bg-success-500" : g.basari >= 50 ? "bg-warning-500" : "bg-error-500")}
                    style={{ width: `${Math.max(0, Math.min(100, g.basari))}%` }}
                  />
                </span>
                <span className="w-10 text-end text-theme-xs tabular">%{g.basari}</span>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
