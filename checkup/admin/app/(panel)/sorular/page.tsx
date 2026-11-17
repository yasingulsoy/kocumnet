import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, GraduationCap, ImageIcon, ListChecks, Plus } from "lucide-react";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { oku } from "@/lib/backend";
import { kimlikAl, kisalt, sayi, sorgu } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Agac, Sayfali, Sinav, SoruOzeti } from "@/lib/tipler";
import { SoruSuzgeci } from "./SoruSuzgeci";

export const metadata: Metadata = { title: "Sorular" };

const BOYUT = 50;

function tek(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SorularSayfasi({ searchParams }: PageProps<"/sorular">) {
  await yoneticiGerekli();
  const sp = await searchParams;
  const sinavlar = await oku<Sinav[]>("/admin/sinavlar");

  if (sinavlar.length === 0) {
    return (
      <>
        <PageBreadcrumb pageTitle="Sorular" />
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Önce bir sınav gerekli"
            description="Sorular bir sınavın konu ağacına bağlanır. Sınav ekleyin, sonra konu ağacını girin."
            action={
              <ButtonLink href="/sinavlar" size="xs">
                Sınavlar
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  // Varsayılan: ilk aktif sınav (yoksa ilk sınav).
  const istenen = kimlikAl(sp.sinav);
  const sinav = sinavlar.find((s) => s.id === istenen) ?? sinavlar.find((s) => s.aktif) ?? sinavlar[0];
  const suzgec = {
    dersId: kimlikAl(sp.ders),
    konuId: kimlikAl(sp.konu),
    kazanimId: kimlikAl(sp.kazanim),
    altKazanimId: kimlikAl(sp.altKazanim),
    aktif: tek(sp.aktif) === "true" ? "true" : tek(sp.aktif) === "false" ? "false" : "",
    ara: tek(sp.ara).slice(0, 200),
  };
  const sayfa = kimlikAl(sp.sayfa) ?? 1;

  const [agac, liste] = await Promise.all([
    oku<Agac>(`/admin/sinavlar/${sinav.id}/agac`),
    oku<Sayfali<SoruOzeti>>(
      `/admin/sorular${sorgu({
        sinavId: sinav.id,
        dersId: suzgec.dersId,
        konuId: suzgec.konuId,
        kazanimId: suzgec.kazanimId,
        altKazanimId: suzgec.altKazanimId,
        aktif: suzgec.aktif,
        ara: suzgec.ara,
        sayfa,
        boyut: BOYUT,
      })}`
    ),
  ]);

  const adresParcalari = {
    sinav: sinav.id,
    ders: suzgec.dersId,
    konu: suzgec.konuId,
    kazanim: suzgec.kazanimId,
    altKazanim: suzgec.altKazanimId,
    aktif: suzgec.aktif,
    ara: suzgec.ara,
  };
  const toplamSayfa = Math.max(1, Math.ceil(liste.toplam / (liste.boyut || BOYUT)));
  const suzgecVar = Boolean(suzgec.dersId || suzgec.aktif || suzgec.ara);
  const yeniSoruAdresi = `/sorular/yeni${sorgu({
    sinav: sinav.id,
    ders: suzgec.dersId,
    konu: suzgec.konuId,
    kazanim: suzgec.kazanimId,
    altKazanim: suzgec.altKazanimId,
  })}`;

  return (
    <>
      <PageBreadcrumb
        pageTitle="Sorular"
        description="Süzgeçler adres çubuğunda durur: bağlantıyı paylaşabilir, geri tuşuyla dönebilirsiniz."
        actions={
          <>
            <ButtonLink href={`/ice-aktar?sinav=${sinav.id}`} size="xs" variant="outline" startIcon={<FileSpreadsheet />}>
              Excel&apos;den içe aktar
            </ButtonLink>
            <ButtonLink href={yeniSoruAdresi} size="xs" startIcon={<Plus />}>
              Yeni soru
            </ButtonLink>
          </>
        }
      />

      <SoruSuzgeci
        key={sorgu(adresParcalari)}
        sinavlar={sinavlar.map((s) => ({ id: s.id, ad: s.ad, aktif: s.aktif }))}
        sinavId={sinav.id}
        agac={agac}
        {...suzgec}
      />

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm text-gray-500">
          <span>
            <span className="font-medium text-gray-800">{sayi(liste.toplam)}</span> soru
            {suzgecVar ? " (süzgeçli)" : ""} · {sinav.ad}
          </span>
          {toplamSayfa > 1 ? (
            <span>
              Sayfa {sayi(sayfa)} / {sayi(toplamSayfa)}
            </span>
          ) : null}
        </div>
        {liste.kayitlar.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title={suzgecVar ? "Süzgeçlere uyan soru yok" : "Bu sınavda henüz soru yok"}
            description={
              suzgecVar
                ? "Süzgeçleri gevşetin ya da temizleyin."
                : agac.dersler.length === 0
                  ? "Önce konu ağacını girin; her soru ders, konu, kazanım ve alt kazanıma bağlanır."
                  : "Tek tek ekleyebilir ya da Excel şablonuyla toplu yükleyebilirsiniz."
            }
            action={
              agac.dersler.length === 0 ? (
                <ButtonLink href={`/sinavlar/${sinav.id}/konular`} size="xs">
                  Konu ağacına git
                </ButtonLink>
              ) : (
                <ButtonLink href={yeniSoruAdresi} size="xs" startIcon={<Plus />}>
                  Yeni soru
                </ButtonLink>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader align="end">
                  #
                </TableCell>
                <TableCell isHeader>Soru</TableCell>
                <TableCell isHeader>Konu</TableCell>
                <TableCell isHeader>Kazanım</TableCell>
                <TableCell isHeader align="center">
                  Zorluk
                </TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader align="end">
                  Kullanım
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liste.kayitlar.map((s) => (
                <TableRow key={s.id} hover className="relative">
                  <TableCell align="end" className="tabular text-theme-xs">
                    {s.id}
                  </TableCell>
                  <TableCell className="w-full max-w-0 min-w-64">
                    <Link
                      href={`/sorular/${s.id}`}
                      className="flex items-start gap-1.5 text-gray-800 after:absolute after:inset-0 hover:text-brand-600"
                    >
                      {s.gorselVar ? <ImageIcon className="mt-0.5 size-4 shrink-0 text-gray-500" aria-label="Görselli" /> : null}
                      <span className="line-clamp-2">{kisalt(s.metin, 160) || "(boş)"}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-40">
                    <span className="block text-theme-xs text-gray-500">{s.ders}</span>
                    <span className="block text-gray-700">{s.konu}</span>
                  </TableCell>
                  <TableCell className="min-w-48">
                    <span className="line-clamp-1 block text-gray-700" title={s.kazanim}>
                      {s.kazanim}
                    </span>
                    <span className="line-clamp-1 block text-theme-xs text-gray-500" title={s.altKazanim}>
                      {s.altKazanim}
                    </span>
                  </TableCell>
                  <TableCell align="center" className="tabular">
                    {s.zorluk ?? "—"}
                  </TableCell>
                  <TableCell nowrap>
                    {s.aktif ? (
                      <Badge size="sm" color="success">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge size="sm" color="light">
                        Pasif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell align="end" className="tabular" title="Bu sorunun geçtiği check-up sayısı">
                    {sayi(s.kullanimSayisi)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="border-t border-gray-100 px-5 py-4 empty:hidden">
          <Pagination currentPage={sayfa} totalPages={toplamSayfa} href={(n) => `/sorular${sorgu({ ...adresParcalari, sayfa: n > 1 ? n : null })}`} />
        </div>
      </Card>
    </>
  );
}
