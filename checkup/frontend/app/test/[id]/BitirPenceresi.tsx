"use client";

import { useRef } from "react";
import { CircleCheck, CircleDashed, Flag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal } from "@/components/tailadmin/ui/Modal";

/** Diyalogda listelenen en fazla boş soru numarası. */
const EN_FAZLA = 30;

/**
 * "Testi bitir" onayı. Boş soru varsa sayısını söyler, numaralarını
 * listeler ve önce onlara dönmeyi önerir (odak "Boş sorulara dön"de başlar).
 */
export function BitirPenceresi({
  acik,
  kapat,
  soruSayisi,
  bosIndeksler,
  kaydedilemeyen,
  onBosaDon,
  onBitir,
}: {
  acik: boolean;
  kapat: () => void;
  soruSayisi: number;
  /** Boş soruların dizindeki yeri (0'dan). */
  bosIndeksler: number[];
  kaydedilemeyen: number;
  onBosaDon: (indeks: number) => void;
  onBitir: () => void;
}) {
  const bosaDonDugmesi = useRef<HTMLButtonElement>(null);
  const bitirDugmesi = useRef<HTMLButtonElement>(null);
  const bos = bosIndeksler.length;
  const cevaplanan = soruSayisi - bos;

  return (
    <Modal
      isOpen={acik}
      onClose={kapat}
      size="sm"
      title="Testi bitirmek istiyor musun?"
      description="Bitirince cevaplarını değiştiremezsin; raporun hemen hazırlanır."
      initialFocusRef={bos > 0 ? bosaDonDugmesi : bitirDugmesi}
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success-50 p-3">
            <dt className="flex items-center gap-1.5 text-caption font-medium text-success-700">
              <CircleCheck className="size-4" aria-hidden />
              Cevaplanan
            </dt>
            <dd className="tabular mt-1 font-display text-num-sm font-semibold text-gray-800">{cevaplanan}</dd>
          </div>
          <div className={bos > 0 ? "rounded-xl bg-warning-50 p-3" : "rounded-xl bg-gray-50 p-3"}>
            <dt className={bos > 0 ? "flex items-center gap-1.5 text-caption font-medium text-warning-700" : "flex items-center gap-1.5 text-caption font-medium text-gray-600"}>
              <CircleDashed className="size-4" aria-hidden />
              Boş
            </dt>
            <dd className="tabular mt-1 font-display text-num-sm font-semibold text-gray-800">{bos}</dd>
          </div>
        </dl>

        {bos > 0 ? (
          <div>
            <p className="text-sm text-gray-700">
              {bos === 1 ? "1 soruyu boş bıraktın." : `${bos} soruyu boş bıraktın.`} Süren varsa bir göz atmak ister misin?
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Boş sorular">
              {bosIndeksler.slice(0, EN_FAZLA).map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onBosaDon(i)}
                    className="tabular flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 ring-inset transition hover:bg-gray-50"
                    aria-label={`${i + 1}. soruya git`}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
              {bos > EN_FAZLA ? (
                <li className="flex h-11 items-center px-1 text-sm text-gray-500">ve {bos - EN_FAZLA} soru daha</li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-700">Bütün soruları cevapladın. Eline sağlık!</p>
        )}

        {kaydedilemeyen > 0 ? (
          <p className="flex gap-2 rounded-xl bg-error-50 p-3 text-sm text-error-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {kaydedilemeyen} cevabın henüz kaydedilemedi. Bitirirken bir kez daha göndermeyi deneriz; olmazsa o sorular boş
              sayılır.
            </span>
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          {bos > 0 ? (
            <Button ref={bosaDonDugmesi} variant="outline" onClick={() => onBosaDon(bosIndeksler[0])}>
              Boş sorulara dön
            </Button>
          ) : (
            <Button variant="outline" onClick={kapat}>
              Vazgeç
            </Button>
          )}
          <Button ref={bitirDugmesi} onClick={onBitir} startIcon={<Flag />}>
            {bos > 0 ? "Yine de bitir" : "Bitir ve raporu gör"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
