"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ListPlus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Target,
  X,
} from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";
import { useBildirim } from "@/components/Bildirim";
import { useAyrilmaUyarisi } from "@/components/useAyrilmaUyarisi";
import { kodluAd, sayiyaCevir } from "@/lib/agac-yardimci";
import { aramaAnahtari, kisalt, sayi } from "@/lib/bicim";
import { ayarKaydet } from "@/lib/eylemler/ayarlar";
import { soruAra } from "@/lib/eylemler/sorular";
import type { Agac, CheckupAyari, Sayfali, SabitSoru, Secim, SoruOzeti } from "@/lib/tipler";

/**
 * Check-up ayarları: her tür için bir kart. Durum istemcide; "Kaydet" PUT'u
 * çağırır ve dönen nesneyle (hazırlık dahil) kartı günceller. Sayfa
 * yenilenmez: öteki kartlardaki kaydedilmemiş değişiklikler korunur.
 */

interface Satir {
  anahtar: string;
  konuId: number | null;
  kazanimId: number | null;
  soruSayisi: string;
  /** Ağaçta bulunamazsa (silinmiş düğüm) sunucunun verdiği ad. */
  ad: string;
  ustAd: string;
}

interface KartDurumu {
  secim: Secim;
  recete: Satir[];
  sabit: SabitSoru[];
}

interface HedefBilgisi {
  tur: "konu" | "kazanim";
  id: number;
  ad: string;
  ustAd: string;
  dersAd: string;
  soru: number;
  /** Kazanımın konusu; konuda kendisi. */
  konuId: number;
}

const anahtar = (tur: "konu" | "kazanim", id: number) => `${tur}-${id}`;

function durumOlustur(a: CheckupAyari): KartDurumu {
  return {
    secim: a.secim,
    recete: a.recete.map((r) => ({
      anahtar: r.kazanimId ? anahtar("kazanim", r.kazanimId) : anahtar("konu", r.konuId ?? 0),
      konuId: r.kazanimId ? null : r.konuId,
      kazanimId: r.kazanimId,
      soruSayisi: String(r.soruSayisi),
      ad: r.ad,
      ustAd: r.ustAd,
    })),
    sabit: [...a.sabitSorular].sort((x, y) => x.sira - y.sira),
  };
}

function imza(d: KartDurumu) {
  return JSON.stringify([d.secim, d.recete.map((r) => [r.anahtar, r.soruSayisi.trim()]), d.sabit.map((s) => s.soruId)]);
}

function hedefHaritasi(agac: Agac): Map<string, HedefBilgisi> {
  const m = new Map<string, HedefBilgisi>();
  for (const d of agac.dersler) {
    for (const k of d.konular) {
      m.set(anahtar("konu", k.id), { tur: "konu", id: k.id, ad: k.ad, ustAd: d.ad, dersAd: d.ad, soru: k.soruSayisi, konuId: k.id });
      for (const z of k.kazanimlar) {
        m.set(anahtar("kazanim", z.id), {
          tur: "kazanim",
          id: z.id,
          ad: kodluAd(z),
          ustAd: `${d.ad} › ${k.ad}`,
          dersAd: d.ad,
          soru: z.soruSayisi,
          konuId: k.id,
        });
      }
    }
  }
  return m;
}

export function CheckupAyarlari({ agac, ayarlar }: { agac: Agac; ayarlar: CheckupAyari[] }) {
  const [kayitlilar, setKayitlilar] = useState<Record<number, CheckupAyari>>(() => Object.fromEntries(ayarlar.map((a) => [a.tur.id, a])));
  const [durumlar, setDurumlar] = useState<Record<number, KartDurumu>>(() =>
    Object.fromEntries(ayarlar.map((a) => [a.tur.id, durumOlustur(a)]))
  );
  const hedefler = useMemo(() => hedefHaritasi(agac), [agac]);

  const kirliler = ayarlar.filter((a) => imza(durumlar[a.tur.id]) !== imza(durumOlustur(kayitlilar[a.tur.id]))).map((a) => a.tur.id);
  const ayrilmaPenceresi = useAyrilmaUyarisi(kirliler.length > 0);

  if (ayarlar.length === 0) {
    return (
      <ComponentCard title="Check-up türü yok">
        <EmptyState
          icon={<Target />}
          title="Önce bir check-up türü gerekli"
          description="Hızlı ya da Kapsamlı gibi türler eklenince her biri için burada bir kart çıkar."
          action={
            <Link href="/turler" className="text-sm font-medium text-brand-500 hover:underline">
              Check-up türleri
            </Link>
          }
        />
      </ComponentCard>
    );
  }

  return (
    <div className="space-y-6">
      {ayrilmaPenceresi}
      {kirliler.length > 1 ? (
        <Alert variant="warning" compact>
          {kirliler.length} türde kaydedilmemiş değişiklik var; her kartı kendi &quot;Kaydet&quot; düğmesiyle kaydedin.
        </Alert>
      ) : null}
      {ayarlar.map((a) => (
        <TurKarti
          key={a.tur.id}
          sinavId={agac.sinav.id}
          agac={agac}
          hedefler={hedefler}
          kayitli={kayitlilar[a.tur.id]}
          durum={durumlar[a.tur.id]}
          kirli={kirliler.includes(a.tur.id)}
          setDurum={(fn) => setDurumlar((d) => ({ ...d, [a.tur.id]: fn(d[a.tur.id]) }))}
          onKaydedildi={(yeni) => {
            setKayitlilar((k) => ({ ...k, [a.tur.id]: yeni }));
            setDurumlar((d) => ({ ...d, [a.tur.id]: durumOlustur(yeni) }));
          }}
        />
      ))}
    </div>
  );
}

function TurKarti({
  sinavId,
  agac,
  hedefler,
  kayitli,
  durum,
  kirli,
  setDurum,
  onKaydedildi,
}: {
  sinavId: number;
  agac: Agac;
  hedefler: Map<string, HedefBilgisi>;
  kayitli: CheckupAyari;
  durum: KartDurumu;
  kirli: boolean;
  setDurum: (fn: (d: KartDurumu) => KartDurumu) => void;
  onKaydedildi: (a: CheckupAyari) => void;
}) {
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState<{ mesaj: string; ek: string[] } | null>(null);
  const [satirHatalari, setSatirHatalari] = useState<Record<string, string>>({});
  const bildir = useBildirim();
  const tur = kayitli.tur;
  const h = kayitli.hazirlik;

  function kaydet() {
    const hatalar: Record<string, string> = {};
    for (const r of durum.recete) {
      const n = Number(r.soruSayisi);
      if (!Number.isInteger(n) || n < 1) hatalar[r.anahtar] = "En az 1 olmalı.";
    }
    setSatirHatalari(hatalar);
    if (Object.keys(hatalar).length) {
      setHata({ mesaj: "Reçetede geçersiz soru sayısı var.", ek: [] });
      return;
    }
    setHata(null);
    gecis(async () => {
      const r = await ayarKaydet(sinavId, tur.id, {
        secim: durum.secim,
        recete: durum.recete.map((x) =>
          x.kazanimId ? { kazanimId: x.kazanimId, soruSayisi: Number(x.soruSayisi) } : { konuId: x.konuId!, soruSayisi: Number(x.soruSayisi) }
        ),
        sabitSoruIdleri: durum.sabit.map((s) => s.soruId),
      });
      if (r.ok) {
        onKaydedildi(r.veri);
        if (r.veri.hazirlik.hazir) bildir.basari(`${tur.ad}: kaydedildi, hazır.`);
        else bildir.bilgi(`${tur.ad}: kaydedildi ama henüz hazır değil. Sorunlar kartta yazıyor.`);
      } else {
        setHata({ mesaj: r.mesaj, ek: Object.entries(r.alanlar ?? {}).map(([k, v]) => `${k}: ${v}`) });
      }
    });
  }

  return (
    <ComponentCard
      id={`tur-${tur.id}`}
      className="scroll-mt-24"
      tone={kirli ? "brand" : "default"}
      title={tur.ad}
      badge={
        <span className="flex flex-wrap gap-1.5">
          {h.hazir ? (
            <Badge size="sm" color="success" startIcon={<CheckCircle2 className="size-3.5" />}>
              Hazır
            </Badge>
          ) : (
            <Badge size="sm" color="warning" startIcon={<CircleAlert className="size-3.5" />}>
              Hazır değil
            </Badge>
          )}
          {!tur.aktif ? (
            <Badge size="sm" color="light">
              Pasif tür
            </Badge>
          ) : null}
          {kirli ? (
            <Badge size="sm" color="info">
              Kaydedilmemiş değişiklik
            </Badge>
          ) : null}
        </span>
      }
      desc={`${sayi(tur.soruSayisi)} soru · ${sayi(tur.sureDakika)} dk`}
      actions={
        <SegmentedTabs
          label={`${tur.ad} seçim biçimi`}
          items={[
            { key: "KARMA", label: "Karma", active: durum.secim === "KARMA", onClick: () => setDurum((d) => ({ ...d, secim: "KARMA" })) },
            { key: "SABIT", label: "Sabit", active: durum.secim === "SABIT", onClick: () => setDurum((d) => ({ ...d, secim: "SABIT" })) },
          ]}
        />
      }
    >
      <div className="space-y-5">
        {!h.hazir && h.sorunlar.length ? (
          <Alert variant="warning" title="Öğrenci bu türü başlatamaz" compact>
            <ul className="list-disc space-y-0.5 ps-4">
              {h.sorunlar.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {kirli ? <p className="mt-1 text-theme-xs">Bu liste son kayda göre; kaydedince yeniden hesaplanır.</p> : null}
          </Alert>
        ) : null}

        <p className="text-sm text-gray-500">
          {durum.secim === "KARMA"
            ? "Karma: reçetedeki her konu ya da kazanımdan istenen sayıda soru, aktif sorular arasından rastgele seçilir. Önce kazanım satırları, sonra konu satırları doldurulur; öğrencinin daha önce gördüğü sorular havuz yetiyorsa gelmez."
            : "Sabit: her öğrenciye aynı sorular bu sırayla gelir. Listede tam tür soru sayısı kadar aktif soru olmalı."}
        </p>

        {durum.secim === "KARMA" ? (
          <ReceteDuzenleyici agac={agac} hedefler={hedefler} tur={tur} durum={durum} setDurum={setDurum} satirHatalari={satirHatalari} />
        ) : (
          <SabitListe sinavId={sinavId} agac={agac} tur={tur} durum={durum} setDurum={setDurum} />
        )}

        {hata ? (
          <Alert variant="error" title="Kaydedilemedi" onClose={() => setHata(null)}>
            {hata.mesaj}
            {hata.ek.length ? (
              <ul className="mt-1 list-disc ps-5">
                {hata.ek.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <Button onClick={kaydet} loading={bekliyor} disabled={!kirli && !bekliyor} startIcon={<Save />}>
            Kaydet
          </Button>
          {kirli ? (
            <Button
              variant="ghost"
              size="xs"
              startIcon={<RotateCcw />}
              onClick={() => {
                setDurum(() => durumOlustur(kayitli));
                setHata(null);
                setSatirHatalari({});
              }}
            >
              Değişiklikleri geri al
            </Button>
          ) : (
            <span className="text-theme-xs text-gray-500">Kaydedilmiş hâlde.</span>
          )}
          <span className="text-theme-xs text-gray-500 sm:ms-auto">
            Karma ve sabit ayar ayrı ayrı saklanır; seçim biçimini değiştirmek ötekini silmez.
          </span>
        </div>
      </div>
    </ComponentCard>
  );
}

// ─── Karma: reçete ───────────────────────────────────────────

function ReceteDuzenleyici({
  agac,
  hedefler,
  tur,
  durum,
  setDurum,
  satirHatalari,
}: {
  agac: Agac;
  hedefler: Map<string, HedefBilgisi>;
  tur: CheckupAyari["tur"];
  durum: KartDurumu;
  setDurum: (fn: (d: KartDurumu) => KartDurumu) => void;
  satirHatalari: Record<string, string>;
}) {
  /** null: kapalı; "yeni": satır ekle; anahtar: o satırın hedefini değiştir. */
  const [secici, setSecici] = useState<string | null>(null);

  const toplam = durum.recete.reduce((t, r) => t + (Number(r.soruSayisi) || 0), 0);
  const gereken = tur.soruSayisi;

  // Konu satırının kullanılabilir havuzu: konudaki aktif sorulardan, aynı konunun
  // kazanım satırlarının istediği sayı düşülür (API.md "Hazırlık").
  const kazanimTalebi = new Map<number, number>();
  for (const r of durum.recete) {
    const b = r.kazanimId ? hedefler.get(r.anahtar) : undefined;
    if (b) kazanimTalebi.set(b.konuId, (kazanimTalebi.get(b.konuId) ?? 0) + (Number(r.soruSayisi) || 0));
  }

  function hedefSecildi(h: HedefBilgisi) {
    const yeniAnahtar = anahtar(h.tur, h.id);
    setDurum((d) => {
      const satir: Satir = {
        anahtar: yeniAnahtar,
        konuId: h.tur === "konu" ? h.id : null,
        kazanimId: h.tur === "kazanim" ? h.id : null,
        soruSayisi: "1",
        ad: h.ad,
        ustAd: h.ustAd,
      };
      if (secici === "yeni") {
        const kalan = gereken - d.recete.reduce((t, r) => t + (Number(r.soruSayisi) || 0), 0);
        satir.soruSayisi = String(Math.max(1, Math.min(kalan, h.soru || 1)));
        return { ...d, recete: [...d.recete, satir] };
      }
      return {
        ...d,
        recete: d.recete.map((r) => (r.anahtar === secici ? { ...satir, soruSayisi: r.soruSayisi } : r)),
      };
    });
    setSecici(null);
  }

  const kullanilan = new Set(durum.recete.map((r) => r.anahtar));

  return (
    <div className="space-y-3">
      {durum.recete.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center">
          <p className="text-sm text-gray-600">Reçete boş. Hangi konudan ya da kazanımdan kaç soru geleceğini satır satır ekleyin.</p>
          <Button size="xs" className="mt-3" startIcon={<Plus />} onClick={() => setSecici("yeni")} disabled={agac.dersler.length === 0}>
            İlk satırı ekle
          </Button>
          {agac.dersler.length === 0 ? <p className="mt-2 text-theme-xs text-gray-500">Önce konu ağacını girin.</p> : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-start text-theme-xs text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  Hedef
                </th>
                <th scope="col" className="w-32 px-4 py-2.5 text-start font-medium">
                  Soru sayısı
                </th>
                <th scope="col" className="w-40 px-4 py-2.5 text-start font-medium">
                  Havuz (aktif soru)
                </th>
                <th scope="col" className="w-12 px-2 py-2.5">
                  <span className="sr-only">Sil</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {durum.recete.map((r) => {
                const b = hedefler.get(r.anahtar);
                const istenen = Number(r.soruSayisi) || 0;
                const havuz = b ? (b.tur === "konu" ? b.soru - (kazanimTalebi.get(b.id) ?? 0) : b.soru) : null;
                const yetmiyor = havuz !== null && istenen > havuz;
                return (
                  <tr key={r.anahtar} className={cx(yetmiyor && "bg-warning-25")}>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSecici(r.anahtar)}
                        className="group flex w-full items-start gap-2 text-start"
                        title="Hedefi değiştir"
                      >
                        <Badge size="sm" color={r.kazanimId ? "info" : "primary"}>
                          {r.kazanimId ? "Kazanım" : "Konu"}
                        </Badge>
                        <span className="min-w-0">
                          <span className="block text-theme-xs text-gray-500">{b?.ustAd ?? r.ustAd}</span>
                          <span className="block text-gray-800 group-hover:text-brand-600 group-hover:underline">{b?.ad ?? r.ad}</span>
                          {!b ? <span className="block text-theme-xs text-error-600">Ağaçta bulunamadı; satırı silin ya da değiştirin.</span> : null}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <Input
                        compact
                        type="number"
                        min={1}
                        value={r.soruSayisi}
                        error={Boolean(satirHatalari[r.anahtar])}
                        aria-label={`${b?.ad ?? r.ad} soru sayısı`}
                        onChange={(e) =>
                          setDurum((d) => ({ ...d, recete: d.recete.map((x) => (x.anahtar === r.anahtar ? { ...x, soruSayisi: e.target.value } : x)) }))
                        }
                        wrapperClassName="w-24"
                      />
                      {satirHatalari[r.anahtar] ? <p className="mt-1 text-theme-xs text-error-600">{satirHatalari[r.anahtar]}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      {havuz === null ? (
                        "—"
                      ) : (
                        <span className={cx("tabular", yetmiyor ? "font-medium text-warning-700" : "text-gray-700")}>
                          {sayi(havuz)}
                          {b?.tur === "konu" && (kazanimTalebi.get(b.id) ?? 0) > 0 ? (
                            <span className="block text-theme-xs font-normal text-gray-500">
                              {sayi(b.soru)} − {sayi(kazanimTalebi.get(b.id) ?? 0)} kazanım satırlarına
                            </span>
                          ) : null}
                          {yetmiyor ? <span className="block text-theme-xs">Havuz yetmiyor</span> : null}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-end align-top">
                      <button
                        type="button"
                        onClick={() => setDurum((d) => ({ ...d, recete: d.recete.filter((x) => x.anahtar !== r.anahtar) }))}
                        aria-label={`${b?.ad ?? r.ad} satırını sil`}
                        title="Satırı sil"
                        className="flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-error-50 hover:text-error-600"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-2.5">
                  <Button size="xs" variant="outline" startIcon={<Plus />} onClick={() => setSecici("yeni")}>
                    Satır ekle
                  </Button>
                </td>
                <td colSpan={3} className="px-4 py-2.5">
                  <span className={cx("font-medium tabular", toplam === gereken ? "text-success-700" : "text-warning-700")}>
                    Toplam {sayi(toplam)} / gereken {sayi(gereken)}
                  </span>
                  {toplam !== gereken ? (
                    <span className="ms-2 text-theme-xs text-gray-500">
                      {toplam < gereken ? `${sayi(gereken - toplam)} eksik` : `${sayi(toplam - gereken)} fazla`}
                    </span>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {secici ? (
        <HedefSecici
          agac={agac}
          kullanilan={kullanilan}
          mevcut={secici === "yeni" ? null : secici}
          onSec={hedefSecildi}
          onKapat={() => setSecici(null)}
          hedefler={hedefler}
        />
      ) : null}
    </div>
  );
}

function HedefSecici({
  agac,
  hedefler,
  kullanilan,
  mevcut,
  onSec,
  onKapat,
}: {
  agac: Agac;
  hedefler: Map<string, HedefBilgisi>;
  kullanilan: Set<string>;
  mevcut: string | null;
  onSec: (h: HedefBilgisi) => void;
  onKapat: () => void;
}) {
  const [ara, setAra] = useState("");
  const q = aramaAnahtari(ara.trim());
  const uyar = (...metinler: string[]) => !q || metinler.some((m) => aramaAnahtari(m).includes(q));

  const gruplar = agac.dersler
    .map((d) => ({
      ders: d,
      konular: d.konular
        .map((k) => {
          const konuEslesir = uyar(d.ad, k.ad);
          const kazanimlar = k.kazanimlar.filter((z) => konuEslesir || uyar(z.ad, z.kod ?? ""));
          return { konu: k, gorunur: konuEslesir || kazanimlar.length > 0, kazanimlar };
        })
        .filter((x) => x.gorunur),
    }))
    .filter((g) => g.konular.length > 0);

  function secenekSatiri(a: string, girinti: boolean) {
    const h = hedefler.get(a);
    if (!h) return null;
    const dolu = kullanilan.has(a) && a !== mevcut;
    return (
      <button
        type="button"
        disabled={dolu}
        onClick={() => onSec(h)}
        className={cx(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition",
          girinti && "ps-8",
          a === mevcut ? "bg-brand-50" : "",
          dolu ? "cursor-not-allowed text-gray-400" : "text-gray-800 hover:bg-gray-50"
        )}
      >
        <Badge size="sm" color={h.tur === "kazanim" ? "info" : "primary"}>
          {h.tur === "kazanim" ? "Kazanım" : "Konu"}
        </Badge>
        <span className={cx("min-w-0 flex-1", h.tur === "konu" && "font-medium")}>{h.ad}</span>
        <span className="shrink-0 text-theme-xs text-gray-500">{dolu ? "reçetede" : `${sayi(h.soru)} soru`}</span>
      </button>
    );
  }

  return (
    <Modal isOpen onClose={onKapat} title={mevcut ? "Hedefi değiştir" : "Reçeteye satır ekle"} description="Konu ya da kazanım seçin. Konu satırı, o konunun bütün kazanımlarından seçer." size="lg">
      <div className="space-y-3">
        <Input
          type="search"
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Ders, konu, kazanım adı ya da kodu…"
          aria-label="Hedef ara"
          startIcon={<Search className="size-4" />}
          autoFocus
        />
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pe-1">
          {gruplar.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{agac.dersler.length ? "Eşleşen konu ya da kazanım yok." : "Konu ağacı boş."}</p>
          ) : (
            gruplar.map((g) => (
              <section key={g.ders.id}>
                <h3 className="mb-1 px-3 text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">{g.ders.ad}</h3>
                <div className="space-y-0.5">
                  {g.konular.map(({ konu, kazanimlar }) => (
                    <div key={konu.id}>
                      {secenekSatiri(anahtar("konu", konu.id), false)}
                      {kazanimlar.map((z) => (
                        <div key={z.id}>{secenekSatiri(anahtar("kazanim", z.id), true)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Sabit liste ─────────────────────────────────────────────

function SabitListe({
  sinavId,
  agac,
  tur,
  durum,
  setDurum,
}: {
  sinavId: number;
  agac: Agac;
  tur: CheckupAyari["tur"];
  durum: KartDurumu;
  setDurum: (fn: (d: KartDurumu) => KartDurumu) => void;
}) {
  const [panelAcik, setPanelAcik] = useState(durum.sabit.length < tur.soruSayisi);
  const n = durum.sabit.length;
  const gereken = tur.soruSayisi;
  const pasifSayisi = durum.sabit.filter((s) => !s.aktif).length;

  function tasi(i: number, yon: -1 | 1) {
    setDurum((d) => {
      const j = i + yon;
      if (j < 0 || j >= d.sabit.length) return d;
      const y = [...d.sabit];
      [y[i], y[j]] = [y[j], y[i]];
      return { ...d, sabit: y };
    });
  }

  function ekle(sorular: SoruOzeti[]) {
    setDurum((d) => {
      const var_ = new Set(d.sabit.map((s) => s.soruId));
      const yeni = sorular
        .filter((s) => !var_.has(s.id))
        .map((s, i) => ({ soruId: s.id, sira: d.sabit.length + i + 1, metin: kisalt(s.metin, 120), konu: s.konu, aktif: s.aktif }));
      return { ...d, sabit: [...d.sabit, ...yeni] };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cx("font-medium tabular", n === gereken ? "text-success-700" : "text-warning-700")}>
          {sayi(n)} / {sayi(gereken)} soru
        </span>
        {n !== gereken ? (
          <span className="text-theme-xs text-gray-500">{n < gereken ? `${sayi(gereken - n)} eksik` : `${sayi(n - gereken)} fazla`}</span>
        ) : null}
        {pasifSayisi ? (
          <Badge size="sm" color="warning">
            {sayi(pasifSayisi)} pasif soru
          </Badge>
        ) : null}
        <Button size="xs" variant={panelAcik ? "ghost" : "outline"} className="ms-auto" startIcon={<ListPlus />} onClick={() => setPanelAcik((a) => !a)}>
          {panelAcik ? "Ekleme panelini kapat" : "Soru ekle"}
        </Button>
      </div>

      {panelAcik ? <SoruEklePaneli sinavId={sinavId} agac={agac} secili={new Set(durum.sabit.map((s) => s.soruId))} onEkle={ekle} /> : null}

      {n === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-600">
          Liste boş. &quot;Soru ekle&quot; panelinden soruları seçin; sıralarını sonra değiştirebilirsiniz.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader align="end">
                  Sıra
                </TableCell>
                <TableCell isHeader>Soru</TableCell>
                <TableCell isHeader>Konu</TableCell>
                <TableCell isHeader align="end">
                  <span className="sr-only">İşlemler</span>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {durum.sabit.map((s, i) => (
                <TableRow key={s.soruId} className={cx(!s.aktif && "bg-warning-25")}>
                  <TableCell align="end" className="tabular">
                    {i + 1}
                  </TableCell>
                  <TableCell className="w-full max-w-0 min-w-64">
                    <span className="flex items-start gap-2">
                      <Link href={`/sorular/${s.soruId}`} target="_blank" className="shrink-0 text-theme-xs text-brand-500 hover:underline">
                        #{s.soruId}
                      </Link>
                      <span className="line-clamp-2 text-gray-800">{s.metin}</span>
                    </span>
                    {!s.aktif ? <span className="mt-0.5 block text-theme-xs font-medium text-warning-700">Pasif soru: liste hazır sayılmaz.</span> : null}
                  </TableCell>
                  <TableCell className="min-w-36 text-gray-600">{s.konu}</TableCell>
                  <TableCell align="end" nowrap>
                    <span className="flex justify-end gap-0.5">
                      <KucukDugme etiket={`#${s.soruId} yukarı`} onClick={() => tasi(i, -1)} disabled={i === 0}>
                        <ArrowUp />
                      </KucukDugme>
                      <KucukDugme etiket={`#${s.soruId} aşağı`} onClick={() => tasi(i, 1)} disabled={i === n - 1}>
                        <ArrowDown />
                      </KucukDugme>
                      <KucukDugme
                        etiket={`#${s.soruId} listeden çıkar`}
                        tehlike
                        onClick={() => setDurum((d) => ({ ...d, sabit: d.sabit.filter((x) => x.soruId !== s.soruId) }))}
                      >
                        <X />
                      </KucukDugme>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KucukDugme({
  etiket,
  onClick,
  disabled,
  tehlike,
  children,
}: {
  etiket: string;
  onClick: () => void;
  disabled?: boolean;
  tehlike?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiket}
      title={etiket}
      className={cx(
        "flex size-8 items-center justify-center rounded-md text-gray-500 transition disabled:opacity-30 [&_svg]:size-4",
        tehlike ? "enabled:hover:bg-error-50 enabled:hover:text-error-600" : "enabled:hover:bg-gray-100 enabled:hover:text-gray-800"
      )}
    >
      {children}
    </button>
  );
}

function SoruEklePaneli({
  sinavId,
  agac,
  secili,
  onEkle,
}: {
  sinavId: number;
  agac: Agac;
  secili: Set<number>;
  onEkle: (s: SoruOzeti[]) => void;
}) {
  const [dersId, setDersId] = useState<number | null>(null);
  const [konuId, setKonuId] = useState<number | null>(null);
  const [ara, setAra] = useState("");
  const [yalnizAktif, setYalnizAktif] = useState(true);
  const [sonuc, setSonuc] = useState<Sayfali<SoruOzeti> | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, gecis] = useTransition();

  const ders = agac.dersler.find((d) => d.id === dersId);

  function getir(sayfa: number, f = { dersId, konuId, ara, yalnizAktif }) {
    setHata(null);
    gecis(async () => {
      const r = await soruAra({ sinavId, dersId: f.dersId, konuId: f.konuId, ara: f.ara, aktif: f.yalnizAktif ? true : null, sayfa });
      if (r.ok) setSonuc(r.veri);
      else setHata(r.mesaj);
    });
  }

  const toplamSayfa = sonuc ? Math.max(1, Math.ceil(sonuc.toplam / (sonuc.boyut || 20))) : 1;
  const eklenebilir = sonuc?.kayitlar.filter((s) => !secili.has(s.id)) ?? [];

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-25 p-4">
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          getir(1);
        }}
      >
        <Select
          compact
          aria-label="Ders"
          value={dersId ? String(dersId) : ""}
          onChange={(e) => {
            const d = sayiyaCevir(e.target.value);
            setDersId(d);
            setKonuId(null);
            getir(1, { dersId: d, konuId: null, ara, yalnizAktif });
          }}
        >
          <option value="">Bütün dersler</option>
          {agac.dersler.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ad}
            </option>
          ))}
        </Select>
        <Select
          compact
          aria-label="Konu"
          disabled={!ders}
          value={konuId ? String(konuId) : ""}
          onChange={(e) => {
            const k = sayiyaCevir(e.target.value);
            setKonuId(k);
            getir(1, { dersId, konuId: k, ara, yalnizAktif });
          }}
        >
          <option value="">{ders ? "Bütün konular" : "Önce ders seçin"}</option>
          {ders?.konular.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </Select>
        <Input
          compact
          type="search"
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Metinde ara…"
          aria-label="Soru metninde ara"
          startIcon={<Search className="size-4" />}
        />
        <Button type="submit" size="xs" loading={bekliyor}>
          Ara
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Checkbox
          checked={yalnizAktif}
          onChange={(e) => {
            setYalnizAktif(e.target.checked);
            if (sonuc) getir(1, { dersId, konuId, ara, yalnizAktif: e.target.checked });
          }}
          label="Yalnızca aktif sorular"
        />
        {sonuc ? (
          <span className="text-theme-xs text-gray-500">
            {sayi(sonuc.toplam)} sonuç
            {toplamSayfa > 1 ? ` · sayfa ${sayi(sonuc.sayfa)} / ${sayi(toplamSayfa)}` : ""}
          </span>
        ) : null}
        {eklenebilir.length > 1 ? (
          <Button size="xs" variant="outline" className="ms-auto" startIcon={<ListPlus />} onClick={() => onEkle(eklenebilir)}>
            Bu sayfadakileri ekle ({eklenebilir.length})
          </Button>
        ) : null}
      </div>

      {hata ? (
        <Alert variant="error" compact className="mt-3">
          {hata}
        </Alert>
      ) : null}

      {!sonuc ? (
        <p className="mt-4 text-sm text-gray-600">Ders/konu seçin ya da &quot;Ara&quot;ya basın; sonuçlar burada listelenir.</p>
      ) : sonuc.kayitlar.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">Bu süzgeçlere uyan soru yok.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {sonuc.kayitlar.map((s) => {
            const listede = secili.has(s.id);
            return (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-gray-800">
                    <span className="me-1.5 text-theme-xs text-gray-500">#{s.id}</span>
                    {kisalt(s.metin, 160)}
                  </span>
                  <span className="mt-0.5 block text-theme-xs text-gray-500">
                    {s.ders} › {s.konu} · {s.kazanim}
                    {!s.aktif ? <span className="ms-1 font-medium text-warning-700">· pasif</span> : null}
                  </span>
                </span>
                {listede ? (
                  <Badge size="sm" color="success" startIcon={<CheckCircle2 className="size-3.5" />}>
                    Listede
                  </Badge>
                ) : (
                  <Button size="xs" variant="outline" startIcon={<Plus />} onClick={() => onEkle([s])}>
                    Ekle
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sonuc && toplamSayfa > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="xs" variant="outline" startIcon={<ChevronLeft className="rtl:rotate-180" />} disabled={sonuc.sayfa <= 1 || bekliyor} onClick={() => getir(sonuc.sayfa - 1)}>
            Önceki
          </Button>
          <Button size="xs" variant="outline" endIcon={<ChevronRight className="rtl:rotate-180" />} disabled={sonuc.sayfa >= toplamSayfa || bekliyor} onClick={() => getir(sonuc.sayfa + 1)}>
            Sonraki
          </Button>
        </div>
      ) : null}
    </div>
  );
}
