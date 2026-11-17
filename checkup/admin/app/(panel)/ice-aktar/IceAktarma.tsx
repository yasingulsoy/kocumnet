"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Download, FileSearch, FileSpreadsheet, Save, XCircle } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { FileInput } from "@/components/tailadmin/form/FileInput";
import { Select } from "@/components/tailadmin/form/Select";
import { Switch } from "@/components/tailadmin/form/Switch";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, buttonClass } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { useBildirim } from "@/components/Bildirim";
import { sayi } from "@/lib/bicim";
import type { DenetimRaporu, IslemSonucu, KayitYaniti } from "@/lib/tipler";

/**
 * Excel içe aktarma: sınav seç → şablonu indir → dosya seç → denetle →
 * (hepsi geçerliyse) kaydet. Dosya route handler'lardan geçer (app/api/
 * ice-aktar/*): server action gövde sınırına takılmaz.
 */

const SUTUNLAR: { ad: string; aciklama: string }[] = [
  { ad: "Ders", aciklama: "Konu ağacındaki ders adı" },
  { ad: "Konu", aciklama: "O dersteki konu adı" },
  { ad: "Kazanım", aciklama: "Adı ya da kodu" },
  { ad: "Alt Kazanım", aciklama: "Adı ya da kodu" },
  { ad: "Soru", aciklama: "Metin; formül $…$ içinde" },
  { ad: "A … E", aciklama: "Beş şık, hepsi dolu ve farklı" },
  { ad: "Doğru", aciklama: "A, B, C, D ya da E" },
  { ad: "Çözüm", aciklama: "Zorunlu" },
  { ad: "Zorluk", aciklama: "Boş ya da 1–5" },
];

type Asama = { tur: "bos" } | { tur: "rapor"; rapor: DenetimRaporu } | { tur: "kaydedildi"; eklenen: number; iceAktarmaId: number };

function raporMu(x: unknown): x is DenetimRaporu {
  return Boolean(x && typeof x === "object" && Array.isArray((x as DenetimRaporu).satirlar));
}

export function IceAktarma({
  sinavlar,
  varsayilanSinavId,
}: {
  sinavlar: { id: number; ad: string; aktif: boolean; dersSayisi: number }[];
  varsayilanSinavId: number;
}) {
  const router = useRouter();
  const bildir = useBildirim();
  const [onayPenceresi, onayla] = useConfirm();
  const [sinavId, setSinavId] = useState(varsayilanSinavId);
  const [dosya, setDosya] = useState<File | null>(null);
  const [dosyaAnahtari, setDosyaAnahtari] = useState(0);
  const [asama, setAsama] = useState<Asama>({ tur: "bos" });
  const [bekliyor, setBekliyor] = useState<"denetle" | "kaydet" | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yalnizHatali, setYalnizHatali] = useState(false);

  const sinav = sinavlar.find((s) => s.id === sinavId);

  function sifirla() {
    setAsama({ tur: "bos" });
    setHata(null);
  }

  async function gonder(uc: "denetle" | "kaydet"): Promise<IslemSonucu<unknown> | null> {
    if (!dosya) return null;
    const fd = new FormData();
    fd.append("dosya", dosya);
    fd.append("sinavId", String(sinavId));
    try {
      const res = await fetch(`/api/ice-aktar/${uc}`, { method: "POST", body: fd });
      const r = (await res.json()) as IslemSonucu<unknown>;
      if (!r.ok && r.kod === "OTURUM_YOK") {
        router.push(`/oturum-bitti?sonraki=${encodeURIComponent(`/ice-aktar?sinav=${sinavId}`)}`);
        return null;
      }
      return r;
    } catch {
      return { ok: false, kod: "BAGLANTI", mesaj: "Dosya gönderilemedi. Bağlantınızı denetleyip yeniden deneyin." };
    }
  }

  async function denetle() {
    if (!dosya) {
      setHata("Önce Excel dosyasını seçin.");
      return;
    }
    setHata(null);
    setBekliyor("denetle");
    const r = await gonder("denetle");
    setBekliyor(null);
    if (!r) return;
    if (r.ok && raporMu(r.veri)) {
      setAsama({ tur: "rapor", rapor: r.veri });
      setYalnizHatali(r.veri.hatali > 0);
    } else if (!r.ok) setHata(r.mesaj);
    else setHata("Sunucudan beklenmeyen yanıt geldi.");
  }

  async function kaydet() {
    if (asama.tur !== "rapor") return;
    const evet = await onayla({
      title: `${sayi(asama.rapor.gecerli)} soru eklensin mi?`,
      description: `Sorular ${sinav?.ad ?? "seçili sınava"} eklenir ve hemen aktif olur. Hepsi tek seferde yazılır.`,
      confirmLabel: "Kaydet",
    });
    if (!evet) return;
    setHata(null);
    setBekliyor("kaydet");
    const r = await gonder("kaydet");
    setBekliyor(null);
    if (!r) return;
    if (r.ok) {
      const v = r.veri as Partial<KayitYaniti> | null;
      const eklenen = v?.eklenen ?? asama.rapor.gecerli;
      setAsama({ tur: "kaydedildi", eklenen, iceAktarmaId: v?.iceAktarmaId ?? 0 });
      setDosya(null);
      setDosyaAnahtari((n) => n + 1);
      bildir.basari(`${sayi(eklenen)} soru eklendi.`);
      return;
    }
    // Kayıt anında hatalı satır çıktıysa (ör. bu arada aynı soru eklendi) güncel rapor `ek`te.
    if (raporMu(r.ek)) {
      setAsama({ tur: "rapor", rapor: r.ek });
      setYalnizHatali(true);
    }
    setHata(r.mesaj);
  }

  const rapor = asama.tur === "rapor" ? asama.rapor : null;
  const satirlar = rapor ? (yalnizHatali ? rapor.satirlar.filter((s) => s.durum === "hatali") : rapor.satirlar) : [];

  return (
    <div className="space-y-6">
      {onayPenceresi}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <ComponentCard title="Dosyayı yükle">
          <div className="space-y-6">
            <ol className="space-y-6">
              <li className="grid gap-3 sm:grid-cols-[2rem_1fr]">
                <Adim n={1} />
                <div className="space-y-3">
                  <Field label="Sınav" hint={sinav && sinav.dersSayisi === 0 ? "Bu sınavın konu ağacı boş: önce dersleri ve konuları girin." : undefined}>
                    <Select
                      value={String(sinavId)}
                      onChange={(e) => {
                        setSinavId(Number(e.target.value));
                        sifirla();
                      }}
                      options={sinavlar.map((s) => ({ value: String(s.id), label: s.aktif ? s.ad : `${s.ad} (pasif)` }))}
                      wrapperClassName="max-w-sm"
                    />
                  </Field>
                </div>
              </li>
              <li className="grid gap-3 sm:grid-cols-[2rem_1fr]">
                <Adim n={2} />
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Şablonu indirin ve doldurun</p>
                  <a href={`/api/ice-aktar/sablon?sinavId=${sinavId}`} download className={buttonClass({ variant: "outline", size: "xs" })}>
                    <Download className="size-4" aria-hidden />
                    Şablonu indir ({sinav?.ad})
                  </a>
                  <p className="mt-2 text-theme-xs text-gray-500">
                    Şablonun &quot;Konu Ağacı&quot; sayfasında bu sınavın geçerli ders, konu, kazanım ve alt kazanım adları yazar.
                  </p>
                </div>
              </li>
              <li className="grid gap-3 sm:grid-cols-[2rem_1fr]">
                <Adim n={3} />
                <div className="space-y-3">
                  <Field label="Doldurulmuş dosya (.xlsx)">
                    <FileInput
                      key={dosyaAnahtari}
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        setDosya(e.target.files?.[0] ?? null);
                        sifirla();
                      }}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={denetle} loading={bekliyor === "denetle"} disabled={!dosya || bekliyor !== null} startIcon={<FileSearch />}>
                      Denetle
                    </Button>
                    {rapor ? (
                      <Button
                        variant={rapor.hatali === 0 && rapor.gecerli > 0 ? "primary" : "outline"}
                        onClick={kaydet}
                        loading={bekliyor === "kaydet"}
                        disabled={rapor.hatali > 0 || rapor.gecerli === 0 || bekliyor !== null}
                        startIcon={<Save />}
                      >
                        {sayi(rapor.gecerli)} soruyu kaydet
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            </ol>

            {hata ? <Alert variant="error">{hata}</Alert> : null}

            {asama.tur === "kaydedildi" ? (
              <Alert
                variant="success"
                title={`${sayi(asama.eklenen)} soru eklendi`}
                action={
                  <Link href={`/sorular?sinav=${sinavId}`} className={buttonClass({ size: "xs" })}>
                    Soruları gör
                  </Link>
                }
              >
                {sinav?.ad} sınavına eklendi{asama.iceAktarmaId ? ` (içe aktarma #${asama.iceAktarmaId})` : ""}. Yeni bir dosya seçip devam
                edebilirsiniz.
              </Alert>
            ) : null}

            {rapor ? (
              rapor.hatali > 0 ? (
                <Alert variant="warning" title={`${sayi(rapor.hatali)} satır hatalı`}>
                  Hatalı satır varken hiçbir soru yazılmaz. Dosyayı düzeltip yeniden seçin ve tekrar denetleyin.
                </Alert>
              ) : rapor.gecerli > 0 ? (
                <Alert variant="success" title="Bütün satırlar geçerli">
                  {sayi(rapor.gecerli)} soru kaydedilmeye hazır.
                </Alert>
              ) : (
                <Alert variant="warning">Dosyada soru satırı bulunamadı.</Alert>
              )
            ) : null}
          </div>
        </ComponentCard>

        <ComponentCard title="Nasıl doldurulur?" icon={<FileSpreadsheet />}>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              <strong className="font-medium text-gray-800">Konu ağacı önceden girilmeli.</strong> İçe aktarma ağaca düğüm eklemez; ders,
              konu, kazanım ve alt kazanım adları ağaçtakilerle aynı yazılmalı (kazanım ve alt kazanımda kod da olur).
            </p>
            <div>
              <p className="mb-1.5 font-medium text-gray-800">Sütunlar</p>
              <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {SUTUNLAR.map((s) => (
                  <div key={s.ad} className="flex gap-3 px-3 py-1.5">
                    <dt className="w-24 shrink-0 font-medium text-gray-700">{s.ad}</dt>
                    <dd className="text-theme-xs leading-5 text-gray-500">{s.aciklama}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p>Başlıklarda büyük-küçük harf ve Türkçe karakter farkı önemsenmez. Sınavda metni aynı olan soru varsa satır hatalı sayılır.</p>
          </div>
        </ComponentCard>
      </div>

      {rapor ? (
        <ComponentCard
          title="Denetim sonucu"
          badge={
            <span className="flex gap-1.5">
              <Badge size="sm" color="success">
                {sayi(rapor.gecerli)} geçerli
              </Badge>
              {rapor.hatali ? (
                <Badge size="sm" color="error">
                  {sayi(rapor.hatali)} hatalı
                </Badge>
              ) : null}
            </span>
          }
          actions={
            rapor.hatali > 0 ? <Switch checked={yalnizHatali} onChange={(e) => setYalnizHatali(e.target.checked)} label="Yalnızca hatalılar" /> : undefined
          }
          flush
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader align="end">
                  Satır
                </TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader>Soru</TableCell>
                <TableCell isHeader>Hatalar</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {satirlar.map((s) => (
                <TableRow key={s.satir}>
                  <TableCell align="end" className="tabular">
                    {s.satir}
                  </TableCell>
                  <TableCell nowrap>
                    {s.durum === "gecerli" ? (
                      <Badge size="sm" color="success" startIcon={<CheckCircle2 className="size-3.5" />}>
                        Geçerli
                      </Badge>
                    ) : (
                      <Badge size="sm" color="error" startIcon={<XCircle className="size-3.5" />}>
                        Hatalı
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="min-w-64 text-gray-700">{s.ozet || "—"}</TableCell>
                  <TableCell className="min-w-72">
                    {s.hatalar.length ? (
                      <ul className="list-disc space-y-0.5 ps-4 text-error-700">
                        {s.hatalar.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {satirlar.length === 0 ? <p className="px-5 py-6 text-center text-sm text-gray-500">Gösterilecek satır yok.</p> : null}
        </ComponentCard>
      ) : null}
    </div>
  );
}

function Adim({ n }: { n: number }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-semibold text-brand-600" aria-hidden>
      {n}
    </span>
  );
}
