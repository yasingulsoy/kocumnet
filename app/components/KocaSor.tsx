"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, MessageCircleQuestion, Send } from "lucide-react";
import { kocaSorAction } from "@/lib/actions/koca-soru";
import { KOCA_SORU_SINIRI, type KocaSoruDurumu } from "@/lib/bildirim-kurallari";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";

/*
 * "Koça sor": öğrencinin bir soru hakkında (ya da genel) koçuna yazdığı not.
 * Cevap "Koça sorularım" sayfasına gelir. Sınırlar ve "soruyu görmüş olma"
 * şartı sunucuda (lib/koca-soru.ts); burada yalnızca uzunluk sayacı.
 *
 * Form eylemi (<form action>) DEĞİL, doğrudan çağrı: React 19 form eylemi
 * bitince formu sıfırlıyor, hata alan öğrencinin yazdığı metin silinirdi.
 */

export function KocaSorFormu({
  questionId = null,
  sessionId = null,
  kapali = null,
  onTamam,
  onVazgec,
}: {
  questionId?: string | null;
  sessionId?: string | null;
  /** Sınır dolduysa nedeni: form yerine bu yazılır. */
  kapali?: string | null;
  onTamam?: () => void;
  onVazgec?: () => void;
}) {
  const [metin, setMetin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);
  const [pending, startTransition] = useTransition();

  if (kapali && !tamam) {
    return (
      <Alert variant="info" compact>
        {kapali}
      </Alert>
    );
  }

  if (tamam) {
    return (
      <div className="space-y-4">
        <Alert variant="success" compact>
          Sorun koçuna iletildi. Cevabı &quot;Koça sorularım&quot; sayfasında görürsün; ana sayfada da haber veririz.
        </Alert>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setTamam(false);
              setMetin("");
              onTamam?.();
            }}
          >
            {onTamam ? "Kapat" : "Yeni soru yaz"}
          </Button>
        </div>
      </div>
    );
  }

  function gonder() {
    if (metin.trim().length === 0) {
      setHata("Sorunu yaz.");
      return;
    }
    setHata(null);
    startTransition(async () => {
      try {
        const r = await kocaSorAction({ body: metin, questionId, sessionId });
        if (r.ok) setTamam(true);
        else setHata(r.error ?? "Sorun gönderilemedi.");
      } catch {
        setHata("Bağlantı koptu, sorun gönderilmedi. Tekrar dene.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Field
        label={questionId ? "Bu soruda nereye takıldın?" : "Sorun"}
        hint={`${metin.length}/${KOCA_SORU_SINIRI}`}
      >
        <TextArea
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          maxLength={KOCA_SORU_SINIRI}
          rows={4}
          placeholder={
            questionId
              ? "Örn. ikinci adımda neden iki tarafı 3'e böldük?"
              : "Örn. Problemlere nasıl çalışmalıyım, günde kaç soru yeter?"
          }
        />
      </Field>
      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        {onVazgec ? (
          <Button variant="outline" onClick={onVazgec} className="max-sm:flex-1">
            Vazgeç
          </Button>
        ) : null}
        <Button onClick={gonder} loading={pending} startIcon={<Send />} className="max-sm:flex-1">
          {pending ? "Gönderiliyor…" : "Koça gönder"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Soru bağlamıyla "Koça sor" (sonuç incelemesi, alıştırma geri bildirimi).
 * Cevap bekleyen sorusu varsa düğme yerine durumu ve sayfaya bağlantı.
 */
export function KocaSorDugmesi({
  questionId,
  sessionId,
  durum,
  className,
}: {
  questionId: string;
  sessionId: string;
  durum: KocaSoruDurumu | null;
  className?: string;
}) {
  const { isOpen, openModal, closeModal } = useModal();

  /*
   * Pencere ağaçta SABİT yerde (son çocuk): gönderim sayfayı yeniden
   * çizdiriyor ve durum "bekliyor"a dönüyor. Pencere dalın içinde olsaydı
   * yeniden kurulur, teşekkür iletisi yerine boş form görünürdü.
   */
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {durum === "BEKLIYOR" ? (
        <Link
          href="/sorularim"
          className="inline-flex min-h-9 items-center gap-1.5 text-theme-sm text-gray-500 transition hover:text-brand-500"
        >
          <MessageCircleQuestion className="size-4 shrink-0 text-brand-500" aria-hidden />
          Koça sordun: cevap bekleniyor
        </Link>
      ) : (
        <>
          {durum === "CEVAPLANDI" ? (
            <Link
              href="/sorularim"
              className="inline-flex min-h-9 items-center gap-1 text-theme-sm font-medium text-brand-500 transition hover:text-brand-600"
            >
              Koçun cevapladı <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
          <Button variant="ghost" size="xs" startIcon={<MessageCircleQuestion />} onClick={openModal}>
            {durum === "CEVAPLANDI" ? "Yeniden sor" : "Koça sor"}
          </Button>
        </>
      )}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        size="sm"
        title="Koça sor"
        description="Takıldığın yeri kısaca yaz. Koçun cevabı “Koça sorularım” sayfasına gelir."
      >
        <KocaSorFormu questionId={questionId} sessionId={sessionId} onTamam={closeModal} onVazgec={closeModal} />
      </Modal>
    </span>
  );
}
