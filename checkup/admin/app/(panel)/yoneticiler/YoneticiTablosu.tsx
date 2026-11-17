"use client";

import { useState, useTransition, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Radio } from "@/components/tailadmin/form/Radio";
import { Switch } from "@/components/tailadmin/form/Switch";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { useBildirim } from "@/components/Bildirim";
import { ROL_ADI } from "@/lib/bicim";
import { yoneticiEkle, yoneticiGuncelle, yoneticiSil } from "@/lib/eylemler/yoneticiler";
import type { Rol, Yonetici } from "@/lib/tipler";

type Pencere = { tur: "yeni" } | { tur: "duzenle"; y: Yonetici } | { tur: "parola"; y: Yonetici } | null;

export function YoneticiTablosu({ yoneticiler, benId }: { yoneticiler: Yonetici[]; benId: number }) {
  const [pencere, setPencere] = useState<Pencere>(null);
  const [onayPenceresi, onayla] = useConfirm();
  const [, gecis] = useTransition();
  const bildir = useBildirim();

  const aktifYoneticiSayisi = yoneticiler.filter((y) => y.rol === "YONETICI" && y.aktif).length;
  /** Son aktif YONETICI: pasif yapılamaz, düşürülemez, silinemez (backend de engeller). */
  const sonYonetici = (y: Yonetici) => y.rol === "YONETICI" && y.aktif && aktifYoneticiSayisi <= 1;

  async function sil(y: Yonetici) {
    const evet = await onayla({
      title: `${y.adSoyad} silinsin mi?`,
      description: "Hesap ve açık oturumları silinir. Geri alınamaz; geçici olarak kapatmak için pasif yapın.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!evet) return;
    gecis(async () => {
      const r = await yoneticiSil(y.id);
      if (r.ok) bildir.basari(`${y.adSoyad} silindi.`);
      else bildir.hata(r.mesaj, "Silinemedi");
    });
  }

  return (
    <>
      {onayPenceresi}
      <ComponentCard
        title="Hesaplar"
        flush
        actions={
          <Button size="xs" startIcon={<Plus />} onClick={() => setPencere({ tur: "yeni" })}>
            Yönetici ekle
          </Button>
        }
      >
        {yoneticiler.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="Hesap yok" description="İlk hesabı ekleyin." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Ad soyad</TableCell>
                <TableCell isHeader>E-posta</TableCell>
                <TableCell isHeader>Rol</TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader align="end">
                  <span className="sr-only">İşlemler</span>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yoneticiler.map((y) => {
                const ben = y.id === benId;
                const son = sonYonetici(y);
                return (
                  <TableRow key={y.id} hover>
                    <TableCell className="min-w-48">
                      <span className="flex items-center gap-3">
                        <Avatar name={y.adSoyad} size="small" decorative />
                        <span className="font-medium text-gray-800">{y.adSoyad}</span>
                        {ben ? (
                          <Badge size="sm" color="light">
                            Siz
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-52">{y.eposta}</TableCell>
                    <TableCell nowrap>
                      <Badge size="sm" color={y.rol === "YONETICI" ? "primary" : "info"}>
                        {ROL_ADI[y.rol]}
                      </Badge>
                    </TableCell>
                    <TableCell nowrap>
                      {y.aktif ? (
                        <Badge size="sm" color="success">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge size="sm" color="light">
                          Pasif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell align="end" nowrap>
                      <span className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" startIcon={<Pencil />} onClick={() => setPencere({ tur: "duzenle", y })}>
                          Düzenle
                        </Button>
                        <Button size="xs" variant="ghost" startIcon={<KeyRound />} onClick={() => setPencere({ tur: "parola", y })}>
                          Parola
                        </Button>
                        <span title={ben ? "Kendi hesabınızı silemezsiniz" : son ? "Son yönetici silinemez" : "Sil"} className="inline-flex">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => sil(y)}
                            disabled={ben || son}
                            aria-label={`${y.adSoyad} hesabını sil`}
                            className="text-error-600"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ComponentCard>

      {pencere?.tur === "yeni" ? <YeniYoneticiPenceresi onKapat={() => setPencere(null)} /> : null}
      {pencere?.tur === "duzenle" ? (
        <DuzenlePenceresi key={pencere.y.id} y={pencere.y} ben={pencere.y.id === benId} son={sonYonetici(pencere.y)} onKapat={() => setPencere(null)} />
      ) : null}
      {pencere?.tur === "parola" ? <ParolaPenceresi key={pencere.y.id} y={pencere.y} onKapat={() => setPencere(null)} /> : null}
    </>
  );
}

function RolSecimi({ rol, setRol, kilitli }: { rol: Rol; setRol: (r: Rol) => void; kilitli?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-gray-700">Rol</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Radio
          card
          name="rol"
          value="YONETICI"
          checked={rol === "YONETICI"}
          onChange={() => setRol("YONETICI")}
          label="Yönetici"
          description="Her şey: sınavlar, türler, öğrenciler, hesaplar."
          disabled={kilitli}
        />
        <Radio
          card
          name="rol"
          value="EDITOR"
          checked={rol === "EDITOR"}
          onChange={() => setRol("EDITOR")}
          label="Editör"
          description="Konu ağacı, sorular, içe aktarma, check-up ayarları."
          disabled={kilitli}
        />
      </div>
    </fieldset>
  );
}

function YeniYoneticiPenceresi({ onKapat }: { onKapat: () => void }) {
  const [adSoyad, setAdSoyad] = useState("");
  const [eposta, setEposta] = useState("");
  const [parola, setParola] = useState("");
  const [rol, setRol] = useState<Rol>("EDITOR");
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    const alanlar: Record<string, string> = {};
    if (adSoyad.trim().length < 2) alanlar.adSoyad = "Ad soyadı yazın.";
    if (!/^\S+@\S+\.\S+$/.test(eposta.trim())) alanlar.eposta = "Geçerli bir e-posta yazın.";
    if (parola.length < 8) alanlar.parola = "En az 8 karakter.";
    if (Object.keys(alanlar).length) return setHata({ alanlar });
    setHata({ alanlar: {} });
    gecis(async () => {
      const r = await yoneticiEkle({ adSoyad, eposta, parola, rol });
      if (r.ok) {
        bildir.basari(`${adSoyad.trim()} eklendi. Geçici parolayı kendisine güvenli bir yoldan iletin.`);
        onKapat();
      } else setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
    });
  }

  return (
    <Modal isOpen onClose={onKapat} title="Yönetici ekle" size="md" dismissable={!bekliyor}>
      <form method="post" onSubmit={gonder} className="space-y-5" noValidate>
        {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
        <Field label="Ad soyad" required error={hata.alanlar.adSoyad}>
          <Input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} autoFocus maxLength={80} />
        </Field>
        <Field label="E-posta" required error={hata.alanlar.eposta}>
          <Input type="email" value={eposta} onChange={(e) => setEposta(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Geçici parola" required error={hata.alanlar.parola} hint="En az 8 karakter. Kişi girdikten sonra Hesabım'dan değiştirmeli.">
          <Input type="text" value={parola} onChange={(e) => setParola(e.target.value)} autoComplete="new-password" />
        </Field>
        <RolSecimi rol={rol} setRol={setRol} />
        {hata.alanlar.rol ? <p className="text-theme-xs text-error-600">{hata.alanlar.rol}</p> : null}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button type="submit" loading={bekliyor}>
            Ekle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DuzenlePenceresi({ y, ben, son, onKapat }: { y: Yonetici; ben: boolean; son: boolean; onKapat: () => void }) {
  const [adSoyad, setAdSoyad] = useState(y.adSoyad);
  const [rol, setRol] = useState<Rol>(y.rol);
  const [aktif, setAktif] = useState(y.aktif);
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (adSoyad.trim().length < 2) return setHata({ alanlar: { adSoyad: "Ad soyadı yazın." } });
    setHata({ alanlar: {} });
    const g: { adSoyad?: string; rol?: Rol; aktif?: boolean } = {};
    if (adSoyad.trim() !== y.adSoyad) g.adSoyad = adSoyad;
    if (rol !== y.rol) g.rol = rol;
    if (aktif !== y.aktif) g.aktif = aktif;
    if (!Object.keys(g).length) return onKapat();
    gecis(async () => {
      const r = await yoneticiGuncelle(y.id, g);
      if (r.ok) {
        bildir.basari(`${adSoyad.trim()} güncellendi.`);
        onKapat();
      } else setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
    });
  }

  return (
    <Modal isOpen onClose={onKapat} title={`${y.adSoyad} — düzenle`} description={y.eposta} size="md" dismissable={!bekliyor}>
      <form method="post" onSubmit={gonder} className="space-y-5" noValidate>
        {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
        {son ? (
          <Alert variant="info" compact>
            Son aktif yönetici: rolü düşürülemez ve pasif yapılamaz. Önce başka bir yönetici ekleyin.
          </Alert>
        ) : null}
        <Field label="Ad soyad" required error={hata.alanlar.adSoyad}>
          <Input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} autoFocus maxLength={80} />
        </Field>
        <RolSecimi rol={rol} setRol={setRol} kilitli={son} />
        <Switch
          checked={aktif}
          onChange={(e) => setAktif(e.target.checked)}
          disabled={son}
          label="Aktif"
          description={aktif ? "Panele girebilir." : "Pasif: giremez, açık oturumları geçersiz olur."}
        />
        {ben && (rol !== y.rol || !aktif) ? (
          <Alert variant="warning" compact>
            Kendi hesabınızı değiştiriyorsunuz; kaydedince bazı sayfalara erişiminiz kalkabilir.
          </Alert>
        ) : null}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button type="submit" loading={bekliyor}>
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ParolaPenceresi({ y, onKapat }: { y: Yonetici; onKapat: () => void }) {
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (parola.length < 8) return setHata("En az 8 karakter.");
    setHata(null);
    gecis(async () => {
      const r = await yoneticiGuncelle(y.id, { parola });
      if (r.ok) {
        bildir.basari(`${y.adSoyad} için yeni parola kaydedildi.`);
        onKapat();
      } else setHata(r.alanlar?.parola ?? r.mesaj);
    });
  }

  return (
    <Modal isOpen onClose={onKapat} title="Parolayı sıfırla" description={`${y.adSoyad} · ${y.eposta}`} size="sm" dismissable={!bekliyor}>
      <form method="post" onSubmit={gonder} className="space-y-5" noValidate>
        <Field label="Yeni geçici parola" required error={hata ?? undefined} hint="En az 8 karakter. Kişiye güvenli bir yoldan iletin.">
          <Input type="text" value={parola} onChange={(e) => setParola(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          <Button type="submit" loading={bekliyor}>
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
