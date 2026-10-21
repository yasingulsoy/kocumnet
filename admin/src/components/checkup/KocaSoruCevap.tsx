"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArchiveX, Pencil, RotateCcw, Send } from "lucide-react";
import { kocaCevapAction, kocaSoruGeriAcAction, kocaSoruKapatAction } from "@/lib/checkup/actions/koca-sorular";
import { CEVAP_SINIRI, cevabiTemizle, type SoruDurumu } from "@/lib/checkup/koca-soru";
import { Field } from "@/components/tailadmin/form/Field";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

/*
 * Gelen kutusundaki bir sorunun eylemleri: cevapla, cevabı düzelt, cevapsız
 * kapat, geri aç. Yetki ve kurallar sunucuda (actions/koca-sorular.ts).
 * Cevabın kendisi (okuma görünümü) sayfada sunucuda çiziliyor; burada
 * yalnızca düzenleme kutusu ve düğmeler.
 */

function CevapKutusu({
  id,
  ilk,
  duzeltme,
  vazgec,
}: {
  id: string;
  ilk: string;
  duzeltme: boolean;
  vazgec?: () => void;
}) {
  const [metin, setMetin] = useState(ilk);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onayla = useOnay();
  const temiz = cevabiTemizle(metin);
  const fazla = temiz.length > CEVAP_SINIRI;
  const degisti = temiz !== cevabiTemizle(ilk);

  const gonder = () =>
    start(async () => {
      const r = await kocaCevapAction(id, metin, duzeltme);
      if (!r.ok) {
        setHata(r.error);
        return;
      }
      setHata(null);
      toast.success(duzeltme ? "Cevap düzeltildi; öğrenci yeni cevap olarak görecek." : "Cevap gönderildi.");
      vazgec?.();
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && temiz && !fazla && (degisti || !duzeltme)) gonder();
      }}
      className="space-y-3"
    >
      <Field
        label={duzeltme ? "Cevabı düzelt" : "Cevabın"}
        error={fazla ? `Cevap ${CEVAP_SINIRI} karakteri aşıyor (${temiz.length}).` : (hata ?? undefined)}
        hint={
          <>
            <span className="tabular">
              {temiz.length}/{CEVAP_SINIRI}
            </span>{" "}
            · Öğrenci “Koça sorularım” ekranında görür.{duzeltme ? " Düzeltince yeni cevap olarak işaretlenir." : ""}
          </>
        }
      >
        <TextArea
          rows={4}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          className="leading-relaxed"
          placeholder="Örn. İkinci adımda paydayı eşitlemeyi unutmuşsun; önce 12'ye genişlet, sonra topla."
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!duzeltme ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={pending}
            startIcon={<ArchiveX />}
            onClick={async () => {
              const evet = await onayla({
                title: "Soru cevapsız kapatılsın mı?",
                description: "Yinelenen ya da konu dışı sorular için. Öğrenciye cevap gitmez; kapatılanlardan geri açılabilir.",
                confirmLabel: "Kapat",
                tone: "warning",
              });
              if (!evet) return;
              start(async () => {
                const r = await kocaSoruKapatAction(id);
                if (r.ok) toast.success("Soru kapatıldı.");
                else toast.error(r.error);
              });
            }}
          >
            Cevapsız kapat
          </Button>
        ) : (
          <Button variant="ghost" size="xs" disabled={pending} onClick={vazgec}>
            Vazgeç
          </Button>
        )}
        <Button type="submit" size="xs" loading={pending} disabled={!temiz || fazla || (duzeltme && !degisti)} startIcon={<Send />}>
          {pending ? "Gönderiliyor…" : duzeltme ? "Düzeltmeyi gönder" : "Cevabı gönder"}
        </Button>
      </div>
    </form>
  );
}

export function KocaSoruEylemleri({ id, durum, cevap }: { id: string; durum: SoruDurumu; cevap: string | null }) {
  const [duzenle, setDuzenle] = useState(false);
  const [pending, start] = useTransition();

  if (durum === "BEKLIYOR") return <CevapKutusu id={id} ilk="" duzeltme={false} />;

  if (durum === "KAPATILDI") {
    return (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="xs"
          loading={pending}
          startIcon={<RotateCcw />}
          onClick={() =>
            start(async () => {
              const r = await kocaSoruGeriAcAction(id);
              if (r.ok) toast.success("Soru bekleyenlere döndü.");
              else toast.error(r.error);
            })
          }
        >
          Geri aç
        </Button>
      </div>
    );
  }

  return duzenle ? (
    <CevapKutusu id={id} ilk={cevap ?? ""} duzeltme vazgec={() => setDuzenle(false)} />
  ) : (
    <div className="flex justify-end">
      <Button variant="ghost" size="xs" startIcon={<Pencil />} onClick={() => setDuzenle(true)}>
        Cevabı düzelt
      </Button>
    </div>
  );
}
