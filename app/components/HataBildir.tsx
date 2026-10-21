"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Flag } from "lucide-react";
import { hataBildirAction } from "@/lib/actions/hata-bildirimi";
import {
  RAPOR_ACIKLAMA_SINIRI,
  RAPOR_SEBEPLERI,
  type RaporDurumu,
  type RaporSebebi,
} from "@/lib/bildirim-kurallari";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Radio } from "@/components/tailadmin/form/Radio";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";

/**
 * "Bu soruda hata var" — küçük pencere: sebep ve isteğe bağlı açıklama.
 *
 * Yalnızca cevaptan sonra görünür (sonuç incelemesi, alıştırma geri
 * bildirimi); süren testte yok. Sunucu ayrıca öğrencinin soruyu gerçekten
 * gördüğünü denetler (lib/hata-bildirimi.ts). Gönderince sayfa yeniden
 * çizilir ve düğmenin yerinde "Bildirdin: inceleniyor" yazar.
 */
export function HataBildir({
  questionId,
  sessionId,
  durum,
  className,
}: {
  questionId: string;
  sessionId: string;
  durum: RaporDurumu | null;
  className?: string;
}) {
  const { isOpen, openModal, closeModal } = useModal();
  const [sebep, setSebep] = useState<RaporSebebi | null>(null);
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);
  const [pending, startTransition] = useTransition();

  function ac() {
    setSebep(null);
    setAciklama("");
    setHata(null);
    setTamam(false);
    openModal();
  }

  function gonder() {
    if (!sebep) {
      setHata("Bir sebep seç.");
      return;
    }
    setHata(null);
    startTransition(async () => {
      try {
        const r = await hataBildirAction({ questionId, sessionId, reason: sebep, body: aciklama });
        if (r.ok) setTamam(true);
        else setHata(r.error ?? "Bildirim gönderilemedi.");
      } catch {
        setHata("Bağlantı koptu, bildirim gönderilmedi. Tekrar dene.");
      }
    });
  }

  /*
   * Pencere durumdan bağımsız çizilir: gönderince sayfa yeniden çiziliyor ve
   * durum "inceleniyor"a dönüyor; pencere o dalda olsaydı teşekkür iletisi
   * görünmeden kapanırdı.
   */
  return (
    <>
      {durum === "INCELENIYOR" ? (
        <p className={cx("inline-flex min-h-9 items-center gap-1.5 text-theme-sm text-gray-500", className)}>
          <Flag className="size-4 shrink-0 text-warning-600" aria-hidden />
          Bildirdin: inceleniyor
        </p>
      ) : (
        <span className={cx("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
          {durum === "INCELENDI" ? (
            <span className="inline-flex items-center gap-1.5 text-theme-sm text-gray-500">
              <CircleCheck className="size-4 shrink-0 text-success-600" aria-hidden />
              Bildirimin incelendi
            </span>
          ) : null}
          <Button variant="ghost" size="xs" startIcon={<Flag />} onClick={ac}>
            {durum === "INCELENDI" ? "Yeniden bildir" : "Bu soruda hata var"}
          </Button>
        </span>
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        size="sm"
        title={tamam ? "Teşekkürler!" : "Bu soruda hata var"}
        description={tamam ? undefined : "İçerik ekibi soruyu inceler. Sonucu bu soruda görürsün."}
      >
        {tamam ? (
          <div className="space-y-5">
            <Alert variant="success" compact>
              Bildirimin ulaştı. İncelenince bu soruda &quot;Bildirimin incelendi&quot; yazar.
            </Alert>
            <Button block onClick={closeModal}>
              Kapat
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">Sorun ne?</legend>
              <div className="space-y-2">
                {RAPOR_SEBEPLERI.map((s) => (
                  <Radio
                    key={s.deger}
                    name="sebep"
                    value={s.deger}
                    checked={sebep === s.deger}
                    onChange={() => setSebep(s.deger)}
                    label={s.etiket}
                    card
                    size="sm"
                  />
                ))}
              </div>
            </fieldset>

            <Field
              label="Açıklama"
              optional
              hint={`${aciklama.length}/${RAPOR_ACIKLAMA_SINIRI} · Nerede, ne gördün? (ör. "C şıkkı da doğru"). Ad, telefon gibi kişisel bilgi yazma.`}
            >
              <TextArea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                maxLength={RAPOR_ACIKLAMA_SINIRI}
                rows={3}
              />
            </Field>

            {hata ? (
              <Alert variant="error" compact>
                {hata}
              </Alert>
            ) : null}

            <div className="flex gap-3">
              <Button variant="outline" onClick={closeModal} className="flex-1">
                Vazgeç
              </Button>
              <Button onClick={gonder} loading={pending} startIcon={<Flag />} className="flex-1">
                {pending ? "Gönderiliyor…" : "Bildir"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
