import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/tailadmin/form/Input";
import { Button } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { YetkiYok } from "@/components/YetkiYok";
import { oku } from "@/lib/backend";
import { KAYNAK_ADI, kimlikAl, sayi, sorgu, tarih } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { OgrenciOzeti, Sayfali } from "@/lib/tipler";

export const metadata: Metadata = { title: "Öğrenciler" };

const BOYUT = 50;

/** API.md `sonCheckup`ın biçimini belirtmiyor: tarih metni ya da nesne olabilir. */
function sonCheckupTarihi(v: OgrenciOzeti["sonCheckup"]): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.bitis ?? v.baslangic ?? null;
}

export default async function OgrencilerSayfasi({ searchParams }: PageProps<"/ogrenciler">) {
  const { yetkili } = await yoneticiGerekli("YONETICI");
  if (!yetkili) return <YetkiYok aciklama="Öğrenci bilgileri kişisel veridir (KVKK); yalnızca YÖNETİCİ rolü görebilir." />;

  const sp = await searchParams;
  const ara = (Array.isArray(sp.ara) ? sp.ara[0] : sp.ara)?.slice(0, 200) ?? "";
  const sayfa = kimlikAl(sp.sayfa) ?? 1;
  const liste = await oku<Sayfali<OgrenciOzeti>>(`/admin/ogrenciler${sorgu({ ara: ara.trim(), sayfa, boyut: BOYUT })}`);
  const toplamSayfa = Math.max(1, Math.ceil(liste.toplam / (liste.boyut || BOYUT)));

  return (
    <>
      <PageBreadcrumb pageTitle="Öğrenciler" description="Kayıtlı öğrenciler ve check-up sayıları. Bir öğrenciye tıklayınca check-up'ları ve raporları açılır." />

      <Card>
        <Form action="/ogrenciler" className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-4">
          <Input
            compact
            type="search"
            name="ara"
            defaultValue={ara}
            placeholder="Ad ya da e-posta…"
            aria-label="Öğrenci ara"
            startIcon={<Search className="size-4" />}
            wrapperClassName="w-full sm:w-80"
            maxLength={200}
          />
          <Button type="submit" size="xs" variant="outline">
            Ara
          </Button>
          <span className="text-sm text-gray-500 sm:ms-auto">
            <span className="font-medium text-gray-800">{sayi(liste.toplam)}</span> öğrenci{ara ? ` · "${ara}"` : ""}
          </span>
        </Form>

        {liste.kayitlar.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={ara ? "Eşleşen öğrenci yok" : "Henüz kayıtlı öğrenci yok"}
            description={ara ? "Aramayı değiştirin ya da temizleyin." : "Öğrenciler check-up uygulamasından kayıt olunca burada görünür."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Ad soyad</TableCell>
                <TableCell isHeader>E-posta</TableCell>
                <TableCell isHeader>Kayıt</TableCell>
                <TableCell isHeader>Kaynak</TableCell>
                <TableCell isHeader align="end">
                  Check-up
                </TableCell>
                <TableCell isHeader>Son check-up</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liste.kayitlar.map((o) => (
                <TableRow key={o.id} hover className="relative">
                  <TableCell className="min-w-44">
                    <Link href={`/ogrenciler/${o.id}`} className="font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-600">
                      {o.adSoyad}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-52">{o.eposta}</TableCell>
                  <TableCell nowrap>{tarih(o.olusturuldu)}</TableCell>
                  <TableCell nowrap>{o.kaynak ? (KAYNAK_ADI[o.kaynak] ?? o.kaynak) : "—"}</TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(o.checkupSayisi)}
                  </TableCell>
                  <TableCell nowrap>{tarih(sonCheckupTarihi(o.sonCheckup))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="border-t border-gray-100 px-5 py-4 empty:hidden">
          <Pagination currentPage={sayfa} totalPages={toplamSayfa} href={(n) => `/ogrenciler${sorgu({ ara: ara.trim(), sayfa: n > 1 ? n : null })}`} />
        </div>
      </Card>
    </>
  );
}
