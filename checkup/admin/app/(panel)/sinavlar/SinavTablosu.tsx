"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { FolderTree, GraduationCap, ListChecks, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Switch } from "@/components/tailadmin/form/Switch";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { useBildirim } from "@/components/Bildirim";
import { degisenler, goturmeMetni, kurustanTlMetni, sayi, tl, tlMetnindenKurus } from "@/lib/bicim";
import { sinavKaydet, sinavSil } from "@/lib/eylemler/katalog";
import type { Sinav, SinavFormu } from "@/lib/tipler";

export function SinavTablosu({ sinavlar, duzenleyebilir }: { sinavlar: Sinav[]; duzenleyebilir: boolean }) {
  const [duzenlenen, setDuzenlenen] = useState<Sinav | "yeni" | null>(null);
  const [onayPenceresi, onayla] = useConfirm();
  const [, gecis] = useTransition();
  const bildir = useBildirim();

  async function sil(s: Sinav) {
    if (!s.silinebilir) {
      const duzenle = await onayla({
        title: `${s.ad} silinemez`,
        description:
          "Bu sınavın dersleri ya da öğrenci check-up'ları var. Öğrencilerden gizlemek için sınavı pasif yapın; geçmiş sonuçlar korunur.",
        confirmLabel: "Düzenle (pasif yap)",
        cancelLabel: "Kapat",
        tone: "warning",
      });
      if (duzenle) setDuzenlenen(s);
      return;
    }
    const evet = await onayla({
      title: `${s.ad} silinsin mi?`,
      description: "Sınav kalıcı olarak silinir. Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!evet) return;
    gecis(async () => {
      const r = await sinavSil(s.id);
      if (r.ok) bildir.basari(`${s.ad} silindi.`);
      else bildir.hata(r.mesaj, "Silinemedi");
    });
  }

  return (
    <>
      {onayPenceresi}
      <ComponentCard
        title="Sınav listesi"
        desc={duzenleyebilir ? undefined : "Sınav eklemek ve düzenlemek yalnızca YÖNETİCİ rolüne açık."}
        flush
        actions={
          duzenleyebilir ? (
            <Button size="xs" startIcon={<Plus />} onClick={() => setDuzenlenen("yeni")}>
              Sınav ekle
            </Button>
          ) : undefined
        }
      >
        {sinavlar.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title="Henüz sınav yok"
            description="Sınav ekleyince konu ağacını, soruları ve check-up ayarlarını buradan açarsınız."
            action={
              duzenleyebilir ? (
                <Button size="xs" startIcon={<Plus />} onClick={() => setDuzenlenen("yeni")}>
                  İlk sınavı ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Sınav</TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader align="end">
                  Ücret
                </TableCell>
                <TableCell isHeader>Yanlış götürme</TableCell>
                <TableCell isHeader align="end">
                  Ders
                </TableCell>
                <TableCell isHeader align="end">
                  Soru (aktif / toplam)
                </TableCell>
                <TableCell isHeader align="end">
                  Check-up
                </TableCell>
                <TableCell isHeader>İçerik</TableCell>
                {duzenleyebilir ? (
                  <TableCell isHeader align="end">
                    <span className="sr-only">İşlemler</span>
                  </TableCell>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sinavlar.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell className="min-w-44">
                    <span className="block font-medium text-gray-800">{s.ad}</span>
                    {s.aciklama ? <span className="mt-0.5 line-clamp-2 block text-theme-xs text-gray-500">{s.aciklama}</span> : null}
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
                  <TableCell align="end" nowrap className="tabular">
                    {tl(s.ucretKurus)}
                  </TableCell>
                  <TableCell nowrap>{goturmeMetni(s.yanlisGoturme)}</TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(s.dersSayisi)}
                  </TableCell>
                  <TableCell align="end" nowrap className="tabular">
                    {sayi(s.aktifSoruSayisi)} / {sayi(s.soruSayisi)}
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(s.checkupSayisi)}
                  </TableCell>
                  <TableCell nowrap>
                    <span className="flex flex-wrap gap-1">
                      <ButtonLink href={`/sinavlar/${s.id}/konular`} size="xs" variant="ghost" startIcon={<FolderTree />}>
                        Konular
                      </ButtonLink>
                      <ButtonLink href={`/sorular?sinav=${s.id}`} size="xs" variant="ghost" startIcon={<ListChecks />}>
                        Sorular
                      </ButtonLink>
                      <ButtonLink href={`/sinavlar/${s.id}/ayarlar`} size="xs" variant="ghost" startIcon={<Settings2 />}>
                        Check-up ayarları
                      </ButtonLink>
                    </span>
                  </TableCell>
                  {duzenleyebilir ? (
                    <TableCell align="end" nowrap>
                      <span className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" startIcon={<Pencil />} onClick={() => setDuzenlenen(s)}>
                          Düzenle
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => sil(s)}
                          aria-label={`${s.ad} sınavını sil`}
                          title={s.silinebilir ? "Sil" : "Silinemez: dersi ya da check-up'ı var; pasif yapın"}
                          className={s.silinebilir ? "text-error-600" : "text-gray-400"}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </span>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ComponentCard>

      {duzenlenen ? (
        <SinavPenceresi
          key={duzenlenen === "yeni" ? "yeni" : duzenlenen.id}
          sinav={duzenlenen === "yeni" ? null : duzenlenen}
          siradaki={sinavlar.reduce((m, s) => Math.max(m, s.sira), 0) + 1}
          onKapat={() => setDuzenlenen(null)}
        />
      ) : null}
    </>
  );
}

function SinavPenceresi({ sinav, siradaki, onKapat }: { sinav: Sinav | null; siradaki: number; onKapat: () => void }) {
  const [ad, setAd] = useState(sinav?.ad ?? "");
  const [aciklama, setAciklama] = useState(sinav?.aciklama ?? "");
  const [ucret, setUcret] = useState(sinav ? kurustanTlMetni(sinav.ucretKurus) : "0");
  const [goturme, setGoturme] = useState(String(sinav?.yanlisGoturme ?? 4));
  const [sira, setSira] = useState(String(sinav?.sira ?? siradaki));
  const [aktif, setAktif] = useState(sinav?.aktif ?? false);
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    const alanlar: Record<string, string> = {};
    const kurus = tlMetnindenKurus(ucret);
    const g = Number(goturme);
    const s = Number(sira);
    if (!ad.trim()) alanlar.ad = "Sınavın adını yazın.";
    if (kurus === null || kurus < 0) alanlar.ucretKurus = "Ücreti TL olarak yazın: 299 ya da 299,90.";
    if (!Number.isInteger(g) || g < 0 || g > 20) alanlar.yanlisGoturme = "0 ile 20 arasında bir tam sayı yazın.";
    if (!Number.isInteger(s)) alanlar.sira = "Tam sayı yazın.";
    if (Object.keys(alanlar).length) {
      setHata({ alanlar });
      return;
    }
    setHata({ alanlar: {} });
    const tam: SinavFormu = { ad: ad.trim(), aciklama: aciklama.trim() || null, ucretKurus: kurus ?? 0, yanlisGoturme: g, aktif, sira: s };
    const govde = sinav
      ? degisenler(tam, {
          ad: sinav.ad,
          aciklama: sinav.aciklama || null,
          ucretKurus: sinav.ucretKurus,
          yanlisGoturme: sinav.yanlisGoturme,
          aktif: sinav.aktif,
          sira: sinav.sira,
        })
      : tam;
    if (sinav && Object.keys(govde).length === 0) {
      onKapat();
      return;
    }
    gecis(async () => {
      const r = await sinavKaydet(sinav?.id ?? null, govde);
      if (r.ok) {
        bildir.basari(sinav ? "Sınav güncellendi." : "Sınav eklendi.");
        onKapat();
      } else {
        setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
      }
    });
  }

  return (
    <Modal isOpen onClose={onKapat} title={sinav ? `${sinav.ad} — düzenle` : "Yeni sınav"} size="md" dismissable={!bekliyor}>
      <form onSubmit={gonder} className="space-y-5" noValidate>
        {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
        <Field label="Ad" required error={hata.alanlar.ad} hint="Öğrencinin gördüğü ad: ALES, DGS…">
          <Input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Açıklama" optional error={hata.alanlar.aciklama}>
          <TextArea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} maxLength={1000} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Ücret (TL)" error={hata.alanlar.ucretKurus} hint="0 = ücretsiz">
            <Input value={ucret} onChange={(e) => setUcret(e.target.value)} inputMode="decimal" placeholder="299,00" />
          </Field>
          <Field label="Yanlış götürme" error={hata.alanlar.yanlisGoturme} hint="0 = götürmez">
            <Input type="number" min={0} max={20} value={goturme} onChange={(e) => setGoturme(e.target.value)} />
          </Field>
          <Field label="Sıra" error={hata.alanlar.sira} hint="Küçük önce gelir">
            <Input type="number" value={sira} onChange={(e) => setSira(e.target.value)} />
          </Field>
        </div>
        <Switch
          checked={aktif}
          onChange={(e) => setAktif(e.target.checked)}
          label="Aktif"
          description={aktif ? "Öğrenciler bu sınavı görür ve check-up başlatabilir." : "Pasif: öğrencilerden gizli. Hazırlık bitince aktif yapın."}
        />
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button type="submit" loading={bekliyor}>
            {sinav ? "Kaydet" : "Sınavı ekle"}
          </Button>
        </div>
        {sinav ? (
          <p className="text-theme-xs text-gray-500">
            Değişiklik yeni başlatılan check-up&apos;lara uygulanır; başlamış olanlar kendi kopyasını taşır.{" "}
            <Link href={`/sinavlar/${sinav.id}/konular`} className="text-brand-500 hover:underline">
              Konu ağacı
            </Link>
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
