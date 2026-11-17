"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Ban, CheckCircle2, CopyPlus, FolderTree, ImagePlus, LoaderCircle, MessageSquareText, RotateCcw, Save, Trash2 } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Select } from "@/components/tailadmin/form/Select";
import { Switch } from "@/components/tailadmin/form/Switch";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { useBildirim } from "@/components/Bildirim";
import { OnizlemeKutusu, OnizlemeliMetin, useOnizleme, YAZIM_IPUCU } from "@/components/Onizleme";
import { SoruGorseli } from "@/components/SoruHtml";
import { useAyrilmaUyarisi } from "@/components/useAyrilmaUyarisi";
import { sayiyaCevir, secenekler, zinciriDuzelt } from "@/lib/agac-yardimci";
import { sayi, sorgu, tarihSaat } from "@/lib/bicim";
import { agacGetir } from "@/lib/eylemler/agac";
import { soruAktifligi, soruGuncelle, soruOlustur, soruSil } from "@/lib/eylemler/sorular";
import { HARFLER, type Agac, type GorselYanit, type Harf, type IslemSonucu, type SoruAyrintisi, type SoruYuku } from "@/lib/tipler";

/**
 * Soru formu (yeni ve düzenleme). Bütün durum istemcide (useState) ve kayıt
 * eylemi elle çağrılır (`await soruOlustur(yuk)`): React 19 form eylemi bitince
 * formu sıfırlıyor, <select>'ler varsayılana dönüyordu; doğrulama hatası alan
 * kullanıcı seçimlerini kaybediyordu. Burada sıfırlama yok.
 *
 * Hız için: "Kaydet ve aynı konuya yeni" (Ctrl+Enter) seçimleri koruyup içeriği
 * boşaltır; Ctrl+S kaydeder.
 */

interface Sik {
  metin: string;
  aciklama: string;
  aciklamaAcik: boolean;
}

interface Konum {
  sinavId: number;
  dersId: number | null;
  konuId: number | null;
  kazanimId: number | null;
  altKazanimId: number | null;
}

interface Icerik {
  metin: string;
  gorselId: string | null;
  cozum: string;
  zorluk: number | null;
  aktif: boolean;
  siklar: Sik[];
  dogru: Harf | null;
}

const BOS_SIKLAR = (): Sik[] => HARFLER.map(() => ({ metin: "", aciklama: "", aciklamaAcik: false }));

function icerikOlustur(soru?: SoruAyrintisi): Icerik {
  if (!soru) return { metin: "", gorselId: null, cozum: "", zorluk: null, aktif: true, siklar: BOS_SIKLAR(), dogru: null };
  const sirali = [...soru.siklar].sort((a, b) => a.sira - b.sira);
  return {
    metin: soru.metin,
    gorselId: soru.gorselId,
    cozum: soru.cozum,
    zorluk: soru.zorluk,
    aktif: soru.aktif,
    siklar: HARFLER.map((_, i) => ({
      metin: sirali[i]?.metin ?? "",
      aciklama: sirali[i]?.aciklama ?? "",
      aciklamaAcik: Boolean(sirali[i]?.aciklama),
    })),
    dogru: (sirali.find((s) => s.dogru)?.harf as Harf | undefined) ?? null,
  };
}

/** Kirlilik karşılaştırması için (açıklama kutusunun açık olması sayılmaz). */
function imza(k: Konum, i: Icerik) {
  return JSON.stringify([k, i.metin, i.gorselId, i.cozum, i.zorluk, i.aktif, i.dogru, i.siklar.map((s) => [s.metin, s.aciklama])]);
}

const sikAnahtari = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, "");

/** Backend alan adları için olası yazımlar (API.md biçimi belirtmiyor). */
function sikAnahtarlari(i: number, alt: "metin" | "aciklama") {
  const h = HARFLER[i];
  return alt === "metin"
    ? [`siklar.${i}.metin`, `siklar[${i}].metin`, `siklar.${i}`, `siklar[${i}]`, `sik${h}`, `siklar.${h}`, h]
    : [`siklar.${i}.aciklama`, `siklar[${i}].aciklama`, `siklar.${h}.aciklama`];
}

const KONUM_ALANLARI = ["sinavId", "dersId", "konuId", "kazanimId", "altKazanimId"] as const;

const ZORLUKLAR: { deger: number | null; ad: string }[] = [
  { deger: null, ad: "Belirtilmedi" },
  { deger: 1, ad: "1 · Çok kolay" },
  { deger: 2, ad: "2 · Kolay" },
  { deger: 3, ad: "3 · Orta" },
  { deger: 4, ad: "4 · Zor" },
  { deger: 5, ad: "5 · Çok zor" },
];

export function SoruFormu({
  sinavlar,
  agac: ilkAgac,
  soru,
  baslangic,
  yeniKaydedildi = false,
}: {
  sinavlar: { id: number; ad: string; aktif: boolean }[];
  agac: Agac;
  /** Düzenleme: mevcut soru. */
  soru?: SoruAyrintisi;
  /** Yeni soru: adresten gelen seçimler. */
  baslangic?: Konum;
  yeniKaydedildi?: boolean;
}) {
  const router = useRouter();
  const bildir = useBildirim();
  const [onayPenceresi, onayla] = useConfirm();
  const [bekliyor, gecis] = useTransition();
  const duzenleme = Boolean(soru);

  // ── Durum ──
  const [agaclar, setAgaclar] = useState<Record<number, Agac>>({ [ilkAgac.sinav.id]: ilkAgac });
  const [agacYukleniyor, setAgacYukleniyor] = useState(false);
  const [konum, setKonum] = useState<Konum>(() => {
    const k = soru
      ? { sinavId: soru.sinavId, dersId: soru.dersId, konuId: soru.konuId, kazanimId: soru.kazanimId, altKazanimId: soru.altKazanimId }
      : (baslangic ?? { sinavId: ilkAgac.sinav.id, dersId: null, konuId: null, kazanimId: null, altKazanimId: null });
    // Adresten gelen seçim ağaçla uyuşmuyorsa (silinmiş konu) altlar düşer.
    return soru ? k : { sinavId: k.sinavId, ...zinciriDuzelt(ilkAgac, k) };
  });
  const [icerik, setIcerik] = useState<Icerik>(() => icerikOlustur(soru));
  /** Kaydedilmiş hâl: kirlilik ve PATCH'te temizlenen alanlar buna göre. */
  const [kayitli, setKayitli] = useState<{ soru?: SoruAyrintisi; imza: string }>(() => ({
    soru,
    imza: imza(konum, icerik),
  }));
  /** "Kaydet ve yeni" sonrası içerik bölümleri yeniden kurulsun (önizlemeler sıfırlansın). */
  const [turAnahtari, setTurAnahtari] = useState(0);
  const [hatalar, setHatalar] = useState<Record<string, string>>({});
  const [genelHata, setGenelHata] = useState<{ mesaj: string; ek: string[] } | null>(null);
  const [sonKayit, setSonKayit] = useState<{ id: number; yeni: boolean } | null>(yeniKaydedildi && soru ? { id: soru.id, yeni: true } : null);
  const [gorselDurumu, setGorselDurumu] = useState<{ yukleniyor: boolean; hata: string | null }>({ yukleniyor: false, hata: null });
  const dosyaGirdisi = useRef<HTMLInputElement>(null);

  const agac = agaclar[konum.sinavId] ?? null;
  const s = secenekler(agac, { dersId: konum.dersId, konuId: konum.konuId, kazanimId: konum.kazanimId });
  const kirli = imza(konum, icerik) !== kayitli.imza;
  const ayrilmaPenceresi = useAyrilmaUyarisi(kirli && !bekliyor);
  const mevcut = kayitli.soru;

  // ── Konum (zincirleme seçimler) ──
  function sinavSec(id: number) {
    setKonum({ sinavId: id, dersId: null, konuId: null, kazanimId: null, altKazanimId: null });
    if (agaclar[id]) return;
    setAgacYukleniyor(true);
    void agacGetir(id).then((r) => {
      setAgacYukleniyor(false);
      if (r.ok) setAgaclar((a) => ({ ...a, [id]: r.veri }));
      else bildir.hata(r.mesaj, "Konu ağacı alınamadı");
    });
  }

  function alanTemizle(...anahtarlar: string[]) {
    if (!anahtarlar.some((a) => hatalar[a])) return;
    setHatalar((h) => {
      const y = { ...h };
      for (const a of anahtarlar) delete y[a];
      return y;
    });
  }

  function icerikDegistir<K extends keyof Icerik>(alan: K, deger: Icerik[K]) {
    setIcerik((i) => ({ ...i, [alan]: deger }));
  }

  function sikDegistir(i: number, d: Partial<Sik>) {
    setIcerik((x) => ({ ...x, siklar: x.siklar.map((s, j) => (j === i ? { ...s, ...d } : s)) }));
  }

  // ── Görsel ──
  async function gorselSecildi(e: ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = ""; // aynı dosya yeniden seçilebilsin
    if (!dosya) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(dosya.type)) {
      setGorselDurumu({ yukleniyor: false, hata: "Yalnızca PNG, JPEG ya da WebP yükleyebilirsiniz (SVG olmaz)." });
      return;
    }
    if (dosya.size > 10 * 1024 * 1024) {
      setGorselDurumu({ yukleniyor: false, hata: "Görsel en fazla 10 MB olabilir." });
      return;
    }
    setGorselDurumu({ yukleniyor: true, hata: null });
    try {
      const fd = new FormData();
      fd.append("dosya", dosya);
      const res = await fetch("/api/gorsel", { method: "POST", body: fd });
      const r = (await res.json()) as IslemSonucu<GorselYanit>;
      if (r.ok) {
        icerikDegistir("gorselId", r.veri.id);
        setGorselDurumu({ yukleniyor: false, hata: null });
      } else if (r.kod === "OTURUM_YOK") {
        router.push(`/oturum-bitti?sonraki=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else {
        setGorselDurumu({ yukleniyor: false, hata: r.mesaj });
      }
    } catch {
      setGorselDurumu({ yukleniyor: false, hata: "Görsel yüklenemedi. Bağlantınızı denetleyip yeniden deneyin." });
    }
  }

  // ── Doğrulama ve kayıt ──
  function denetle(): Record<string, string> {
    const h: Record<string, string> = {};
    if (!konum.dersId) h.dersId = "Ders seçin.";
    if (!konum.konuId) h.konuId = "Konu seçin.";
    if (!konum.kazanimId) h.kazanimId = "Kazanım seçin.";
    if (!konum.altKazanimId) h.altKazanimId = "Alt kazanım seçin.";
    if (!icerik.metin.trim()) h.metin = "Soru metnini yazın.";
    if (!icerik.cozum.trim()) h.cozum = "Çözümü yazın.";
    const gorulen = new Map<string, number>();
    icerik.siklar.forEach((sk, i) => {
      if (!sk.metin.trim()) {
        h[`sik.${i}`] = `${HARFLER[i]} şıkkını yazın.`;
        return;
      }
      const a = sikAnahtari(sk.metin);
      const once = gorulen.get(a);
      if (once !== undefined) h[`sik.${i}`] = `${HARFLER[once]} şıkkıyla aynı. Şıklar birbirinden farklı olmalı.`;
      else gorulen.set(a, i);
    });
    if (!icerik.dogru) h.dogru = "Doğru şıkkı işaretleyin.";
    return h;
  }

  function yukHazirla(): SoruYuku {
    const ilk = kayitli.soru;
    const ilkSiklar = ilk ? [...ilk.siklar].sort((a, b) => a.sira - b.sira) : [];
    const y: SoruYuku = {
      sinavId: konum.sinavId,
      dersId: konum.dersId!,
      konuId: konum.konuId!,
      kazanimId: konum.kazanimId!,
      altKazanimId: konum.altKazanimId!,
      metin: icerik.metin,
      cozum: icerik.cozum,
      aktif: icerik.aktif,
      dogruSik: icerik.dogru!,
      siklar: icerik.siklar.map((sk, i) => {
        const a = sk.aciklama.trim();
        if (a) return { metin: sk.metin, aciklama: sk.aciklama };
        // Düzenlemede silinen açıklama null ile temizlenir; yoksa hiç gönderilmez.
        return ilkSiklar[i]?.aciklama ? { metin: sk.metin, aciklama: null } : { metin: sk.metin };
      }),
    };
    if (icerik.gorselId) y.gorselId = icerik.gorselId;
    else if (ilk?.gorselId) y.gorselId = null;
    if (icerik.zorluk) y.zorluk = icerik.zorluk;
    else if (ilk?.zorluk) y.zorluk = null;
    return y;
  }

  function sunucuHatalari(r: Extract<IslemSonucu<unknown>, { ok: false }>) {
    const gelen = r.alanlar ?? {};
    const h: Record<string, string> = {};
    const kullanilan = new Set<string>();
    const al = (hedef: string, adaylar: string[]) => {
      for (const a of adaylar) {
        if (gelen[a]) {
          h[hedef] = gelen[a];
          kullanilan.add(a);
          return;
        }
      }
    };
    for (const k of KONUM_ALANLARI) al(k, [k]);
    al("metin", ["metin"]);
    al("cozum", ["cozum"]);
    al("dogru", ["dogruSik", "dogru"]);
    al("zorluk", ["zorluk"]);
    al("gorsel", ["gorselId"]);
    al("siklar", ["siklar"]);
    HARFLER.forEach((_, i) => {
      al(`sik.${i}`, sikAnahtarlari(i, "metin"));
      al(`aciklama.${i}`, sikAnahtarlari(i, "aciklama"));
    });
    const ek = Object.entries(gelen)
      .filter(([k]) => !kullanilan.has(k))
      .map(([k, v]) => `${k}: ${v}`);
    setHatalar(h);
    setGenelHata({ mesaj: r.mesaj, ek });
    odaklan();
  }

  function odaklan() {
    window.setTimeout(() => {
      const ilkHata = document.querySelector<HTMLElement>("[data-soru-formu] [aria-invalid='true'], [data-soru-formu] [data-hatali='true']");
      if (ilkHata) {
        ilkHata.scrollIntoView({ block: "center", behavior: "smooth" });
        ilkHata.focus({ preventScroll: true });
      } else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  function kaydet(yeniyeGec: boolean) {
    if (bekliyor) return;
    const h = denetle();
    setGenelHata(null);
    setHatalar(h);
    if (Object.keys(h).length) {
      odaklan();
      return;
    }
    const yuk = yukHazirla();
    gecis(async () => {
      if (mevcut) {
        const r = await soruGuncelle(mevcut.id, yuk);
        if (!r.ok) return sunucuHatalari(r);
        setKayitli({ soru: r.veri ?? mevcut, imza: imza(konum, icerik) });
        setSonKayit({ id: mevcut.id, yeni: false });
        bildir.basari(`Soru #${mevcut.id} kaydedildi.`);
        return;
      }
      const r = await soruOlustur(yuk);
      if (!r.ok) return sunucuHatalari(r);
      const id = r.veri?.id;
      if (yeniyeGec || !id) {
        // Seçimler kalır, içerik boşalır: aynı konuya sıradaki soru.
        const bos = { ...icerikOlustur(), zorluk: icerik.zorluk, aktif: icerik.aktif };
        setIcerik(bos);
        setKayitli({ imza: imza(konum, bos) });
        setTurAnahtari((n) => n + 1);
        setSonKayit(id ? { id, yeni: true } : null);
        bildir.basari(
          <>
            Soru{id ? ` #${id}` : ""} kaydedildi. Aynı konuya yenisini yazabilirsiniz.
            {id ? (
              <>
                {" "}
                <Link href={`/sorular/${id}`} className="font-medium underline">
                  Kaydedileni aç
                </Link>
              </>
            ) : null}
          </>
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setKayitli({ imza: imza(konum, icerik) }); // yönlendirmede ayrılma uyarısı çıkmasın
      router.push(`/sorular/${id}?kaydedildi=1`);
    });
  }

  function gonder(e: FormEvent) {
    e.preventDefault();
    kaydet(false);
  }

  function kisayol(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      kaydet(false);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !duzenleme) {
      e.preventDefault();
      kaydet(true);
    }
  }

  // ── Düzenleme eylemleri ──
  function aktiflikDegistir() {
    if (!mevcut) return;
    const yeni = !mevcut.aktif;
    gecis(async () => {
      const r = await soruAktifligi(mevcut.id, yeni);
      if (!r.ok) {
        bildir.hata(r.mesaj);
        return;
      }
      setIcerik((i) => ({ ...i, aktif: yeni }));
      setKayitli((k) => {
        const soruYeni = { ...(k.soru ?? mevcut), aktif: yeni };
        // Kayıtlı imzada da aktiflik güncellenir; öteki kaydedilmemiş değişiklikler kirli kalır.
        const eski = JSON.parse(k.imza) as unknown[];
        eski[5] = yeni;
        return { soru: soruYeni, imza: JSON.stringify(eski) };
      });
      bildir.basari(yeni ? "Soru aktif yapıldı; havuza girer." : "Soru pasif yapıldı; yeni check-up'lara gelmez.");
    });
  }

  async function sil() {
    if (!mevcut) return;
    const evet = await onayla({
      title: `Soru #${mevcut.id} silinsin mi?`,
      description: "Soru, şıkları ve çözümü kalıcı olarak silinir. Geri alınamaz.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!evet) return;
    gecis(async () => {
      const r = await soruSil(mevcut.id);
      if (!r.ok) {
        bildir.hata(r.mesaj, "Silinemedi");
        return;
      }
      setKayitli({ soru: mevcut, imza: imza(konum, icerik) });
      bildir.basari(`Soru #${mevcut.id} silindi.`);
      router.push(`/sorular?sinav=${mevcut.sinavId}`);
    });
  }

  const ayniKonuAdresi = `/sorular/yeni${sorgu({
    sinav: konum.sinavId,
    ders: konum.dersId,
    konu: konum.konuId,
    kazanim: konum.kazanimId,
    altKazanim: konum.altKazanimId,
  })}`;
  const silinebilir = mevcut ? mevcut.kullanimSayisi === 0 && mevcut.sabitListeSayisi === 0 : false;
  const konuAgacSecimi = agac && agac.dersler.length === 0;

  return (
    <form onSubmit={gonder} onKeyDown={kisayol} noValidate data-soru-formu className="space-y-6 pb-4">
      {onayPenceresi}
      {ayrilmaPenceresi}

      {/* ── Durum bandı ── */}
      {sonKayit && mevcut && sonKayit.yeni ? (
        <Alert
          variant="success"
          title={`Soru #${sonKayit.id} kaydedildi`}
          onClose={() => setSonKayit(null)}
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={ayniKonuAdresi} size="xs" startIcon={<CopyPlus />}>
                Aynı konuya yeni soru
              </ButtonLink>
              <ButtonLink href={`/sorular?sinav=${konum.sinavId}`} size="xs" variant="outline">
                Soru listesi
              </ButtonLink>
            </div>
          }
        >
          Sınav, ders, konu, kazanım ve alt kazanım yeni soruda dolu gelir.
        </Alert>
      ) : null}

      {genelHata ? (
        <Alert variant="error" title="Kaydedilemedi" onClose={() => setGenelHata(null)}>
          {genelHata.mesaj}
          {genelHata.ek.length ? (
            <ul className="mt-1 list-disc ps-5">
              {genelHata.ek.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {mevcut ? (
        <ComponentCard
          title="Durum"
          badge={
            mevcut.aktif ? (
              <Badge size="sm" color="success">
                Aktif
              </Badge>
            ) : (
              <Badge size="sm" color="light">
                Pasif
              </Badge>
            )
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={ayniKonuAdresi} size="xs" variant="outline" startIcon={<CopyPlus />}>
                Aynı konuya yeni soru
              </ButtonLink>
              <Button size="xs" variant="outline" onClick={aktiflikDegistir} disabled={bekliyor} startIcon={mevcut.aktif ? <Ban /> : <CheckCircle2 />}>
                {mevcut.aktif ? "Pasif yap" : "Aktif yap"}
              </Button>
              {silinebilir ? (
                <Button size="xs" variant="danger-outline" onClick={sil} disabled={bekliyor} startIcon={<Trash2 />}>
                  Sil
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">{sayi(mevcut.kullanimSayisi)}</span> check-up&apos;ta kullanıldı ·{" "}
              <span className="font-medium text-gray-800">{sayi(mevcut.sabitListeSayisi)}</span> sabit listede · Eklendi{" "}
              {tarihSaat(mevcut.olusturuldu)} · Son değişiklik {tarihSaat(mevcut.guncellendi)}
            </p>
            {mevcut.kullanimSayisi > 0 ? (
              <Alert variant="warning" compact>
                Bu soru {sayi(mevcut.kullanimSayisi)} check-up&apos;ta kullanıldı; şıkları değiştirmek eski cevapları etkiler (öğrencinin
                seçtiği şık aynı kalır, metni ve doğruluğu değişir). Yanlışlığı düzeltmek dışında yeni soru eklemeyi düşünün.
              </Alert>
            ) : null}
            {!silinebilir ? (
              <p className="text-theme-xs text-gray-500">
                Check-up&apos;ta ya da sabit listede geçtiği için silinemez; havuzdan çıkarmak için pasif yapın.
              </p>
            ) : null}
          </div>
        </ComponentCard>
      ) : null}

      {/* ── Konum ── */}
      <ComponentCard
        title="Konum"
        desc="Beşi de zorunlu. Üst seçim değişince alttakiler sıfırlanır."
        actions={
          <ButtonLink href={`/sinavlar/${konum.sinavId}/konular`} size="xs" variant="ghost" startIcon={<FolderTree />}>
            Konu ağacı
          </ButtonLink>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Sınav" required>
            <Select
              value={String(konum.sinavId)}
              onChange={(e) => sinavSec(Number(e.target.value))}
              options={sinavlar.map((x) => ({ value: String(x.id), label: x.aktif ? x.ad : `${x.ad} (pasif)` }))}
            />
          </Field>
          <Field label="Ders" required error={hatalar.dersId}>
            <Select
              value={konum.dersId ? String(konum.dersId) : ""}
              disabled={agacYukleniyor}
              onChange={(e) => {
                setKonum((k) => ({ ...k, dersId: sayiyaCevir(e.target.value), konuId: null, kazanimId: null, altKazanimId: null }));
                alanTemizle("dersId");
              }}
            >
              <option value="">{agacYukleniyor ? "Yükleniyor…" : "Ders seçin"}</option>
              {s.dersler.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Konu" required error={hatalar.konuId}>
            <Select
              value={konum.konuId ? String(konum.konuId) : ""}
              disabled={!konum.dersId}
              onChange={(e) => {
                setKonum((k) => ({ ...k, konuId: sayiyaCevir(e.target.value), kazanimId: null, altKazanimId: null }));
                alanTemizle("konuId");
              }}
            >
              <option value="">{konum.dersId ? (s.konular.length ? "Konu seçin" : "Bu derste konu yok") : "Önce ders seçin"}</option>
              {s.konular.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kazanım" required error={hatalar.kazanimId}>
            <Select
              value={konum.kazanimId ? String(konum.kazanimId) : ""}
              disabled={!konum.konuId}
              onChange={(e) => {
                setKonum((k) => ({ ...k, kazanimId: sayiyaCevir(e.target.value), altKazanimId: null }));
                alanTemizle("kazanimId");
              }}
            >
              <option value="">{konum.konuId ? (s.kazanimlar.length ? "Kazanım seçin" : "Bu konuda kazanım yok") : "Önce konu seçin"}</option>
              {s.kazanimlar.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Alt kazanım" required error={hatalar.altKazanimId}>
            <Select
              value={konum.altKazanimId ? String(konum.altKazanimId) : ""}
              disabled={!konum.kazanimId}
              onChange={(e) => {
                setKonum((k) => ({ ...k, altKazanimId: sayiyaCevir(e.target.value) }));
                alanTemizle("altKazanimId");
              }}
            >
              <option value="">
                {konum.kazanimId ? (s.altKazanimlar.length ? "Alt kazanım seçin" : "Bu kazanımda alt kazanım yok") : "Önce kazanım seçin"}
              </option>
              {s.altKazanimlar.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {konuAgacSecimi ? (
          <Alert variant="info" compact className="mt-4">
            Bu sınavın konu ağacı boş. Soru eklemeden önce{" "}
            <Link href={`/sinavlar/${konum.sinavId}/konular`} className="font-medium underline">
              konu ağacını girin
            </Link>
            .
          </Alert>
        ) : null}
      </ComponentCard>

      <div key={turAnahtari} className="space-y-6">
        {/* ── Soru metni ve görsel ── */}
        <ComponentCard title="Soru" desc={YAZIM_IPUCU}>
          <div className="space-y-5">
            <OnizlemeliMetin
              label="Soru metni"
              required
              value={icerik.metin}
              onChange={(v) => {
                icerikDegistir("metin", v);
                alanTemizle("metin");
              }}
              ilkMetin={mevcut?.metin}
              ilkHtml={mevcut?.metinHtml}
              error={hatalar.metin}
              rows={7}
              placeholder="Soru kökünü yazın. Örnek: $x^2 - 5x + 6 = 0$ denkleminin kökleri toplamı kaçtır?"
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">
                Görsel <span className="font-normal text-gray-500">(isteğe bağlı)</span>
              </p>
              <div className="flex flex-wrap items-start gap-4">
                {icerik.gorselId ? (
                  <SoruGorseli id={icerik.gorselId} className="max-h-60" />
                ) : (
                  <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-gray-300 text-theme-xs text-gray-400">
                    Görsel yok
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={dosyaGirdisi}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={gorselSecildi}
                  />
                  <Button
                    size="xs"
                    variant="outline"
                    startIcon={gorselDurumu.yukleniyor ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
                    disabled={gorselDurumu.yukleniyor}
                    onClick={() => dosyaGirdisi.current?.click()}
                  >
                    {gorselDurumu.yukleniyor ? "Yükleniyor…" : icerik.gorselId ? "Görseli değiştir" : "Görsel yükle"}
                  </Button>
                  {icerik.gorselId ? (
                    <Button size="xs" variant="ghost" startIcon={<Trash2 />} onClick={() => icerikDegistir("gorselId", null)}>
                      Görseli kaldır
                    </Button>
                  ) : null}
                  {mevcut?.gorselId && icerik.gorselId !== mevcut.gorselId ? (
                    <Button size="xs" variant="ghost" startIcon={<RotateCcw />} onClick={() => icerikDegistir("gorselId", mevcut.gorselId)}>
                      Eskisine dön
                    </Button>
                  ) : null}
                  <p className="max-w-60 text-theme-xs text-gray-500">PNG, JPEG ya da WebP; en fazla 10 MB. Genişliği 1200 piksele küçültülür.</p>
                </div>
              </div>
              {gorselDurumu.hata || hatalar.gorsel ? (
                <p className="mt-1.5 text-theme-xs text-error-600" role="alert">
                  {gorselDurumu.hata ?? hatalar.gorsel}
                </p>
              ) : null}
            </div>
          </div>
        </ComponentCard>

        {/* ── Şıklar ── */}
        <ComponentCard
          title="Şıklar"
          desc="Beş şık zorunlu ve birbirinden farklı olmalı. Doğru olanı işaretleyin; yanlış şıklara isteğe bağlı açıklama ekleyebilirsiniz."
        >
          <fieldset className="space-y-3">
            <legend className="sr-only">Şıklar ve doğru cevap</legend>
            {hatalar.dogru ? (
              <p className="text-sm text-error-600" role="alert" data-hatali="true" tabIndex={-1}>
                {hatalar.dogru}
              </p>
            ) : null}
            {hatalar.siklar ? (
              <p className="text-sm text-error-600" role="alert">
                {hatalar.siklar}
              </p>
            ) : null}
            {icerik.siklar.map((sk, i) => (
              <SikSatiri
                key={HARFLER[i]}
                harf={HARFLER[i]}
                sik={sk}
                dogru={icerik.dogru === HARFLER[i]}
                onDogru={() => {
                  icerikDegistir("dogru", HARFLER[i]);
                  alanTemizle("dogru");
                }}
                onDegis={(d) => {
                  sikDegistir(i, d);
                  if (d.metin !== undefined) alanTemizle(`sik.${i}`);
                  if (d.aciklama !== undefined) alanTemizle(`aciklama.${i}`);
                }}
                ilk={mevcut ? [...mevcut.siklar].sort((a, b) => a.sira - b.sira)[i] : undefined}
                hata={hatalar[`sik.${i}`]}
                aciklamaHatasi={hatalar[`aciklama.${i}`]}
              />
            ))}
          </fieldset>
        </ComponentCard>

        {/* ── Çözüm ── */}
        <ComponentCard title="Çözüm" desc="Öğrenci raporunda her sorunun altında görünür.">
          <OnizlemeliMetin
            label="Çözüm"
            required
            value={icerik.cozum}
            onChange={(v) => {
              icerikDegistir("cozum", v);
              alanTemizle("cozum");
            }}
            ilkMetin={mevcut?.cozum}
            ilkHtml={mevcut?.cozumHtml}
            error={hatalar.cozum}
            rows={6}
          />
        </ComponentCard>
      </div>

      {/* ── Ayarlar ── */}
      <ComponentCard title="Zorluk ve durum">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p id="zorluk-etiketi" className="mb-1.5 text-sm font-medium text-gray-700">
              Zorluk <span className="font-normal text-gray-500">(isteğe bağlı)</span>
            </p>
            <div role="radiogroup" aria-labelledby="zorluk-etiketi" className="flex flex-wrap gap-2">
              {ZORLUKLAR.map((z) => {
                const secili = icerik.zorluk === z.deger;
                return (
                  <button
                    key={z.ad}
                    type="button"
                    role="radio"
                    aria-checked={secili}
                    onClick={() => icerikDegistir("zorluk", z.deger)}
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-sm transition",
                      secili ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {z.ad}
                  </button>
                );
              })}
            </div>
            {hatalar.zorluk ? <p className="mt-1.5 text-theme-xs text-error-600">{hatalar.zorluk}</p> : null}
          </div>
          <Switch
            checked={icerik.aktif}
            onChange={(e) => icerikDegistir("aktif", e.target.checked)}
            label="Aktif"
            description={icerik.aktif ? "Havuza girer, check-up'larda çıkabilir." : "Pasif: yeni check-up'lara gelmez."}
          />
        </div>
      </ComponentCard>

      {/* ── Kaydet çubuğu ── */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={bekliyor} startIcon={<Save />}>
            Kaydet
          </Button>
          {!duzenleme ? (
            <Button variant="soft" onClick={() => kaydet(true)} disabled={bekliyor} startIcon={<CopyPlus />}>
              Kaydet ve aynı konuya yeni
            </Button>
          ) : null}
          <span className="text-theme-xs text-gray-500">
            {kirli ? (
              <span className="font-medium text-warning-700">Kaydedilmemiş değişiklik var</span>
            ) : mevcut ? (
              "Değişiklik yok"
            ) : null}
            <span className="hidden sm:inline"> · Ctrl+S kaydet{!duzenleme ? " · Ctrl+Enter kaydet ve yeni" : ""}</span>
          </span>
        </div>
      </div>
    </form>
  );
}

function SikSatiri({
  harf,
  sik,
  dogru,
  onDogru,
  onDegis,
  ilk,
  hata,
  aciklamaHatasi,
}: {
  harf: Harf;
  sik: Sik;
  dogru: boolean;
  onDogru: () => void;
  onDegis: (d: Partial<Sik>) => void;
  ilk?: { metin: string; metinHtml: string };
  hata?: string;
  aciklamaHatasi?: string;
}) {
  const o = useOnizleme(sik.metin, ilk?.metin, ilk?.metinHtml);
  const id = `sik-${harf}`;
  const acik = sik.aciklamaAcik || Boolean(sik.aciklama);

  return (
    <div className={cx("rounded-xl border p-3 transition sm:p-4", dogru ? "border-success-500 bg-success-25" : "border-gray-200 bg-white")}>
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr] lg:items-start">
        <div className="flex items-center gap-3 lg:flex-col lg:items-center lg:pt-1">
          <span
            className={cx(
              "flex size-9 items-center justify-center rounded-full font-display text-sm font-semibold",
              dogru ? "bg-success-500 text-white" : "bg-gray-100 text-gray-700"
            )}
            aria-hidden
          >
            {harf}
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 text-theme-xs font-medium text-gray-700">
            <input
              type="radio"
              name="dogru-sik"
              checked={dogru}
              onChange={onDogru}
              className="size-4 cursor-pointer accent-success-600"
              aria-label={`${harf} şıkkı doğru`}
            />
            Doğru
          </label>
        </div>
        <Field label={`${harf} şıkkı`} error={hata} htmlFor={id}>
          <TextArea id={id} value={sik.metin} onChange={(e) => onDegis({ metin: e.target.value })} rows={2} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 max-lg:sr-only">Önizleme</p>
          <OnizlemeKutusu html={o.html} hata={o.hata} bekliyor={o.bekliyor} bos="—" kompakt />
        </div>
      </div>
      <div className="mt-2 lg:ps-14">
        {acik ? (
          <Field label={dogru ? "Açıklama" : "Neden yanlış?"} optional error={aciklamaHatasi}>
            <TextArea
              value={sik.aciklama}
              onChange={(e) => onDegis({ aciklama: e.target.value })}
              rows={2}
              placeholder={dogru ? "İsteğe bağlı not" : "Öğrencinin bu şıkkı neden seçmiş olabileceği, hatası"}
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => onDegis({ aciklamaAcik: true })}
            className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-brand-500 hover:text-brand-600"
          >
            <MessageSquareText className="size-3.5" aria-hidden />
            {dogru ? "Açıklama ekle" : "“Neden yanlış” açıklaması ekle"}
          </button>
        )}
      </div>
    </div>
  );
}

