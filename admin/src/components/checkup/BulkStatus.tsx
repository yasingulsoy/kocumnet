"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, X } from "lucide-react";
import { setQuestionsStatusAction } from "@/lib/checkup/actions/questions";
import { QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { buttonClass } from "./ui";

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

const EYLEMLER: { status: string; etiket: string; onay?: (n: number) => string }[] = [
  {
    status: "PUBLISHED",
    etiket: "Yayına al",
    onay: (n) => n + " soru yayına alınsın mı? Öğrenci testlerine seçilmeye başlar.",
  },
  { status: "REVIEW", etiket: "İncelemeye gönder" },
  { status: "DRAFT", etiket: "Taslağa çek" },
  {
    status: "ARCHIVED",
    etiket: "Arşivle",
    onay: (n) => n + " soru arşivlensin mi? Yeni testlere seçilmez; geçmiş sonuçlarda durur.",
  },
];

export function BulkProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [ham, setHam] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  const router = useRouter();

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

  const uygula = (status: string, onay?: (n: number) => string) => {
    const liste = [...secili];
    if (liste.length === 0) return;
    if (onay && !window.confirm(onay(liste.length))) return;
    start(async () => {
      const res = await setQuestionsStatusAction(liste, status);
      if (!res.ok) {
        toast.error(res.error ?? "Durum değiştirilemedi.");
        return;
      }
      const degisen = res.count ?? 0;
      toast.success(
        degisen === 0
          ? "Seçilen soruların hepsi zaten " + QUESTION_STATUS_LABEL[status].toLocaleLowerCase("tr-TR") + "."
          : degisen + " soru: " + QUESTION_STATUS_LABEL[status]
      );
      setHam(new Set());
      router.refresh();
    });
  };

  return (
    <BulkCtx.Provider value={ctx}>
      {children}

      {/* Sabit çubuk sayfa sonunu (sayfalama) örtmesin. */}
      {secili.size > 0 ? <div aria-hidden className="h-20" /> : null}

      {secili.size > 0 ? (
        <div
          role="region"
          aria-label="Toplu işlem"
          className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-pop backdrop-blur lg:start-[264px]"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-3 sm:px-6 lg:px-10">
            <p className="me-auto text-caption font-semibold text-ink" aria-live="polite">
              {secili.size} soru seçildi
            </p>
            {EYLEMLER.map((e) => (
              <button
                key={e.status}
                type="button"
                disabled={pending}
                onClick={() => uygula(e.status, e.onay)}
                className={buttonClass(e.status === "PUBLISHED" ? "primary" : e.status === "ARCHIVED" ? "danger" : "outline", "sm")}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {e.etiket}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => setHam(new Set())}
              className={buttonClass("ghost", "sm")}
              aria-label="Seçimi kaldır"
            >
              <X aria-hidden />
            </button>
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
    <input
      type="checkbox"
      checked={secili.has(id)}
      onChange={(e) => degistir(id, e.target.checked)}
      aria-label={label}
      className="mt-1 size-4 shrink-0 cursor-pointer accent-brand"
    />
  );
}

/** Sayfadaki hepsini seç / bırak. Kısmi seçimde "belirsiz" görünür. */
export function BulkSelectAll() {
  const { ids, secili, hepsi } = useBulk();
  const tum = ids.length > 0 && secili.size === ids.length;
  const kismi = secili.size > 0 && !tum;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-micro font-medium text-ink-soft">
      <input
        type="checkbox"
        checked={tum}
        ref={(el) => {
          if (el) el.indeterminate = kismi;
        }}
        onChange={(e) => hepsi(e.target.checked)}
        className="size-4 cursor-pointer accent-brand"
      />
      {secili.size > 0 ? secili.size + " / " + ids.length + " seçili" : "Bu sayfadakileri seç"}
    </label>
  );
}
