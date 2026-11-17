"use client";

import { useMemo, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderTree,
  ListPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { useBildirim } from "@/components/Bildirim";
import { aramaAnahtari, sayi } from "@/lib/bicim";
import { dugumEkle, dugumGuncelle, dugumSil, dugumTasi, dugumTopluEkle } from "@/lib/eylemler/agac";
import type { Agac, Seviye } from "@/lib/tipler";

/**
 * Konu ağacı düzenleyicisi: Ders → Konu → Kazanım → Alt kazanım.
 * Her işlem server action + refresh(): sunucu yeni ağacı gönderir, açık/kapalı
 * durumu ve arama kutusu bu bileşende kalır (bileşen yeniden kurulmaz).
 */

interface Bilgi {
  ad: string;
  cogul: string;
  alt: Seviye | null;
  kodlu: boolean;
}

const BILGI: Record<Seviye, Bilgi> = {
  dersler: { ad: "ders", cogul: "dersler", alt: "konular", kodlu: false },
  konular: { ad: "konu", cogul: "konular", alt: "kazanimlar", kodlu: false },
  kazanimlar: { ad: "kazanım", cogul: "kazanımlar", alt: "alt-kazanimlar", kodlu: true },
  "alt-kazanimlar": { ad: "alt kazanım", cogul: "alt kazanımlar", alt: null, kodlu: true },
};

const buyukHarf = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);

interface Dugum {
  anahtar: string;
  seviye: Seviye;
  id: number;
  ad: string;
  kod: string | null;
  soruSayisi: number;
  silinebilir: boolean;
  ilk: boolean;
  son: boolean;
  cocuklar: Dugum[];
}

function normallestir(agac: Agac): Dugum[] {
  const yap = <T extends { id: number; ad: string; soruSayisi: number; silinebilir: boolean; kod?: string | null }>(
    liste: T[],
    seviye: Seviye,
    cocuk: (x: T) => Dugum[]
  ): Dugum[] =>
    liste.map((x, i) => ({
      anahtar: `${seviye}-${x.id}`,
      seviye,
      id: x.id,
      ad: x.ad,
      kod: x.kod ?? null,
      soruSayisi: x.soruSayisi,
      silinebilir: x.silinebilir,
      ilk: i === 0,
      son: i === liste.length - 1,
      cocuklar: cocuk(x),
    }));

  return yap(agac.dersler, "dersler", (d) =>
    yap(d.konular, "konular", (k) => yap(k.kazanimlar, "kazanimlar", (z) => yap(z.altKazanimlar, "alt-kazanimlar", () => [])))
  );
}

function hepsi(dugumler: Dugum[], fn: (d: Dugum) => void) {
  for (const d of dugumler) {
    fn(d);
    hepsi(d.cocuklar, fn);
  }
}

interface Ekleme {
  seviye: Seviye;
  ustId: number;
  ustAnahtar: string | null;
  ustAd: string;
  toplu: boolean;
}

export function KonuAgaci({ agac }: { agac: Agac }) {
  const kok = useMemo(() => normallestir(agac), [agac]);
  const [acik, setAcik] = useState<Set<string>>(() => new Set(kok.map((d) => d.anahtar)));
  const [ara, setAra] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [ekleme, setEkleme] = useState<Ekleme | null>(null);
  const [bekliyor, gecis] = useTransition();
  const [onayPenceresi, onayla] = useConfirm();
  const bildir = useBildirim();

  const sayilar = useMemo(() => {
    const s: Record<Seviye, number> = { dersler: 0, konular: 0, kazanimlar: 0, "alt-kazanimlar": 0 };
    hepsi(kok, (d) => s[d.seviye]++);
    return s;
  }, [kok]);
  const toplamSoru = kok.reduce((t, d) => t + d.soruSayisi, 0);

  // Süzme: eşleşen düğüm (ad ya da kod) ve ataları görünür; eşleşmeyi içeren
  // düğümler zorla açılır.
  const q = aramaAnahtari(ara.trim());
  const { gorunen, zorlaAcik, eslesen } = useMemo(() => {
    const zorla = new Set<string>();
    let adet = 0;
    if (!q) return { gorunen: kok, zorlaAcik: zorla, eslesen: 0 };
    const suz = (d: Dugum): Dugum | null => {
      const kendisi = aramaAnahtari(`${d.kod ?? ""} ${d.ad}`).includes(q);
      const cocuklar = d.cocuklar.map(suz).filter((x): x is Dugum => x !== null);
      if (kendisi) adet++;
      if (cocuklar.length) zorla.add(d.anahtar);
      if (kendisi) return { ...d, cocuklar: cocuklar.length ? cocuklar : d.cocuklar };
      return cocuklar.length ? { ...d, cocuklar } : null;
    };
    return { gorunen: kok.map(suz).filter((x): x is Dugum => x !== null), zorlaAcik: zorla, eslesen: adet };
  }, [kok, q]);

  const acikMi = (a: string) => acik.has(a) || zorlaAcik.has(a);

  function degistir(a: string) {
    setAcik((s) => {
      const y = new Set(s);
      if (y.has(a)) y.delete(a);
      else y.add(a);
      return y;
    });
  }

  function tumunuAc() {
    const y = new Set<string>();
    hepsi(kok, (d) => {
      if (d.cocuklar.length) y.add(d.anahtar);
    });
    setAcik(y);
  }

  function islem(fn: () => Promise<{ ok: boolean; mesaj?: string }>, basari?: string) {
    gecis(async () => {
      const r = await fn();
      if (r.ok) {
        if (basari) bildir.basari(basari);
      } else {
        bildir.hata(r.mesaj ?? "İşlem yapılamadı.");
      }
    });
  }

  async function sil(d: Dugum) {
    const b = BILGI[d.seviye];
    if (!d.silinebilir) return;
    const evet = await onayla({
      title: `${buyukHarf(b.ad)} silinsin mi?`,
      description: `"${d.kod ? `${d.kod} ` : ""}${d.ad}" kalıcı olarak silinir.`,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (evet) islem(() => dugumSil(d.seviye, d.id), `${buyukHarf(b.ad)} silindi.`);
  }

  function ekle(seviye: Seviye, ustId: number, ustAnahtar: string | null, ustAd: string, toplu: boolean) {
    setEkleme({ seviye, ustId, ustAnahtar, ustAd, toplu });
  }

  function satir(d: Dugum, derinlik: number): ReactNode {
    const b = BILGI[d.seviye];
    const acikDurum = acikMi(d.anahtar);
    const cocukVar = d.cocuklar.length > 0;
    const altBilgi = b.alt ? BILGI[b.alt] : null;

    return (
      <li key={d.anahtar}>
        <div
          className={cx(
            "group flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 py-2 pe-3 hover:bg-gray-50",
            derinlik === 0 && "bg-gray-25"
          )}
          style={{ paddingInlineStart: `${0.5 + derinlik * 1.5}rem` }}
        >
          {/* Aç/kapa */}
          {b.alt ? (
            <button
              type="button"
              onClick={() => degistir(d.anahtar)}
              aria-expanded={acikDurum}
              aria-label={`${d.ad} ${acikDurum ? "kapat" : "aç"}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              {acikDurum ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />}
            </button>
          ) : (
            <span className="size-7 shrink-0" aria-hidden />
          )}

          {duzenlenen === d.anahtar ? (
            <YenidenAdlandir
              dugum={d}
              kodlu={b.kodlu}
              bekliyor={bekliyor}
              onVazgec={() => setDuzenlenen(null)}
              onKaydet={(ad, kod) =>
                gecis(async () => {
                  const r = await dugumGuncelle(d.seviye, d.id, ad, kod);
                  if (r.ok) {
                    setDuzenlenen(null);
                    bildir.basari("Ad güncellendi.");
                  } else bildir.hata(r.mesaj);
                })
              }
            />
          ) : (
            <>
              <span className="flex min-w-0 flex-1 basis-60 items-center gap-2">
                {d.kod ? <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-700">{d.kod}</span> : null}
                <span className={cx("min-w-0 break-words", derinlik === 0 ? "font-semibold text-gray-800" : derinlik === 1 ? "font-medium text-gray-800" : "text-gray-700")}>
                  {d.ad}
                </span>
                <span className="shrink-0 text-theme-xs text-gray-500" title="Bu düğümdeki aktif soru sayısı">
                  {sayi(d.soruSayisi)} soru
                </span>
                {cocukVar && !acikDurum && altBilgi ? (
                  <span className="shrink-0 text-theme-xs text-gray-400">
                    · {d.cocuklar.length} {altBilgi.ad}
                  </span>
                ) : null}
              </span>

              <span className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover:opacity-100 focus-within:opacity-100">
                {b.alt && altBilgi ? (
                  <>
                    <IkonDugme
                      etiket={`${d.ad} altına ${altBilgi.ad} ekle`}
                      ipucu={`${buyukHarf(altBilgi.ad)} ekle`}
                      onClick={() => ekle(b.alt!, d.id, d.anahtar, d.ad, false)}
                      disabled={bekliyor}
                    >
                      <Plus />
                    </IkonDugme>
                    <IkonDugme
                      etiket={`${d.ad} altına toplu ${altBilgi.ad} ekle`}
                      ipucu={`Toplu ${altBilgi.ad} ekle`}
                      onClick={() => ekle(b.alt!, d.id, d.anahtar, d.ad, true)}
                      disabled={bekliyor}
                    >
                      <ListPlus />
                    </IkonDugme>
                  </>
                ) : null}
                <IkonDugme etiket={`${d.ad} adını değiştir`} ipucu="Yeniden adlandır" onClick={() => setDuzenlenen(d.anahtar)} disabled={bekliyor}>
                  <Pencil />
                </IkonDugme>
                <IkonDugme
                  etiket={`${d.ad} yukarı taşı`}
                  ipucu="Yukarı taşı"
                  onClick={() => islem(() => dugumTasi(d.seviye, d.id, "yukari"))}
                  disabled={bekliyor || d.ilk}
                >
                  <ArrowUp />
                </IkonDugme>
                <IkonDugme
                  etiket={`${d.ad} aşağı taşı`}
                  ipucu="Aşağı taşı"
                  onClick={() => islem(() => dugumTasi(d.seviye, d.id, "asagi"))}
                  disabled={bekliyor || d.son}
                >
                  <ArrowDown />
                </IkonDugme>
                <IkonDugme
                  etiket={`${d.ad} sil`}
                  ipucu={
                    d.silinebilir
                      ? "Sil"
                      : `Silinemez: ${cocukVar ? `altında ${altBilgi?.cogul ?? "düğüm"} var` : "sorusu ya da öğrenci sonucu var"}`
                  }
                  onClick={() => sil(d)}
                  disabled={bekliyor || !d.silinebilir}
                  tehlike
                >
                  <Trash2 />
                </IkonDugme>
              </span>
            </>
          )}
        </div>

        {b.alt && acikDurum ? (
          d.cocuklar.length ? (
            <ul>{d.cocuklar.map((c) => satir(c, derinlik + 1))}</ul>
          ) : (
            <div
              className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 text-theme-xs text-gray-500"
              style={{ paddingInlineStart: `${2.75 + (derinlik + 1) * 1.5}rem` }}
            >
              Henüz {altBilgi?.ad} yok.
              <button
                type="button"
                className="font-medium text-brand-500 hover:underline"
                onClick={() => ekle(b.alt!, d.id, d.anahtar, d.ad, false)}
              >
                Ekle
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="font-medium text-brand-500 hover:underline"
                onClick={() => ekle(b.alt!, d.id, d.anahtar, d.ad, true)}
              >
                Toplu ekle
              </button>
            </div>
          )
        ) : null}
      </li>
    );
  }

  return (
    <>
      {onayPenceresi}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
          <Input
            compact
            type="search"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder="Ad ya da kodla süz…"
            aria-label="Ağaçta ara"
            startIcon={<Search className="size-4" />}
            wrapperClassName="w-full sm:w-72"
          />
          <Button size="xs" variant="ghost" startIcon={<ChevronsUpDown />} onClick={tumunuAc}>
            Tümünü aç
          </Button>
          <Button size="xs" variant="ghost" startIcon={<ChevronsDownUp />} onClick={() => setAcik(new Set())}>
            Tümünü kapat
          </Button>
          <span className="ms-auto flex flex-wrap gap-2">
            <Button size="xs" variant="outline" startIcon={<ListPlus />} onClick={() => ekle("dersler", agac.sinav.id, null, agac.sinav.ad, true)}>
              Toplu ders ekle
            </Button>
            <Button size="xs" startIcon={<Plus />} onClick={() => ekle("dersler", agac.sinav.id, null, agac.sinav.ad, false)}>
              Ders ekle
            </Button>
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-100 px-5 py-2.5 text-theme-xs text-gray-500">
          <span>{sayi(sayilar.dersler)} ders</span>
          <span>{sayi(sayilar.konular)} konu</span>
          <span>{sayi(sayilar.kazanimlar)} kazanım</span>
          <span>{sayi(sayilar["alt-kazanimlar"])} alt kazanım</span>
          <span>{sayi(toplamSoru)} aktif soru</span>
          {q ? (
            <span className="font-medium text-brand-600" role="status">
              {eslesen ? `${sayi(eslesen)} eşleşme` : "Eşleşme yok"}
            </span>
          ) : null}
          {bekliyor ? <span className="text-gray-400">Kaydediliyor…</span> : null}
        </div>

        {kok.length === 0 ? (
          <EmptyState
            icon={<FolderTree />}
            title="Konu ağacı boş"
            description="Önce dersleri ekleyin (ör. Sayısal, Sözel), sonra her dersin altına konuları, kazanımları ve alt kazanımları."
            action={
              <Button size="xs" startIcon={<ListPlus />} onClick={() => ekle("dersler", agac.sinav.id, null, agac.sinav.ad, true)}>
                Dersleri ekle
              </Button>
            }
          />
        ) : gorunen.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">&quot;{ara}&quot; ile eşleşen düğüm yok.</p>
        ) : (
          <ul className="text-sm">{gorunen.map((d) => satir(d, 0))}</ul>
        )}
      </Card>

      {ekleme ? (
        <EklemePenceresi
          key={`${ekleme.seviye}-${ekleme.ustId}-${ekleme.toplu}`}
          ekleme={ekleme}
          onKapat={() => setEkleme(null)}
          onEklendi={() => {
            const a = ekleme.ustAnahtar;
            if (a) setAcik((s) => new Set(s).add(a));
          }}
        />
      ) : null}
    </>
  );
}

function IkonDugme({
  etiket,
  ipucu,
  onClick,
  disabled,
  tehlike,
  children,
}: {
  etiket: string;
  ipucu: string;
  onClick: () => void;
  disabled?: boolean;
  tehlike?: boolean;
  children: ReactNode;
}) {
  return (
    // Devre dışı düğme ipucunu göstermez: ipucu kabın üstünde.
    <span title={ipucu} className="inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={etiket}
        className={cx(
          "flex size-8 items-center justify-center rounded-md transition [&_svg]:size-4",
          "disabled:cursor-not-allowed disabled:opacity-35",
          tehlike ? "text-gray-500 enabled:hover:bg-error-50 enabled:hover:text-error-600" : "text-gray-500 enabled:hover:bg-gray-100 enabled:hover:text-gray-800"
        )}
      >
        {children}
      </button>
    </span>
  );
}

function YenidenAdlandir({
  dugum,
  kodlu,
  bekliyor,
  onKaydet,
  onVazgec,
}: {
  dugum: Dugum;
  kodlu: boolean;
  bekliyor: boolean;
  onKaydet: (ad: string, kod: string | null) => void;
  onVazgec: () => void;
}) {
  const [ad, setAd] = useState(dugum.ad);
  const [kod, setKod] = useState(dugum.kod ?? "");

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (!ad.trim()) return;
    onKaydet(ad.trim(), kodlu ? kod.trim() || null : null);
  }

  function tus(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onVazgec();
    }
  }

  return (
    <form onSubmit={gonder} onKeyDown={tus} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {kodlu ? (
        <Input compact value={kod} onChange={(e) => setKod(e.target.value)} placeholder="Kod" aria-label="Kod" wrapperClassName="w-28" maxLength={40} />
      ) : null}
      <Input
        compact
        value={ad}
        onChange={(e) => setAd(e.target.value)}
        aria-label="Ad"
        autoFocus
        wrapperClassName="min-w-48 flex-1"
        maxLength={300}
      />
      <Button type="submit" size="xs" loading={bekliyor} disabled={!ad.trim()}>
        Kaydet
      </Button>
      <Button size="xs" variant="ghost" onClick={onVazgec}>
        Vazgeç
      </Button>
    </form>
  );
}

function EklemePenceresi({ ekleme, onKapat, onEklendi }: { ekleme: Ekleme; onKapat: () => void; onEklendi: () => void }) {
  const b = BILGI[ekleme.seviye];
  const [ad, setAd] = useState("");
  const [kod, setKod] = useState("");
  const [satirlar, setSatirlar] = useState("");
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  const doluSatirlar = satirlar.split(/\r?\n/).filter((s) => s.trim());
  const ustMetni = ekleme.seviye === "dersler" ? `${ekleme.ustAd} sınavına` : `"${ekleme.ustAd}" altına`;

  function gonder(yeniden: boolean) {
    setHata({ alanlar: {} });
    if (ekleme.toplu) {
      if (!doluSatirlar.length) {
        setHata({ alanlar: { satirlar: "En az bir satır yazın." } });
        return;
      }
      gecis(async () => {
        const r = await dugumTopluEkle(ekleme.seviye, ekleme.ustId, doluSatirlar);
        if (r.ok) {
          const n = r.veri?.eklenen ?? doluSatirlar.length;
          const atlanan = doluSatirlar.length - n;
          bildir.basari(`${sayi(n)} ${b.ad} eklendi${atlanan > 0 ? `; ${sayi(atlanan)} satır (aynı ad) atlandı` : ""}.`);
          onEklendi();
          onKapat();
        } else setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
      });
      return;
    }
    if (!ad.trim()) {
      setHata({ alanlar: { ad: "Adı yazın." } });
      return;
    }
    gecis(async () => {
      const r = await dugumEkle(ekleme.seviye, ekleme.ustId, ad, b.kodlu ? kod : undefined);
      if (r.ok) {
        bildir.basari(`${buyukHarf(b.ad)} eklendi: ${ad.trim()}`);
        onEklendi();
        if (yeniden) {
          setAd("");
          setKod("");
        } else onKapat();
      } else setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
    });
  }

  function formGonder(e: FormEvent) {
    e.preventDefault();
    gonder(false);
  }

  return (
    <Modal
      isOpen
      onClose={onKapat}
      title={ekleme.toplu ? `Toplu ${b.ad} ekle` : `${buyukHarf(b.ad)} ekle`}
      description={`${ustMetni} eklenir; sona yerleşir.`}
      size={ekleme.toplu ? "lg" : "md"}
      dismissable={!bekliyor}
    >
      <form onSubmit={formGonder} className="space-y-5" noValidate>
        {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
        {ekleme.toplu ? (
          <Field
            label={`${buyukHarf(b.cogul)} (her satıra bir tane)`}
            error={hata.alanlar.satirlar}
            hint={
              b.kodlu ? (
                <>
                  Kodu ayırmak için <code className="rounded bg-gray-100 px-1">KOD | Ad</code> yazın (ör.{" "}
                  <code className="rounded bg-gray-100 px-1">MAT.1.2 | Doğal sayılar</code>). Boş ve aynı adlı satırlar atlanır.
                </>
              ) : (
                "Boş ve aynı adlı satırlar atlanır."
              )
            }
          >
            <TextArea
              value={satirlar}
              onChange={(e) => setSatirlar(e.target.value)}
              rows={12}
              autoFocus
              className="font-mono text-sm"
              placeholder={b.kodlu ? "MAT.1.1 | Doğal sayılar\nMAT.1.2 | Tam sayılar" : ekleme.seviye === "dersler" ? "Sayısal\nSözel" : "Temel kavramlar\nSayı basamakları"}
            />
          </Field>
        ) : (
          <div className={cx("grid gap-5", b.kodlu && "sm:grid-cols-[10rem_1fr]")}>
            {b.kodlu ? (
              <Field label="Kod" optional error={hata.alanlar.kod}>
                <Input value={kod} onChange={(e) => setKod(e.target.value)} placeholder="MAT.1.2" maxLength={40} />
              </Field>
            ) : null}
            <Field label="Ad" required error={hata.alanlar.ad}>
              <Input value={ad} onChange={(e) => setAd(e.target.value)} autoFocus maxLength={300} />
            </Field>
          </div>
        )}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
          {ekleme.toplu ? <span className="text-theme-xs text-gray-500 sm:me-auto">{sayi(doluSatirlar.length)} satır</span> : null}
          <Button variant="outline" onClick={onKapat} disabled={bekliyor}>
            Vazgeç
          </Button>
          {!ekleme.toplu ? (
            <Button variant="soft" onClick={() => gonder(true)} disabled={bekliyor}>
              Ekle ve yenisini gir
            </Button>
          ) : null}
          <Button type="submit" loading={bekliyor}>
            {ekleme.toplu ? `${sayi(doluSatirlar.length)} satırı ekle` : "Ekle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
