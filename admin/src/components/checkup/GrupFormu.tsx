"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { grupArsivAction, grupKaydetAction } from "@/lib/checkup/actions/gruplar";
import { EXAM_LABEL, EXAM_SCOPES } from "@/lib/checkup/format";
import { GRUP_ADI_SINIRI, GRUP_NOTU_SINIRI } from "@/lib/checkup/grup-kurallari";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";
import { useOnay } from "./Onay";

/*
 * Grup oluştur / düzenle / arşivle. Yetki ve doğrulama sunucuda
 * (actions/gruplar.ts, yalnızca yönetici ve müdür).
 *
 * Form denetimli ve onSubmit'te eylemi elle çağırıyor: React 19'un form
 * eylemi bitince formu sıfırlaması, doğrulama hatası alan kişinin yazdığını
 * (ve <select> seçimini) silerdi (bkz. ObjectiveForms).
 */

export interface GrupDegerleri {
  id?: string;
  name: string;
  examScope: string;
  note: string;
}

const SINAV_SECENEKLERI = [
  { value: "", label: "Sınavsız (karışık grup)" },
  ...EXAM_SCOPES.map((s) => ({ value: s, label: EXAM_LABEL[s] ?? s })),
];

function GrupFormIcerigi({ ilk, kapat }: { ilk: GrupDegerleri; kapat: () => void }) {
  const [d, setD] = useState(ilk);
  const [hata, setHata] = useState<{ error?: string; fields?: Record<string, string> }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const yeni = !ilk.id;

  const gonder = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await grupKaydetAction(d);
      if (!r.ok) {
        setHata({ error: r.error, fields: r.fields });
        return;
      }
      toast.success(yeni ? "Grup oluşturuldu." : "Grup kaydedildi.");
      kapat();
      if (yeni) router.push("/checkup/gruplar/" + r.id);
    });
  };

  return (
    <form onSubmit={gonder} className="space-y-5">
      {hata.error && !hata.fields ? <Alert variant="error" compact>{hata.error}</Alert> : null}
      <Field label="Grup adı" required error={hata.fields?.name} hint="Örn. TYT Pilot · Cumartesi">
        <Input
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          maxLength={GRUP_ADI_SINIRI}
          required
          autoComplete="off"
          autoFocus
        />
      </Field>
      <Field
        label="Sınav"
        error={hata.fields?.examScope}
        hint="Ödev formu bu sınavın test ve konularını önce gösterir; grup raporu bu sınavın sonuçlarından."
      >
        <Select value={d.examScope} onChange={(e) => setD({ ...d, examScope: e.target.value })} options={SINAV_SECENEKLERI} />
      </Field>
      <Field
        label="Not"
        optional
        error={hata.fields?.note}
        hint={
          <>
            <span className="tabular">
              {d.note.trim().length}/{GRUP_NOTU_SINIRI}
            </span>{" "}
            · Yalnızca personel görür.
          </>
        }
      >
        <TextArea rows={3} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={kapat} disabled={pending}>
          Vazgeç
        </Button>
        <Button type="submit" size="xs" loading={pending} startIcon={yeni ? <Plus /> : undefined}>
          {pending ? "Kaydediliyor…" : yeni ? "Grubu oluştur" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

/** "Yeni grup" düğmesi + penceresi. */
export function YeniGrupDugmesi() {
  const { isOpen, openModal, closeModal } = useModal();
  return (
    <>
      <Button size="xs" startIcon={<Plus />} onClick={openModal}>
        Yeni grup
      </Button>
      <Modal isOpen={isOpen} onClose={closeModal} title="Yeni grup" size="sm">
        <GrupFormIcerigi ilk={{ name: "", examScope: "", note: "" }} kapat={closeModal} />
      </Modal>
    </>
  );
}

/** Grup ayrıntısındaki "Düzenle". */
export function GrupDuzenleDugmesi({ grup }: { grup: Required<GrupDegerleri> }) {
  const { isOpen, openModal, closeModal } = useModal();
  return (
    <>
      <Button variant="outline" size="xs" startIcon={<Pencil />} onClick={openModal}>
        Düzenle
      </Button>
      <Modal isOpen={isOpen} onClose={closeModal} title="Grubu düzenle" size="sm">
        <GrupFormIcerigi ilk={grup} kapat={closeModal} />
      </Modal>
    </>
  );
}

/** Arşivle / arşivden al. */
export function GrupArsivDugmesi({ id, arsivde }: { id: string; arsivde: boolean }) {
  const [pending, start] = useTransition();
  const onayla = useOnay();

  return (
    <Button
      variant={arsivde ? "outline" : "ghost"}
      size="xs"
      loading={pending}
      startIcon={arsivde ? <ArchiveRestore /> : <Archive />}
      onClick={async () => {
        if (!arsivde) {
          const evet = await onayla({
            title: "Grup arşivlensin mi?",
            description:
              "Grubun ödevleri öğrencilerin ekranından kalkar. Üyeler, ödevler ve ilerleme silinmez; arşivden geri alınca hepsi döner.",
            confirmLabel: "Arşivle",
            tone: "warning",
          });
          if (!evet) return;
        }
        start(async () => {
          const r = await grupArsivAction(id, !arsivde);
          if (r.ok) toast.success(arsivde ? "Grup arşivden alındı." : "Grup arşivlendi.");
          else toast.error(r.error);
        });
      }}
    >
      {arsivde ? "Arşivden al" : "Arşivle"}
    </Button>
  );
}
