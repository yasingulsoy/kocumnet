"use client";

import React from "react";
import type { SortDir } from "@/lib/tableSort";

export type TableSortState<K extends string> = { key: K; dir: SortDir } | null;

type Align = "left" | "right" | "center";

export function SortableTableTh<K extends string>({
  columnKey,
  sort,
  onSort,
  children,
  buttonClassName,
  thClassName,
  align = "left",
}: {
  columnKey: K;
  sort: TableSortState<K>;
  onSort: (key: K) => void;
  children: React.ReactNode;
  buttonClassName?: string;
  thClassName?: string;
  align?: Align;
}) {
  const dir = sort?.key === columnKey ? sort.dir : null;
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const thCls =
    thClassName ??
    `px-6 py-3 ${alignCls} text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400`;
  const defaultBtn =
    align === "right"
      ? `group inline-flex w-full items-center justify-end gap-1 font-medium uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200`
      : `group inline-flex w-full items-center gap-1 font-medium uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200`;
  const btnCls = buttonClassName ?? defaultBtn;

  return (
    <th scope="col" className={thCls}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={btnCls}
        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
      >
        {children}
        {dir && (
          <span className="text-brand-500 normal-case" aria-hidden>
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}
