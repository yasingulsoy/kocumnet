import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  Hourglass,
  Link2Off,
  Minus,
  NotebookPen,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { VeliKonu, VeliRaporu } from "@/lib/veli-raporu";
import { KonuHaritasi } from "@/components/KonuHaritasi";
import { trDate, trNumber } from "@/components/ui";
import { Wordmark } from "@/components/ui/logo";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

/*
 * Veli raporu ekranı — girişsiz, salt okunur (app/veli/[token]).
 *
 * Yalnızca VeliRaporu'nu çizer; veritabanı, çerez, istek bilgisi görmez.
 * Grafik `grafik` yuvasından gelir (ApexCharts istemcide yüklenir): böylece
 * bu bileşen `npm run test:veli` içinde HTML'e çizilip sızıntı denetlenebiliyor.
 * Veliye "siz" diye hitap edilir.
 */

/** Başarı bandı — pano ve gelişimle aynı eşikler (%75 / %45). */
function bant(oran: number): BadgeColor {
  return oran >= 75 ? "success" : oran >= 45 ? "warning" : "error";
}

const GIZLILIK_NOTU =
  "Bu sayfa yalnızca genel durumu gösterir: sorular, cevaplar, çözümler ve iletişim bilgileri burada yer almaz. Bağlantıyı öğrenci istediği an kapatabilir.";

/** Girişsiz sayfaların kabuğu: logo, ortalı içerik, gizlilik notu. */
export function VeliKabugu({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark />
          <Badge size="sm" color="light" startIcon={<ShieldCheck aria-hidden />}>
            Veli raporu · salt okunur
          </Badge>
        </div>
        <div className="mt-6 sm:mt-8">{children}</div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-theme-xs leading-relaxed text-gray-500">
          {GIZLILIK_NOTU}{" "}
          {/* Referer gönderilmez (next.config.ts): jeton gizlilik sayfasının günlüğüne düşmez. */}
          <a href="/gizlilik#veli-baglantisi" className="font-medium text-brand-500 underline hover:text-brand-600">
            Gizlilik
          </a>
        </p>
      </div>
    </main>
  );
}

/** Rapor yerine gösterilen durumlar: veri yok, yalnızca açıklama. */
export function VeliDurumu({ tur }: { tur: "kapali" | "sinir" | "onizleme" }) {
  const icerik = {
    kapali: {
      ikon: <Link2Off className="size-6" aria-hidden />,
      baslik: "Bu bağlantı artık açık değil",
      metin:
        "Süresi dolmuş ya da öğrenci tarafından kapatılmış olabilir. Güncel durumu görmek için öğrenciden yeni bir bağlantı isteyebilirsiniz.",
    },
    sinir: {
      ikon: <Hourglass className="size-6" aria-hidden />,
      baslik: "Çok fazla istek",
      metin: "Kısa sürede çok sayıda açılış oldu. Birkaç dakika sonra sayfayı yeniden açın.",
    },
    onizleme: {
      ikon: <ShieldCheck className="size-6" aria-hidden />,
      baslik: "Koçum.Net veli raporu",
      metin: "Öğrencinin matematik check-up özeti. Rapor, bağlantı tarayıcıda açılınca görünür.",
    },
  }[tur];

  return (
    <Card className="mx-auto max-w-md p-6 text-center sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">{icerik.ikon}</span>
      <h1 className="mt-4 font-display text-xl font-semibold text-balance text-gray-800">{icerik.baslik}</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{icerik.metin}</p>
    </Card>
  );
}

function KonuListesi({ konular, seviye, bos }: { konular: VeliKonu[]; seviye: "STRONG" | "WEAK"; bos: string }) {
  if (konular.length === 0) return <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">{bos}</p>;
  return (
    <KonuHaritasi
      konular={konular.map((k, i) => ({
        topicId: String(i),
        name: k.ad,
        ratio: k.oran / 100,
        correct: k.dogru,
        asked: k.soru,
        level: seviye,
      }))}
    />
  );
}

export function VeliRaporuGorunumu({
  rapor,
  bitis,
  grafik,
}: {
  rapor: VeliRaporu;
  /** Bağlantının bitişi. */
  bitis: Date;
  /** Başarı eğilimi grafiği (iki ve daha çok ölçümde). */
  grafik?: ReactNode;
}) {
  const { sinav, sonOlcum, plan } = rapor;
  const degisim = sonOlcum?.degisim ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      <Card tone="brand" className="p-5 sm:p-6">
        <p className="text-theme-xs font-semibold tracking-[0.14em] text-brand-500 uppercase">Matematik check-up özeti</p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-balance text-gray-800 sm:text-title-sm">{rapor.ad}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sinav ? (
            <>
              <Badge size="sm" title={sinav.ad}>
                Hedef: {sinav.kisa}
              </Badge>
              <Badge size="sm" color="light" startIcon={<CalendarDays aria-hidden />}>
                {sinav.kalanGun !== null ? <span className="tabular">Sınava {sinav.kalanGun} gün</span> : `Sınav: ${sinav.donem}`}
              </Badge>
            </>
          ) : (
            <Badge size="sm" color="light">
              Hedef sınav seçilmemiş
            </Badge>
          )}
        </div>
        <p className="mt-3 text-theme-sm leading-relaxed text-gray-500">
          Sayfa her açılışta güncel durumu gösterir. Bağlantı {trDate(bitis)} tarihine kadar açık.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
        <MetricCard
          compact
          className="col-span-2 lg:col-span-1"
          label="Son ölçüm"
          value={sonOlcum ? `%${sonOlcum.oran}` : "—"}
          icon={<Target />}
          tone="brand"
          badge={
            degisim !== null ? (
              <Badge
                size="sm"
                color={degisim > 0 ? "success" : degisim < 0 ? "error" : "light"}
                startIcon={degisim > 0 ? <TrendingUp aria-hidden /> : degisim < 0 ? <TrendingDown aria-hidden /> : <Minus aria-hidden />}
              >
                <span className="tabular">
                  {degisim > 0 ? "+" : ""}
                  {degisim} puan
                </span>
              </Badge>
            ) : undefined
          }
          hint={
            sonOlcum
              ? `${sonOlcum.paket} · ${trDate(sonOlcum.tarih, false)}${degisim !== null ? " · bir öncekine göre" : ""}`
              : "Henüz bir check-up ölçümü yok."
          }
        />
        <MetricCard
          compact
          label="Bu haftaki plan"
          value={plan ? <span className="tabular">{`${plan.biten}/${plan.toplam}`}</span> : "—"}
          icon={<ClipboardCheck />}
          tone={plan && plan.toplam > 0 && plan.biten === plan.toplam ? "success" : "gray"}
          hint={plan ? "iş tamamlandı" : "Bu hafta için plan yok."}
        />
        <MetricCard
          compact
          label="Yanlış defteri"
          value={rapor.acikDefter}
          icon={<NotebookPen />}
          hint="tekrar bekleyen soru"
        />
      </div>

      <ChartCard
        title="Başarı oranı"
        description={
          rapor.olcumSayisi >= 2
            ? "Her nokta bir check-up. 5 soruluk kontrol testleri ve alıştırmalar girmez."
            : "Grafik ikinci check-up'tan sonra oluşur."
        }
      >
        {rapor.egilim.length >= 2 && grafik ? (
          grafik
        ) : (
          <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">
            {sonOlcum ? `Şimdilik tek bir ölçüm var: %${sonOlcum.oran}.` : "Henüz bir check-up ölçümü yok."}
          </p>
        )}
      </ChartCard>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <ComponentCard title="Güçlü konular" desc="En az 3 soruda ölçülmüş, başarı %75 ve üstü">
          <KonuListesi konular={rapor.gucluKonular} seviye="STRONG" bos="Henüz güçlü çıkan bir konu yok." />
        </ComponentCard>
        <ComponentCard title="Çalışılması gereken konular" desc="En az 3 soruda ölçülmüş, başarı %45'in altında">
          <KonuListesi konular={rapor.zayifKonular} seviye="WEAK" bos="Zayıf çıkan bir konu yok." />
        </ComponentCard>
      </div>

      <ComponentCard title="Son check-up'lar" desc="En yeniden eskiye" flush>
        {rapor.sonTestler.length === 0 ? (
          <p className="mx-5 mb-5 rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500 sm:mx-6">Henüz tamamlanmış bir check-up yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Test</TableCell>
                <TableCell isHeader className="hidden sm:table-cell">
                  Tarih
                </TableCell>
                <TableCell isHeader align="end">
                  Net
                </TableCell>
                <TableCell isHeader align="end">
                  Başarı
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rapor.sonTestler.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="w-full max-w-0 min-w-36">
                    <span className="block truncate font-medium text-gray-800">{t.paket}</span>
                    <span className="block text-theme-xs sm:hidden">{trDate(t.tarih, false)}</span>
                  </TableCell>
                  <TableCell nowrap className="hidden sm:table-cell">
                    {trDate(t.tarih)}
                  </TableCell>
                  <TableCell nowrap align="end" className="tabular">
                    <span className="font-medium text-gray-800">{trNumber(t.net)}</span>
                  </TableCell>
                  <TableCell nowrap align="end">
                    <Badge size="sm" color={bant(t.oran)}>
                      <span className="tabular">%{t.oran}</span>
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ComponentCard>
    </div>
  );
}
