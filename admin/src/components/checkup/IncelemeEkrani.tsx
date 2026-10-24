"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, PencilLine, SkipForward } from "lucide-react";
import { duzeltmeIsteAction, incelemeOnaylaAction } from "@/lib/checkup/actions/questions";
import { NOT_SINIRI } from "@/lib/checkup/question-note";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { CODE } from "./ui";

/** Yazı alanındayken tek harfli kısayollar çalışmaz (notu yazarken "a" atlatmasın). */
function yaziAlaniMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof HTMLElement)) return false;
  return hedef.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(hedef.tagName);
}

/**
 * İnceleme kuyruğunun düğmeleri: Onayla, Düzeltme iste, Atla. Her düğme
 * sıradaki soruyu açar (`sonrakiAdres`: kuyrukta bu sorudan sonraki).
 * Klavye: O onaylar, D düzeltme notunu açar, A atlar; notta Ctrl+Enter
 * gönderir, Esc kapatır.
 *
 * Onay "yayına hazır mı" kapısından geçer: hazır değilse düğme kapalı ve
 * eksikler yanında yazar (sunucu da aynı kuralla reddeder). Düzeltme isteğinde
 * not zorunlu: sorunun inceleme notlarına yazılır, soru Taslağa döner.
 */
export function IncelemeEkrani({
  id,
  hazir,
  eksikMetni,
  sonrakiAdres,
  duzenleAdres,
  onayKapaliSebebi,
}: {
  id: string;
  hazir: boolean;
  /** Hazır değilse eksiklerin özeti ("Yayına alınamaz: çözüm yok."). */
  eksikMetni: string | null;
  sonrakiAdres: string;
  duzenleAdres: string;
  /** Onay başka bir kuraldan kapalıysa (kendi sorusu, hoca kararı) sebebi. */
  onayKapaliSebebi?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notAcik, setNotAcik] = useState(false);
  const [not, setNot] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const notAlani = useRef<HTMLTextAreaElement>(null);
  const onaylanabilir = hazir && !onayKapaliSebebi;

  const sonraki = () => router.push(sonrakiAdres);

  const onayla = () => {
    if (!onaylanabilir || pending) return;
    setHata(null);
    start(async () => {
      const r = await incelemeOnaylaAction(id);
      if (!r.ok) {
        setHata(r.error);
        return;
      }
      toast.success("Yayına alındı.");
      sonraki();
    });
  };

  const duzeltmeAc = () => {
    setNotAcik(true);
    setHata(null);
    requestAnimationFrame(() => notAlani.current?.focus());
  };

  const duzeltmeGonder = () => {
    if (pending) return;
    if (!not.trim()) {
      setHata("Düzeltme notunu yaz: yazar neyi düzelteceğini bilsin.");
      notAlani.current?.focus();
      return;
    }
    setHata(null);
    start(async () => {
      const r = await duzeltmeIsteAction(id, not);
      if (!r.ok) {
        setHata(r.error);
        return;
      }
      toast.success("Not yazıldı, soru taslağa döndü.");
      sonraki();
    });
  };

  // Kısayollar: yazı alanında değilken ve değiştirici tuş yokken.
  const kisayol = useRef({ onayla, duzeltmeAc, sonraki });
  useEffect(() => {
    kisayol.current = { onayla, duzeltmeAc, sonraki };
  });
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || yaziAlaniMi(e.target)) return;
      const k = e.key.toLocaleLowerCase("tr-TR");
      if (k === "o") kisayol.current.onayla();
      else if (k === "d") {
        e.preventDefault(); // "d" not kutusuna yazılmasın
        kisayol.current.duzeltmeAc();
      } else if (k === "a") kisayol.current.sonraki();
      else return;
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  return (
    <div className="space-y-3">
      {hata ? <Alert variant="error" compact>{hata}</Alert> : null}
      {!hazir && eksikMetni ? (
        <Alert variant="warning" compact>
          {eksikMetni} Düzeltme iste ya da soruyu düzenle.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onayla}
          disabled={!onaylanabilir || pending}
          loading={pending && !notAcik}
          startIcon={<Check />}
          title={onayKapaliSebebi ?? eksikMetni ?? "Yayına al ve sıradakine geç"}
        >
          Onayla <kbd className={CODE + " ms-1"}>O</kbd>
        </Button>
        <Button variant="outline" onClick={duzeltmeAc} disabled={pending} startIcon={<PencilLine />}>
          Düzeltme iste <kbd className={CODE + " ms-1"}>D</kbd>
        </Button>
        <Button variant="ghost" onClick={sonraki} disabled={pending} startIcon={<SkipForward />}>
          Atla <kbd className={CODE + " ms-1"}>A</kbd>
        </Button>
        <ButtonLink href={duzenleAdres} variant="ghost" className="ms-auto">
          Düzenle
        </ButtonLink>
      </div>
      {onayKapaliSebebi ? <p className="text-theme-xs text-gray-500">{onayKapaliSebebi}</p> : null}

      {notAcik ? (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <label htmlFor="duzeltme-notu" className="text-theme-sm font-medium text-gray-700">
            Ne düzeltilmeli? <span className="font-normal text-gray-500">(zorunlu; yazar soru ekranındaki notlarda görür)</span>
          </label>
          <TextArea
            id="duzeltme-notu"
            ref={notAlani}
            rows={3}
            value={not}
            maxLength={NOT_SINIRI}
            onChange={(e) => setNot(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                duzeltmeGonder();
              } else if (e.key === "Escape") {
                setNotAcik(false);
              }
            }}
            placeholder="ör. C şıkkı da doğru çıkıyor; çözümün 2. adımında işlem hatası var."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" onClick={duzeltmeGonder} loading={pending} disabled={pending}>
              Notu gönder, taslağa çevir
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setNotAcik(false)} disabled={pending}>
              Vazgeç
            </Button>
            <span className="text-theme-xs text-gray-500">
              <kbd className={CODE}>Ctrl</kbd> + <kbd className={CODE}>Enter</kbd> gönderir · <kbd className={CODE}>Esc</kbd> kapatır
            </span>
          </div>
        </div>
      ) : null}

      <p className="text-theme-xs text-gray-500">
        Kısayollar: <kbd className={CODE}>O</kbd> onayla · <kbd className={CODE}>D</kbd> düzeltme iste ·{" "}
        <kbd className={CODE}>A</kbd> atla. Her düğme sıradaki soruyu açar.
      </p>
    </div>
  );
}
