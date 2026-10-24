"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Ban, CalendarPlus, ClipboardPlus } from "lucide-react";
import { odevIptalAction, odevOlusturAction, odevSureUzatAction } from "@/lib/checkup/actions/gruplar";
import { EXAM_LABEL } from "@/lib/checkup/format";
import { ODEV_BASLIGI_SINIRI, ODEV_NOTU_SINIRI } from "@/lib/checkup/grup-kurallari";
import { konuSinavdaMi } from "@/lib/checkup/shared/exam-scope";
import {
  ODEV_SORU_ALT,
  ODEV_SORU_UST,
  enGecSonTarih,
  odevBasligi,
  trTarih,
  uzatmaEnErken,
  uzatmaOnerisi,
  type OdevTuru,
} from "@/lib/checkup/shared/odev";
import { cx } from "@/components/tailadmin/cx";
import { DateInput } from "@/components/tailadmin/form/DateInput";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Radio } from "@/components/tailadmin/form/Radio";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, type ButtonVariant } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";
import { useOnay } from "./Onay";

/*
 * Ödev ver / iptal et. Yetki, paket ve konu denetimi, son tarih sınırları
 * sunucuda (actions/gruplar.ts). Başlık seçimden otomatik dolar (paket adı ya
 * da "Konu: N soru alıştırma", shared/odev.ts odevBasligi); koç değiştirirse
 * otomatik dolum durur, kutuyu boşaltırsa yeniden başlar.
 *
 * Form denetimli, eylem onSubmit'te elle çağrılıyor: React 19 form eylemi
 * bitince formu sıfırlıyor, hata alan koç seçimini kaybederdi.
 */

export interface OdevPaketi {
  id: string;
  name: string;
  examScope: string;
  kind: string;
  questionCount: number;
  durationMinutes: number;
  /** Ücretli pakette erişim hakkı olmayan öğrenci kilit görür: ödev hak vermez. */
  isFree: boolean;
}

export interface OdevKonusu {
  id: string;
  name: string;
  ustAd: string | null;
  examScope: string;
  examScopes: string[];
  /**
   * Alıştırmanın seçebileceği yayındaki soru sayısı: grubun sınavında sorulabilenler
   * (grup-kurallari.ts odevKonuSinavi; sınavsız grupta konunun bütün yayındaki soruları).
   */
  soruSayisi: number;
}

interface Durum {
  kind: OdevTuru;
  packageId: string;
  topicId: string;
  questionCount: string;
  title: string;
  /** Koç başlığı kendisi yazdı: otomatik dolum durur. */
  elle: boolean;
  note: string;
  dueDate: string;
}

const VARSAYILAN_SORU = 20;

function paketEtiketi(p: OdevPaketi) {
  return `${p.name} · ${p.questionCount} soru · ${p.durationMinutes} dk${p.kind === "MOCK" ? " · deneme" : ""}${p.isFree ? "" : " · ücretli"}`;
}

function konuEtiketi(k: OdevKonusu) {
  return `${k.ustAd ? k.ustAd + " › " : ""}${k.name} (${k.soruSayisi} soru)`;
}

/**
 * Seçenekleri gruplar: grubun sınavı varsa önce o sınavınkiler ("önerilen"),
 * sonra ötekiler; yoksa sınav sınav.
 */
function gruplu<T>(liste: T[], sinavda: (x: T, sinav: string) => boolean, sinavi: (x: T) => string, grupSinavi: string | null, etiket: (x: T) => string, id: (x: T) => string): ReactNode {
  const secenek = (x: T) => (
    <option key={id(x)} value={id(x)}>
      {etiket(x)}
    </option>
  );
  if (grupSinavi) {
    const once = liste.filter((x) => sinavda(x, grupSinavi));
    const sonra = liste.filter((x) => !sinavda(x, grupSinavi));
    return (
      <>
        {once.length > 0 ? <optgroup label={EXAM_LABEL[grupSinavi] ?? grupSinavi}>{once.map(secenek)}</optgroup> : null}
        {sonra.length > 0 ? <optgroup label="Diğer sınavlar">{sonra.map(secenek)}</optgroup> : null}
      </>
    );
  }
  const sinavlar = [...new Set(liste.map(sinavi))];
  return sinavlar.map((s) => (
    <optgroup key={s} label={EXAM_LABEL[s] ?? s}>
      {liste.filter((x) => sinavi(x) === s).map(secenek)}
    </optgroup>
  ));
}

function OdevFormIcerigi({
  groupId,
  paketler,
  konular,
  grupSinavi,
  bugun,
  enGec,
  varsayilanTarih,
  ilk,
  kapat,
}: {
  groupId: string;
  paketler: OdevPaketi[];
  konular: OdevKonusu[];
  grupSinavi: string | null;
  bugun: string;
  enGec: string;
  varsayilanTarih: string;
  ilk?: { kind: OdevTuru; topicId?: string; packageId?: string };
  kapat: () => void;
}) {
  const [d, setD] = useState<Durum>(() => ({
    kind: ilk?.kind ?? "PACKAGE",
    packageId: ilk?.packageId ?? "",
    topicId: ilk?.topicId ?? "",
    questionCount: String(VARSAYILAN_SORU),
    title: "",
    elle: false,
    note: "",
    dueDate: varsayilanTarih,
  }));
  const [hata, setHata] = useState<{ error?: string; fields?: Record<string, string> }>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  const paket = paketler.find((p) => p.id === d.packageId) ?? null;
  const konu = konular.find((k) => k.id === d.topicId) ?? null;
  const soru = Number(d.questionCount);
  const otomatik =
    d.kind === "PACKAGE"
      ? paket
        ? odevBasligi({ kind: "PACKAGE", paketAdi: paket.name })
        : ""
      : konu && Number.isInteger(soru) && soru > 0
        ? odevBasligi({ kind: "TOPIC_PRACTICE", konuAdi: konu.name, soruSayisi: soru })
        : "";
  const baslik = d.elle ? d.title : otomatik;
  const havuzDar = d.kind === "TOPIC_PRACTICE" && konu !== null && Number.isFinite(soru) && konu.soruSayisi < soru;

  const gonder = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await odevOlusturAction({
        groupId,
        kind: d.kind,
        packageId: d.kind === "PACKAGE" ? d.packageId : "",
        topicId: d.kind === "TOPIC_PRACTICE" ? d.topicId : "",
        questionCount: d.kind === "TOPIC_PRACTICE" ? d.questionCount : undefined,
        // Otomatik başlık boş gider: sunucu kayıttaki adlardan aynısını kurar.
        title: d.elle ? d.title : "",
        note: d.note,
        dueDate: d.dueDate,
      });
      if (!r.ok) {
        setHata({ error: r.error, fields: r.fields });
        return;
      }
      toast.success("Ödev verildi.");
      kapat();
      router.push("/checkup/gruplar/" + groupId + "?odev=" + r.id + "#ilerleme");
    });
  };

  return (
    <form onSubmit={gonder} className="space-y-5">
      {hata.error && !hata.fields ? <Alert variant="error" compact>{hata.error}</Alert> : null}

      <fieldset>
        <legend className={cx(labelClass, "mb-1.5")}>Tür</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Radio
            card
            name="kind"
            value="PACKAGE"
            checked={d.kind === "PACKAGE"}
            onChange={() => setD({ ...d, kind: "PACKAGE" })}
            label="Test çöz"
            description="Bir check-up ya da deneme. Bitirince tamamlanır; kâğıtta çözülen de sayılır."
          />
          <Radio
            card
            name="kind"
            value="TOPIC_PRACTICE"
            checked={d.kind === "TOPIC_PRACTICE"}
            onChange={() => setD({ ...d, kind: "TOPIC_PRACTICE" })}
            label="Konu alıştırması"
            description="Bir konudan en az N soru, süresiz; her cevaptan sonra çözüm."
          />
        </div>
      </fieldset>

      {d.kind === "PACKAGE" ? (
        <Field
          label="Test"
          required
          error={hata.fields?.packageId}
          hint={
            paket && !paket.isFree
              ? "Ücretli test: ödev erişim hakkı vermez; hakkı olmayan öğrenci kilit görür (Öğrenciler → erişim hakkı)."
              : "Yalnızca yayındaki check-up ve denemeler."
          }
        >
          <Select value={d.packageId} onChange={(e) => setD({ ...d, packageId: e.target.value })} required>
            <option value="">Seç…</option>
            {gruplu(
              paketler,
              (p, s) => p.examScope === s,
              (p) => p.examScope,
              grupSinavi,
              paketEtiketi,
              (p) => p.id
            )}
          </Select>
        </Field>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
          <Field
            label="Konu"
            required
            error={hata.fields?.topicId}
            hint={
              grupSinavi
                ? "Parantezde alıştırmanın seçebileceği yayındaki soru: grubun sınavında (konu o sınavda yoksa kendi sınavında) sorulabilenler."
                : "Parantezde konunun yayındaki soru sayısı."
            }
          >
            <Select value={d.topicId} onChange={(e) => setD({ ...d, topicId: e.target.value })} required>
              <option value="">Seç…</option>
              {gruplu(
                konular,
                (k, s) => konuSinavdaMi(k, s),
                (k) => k.examScope,
                grupSinavi,
                konuEtiketi,
                (k) => k.id
              )}
            </Select>
          </Field>
          <Field label="Soru sayısı" required error={hata.fields?.questionCount} hint={`${ODEV_SORU_ALT}-${ODEV_SORU_UST}`}>
            <Input
              type="number"
              inputMode="numeric"
              min={ODEV_SORU_ALT}
              max={ODEV_SORU_UST}
              step={1}
              value={d.questionCount}
              onChange={(e) => setD({ ...d, questionCount: e.target.value })}
              required
            />
          </Field>
        </div>
      )}

      {d.kind === "TOPIC_PRACTICE" ? (
        havuzDar ? (
          <Alert variant="warning" compact>
            Bu konuda alıştırmanın seçebileceği {konu!.soruSayisi} yayında soru var; öğrenci {soru} soruya ulaşamayabilir.
            Sayıyı düşür ya da havuzu büyüt.
          </Alert>
        ) : (
          <p className="-mt-2 text-theme-xs leading-relaxed text-gray-500">
            Öğrenci konuyu ödev ekranından kısa alıştırma turlarıyla çözer; önce test çözmesi gerekmez (konu hiçbir testinde
            çıkmamış olsa da açılır). Günlük alıştırma sınırı var: uzun ödevler için birkaç gün ver.
          </p>
        )
      ) : null}

      <Field
        label="Başlık"
        error={hata.fields?.title}
        hint={d.elle ? "Kutuyu boşaltırsan başlık yeniden otomatik dolar." : "Seçimden otomatik doluyor; değiştirebilirsin."}
      >
        <Input
          value={baslik}
          maxLength={ODEV_BASLIGI_SINIRI}
          onChange={(e) => setD({ ...d, title: e.target.value, elle: e.target.value.trim() !== "" })}
          placeholder="Test ya da konu seçince dolar"
        />
      </Field>

      <Field
        label="Açıklama"
        optional
        error={hata.fields?.note}
        hint={
          <>
            <span className="tabular">
              {d.note.trim().length}/{ODEV_NOTU_SINIRI}
            </span>{" "}
            · Öğrenci ödev kartında görür.
          </>
        }
      >
        <TextArea
          rows={3}
          value={d.note}
          onChange={(e) => setD({ ...d, note: e.target.value })}
          placeholder="Örn. Bitirince yanlışlarının çözümüne bak, perşembe derste konuşalım."
        />
      </Field>

      <Field label="Son tarih" required error={hata.fields?.dueDate} hint="O günün 23:59'u (Türkiye saati). Ödev şimdi başlar: daha önce çözülen sayılmaz.">
        <DateInput
          value={d.dueDate}
          min={bugun}
          max={enGec}
          onChange={(e) => setD({ ...d, dueDate: e.target.value })}
          required
          wrapperClassName="max-w-56"
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={kapat} disabled={pending}>
          Vazgeç
        </Button>
        <Button type="submit" size="xs" loading={pending} startIcon={<ClipboardPlus />}>
          {pending ? "Veriliyor…" : "Ödevi ver"}
        </Button>
      </div>
    </form>
  );
}

/** "Ödev ver" düğmesi + penceresi. `ilk`: rapordaki "bu konuda ödev ver" gibi ön seçim. */
export function YeniOdevDugmesi({
  etiket = "Ödev ver",
  variant = "primary",
  ...props
}: Omit<Parameters<typeof OdevFormIcerigi>[0], "kapat"> & { etiket?: string; variant?: ButtonVariant }) {
  const { isOpen, openModal, closeModal } = useModal();
  return (
    <>
      <Button variant={variant} size="xs" startIcon={<ClipboardPlus />} onClick={openModal}>
        {etiket}
      </Button>
      <Modal isOpen={isOpen} onClose={closeModal} title="Ödev ver" size="lg">
        <OdevFormIcerigi {...props} kapat={closeModal} />
      </Modal>
    </>
  );
}

export function OdevIptalDugmesi({ id, baslik }: { id: string; baslik: string }) {
  const [pending, start] = useTransition();
  const onayla = useOnay();
  return (
    <Button
      variant="danger-outline"
      size="xs"
      loading={pending}
      startIcon={<Ban />}
      aria-label={`"${baslik}" ödevini iptal et`}
      className="relative z-1"
      onClick={async () => {
        const evet = await onayla({
          title: `"${baslik}" iptal edilsin mi?`,
          description: "Ödev öğrencilerin ekranından kalkar; panelde iptal olarak durur. Geri alınamaz, gerekirse yeniden verilir.",
          confirmLabel: "İptal et",
          tone: "danger",
        });
        if (!evet) return;
        start(async () => {
          const r = await odevIptalAction(id);
          if (r.ok) toast.success("Ödev iptal edildi.");
          else toast.error(r.error);
        });
      }}
    >
      İptal et
    </Button>
  );
}

function UzatmaFormu({ id, eskiSonTarih, kapat }: { id: string; eskiSonTarih: Date; kapat: () => void }) {
  // Pencere yalnızca açılınca çizilir: tarih sınırları o anki saate göre (Türkiye takvimi, shared/odev.ts).
  const [simdi] = useState(() => new Date());
  const enErken = uzatmaEnErken(eskiSonTarih, simdi);
  const enGec = enGecSonTarih(simdi);
  const [gun, setGun] = useState(() => uzatmaOnerisi(eskiSonTarih, simdi));
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await odevSureUzatAction(id, gun);
          if (!r.ok) {
            setHata(r.error);
            return;
          }
          toast.success("Son tarih uzatıldı.");
          kapat();
        });
      }}
      className="space-y-5"
    >
      <p className="text-theme-sm leading-relaxed text-gray-500">
        Şu anki son tarih <span className="font-medium text-gray-800">{trTarih(eskiSonTarih).split("-").reverse().join(".")}</span> 23:59.
        Uzatınca, eski ve yeni son tarih arasında bitirenler “zamanında” sayılır; öğrenci yeni tarihi kendi ekranında görür.
      </p>
      <Field label="Yeni son tarih" required error={hata ?? undefined} hint="O günün 23:59'u (Türkiye saati).">
        <DateInput
          value={gun}
          min={enErken}
          max={enGec}
          onChange={(e) => setGun(e.target.value)}
          required
          wrapperClassName="max-w-56"
          autoFocus
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={kapat} disabled={pending}>
          Vazgeç
        </Button>
        <Button type="submit" size="xs" loading={pending} startIcon={<CalendarPlus />}>
          {pending ? "Kaydediliyor…" : "Uzat"}
        </Button>
      </div>
    </form>
  );
}

/** İptal etmeden son tarihi uzat. Kurallar sunucuda (actions/gruplar.ts odevSureUzatAction). */
export function OdevUzatDugmesi({ id, baslik, eskiSonTarih }: { id: string; baslik: string; eskiSonTarih: Date }) {
  const { isOpen, openModal, closeModal } = useModal();
  return (
    <>
      <Button
        variant="outline"
        size="xs"
        startIcon={<CalendarPlus />}
        aria-label={`"${baslik}" ödevinin son tarihini uzat`}
        className="relative z-1"
        onClick={openModal}
      >
        Uzat
      </Button>
      <Modal isOpen={isOpen} onClose={closeModal} title="Son tarihi uzat" description={baslik} size="sm">
        <UzatmaFormu id={id} eskiSonTarih={eskiSonTarih} kapat={closeModal} />
      </Modal>
    </>
  );
}
