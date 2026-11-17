"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Switch } from "@/components/tailadmin/form/Switch";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { useBildirim } from "@/components/Bildirim";
import { degisenler, sayi } from "@/lib/bicim";
import { turKaydet, turSil } from "@/lib/eylemler/katalog";
import type { Tur, TurFormu } from "@/lib/tipler";

export function TurTablosu({ turler, duzenleyebilir }: { turler: Tur[]; duzenleyebilir: boolean }) {
  const [duzenlenen, setDuzenlenen] = useState<Tur | "yeni" | null>(null);
  const [onayPenceresi, onayla] = useConfirm();
  const [, gecis] = useTransition();
  const bildir = useBildirim();

  async function sil(t: Tur) {
    if (!t.silinebilir) {
      const duzenle = await onayla({
        title: `${t.ad} silinemez`,
        description: "Bu türle başlatılmış check-up'lar var. Öğrencilerden gizlemek için türü pasif yapın; geçmiş sonuçlar korunur.",
        confirmLabel: "Düzenle (pasif yap)",
        cancelLabel: "Kapat",
        tone: "warning",
      });
      if (duzenle) setDuzenlenen(t);
      return;
    }
    const evet = await onayla({
      title: `${t.ad} silinsin mi?`,
      description: "Tür kalıcı olarak silinir; sınavlardaki bu türe ait reçete ve sabit listeler de kullanılmaz olur. Geri alınamaz.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!evet) return;
    gecis(async () => {
      const r = await turSil(t.id);
      if (r.ok) bildir.basari(`${t.ad} silindi.`);
      else bildir.hata(r.mesaj, "Silinemedi");
    });
  }

  return (
    <>
      {onayPenceresi}
      <ComponentCard
        title="Tür listesi"
        desc={duzenleyebilir ? undefined : "Tür eklemek ve düzenlemek yalnızca YÖNETİCİ rolüne açık."}
        flush
        actions={
          duzenleyebilir ? (
            <Button size="xs" startIcon={<Plus />} onClick={() => setDuzenlenen("yeni")}>
              Tür ekle
            </Button>
          ) : undefined
        }
      >
        {turler.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="Henüz check-up türü yok"
            description="Örneğin: Hızlı Check-up (50 soru, 75 dk) ve Kapsamlı Check-up (150 soru, 200 dk)."
            action={
              duzenleyebilir ? (
                <Button size="xs" startIcon={<Plus />} onClick={() => setDuzenlenen("yeni")}>
                  İlk türü ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Tür</TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader align="end">
                  Soru sayısı
                </TableCell>
                <TableCell isHeader align="end">
                  Süre
                </TableCell>
                <TableCell isHeader align="end">
                  Sıra
                </TableCell>
                <TableCell isHeader align="end">
                  Check-up
                </TableCell>
                {duzenleyebilir ? (
                  <TableCell isHeader align="end">
                    <span className="sr-only">İşlemler</span>
                  </TableCell>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {turler.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell className="w-full max-w-0 min-w-52">
                    <span className="block font-medium text-gray-800">{t.ad}</span>
                    {t.aciklama ? <span className="mt-0.5 block truncate text-theme-xs text-gray-500">{t.aciklama}</span> : null}
                  </TableCell>
                  <TableCell nowrap>
                    {t.aktif ? (
                      <Badge size="sm" color="success">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge size="sm" color="light">
                        Pasif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(t.soruSayisi)}
                  </TableCell>
                  <TableCell align="end" nowrap className="tabular">
                    {sayi(t.sureDakika)} dk
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {t.sira}
                  </TableCell>
                  <TableCell align="end" className="tabular">
                    {sayi(t.checkupSayisi)}
                  </TableCell>
                  {duzenleyebilir ? (
                    <TableCell align="end" nowrap>
                      <span className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" startIcon={<Pencil />} onClick={() => setDuzenlenen(t)}>
                          Düzenle
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => sil(t)}
                          aria-label={`${t.ad} türünü sil`}
                          title={t.silinebilir ? "Sil" : "Silinemez: check-up'ı var; pasif yapın"}
                          className={t.silinebilir ? "text-error-600" : "text-gray-400"}
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
        <TurPenceresi
          key={duzenlenen === "yeni" ? "yeni" : duzenlenen.id}
          tur={duzenlenen === "yeni" ? null : duzenlenen}
          siradaki={turler.reduce((m, t) => Math.max(m, t.sira), 0) + 1}
          onKapat={() => setDuzenlenen(null)}
        />
      ) : null}
    </>
  );
}

function TurPenceresi({ tur, siradaki, onKapat }: { tur: Tur | null; siradaki: number; onKapat: () => void }) {
  const [ad, setAd] = useState(tur?.ad ?? "");
  const [aciklama, setAciklama] = useState(tur?.aciklama ?? "");
  const [soruSayisi, setSoruSayisi] = useState(String(tur?.soruSayisi ?? 50));
  const [sure, setSure] = useState(String(tur?.sureDakika ?? 75));
  const [sira, setSira] = useState(String(tur?.sira ?? siradaki));
  const [aktif, setAktif] = useState(tur?.aktif ?? true);
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    const alanlar: Record<string, string> = {};
    const n = Number(soruSayisi);
    const d = Number(sure);
    const s = Number(sira);
    if (!ad.trim()) alanlar.ad = "Türün adını yazın.";
    if (!Number.isInteger(n) || n < 1 || n > 300) alanlar.soruSayisi = "1 ile 300 arasında bir tam sayı yazın.";
    if (!Number.isInteger(d) || d < 1 || d > 600) alanlar.sureDakika = "1 ile 600 dakika arasında olmalı.";
    if (!Number.isInteger(s)) alanlar.sira = "Tam sayı yazın.";
    if (Object.keys(alanlar).length) {
      setHata({ alanlar });
      return;
    }
    setHata({ alanlar: {} });
    const tam: TurFormu = { ad: ad.trim(), aciklama: aciklama.trim() || null, soruSayisi: n, sureDakika: d, aktif, sira: s };
    const govde = tur
      ? degisenler(tam, {
          ad: tur.ad,
          aciklama: tur.aciklama || null,
          soruSayisi: tur.soruSayisi,
          sureDakika: tur.sureDakika,
          aktif: tur.aktif,
          sira: tur.sira,
        })
      : tam;
    if (tur && Object.keys(govde).length === 0) {
      onKapat();
      return;
    }
    gecis(async () => {
      const r = await turKaydet(tur?.id ?? null, govde);
      if (r.ok) {
        bildir.basari(tur ? "Tür güncellendi." : "Tür eklendi.");
        onKapat();
      } else {
        setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
      }
    });
  }

  return (
    <Modal isOpen onClose={onKapat} title={tur ? `${tur.ad} — düzenle` : "Yeni check-up türü"} size="md" dismissable={!bekliyor}>
      <form onSubmit={gonder} className="space-y-5" noValidate>
        {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
        <Field label="Ad" required error={hata.alanlar.ad} hint="Öğrencinin gördüğü ad: Hızlı Check-up…">
          <Input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Açıklama" optional error={hata.alanlar.aciklama}>
          <TextArea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} maxLength={1000} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Soru sayısı" required error={hata.alanlar.soruSayisi} hint="1–300">
            <Input type="number" min={1} max={300} value={soruSayisi} onChange={(e) => setSoruSayisi(e.target.value)} />
          </Field>
          <Field label="Süre (dk)" required error={hata.alanlar.sureDakika} hint="1–600">
            <Input type="number" min={1} max={600} value={sure} onChange={(e) => setSure(e.target.value)} />
          </Field>
          <Field label="Sıra" error={hata.alanlar.sira} hint="Küçük önce gelir">
            <Input type="number" value={sira} onChange={(e) => setSira(e.target.value)} />
          </Field>
        </div>
        {tur && Number(soruSayisi) !== tur.soruSayisi ? (
          <Alert variant="warning" compact>
            Soru sayısı değişince her sınavdaki reçete ve sabit liste bu sayıya göre yeniden &quot;hazır&quot; denetlenir.
          </Alert>
        ) : null}
        <Switch
          checked={aktif}
          onChange={(e) => setAktif(e.target.checked)}
          label="Aktif"
          description={aktif ? "Öğrenciler bu türü seçebilir (ayarı hazır olan sınavlarda)." : "Pasif: öğrencilerden gizli."}
        />
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button type="submit" loading={bekliyor}>
            {tur ? "Kaydet" : "Türü ekle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
