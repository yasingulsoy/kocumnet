import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { ProfileCard } from "@/components/tailadmin/profile/ProfileCard";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { YetkiYok } from "@/components/YetkiYok";
import { oku } from "@/lib/backend";
import { KAYNAK_ADI, kimlikMi, ondalik, sayi, tarihSaat } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { OgrenciAyrintisi } from "@/lib/tipler";

export const metadata: Metadata = { title: "Öğrenci" };

export default async function OgrenciSayfasi({ params }: PageProps<"/ogrenciler/[id]">) {
  const { yetkili } = await yoneticiGerekli("YONETICI");
  if (!yetkili) return <YetkiYok aciklama="Öğrenci bilgileri kişisel veridir (KVKK); yalnızca YÖNETİCİ rolü görebilir." />;
  const { id } = await params;
  if (!kimlikMi(id)) notFound();
  const { ogrenci, checkuplar } = await oku<OgrenciAyrintisi>(`/admin/ogrenciler/${id}`);
  const biten = checkuplar.filter((c) => c.durum === "BITTI").length;

  return (
    <>
      <PageBreadcrumb pageTitle={ogrenci.adSoyad} crumbs={[{ href: "/ogrenciler", label: "Öğrenciler" }]} currentLabel={ogrenci.adSoyad} />

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <ProfileCard
          name={ogrenci.adSoyad}
          meta={[ogrenci.eposta]}
          details={[
            { label: "Kayıt", value: tarihSaat(ogrenci.olusturuldu) },
            { label: "Kaynak", value: ogrenci.kaynak ? (KAYNAK_ADI[ogrenci.kaynak] ?? ogrenci.kaynak) : "—" },
            { label: "Check-up", value: `${sayi(checkuplar.length)} (${sayi(biten)} tamamlandı)` },
          ]}
        />

        <ComponentCard title="Check-up'lar" desc="En yeni önce. Tamamlananların raporu açılır." flush>
          {checkuplar.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Henüz check-up yok" description="Öğrenci bir check-up başlatınca burada görünür." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Sınav · tür</TableCell>
                  <TableCell isHeader>Durum</TableCell>
                  <TableCell isHeader>Başlangıç</TableCell>
                  <TableCell isHeader align="end">
                    D / Y / B
                  </TableCell>
                  <TableCell isHeader align="end">
                    Net
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkuplar.map((c) => (
                  <TableRow key={c.id} hover className={c.durum === "BITTI" ? "relative" : undefined}>
                    <TableCell className="min-w-48">
                      {c.durum === "BITTI" ? (
                        <Link href={`/checkuplar/${c.id}`} className="font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-600">
                          {c.sinav.ad} · {c.tur.ad}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-800">
                          {c.sinav.ad} · {c.tur.ad}
                        </span>
                      )}
                      <span className="block text-theme-xs text-gray-500">
                        {sayi(c.soruSayisi)} soru · {sayi(c.cevaplanan)} cevaplandı
                      </span>
                    </TableCell>
                    <TableCell nowrap>
                      {c.durum === "BITTI" ? (
                        <Badge size="sm" color="success">
                          Bitti
                        </Badge>
                      ) : (
                        <Badge size="sm" color="warning">
                          Devam ediyor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell nowrap>{tarihSaat(c.baslangic)}</TableCell>
                    <TableCell align="end" nowrap className="tabular">
                      {c.durum === "BITTI" ? `${sayi(c.dogru)} / ${sayi(c.yanlis)} / ${sayi(c.bos)}` : "—"}
                    </TableCell>
                    <TableCell align="end" className="tabular font-medium text-gray-800">
                      {c.durum === "BITTI" ? ondalik(c.net) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ComponentCard>
      </div>
    </>
  );
}
