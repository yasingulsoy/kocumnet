"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/modal/index.tsx (+ hooks/useModal.ts)
 *
 * Görünüm TailAdmin'in: buzlu gri arka plan, rounded-3xl beyaz kutu, sağ
 * üstte yuvarlak kapat düğmesi. Altyapı yerel <dialog> + showModal():
 * odak tuzağı, Esc ile kapanma, arka planın etkisizleşmesi ve üst katman
 * tarayıcıdan gelir (TailAdmin'in div modalı odağı hapsetmiyordu).
 *
 *  · Başlık verilirse pencerenin erişilebilir adı olur; yoksa ariaLabel ya
 *    da labelledBy ver.
 *  · document.body'ye taşınır (portal): bir <form>'un içinden açılsa da iç
 *    içe form oluşmaz. React olayları (tıklama, değişim, gönderim, tuş)
 *    pencerenin dışına kabarmaz: üst formun onChange'i tetiklenmez.
 *  · Kapalıyken içerik çizilmez; her açılış temiz başlar.
 *  · dismissable={false}: Esc, arka plan ve kapat düğmesi kapatmaz.
 *  · sheet: telefonda (sm altı) alttan açılan tam genişlik tabaka, geniş
 *    ekranda ortada kutu — başparmakla kullanılan liste için (soru paleti).
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "../cx";
import { kaydirmayiBirak, kaydirmayiKilitle } from "../lib/scroll-lock";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const GENISLIK: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-150",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

const abone = () => () => {};
const istemcide = () => true;
const sunucuda = () => false;
const durdur = (e: SyntheticEvent) => e.stopPropagation();

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Görünür başlık yoksa erişilebilir ad. */
  ariaLabel?: string;
  /** İçerikteki kendi başlığının id'si (title vermediysen). */
  labelledBy?: string;
  describedBy?: string;
  size?: ModalSize;
  /** Kutuya ek sınıf (genişlik, kenar boşluğu değil — onlar size/padded). */
  className?: string;
  /** false: iç dolgu yok (görsel önizleme gibi). */
  padded?: boolean;
  showCloseButton?: boolean;
  isFullscreen?: boolean;
  /** Telefonda alttan açılan tabaka (sm altı); geniş ekranda ortada kutu. */
  sheet?: boolean;
  dismissable?: boolean;
  closeLabel?: string;
  /** Açılınca odaklanacak öğe; yoksa tarayıcı ilk odaklanabilir öğeyi seçer. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  ariaLabel,
  labelledBy,
  describedBy,
  size = "md",
  className,
  padded = true,
  showCloseButton = true,
  isFullscreen = false,
  sheet = false,
  dismissable = true,
  closeLabel = "Kapat",
  initialFocusRef,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const istemci = useSyncExternalStore(abone, istemcide, sunucuda);
  const baslikId = useId();
  const aciklamaId = useId();
  const kapat = useRef(onClose);
  const acik = useRef(isOpen);
  /** Arka plan tıklaması yalnızca basış da arka planda başladıysa sayılır (metin seçerken kapanmasın). */
  const basis = useRef(false);

  useEffect(() => {
    kapat.current = onClose;
    acik.current = isOpen;
  });

  useEffect(() => {
    const d = ref.current;
    if (!istemci || !isOpen || !d) return;
    const onceki = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();
    kaydirmayiKilitle();
    initialFocusRef?.current?.focus();
    return () => {
      kaydirmayiBirak();
      if (d.open) d.close();
      // Tarayıcı odağı geri vermediyse açan öğeye dön.
      if (onceki && onceki.isConnected && (document.activeElement === document.body || !document.activeElement)) onceki.focus();
    };
  }, [isOpen, istemci, initialFocusRef]);

  const istenenKapanis = useCallback(() => {
    if (dismissable) kapat.current();
  }, [dismissable]);

  if (!istemci) return null;

  const adlandiran = labelledBy ?? (title ? baslikId : undefined);
  const tanimlayan = describedBy ?? (description ? aciklamaId : undefined);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={adlandiran}
      aria-describedby={tanimlayan}
      aria-label={adlandiran ? undefined : ariaLabel}
      onCancel={(e) => {
        e.preventDefault();
        istenenKapanis();
      }}
      onClose={() => {
        // Tarayıcı kendisi kapattıysa durumu eşitle. Chrome art arda iki Esc'te
        // engellenen cancel'ı atlayıp kapatabiliyor: kapatılamayan pencereyi geri aç.
        if (!acik.current) return;
        if (dismissable) kapat.current();
        else ref.current?.showModal();
      }}
      onClick={durdur}
      onMouseDown={durdur}
      onPointerDown={durdur}
      onKeyDown={durdur}
      onChange={durdur}
      onInput={durdur}
      onSubmit={durdur}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-transparent p-0 text-gray-800 backdrop:bg-transparent"
    >
      {isOpen ? (
        <div
          className={cx(
            "relative flex min-h-full items-center justify-center",
            !isFullscreen && (sheet ? "max-sm:items-end sm:p-6" : "p-4 sm:p-6")
          )}
        >
          {!isFullscreen ? (
            <div
              aria-hidden
              className="animate-fade fixed inset-0 bg-gray-400/50 backdrop-blur-[32px]"
              onMouseDown={() => {
                basis.current = true;
              }}
              onClick={() => {
                if (basis.current) istenenKapanis();
                basis.current = false;
              }}
            />
          ) : null}
          <div
            className={cx(
              "relative w-full bg-white",
              isFullscreen ? "min-h-full" : cx("animate-rise rounded-3xl shadow-theme-xl", GENISLIK[size]),
              sheet && !isFullscreen && "max-sm:max-w-none max-sm:rounded-b-none",
              padded && "p-6 sm:p-8",
              // iPhone ev çubuğu tabakanın son satırını örtmesin.
              padded && sheet && !isFullscreen && "max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
              className
            )}
            onMouseDown={() => {
              basis.current = false;
            }}
          >
            {title ? (
              <h2 id={baslikId} className={cx("font-display text-xl font-semibold text-gray-800", showCloseButton && dismissable && "pe-12")}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={aciklamaId} className={cx("text-sm leading-6 text-gray-500", title && "mt-1.5", showCloseButton && dismissable && "pe-12")}>
                {description}
              </p>
            ) : null}
            {title || description ? <div className="mt-6">{children}</div> : children}
            {/* Kapat düğmesi DOM'da en sonda (görünüşte sağ üstte): açılınca odak ilk alana gider. */}
            {showCloseButton && dismissable ? (
              <button
                type="button"
                onClick={istenenKapanis}
                aria-label={closeLabel}
                className="absolute end-3 top-3 z-10 flex size-9.5 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 sm:end-5 sm:top-5 sm:size-11"
              >
                <X className="size-5 sm:size-6" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>,
    document.body
  );
}

/** TailAdmin'in useModal kancası: aç/kapat/değiştir. */
export function useModal(baslangic = false) {
  const [isOpen, setIsOpen] = useState(baslangic);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const toggleModal = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, openModal, closeModal, toggleModal };
}
