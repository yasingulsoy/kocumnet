/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/table/index.tsx
 * (+ components/tables/BasicTableOne.tsx'teki hücre sınıfları)
 *
 * TailAdmin'in ilkelleri yalın <table> öğeleriydi; her sayfa hücre
 * sınıflarını elle yazıyordu. Burada TailAdmin'in tablo örneğindeki
 * sınıflar varsayılan: başlık text-theme-xs gri, gövde text-theme-sm,
 * satırlar arasında ince çizgi. Hizalama `align` ile (className ile ezme
 * yok: kitte tailwind-merge yok). Table yatay kaydırma kabını da çizer.
 * Kap `relative`: tablodaki konumlu öğeler (son sütundaki sr-only başlık
 * gibi) kabın içinde kırpılsın; yoksa dar ekranda sayfayı yana taşırıyordu.
 */
import type { ComponentProps } from "react";
import { cx } from "../cx";

export interface TableProps extends ComponentProps<"table"> {
  /** false: kaydırma kabı çizilmez (dışarıda zaten varsa). */
  scroll?: boolean;
  wrapperClassName?: string;
}

export function Table({ scroll = true, wrapperClassName, className, ...props }: TableProps) {
  const tablo = <table className={cx("min-w-full", className)} {...props} />;
  if (!scroll) return tablo;
  return <div className={cx("custom-scrollbar relative max-w-full overflow-x-auto", wrapperClassName)}>{tablo}</div>;
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cx("border-b border-gray-100", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cx("divide-y divide-gray-100", className)} {...props} />;
}

export interface TableRowProps extends ComponentProps<"tr"> {
  /** Üstüne gelince hafif zemin (tıklanabilir satırlar). */
  hover?: boolean;
  /** Seçili satır görünümü (seçimi satırdaki onay kutusu anlatır). */
  selected?: boolean;
}

export function TableRow({ hover = false, selected = false, className, ...props }: TableRowProps) {
  return <tr className={cx(selected ? "bg-brand-25" : hover && "transition hover:bg-gray-50", className)} {...props} />;
}

type Hiza = "start" | "center" | "end";
const HIZA: Record<Hiza, string> = { start: "text-start", center: "text-center", end: "text-end" };

export interface TableCellProps extends Omit<ComponentProps<"td">, "align"> {
  /** true: <th scope="col"> olarak çizilir. */
  isHeader?: boolean;
  align?: Hiza;
  nowrap?: boolean;
  scope?: "col" | "row" | "colgroup" | "rowgroup";
}

export function TableCell({ isHeader = false, align = "start", nowrap = false, scope, className, ...props }: TableCellProps) {
  const ortak = cx(HIZA[align], nowrap && "whitespace-nowrap", className);
  if (isHeader) {
    return (
      <th
        scope={scope ?? "col"}
        className={cx("px-4 py-3 text-theme-xs font-medium text-gray-500 sm:px-5", ortak)}
        {...props}
      />
    );
  }
  return <td className={cx("px-4 py-3.5 text-theme-sm text-gray-500 sm:px-5", ortak)} {...props} />;
}
