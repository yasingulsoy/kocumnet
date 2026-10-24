"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { setQuestionsStatusAction } from "@/lib/checkup/actions/questions";
import { QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { KILITLI_DENEME_MESAJI } from "@/lib/checkup/mock-rules";
import { listeAdresi, soruAdresi } from "@/lib/checkup/question-list";
import { yayinOzeti, type AtlamaOzeti } from "@/lib/checkup/soru-akisi";
import { cx } from "@/components/tailadmin/cx";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { useSidebar } from "@/components/tailadmin/layout/SidebarContext";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, type ButtonVariant } from "@/components/tailadmin/ui/Button";
import type { ConfirmOptions } from "@/components/tailadmin/ui/Dialogs";
import { useOnay } from "./Onay";

/**
 * Soru listesinde toplu durum değiştirme. Liste sunucuda çiziliyor; seçim
 * durumu bu sağlayıcıda, onay kutuları ve eylem çubuğu küçük istemci
 * adacıkları.
 *
 * Seçim yalnızca o an listede görünen soruları kapsar: sayfa ya da süzgeç
 * değişince görünmeyen bir soru gizlice seçili kalmaz.
 */

interface Ctx {
  ids: string[];
  secili: Set<string>;
  degistir: (id: string, acik: boolean) => void;
  hepsi: (acik: boolean) => void;
}

const BulkCtx = createContext<Ctx | null>(null);

function useBulk(): Ctx {
  const c = useContext(BulkCtx);
  if (!c) throw new Error("BulkProvider dışında kullanıldı.");
  return c;
}

const EYLEMLER: { status: string; etiket: string; variant: ButtonVariant; onay?: (n: number) => ConfirmOptions }[] = [
  {
    status: "PUBLISHED",
    etiket: "Yayına al",
    variant: "primary",
    onay: (n) => ({
      title: n + " soru yayına alınsın mı?",
      description: "Öğrenci testlerine seçilmeye başlar. Yayına hazır olmayanlar (çözüm, hata tipi, seviye…) atlanır; neden atlandıkları listede yazar.",
      confirmLabel: "Yayına al",
    }),
  },
  { status: "REVIEW", etiket: "İncelemeye gönder", variant: "outline" },
  { status: "DRAFT", etiket: "Taslağa çek", variant: "outline" },
  {
    status: "ARCHIVED",
    etiket: "Arşivle",
    variant: "danger-outline",
    onay: (n) => ({
      title: n + " soru arşivlensin mi?",
      description: "Yeni testlere seçilmez; geçmiş sonuçlarda durur.",
      confirmLabel: "Arşivle",
      tone: "warning",
    }),
  },
];

/**
 * `denemeleri`: yayındaki ve BAŞLATILMAMIŞ bir denemede olan soruların deneme
 * adları (soru kimliği → adlar). Yayından kaldıran toplu işlemden önce uyarılır.
 *
 * `kilitliler`: yayındaki ve başlatılmış bir denemede olan sorular. Yayından
 * kaldıran toplu işlem onları ATLAR (sunucu da atlar ve sayısını döner);
 * onayda kaç tanesinin yayında kalacağı söylenir.
 *
 * Yayına alma "yayına hazır mı" kapısından geçer (sunucuda): hazır olmayanlar
 * atlanır. Sonuç listenin üstünde kalıcı bir kutuda yazar ("12 soru yayına
 * alındı, 3 soru atlandı: çözüm yok (2), hata tipi eksik (1)"); her eksik
 * türü listenin `?eksik=` süzgecine bağlanır (`sorgu`: listenin süzgeci,
 * bağlantı onu korur).
 */
export function BulkProvider({
  ids,
  denemeleri = {},
  kilitliler = {},
  sorgu = "",
  children,
}: {
  ids: string[];
  denemeleri?: Record<string, string[]>;
  kilitliler?: Record<string, string[]>;
  sorgu?: string;
  children: ReactNode;
}) {
  const [ham, setHam] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  /** Hangi düğme çalışıyor: dönen halka yalnızca onda. */
  const [calisan, setCalisan] = useState<string | null>(null);
  /** Son toplu yayının atlananları: kutu kapatılana ya da yeni işleme kadar durur. */
  const [yayinSonucu, setYayinSonucu] = useState<{ metin: string; atlanan: AtlamaOzeti } | null>(null);
  const router = useRouter();
  const onayla = useOnay();
  // Sabit çubuk kenar çubuğunun yanından başlasın (geniş 290, dar 90 px).
  const { isExpanded } = useSidebar();

  // Listede artık olmayan kimlikler seçimden düşer.
  const secili = useMemo(() => new Set(ids.filter((id) => ham.has(id))), [ids, ham]);

  const ctx: Ctx = {
    ids,
    secili,
    degistir: (id, acik) =>
      setHam((prev) => {
        const s = new Set(prev);
        if (acik) s.add(id);
        else s.delete(id);
        return s;
      }),
    hepsi: (acik) => setHam(acik ? new Set(ids) : new Set()),
  };

  const uygula = async (status: string, onay?: (n: number) => ConfirmOptions) => {
    const liste = [...secili];
    if (liste.length === 0) return;
    const kaldiriliyor = status !== "PUBLISHED";
    // Başlatılmış denemenin sorusu yayında kalır (sunucu da atlar).
    const kilitli = kaldiriliyor ? liste.filter((id) => kilitliler[id]?.length) : [];
    if (kilitli.length === liste.length) {
      toast.error(
        (liste.length === 1 ? "" : "Seçilen " + liste.length + " sorunun hepsi başlatılmış denemelerde. ") + KILITLI_DENEME_MESAJI,
        { duration: 8000 }
      );
      return;
    }
    const kilitNotu = kilitli.length
      ? kilitli.length +
        " soru başlatılmış bir denemede (" +
        [...new Set(kilitli.flatMap((id) => kilitliler[id]))].join(", ") +
        "): yayında kalır, yanlışsa düzeltilir. "
      : "";
    // Denemedeki yayında soru yayından kalkarsa deneme eksik kalır: bu uyarı
    // eylemin kendi onayının yerine geçer (ikisini art arda sormayalım).
    const denemedeki = kaldiriliyor ? liste.filter((id) => denemeleri[id]?.length && !kilitliler[id]?.length) : [];
    if (denemedeki.length) {
      const adlar = [...new Set(denemedeki.flatMap((id) => denemeleri[id]))];
      const evet = await onayla({
        title: "Seçilenlerden " + denemedeki.length + " soru denemelerde kullanılıyor",
        description:
          adlar.join(", ") +
          ". " +
          QUESTION_STATUS_LABEL[status] +
          " durumuna alırsan bu denemeler eksik kalır ve öğrenci başlatamaz." +
          (kilitNotu ? " " + kilitNotu : ""),
        confirmLabel: "Yine de değiştir",
        tone: "warning",
      });
      if (!evet) return;
    } else if (kilitNotu) {
      const evet = await onayla({
        title: liste.length - kilitli.length + " soru " + QUESTION_STATUS_LABEL[status].toLocaleLowerCase("tr-TR") + " durumuna alınsın mı?",
        description: kilitNotu + "Ötekiler değişir.",
        confirmLabel: "Ötekileri değiştir",
        tone: "warning",
      });
      if (!evet) return;
    } else if (onay && !(await onayla(onay(liste.length)))) return;
    setCalisan(status);
    setYayinSonucu(null);
    start(async () => {
      const res = await setQuestionsStatusAction(liste, status);
      if (!res.ok) {
        toast.error(res.error ?? "Durum değiştirilemedi.");
        return;
      }
      if (status === "PUBLISHED" && res.atlanan?.toplam) {
        // Atlanan var: özet kalıcı kutuda (bağlantılarıyla), bildirim kısa.
        const metin = yayinOzeti(res.count ?? 0, res.atlanan);
        setYayinSonucu({ metin, atlanan: res.atlanan });
        toast(metin, { duration: 6000 });
        setHam(new Set());
        router.refresh();
        return;
      }
      if (res.degisen) toast.error(res.degisen + " soru bu arada değiştiği için yayına alınmadı; yeniden dene.", { duration: 6000 });
      const degisen = res.count ?? 0;
      toast.success(
        degisen === 0
          ? "Seçilen soruların hepsi zaten " + QUESTION_STATUS_LABEL[status].toLocaleLowerCase("tr-TR") + "."
          : degisen + " soru: " + QUESTION_STATUS_LABEL[status]
      );
      if (res.kilitli) toast.error(res.kilitli + " soru başlatılmış bir denemede olduğu için yayında kaldı.", { duration: 6000 });
      setHam(new Set());
      router.refresh();
    });
  };

  /** Atlananların süzgeci: listenin süzgeci korunur, `eksik` değişir, sayfa başa döner. */
  const eksikAdresi = (suzgec: string) => {
    const u = new URLSearchParams(sorgu);
    u.set("eksik", suzgec);
    u.delete("sayfa");
    return listeAdresi(u.toString());
  };

  return (
    <BulkCtx.Provider value={ctx}>
      {yayinSonucu ? (
        <Alert
          variant="warning"
          className="mb-4"
          title={yayinSonucu.metin}
          onClose={() => setYayinSonucu(null)}
          closeLabel="Sonucu kapat"
        >
          <span className="block">Atlanan sorular yayına hazır değil. Eksiği gider, sonra yeniden yayına al:</span>
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {yayinSonucu.atlanan.nedenler
              .filter((n) => n.suzgec)
              .map((n) => (
                <Link key={n.kod} href={eksikAdresi(n.suzgec!)} className="font-medium text-gray-800 underline underline-offset-2">
                  {n.etiket} ({n.sayi})
                </Link>
              ))}
          </span>
          {yayinSonucu.atlanan.sorular.length ? (
            <span className="mt-1.5 block">
              Süzgeci olmayan eksikler:{" "}
              {yayinSonucu.atlanan.sorular.map((s, i) => (
                <span key={s.id}>
                  {i ? " · " : ""}
                  <Link href={soruAdresi(s.id, sorgu)} className="font-medium text-gray-800 underline underline-offset-2" title={s.id}>
                    #{s.id.slice(-6)}
                  </Link>{" "}
                  ({s.etiket})
                </span>
              ))}
            </span>
          ) : null}
        </Alert>
      ) : null}
      {children}

      {/* Sabit çubuk sayfa sonunu (sayfalama) örtmesin. */}
      {secili.size > 0 ? <div aria-hidden className="h-24" /> : null}

      {secili.size > 0 ? (
        <div
          role="region"
          aria-label="Toplu işlem"
          className={cx(
            "pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 shadow-theme-xl backdrop-blur",
            isExpanded ? "lg:start-72.5" : "lg:start-22.5"
          )}
        >
          <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center gap-2 px-4 pt-3 md:px-6">
            <p className="me-auto text-theme-sm font-semibold text-gray-800" aria-live="polite">
              {secili.size} soru seçildi
            </p>
            {EYLEMLER.map((e) => (
              <Button
                key={e.status}
                variant={e.variant}
                size="xs"
                disabled={pending}
                loading={pending && calisan === e.status}
                onClick={() => void uygula(e.status, e.onay)}
              >
                {e.etiket}
              </Button>
            ))}
            <Button variant="ghost" size="xs" disabled={pending} onClick={() => setHam(new Set())} aria-label="Seçimi kaldır">
              <X aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </BulkCtx.Provider>
  );
}

/** Satır onay kutusu. `label` ekran okuyucuya hangi sorunun seçildiğini söyler. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const { secili, degistir } = useBulk();
  return (
    <span className="mt-0.5 flex shrink-0">
      <Checkbox checked={secili.has(id)} onChange={(e) => degistir(id, e.target.checked)} aria-label={label} />
    </span>
  );
}

/** Sayfadaki hepsini seç / bırak. Kısmi seçimde "belirsiz" görünür. */
export function BulkSelectAll() {
  const { ids, secili, hepsi } = useBulk();
  const tum = ids.length > 0 && secili.size === ids.length;
  const kismi = secili.size > 0 && !tum;
  return (
    <Checkbox
      checked={tum}
      indeterminate={kismi}
      onChange={(e) => hepsi(e.target.checked)}
      label={secili.size > 0 ? secili.size + " / " + ids.length + " seçili" : "Bu sayfadakileri seç"}
    />
  );
}
