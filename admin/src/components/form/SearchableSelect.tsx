"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  emptyResultsText?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seçin",
  disabled = false,
  className = "",
  searchPlaceholder = "Ara…",
  emptyResultsText = "Sonuç yok",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.value === value);
    return o?.label ?? "";
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const handlePick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={
            selectedLabel
              ? "truncate text-left text-gray-800 dark:text-white/90"
              : "text-left text-gray-400 dark:text-gray-400"
          }
        >
          {selectedLabel || placeholder}
        </span>
        <span className="ml-2 shrink-0 text-gray-400" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full border-b border-gray-100 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-white/40"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <ul
            className="max-h-52 overflow-y-auto py-1"
            role="listbox"
            aria-label={placeholder}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {emptyResultsText}
              </li>
            ) : (
              filtered.map((o) => (
                <li key={o.value === "" ? "__empty" : o.value} role="option">
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      value === o.value
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "text-gray-800 dark:text-white/90"
                    }`}
                    onClick={() => handlePick(o.value)}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
