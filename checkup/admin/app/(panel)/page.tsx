import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, GraduationCap, Settings2, UserPlus, Users } from "lucide-react";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { oku } from "@/lib/backend";
import { sayi } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Pano } from "@/lib/tipler";

export const metadata: Metadata = { title: "Pano" };

export default async function PanoSayfasi() {
  const { yonetici } = await yoneticiGerekli();
  const p = await oku<Pano>("/admin/pano");
  const yoneticiMi = yonetici.rol === "YONETICI";

  return (
    <>
      <PageBreadcrumb pageTitle="Pano" description={`Hoş geldiniz, ${yonetici.adSoyad.split(" ")[0]}. Programın genel durumu.`} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Öğrenci"
          value={sayi(p.ogrenciSayisi)}
          icon={<Users />}
          tone="brand"
          href={yoneticiMi ? "/ogrenciler" : undefined}
          hint="Kayıtlı hesap"
        />
        <MetricCard
          label="Check-up"
          value={sayi(p.checkupSayisi)}
          icon={<ClipboardCheck />}
          hint={`${sayi(p.bitenCheckupSayisi)} tamamlandı`}
        />
        <MetricCard label="Son 7 gün kayıt" value={sayi(p.son7GunKayit)} icon={<UserPlus />} tone="success" hint="Yeni öğrenci" />
        <MetricCard label="Son 7 gün check-up" value={sayi(p.son7GunCheckup)} icon={<CalendarClock />} tone="warning" hint="Başlatılan" />
      </div>

      <ComponentCard
        className="mt-6"
        title="Sınavlar ve hazırlık"
        desc="Her sınavın soru havuzu ve check-up türlerinin hazır olup olmadığı. Rozet, o sınavın check-up ayarlarına götürür."
        flush
        actions={
          <ButtonLink href="/sinavlar" size="xs" variant="outline">
            Sınavlar
          </ButtonLink>
        }
      >
        {p.sinavlar.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title="Henüz sınav yok"
            description={yoneticiMi ? "Önce bir sınav ekleyin, sonra konu ağacını ve soruları girin." : "Bir yönetici sınav ekleyince burada görünür."}
            action={
              yoneticiMi ? (
                <ButtonLink href="/sinavlar" size="xs">
                  Sınav ekle
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Sınav</TableCell>
                <TableCell isHeader align="end">
                  Aktif soru
                </TableCell>
                <TableCell isHeader align="end">
                  Toplam soru
                </TableCell>
                <TableCell isHeader>Check-up türleri</TableCell>
                <TableCell isHeader align="end">
                  <span className="sr-only">Bağlantılar</span>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.sinavlar.map((s) => (
                <TableRow key={s.id}>
                  <TableCell nowrap>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{s.ad}</span>
                      {s.aktif ? (
                        <Badge size="sm" color="success">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge size="sm" color="light">
                          Pasif
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(s.aktifSoruSayisi)}
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(s.soruSayisi)}
                  </TableCell>
                  <TableCell>
                    {s.turler.length === 0 ? (
                      <span className="text-theme-xs text-gray-500">Tür tanımlı değil</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {s.turler.map((t) => (
                          <Link
                            key={t.turId}
                            href={`/sinavlar/${s.id}/ayarlar#tur-${t.turId}`}
                            className="rounded-full focus-visible:outline-2"
                            title={`${t.ad}: ${t.hazir ? "hazır" : "hazır değil"} (${t.secim === "SABIT" ? "sabit liste" : "karma"})`}
                          >
                            <Badge size="sm" color={t.hazir ? "success" : "warning"}>
                              {t.ad} · {t.hazir ? "hazır" : "hazır değil"}
                            </Badge>
                          </Link>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="end" nowrap>
                    <ButtonLink href={`/sinavlar/${s.id}/ayarlar`} size="xs" variant="ghost" startIcon={<Settings2 />}>
                      Ayarlar
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ComponentCard>
    </>
  );
}
