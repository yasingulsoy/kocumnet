"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, Link2, MessageCircle, Trash2 } from "lucide-react";
import { veliBaglantisiKaldirAction, veliBaglantisiOlusturAction } from "@/lib/actions/veli";
import {
  EN_FAZLA_VELI_BAGLANTISI,
  VARSAYILAN_VELI_SURESI,
  VELI_SURELERI,
  whatsappAdresi,
  type VeliSuresi,
} from "@/lib/veli";
import { trDate } from "@/components/ui";
import { Input } from "@/components/tailadmin/form/Input";
import { labelClass } from "@/components/tailadmin/form/styles";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, buttonClass } from "@/components/tailadmin/ui/Button";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

export interface VeliBaglantisiOzeti {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastViewedAt: Date | null;
  viewCount: number;
}

const saatli = (d: Date) =>
  d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * Profildeki "Veli bağlantısı" kartının içi.
 *
 * Bağlantının kendisi saklanmaz (yalnızca özeti): oluşturulduğu an gösterilir,
 * kopyalanır ya da WhatsApp'la gönderilir. Listede yalnızca etkin olanlar,
 * bitiş ve son açılma; kaldırma kitin onay penceresiyle.
 */
export function VeliBaglantisi({ baglantilar }: { baglantilar: VeliBaglantisiOzeti[] }) {
  const [gun, setGun] = useState<VeliSuresi>(VARSAYILAN_VELI_SURESI);
  const [yeni, setYeni] = useState<{ id: string; link: string; expiresAt: Date } | null>(null);
  /** "elle": pano kapalı (bazı uygulama içi tarayıcılar); alan seçili, kişi kendisi kopyalar. */
  const [kopya, setKopya] = useState<"" | "tamam" | "elle">("");
  const [hata, setHata] = useState<string | null>(null);
  const [olusturuluyor, olusturmaBasla] = useTransition();
  const [kaldirilan, setKaldirilan] = useState<string | null>(null);
  const [onayPenceresi, onayla] = useConfirm();
  const alan = useRef<HTMLInputElement>(null);

  const dolu = baglantilar.length >= EN_FAZLA_VELI_BAGLANTISI;

  function olustur() {
    setHata(null);
    olusturmaBasla(async () => {
      try {
        const r = await veliBaglantisiOlusturAction(gun);
        if (r.error || !r.link || !r.id || !r.expiresAt) {
          setHata(r.error ?? "Bağlantı oluşturulamadı.");
          return;
        }
        setYeni({ id: r.id, link: r.link, expiresAt: r.expiresAt });
        setKopya("");
      } catch {
        setHata("Bağlantı oluşturulamadı. Sayfayı yenileyip tekrar dene.");
      }
    });
  }

  async function kopyala() {
    if (!yeni) return;
    try {
      await navigator.clipboard.writeText(yeni.link);
      setKopya("tamam");
    } catch {
      // Pano izni yoksa eski yol: seçili alanı kopyala; o da olmazsa alan seçili kalır.
      alan.current?.select();
      setKopya(document.execCommand?.("copy") ? "tamam" : "elle");
    }
  }

  async function kaldir(b: VeliBaglantisiOzeti) {
    const evet = await onayla({
      title: "Bağlantı kaldırılsın mı?",
      description: `${trDate(b.createdAt)} tarihinde oluşturduğun bağlantı hemen kapanır; açan kişi raporu artık göremez. Bu geri alınamaz.`,
      confirmLabel: "Kaldır",
      tone: "danger",
    });
    if (!evet) return;
    setHata(null);
    setKaldirilan(b.id);
    try {
      const r = await veliBaglantisiKaldirAction(b.id);
      if (r.error) setHata(r.error);
      else if (yeni?.id === b.id) setYeni(null);
    } catch {
      setHata("Bağlantı kaldırılamadı. Sayfayı yenileyip tekrar dene.");
    } finally {
      setKaldirilan(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-gray-500">
        Velin bu bağlantıyla giriş yapmadan genel durumunu görür: ilk adın, hedef sınavın, son ölçümün ve gelişimin,
        güçlü ve zayıf konuların, son 5 testin, bu haftaki planının ne kadarını yaptığın, yanlış defterinde kaç soru
        beklediği ve koçunun ödevlerinin adı, son tarihi ve yapıp yapmadığın. Soruları, cevaplarını ve e-postanı
        göremez.{" "}
        <a href="/gizlilik#veli-baglantisi" className="font-medium text-brand-500 underline hover:text-brand-600">
          Ayrıntı
        </a>
      </p>

      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}

      {yeni ? (
        <div className="space-y-3 rounded-xl border border-success-200 bg-success-50 p-4">
          <p className="text-sm font-medium text-gray-800">
            Bağlantın hazır · {trDate(yeni.expiresAt)} tarihine kadar açık
          </p>
          <Input
            ref={alan}
            readOnly
            value={yeni.link}
            aria-label="Veli bağlantısı"
            onFocus={(e) => e.currentTarget.select()}
          />
          {kopya === "elle" ? (
            <p role="status" className="text-theme-xs text-gray-600">
              Bu tarayıcı otomatik kopyalamaya izin vermedi. Bağlantı seçili: Ctrl+C ile (telefonda basılı tutup) kopyala.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void kopyala()} startIcon={kopya === "tamam" ? <Check /> : <Copy />}>
              {kopya === "tamam" ? "Kopyalandı" : "Kopyala"}
            </Button>
            <a
              href={whatsappAdresi(yeni.link, yeni.expiresAt)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "outline" })}
            >
              <MessageCircle aria-hidden /> WhatsApp&apos;ta paylaş
            </a>
          </div>
          <p className="text-theme-xs leading-relaxed text-gray-600">
            Güvenliğin için bağlantıyı saklamıyoruz: bu sayfadan çıkınca yeniden göremezsin. Kaybedersen kaldırıp
            yenisini oluştur. Bağlantıyı bilen herkes raporu görür; yalnızca velinle paylaş.
          </p>
        </div>
      ) : null}

      {dolu ? (
        <p className="rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">
          En fazla {EN_FAZLA_VELI_BAGLANTISI} etkin bağlantın olabilir. Yenisi için aşağıdan birini kaldır.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div>
            <p aria-hidden className={labelClass}>
              Ne kadar süre açık kalsın?
            </p>
            <SegmentedTabs
              size="md"
              label="Ne kadar süre açık kalsın?"
              items={VELI_SURELERI.map((g) => ({ key: String(g), label: `${g} gün`, active: gun === g, onClick: () => setGun(g) }))}
            />
          </div>
          <Button onClick={olustur} loading={olusturuluyor} startIcon={<Link2 />}>
            {olusturuluyor ? "Oluşturuluyor…" : "Bağlantı oluştur"}
          </Button>
        </div>
      )}

      {baglantilar.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Etkin bağlantılar{" "}
            <span className="tabular font-normal text-gray-500">
              ({baglantilar.length}/{EN_FAZLA_VELI_BAGLANTISI})
            </span>
          </h3>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {baglantilar.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{trDate(b.expiresAt)} tarihine kadar açık</p>
                  <p className="text-theme-xs text-gray-500">
                    {trDate(b.createdAt)} tarihinde oluşturuldu ·{" "}
                    {b.lastViewedAt ? (
                      <>
                        son açılma {saatli(b.lastViewedAt)} <span className="tabular">({b.viewCount} kez)</span>
                      </>
                    ) : (
                      "henüz açılmadı"
                    )}
                  </p>
                </div>
                <Button
                  variant="danger-outline"
                  size="xs"
                  startIcon={<Trash2 />}
                  loading={kaldirilan === b.id}
                  onClick={() => void kaldir(b)}
                >
                  Kaldır
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onayPenceresi}
    </div>
  );
}
