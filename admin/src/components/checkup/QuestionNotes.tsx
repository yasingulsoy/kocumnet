"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { CircleCheck, MessageSquarePlus, MessageSquareText, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { notDurumuAction, notEkleAction } from "@/lib/checkup/actions/notes";
import { trDate } from "@/lib/checkup/format";
import { NOT_SINIRI, damgaAdi, notuTemizle } from "@/lib/checkup/question-note";
import type { SoruNotu } from "@/lib/checkup/question-notes";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";

/**
 * Soru ekranındaki inceleme notları. Kurallar lib/checkup/question-note.ts'te,
 * yetki sunucuda (actions/notes.ts): yazma ve çözme içerik rollerinde, okuma
 * herkeste.
 *
 * Not kutusunun metni sağlayıcıda durur: madde analizi kartındaki "Not ekle"
 * (BulgudanNotDugmesi) bulgunun metnini kutuya yazar ve oraya kaydırır;
 * kişi bağlam ekleyip kaydeder.
 */

interface Taslak {
  metin: string;
  setMetin: (m: string) => void;
  /** Kutuya ekler (yazılmış metin silinmez), kutuya kaydırır ve odaklar. */
  yaz: (m: string) => void;
  alan: RefObject<HTMLTextAreaElement | null>;
}

const TaslakCtx = createContext<Taslak | null>(null);

export function NotTaslagiSaglayici({ ilkTaslak = "", children }: { ilkTaslak?: string; children: ReactNode }) {
  const [metin, setMetin] = useState(ilkTaslak);
  const alan = useRef<HTMLTextAreaElement>(null);

  const yaz = useCallback((yeni: string) => {
    setMetin((m) => (m.includes(yeni) ? m : m.trim() ? m.trimEnd() + "\n\n" + yeni : yeni));
    // Bir sonraki karede: kutu yeni metinle çizilmiş olsun.
    requestAnimationFrame(() => {
      const el = alan.current;
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const deger = useMemo(() => ({ metin, setMetin, yaz, alan }), [metin, yaz]);
  return <TaslakCtx.Provider value={deger}>{children}</TaslakCtx.Provider>;
}

/** Madde analizi bulgusunun yanında: bulguyu not kutusuna yazar. Sağlayıcı yoksa (yazma yetkisi yok) çizilmez. */
export function BulgudanNotDugmesi({ metin }: { metin: string }) {
  const taslak = useContext(TaslakCtx);
  if (!taslak) return null;
  return (
    <Button variant="ghost" size="xs" startIcon={<MessageSquarePlus />} onClick={() => taslak.yaz(metin)}>
      Not ekle
    </Button>
  );
}

function NotSatiri({ not, yazabilir }: { not: SoruNotu; yazabilir: boolean }) {
  const [pending, start] = useTransition();
  const cozuldu = not.resolvedAt !== null;

  const degistir = () =>
    start(async () => {
      const r = await notDurumuAction(not.id, !cozuldu);
      if (!r.ok) toast.error(r.error);
    });

  return (
    <li className={cx("px-5 py-4 sm:px-6", cozuldu && "bg-gray-50")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500">
        <span className="font-medium text-gray-800" title={not.authorStaff}>
          {damgaAdi(not.authorStaff)}
        </span>
        <span>{trDate(not.createdAt, { time: true })}</span>
        <Badge size="sm" color={cozuldu ? "success" : "warning"}>
          {cozuldu ? "Çözüldü" : "Açık"}
        </Badge>
      </div>
      <p className={cx("mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line", cozuldu ? "text-gray-500" : "text-gray-800")}>
        {not.body}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {cozuldu ? (
          <span className="text-theme-xs text-gray-500" title={not.resolvedByStaff ?? undefined}>
            Çözen {damgaAdi(not.resolvedByStaff)} · {trDate(not.resolvedAt!, { time: true })}
          </span>
        ) : (
          <span />
        )}
        {yazabilir ? (
          <Button
            variant={cozuldu ? "ghost" : "outline"}
            size="xs"
            loading={pending}
            startIcon={cozuldu ? <RotateCcw /> : <CircleCheck />}
            onClick={degistir}
          >
            {cozuldu ? "Yeniden aç" : "Çözüldü"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function NotKutusu({ questionId }: { questionId: string }) {
  const taslak = useContext(TaslakCtx);
  const [yerelMetin, setYerelMetin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Sağlayıcı yoksa kutu kendi metnini tutar.
  const metin = taslak ? taslak.metin : yerelMetin;
  const setMetin = taslak ? taslak.setMetin : setYerelMetin;
  const temiz = notuTemizle(metin);
  const fazla = temiz.length > NOT_SINIRI;

  const gonder = () =>
    start(async () => {
      const r = await notEkleAction(questionId, metin);
      if (!r.ok) {
        setHata(r.error);
        return;
      }
      setHata(null);
      setMetin("");
      toast.success("Not eklendi.");
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && temiz && !fazla) gonder();
      }}
      className="space-y-3 border-t border-gray-100 px-5 py-4 sm:px-6"
    >
      <Field
        label="Yeni not"
        error={fazla ? `Not ${NOT_SINIRI} karakteri aşıyor (${temiz.length}).` : (hata ?? undefined)}
        hint={
          <>
            <span className="tabular">
              {temiz.length}/{NOT_SINIRI}
            </span>{" "}
            · Yalnızca personel görür. Madde analizindeki bulguyu &quot;Not ekle&quot; ile buraya taşıyabilirsin.
          </>
        }
      >
        <TextArea
          ref={taslak?.alan}
          rows={3}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          className="leading-relaxed"
          placeholder="Örn. C şıkkı da doğru olabilir; anahtarı kontrol edelim."
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="xs" loading={pending} disabled={!temiz || fazla} startIcon={<MessageSquarePlus />}>
          {pending ? "Ekleniyor…" : "Notu ekle"}
        </Button>
      </div>
    </form>
  );
}

export function SoruNotlari({
  questionId,
  notlar,
  yazabilir,
}: {
  questionId: string;
  notlar: SoruNotu[];
  yazabilir: boolean;
}) {
  const acik = notlar.filter((n) => n.resolvedAt === null).length;

  return (
    <ComponentCard
      // Analiz listesindeki "Not ekle" bağlantısı buraya iner.
      id="notlar"
      className="mb-6 scroll-mt-24"
      title="İnceleme notları"
      badge={
        acik > 0 ? (
          <Badge size="sm" color="warning">
            <span className="tabular">{acik}</span> açık
          </Badge>
        ) : null
      }
      desc="Personel arasında; öğrenciye hiçbir yoldan gitmez."
      flush
    >
      {notlar.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText />}
          title="Henüz not yok"
          description={
            yazabilir
              ? "Soruda gördüğün bir sorunu (anahtar, ifade, çeldirici) buraya yaz; çözülünce işaretle."
              : "Not eklemek ve çözmek yönetici, müdür ve editöre açık."
          }
        />
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {notlar.map((n) => (
            <NotSatiri key={n.id} not={n} yazabilir={yazabilir} />
          ))}
        </ul>
      )}
      {yazabilir ? (
        <NotKutusu questionId={questionId} />
      ) : notlar.length > 0 ? (
        <p className="border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-500 sm:px-6">
          Not eklemek ve çözmek yönetici, müdür ve editöre açık.
        </p>
      ) : null}
    </ComponentCard>
  );
}
