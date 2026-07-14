"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import {
  getStorefrontOriginFromAdminSubdomain,
  getStorefrontOriginFromEnv,
  getStorefrontProductPath,
} from "@/lib/storefrontUrl";

type ReviewRow = {
  id: number;
  order_id: number;
  order_item_id: number;
  rating: number | null;
  comment: string | null;
  created_at: string;
  product: { id: number; name: string; slug: string } | null;
  customer: { id: number; email: string; first_name: string | null; last_name: string | null } | null;
  order: { id: number; order_number: string } | null;
  photos: { id: number; url: string }[];
};

type ListResponse = {
  success: boolean;
  data: ReviewRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export default function CustomerReviewList() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      const res = await apiGet<ListResponse>(`/api/admin/reviews?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setRows(res.data);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.error("Yorumlar yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchDraft);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const customerLabel = (c: ReviewRow["customer"]) => {
    if (!c) return "—";
    const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    return n ? `${n} (${c.email})` : c.email;
  };

  const productHref = (slug: string) => {
    const origin =
      getStorefrontOriginFromEnv() ||
      (typeof window !== "undefined" ? getStorefrontOriginFromAdminSubdomain() : "");
    const path = getStorefrontProductPath(slug);
    return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Ara (sipariş no, ürün, e-posta, yorum metni)
          </label>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Örn. sipariş numarası veya ürün adı"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
        >
          Ara
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">Henüz kayıtlı müşteri yorumu yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Tarih</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Sipariş</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Ürün</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Müşteri</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Puan</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Yorum</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.id} className="bg-white dark:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {r.order?.order_number ? `#${r.order.order_number}` : `#${r.order_id}`}
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    {r.product?.slug ? (
                      <Link
                        href={productHref(r.product.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400 line-clamp-2"
                      >
                        {r.product.name}
                      </Link>
                    ) : (
                      <span className="line-clamp-2 text-gray-800 dark:text-gray-200">{r.product?.name || "—"}</span>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3 py-2 text-gray-700 dark:text-gray-300">
                    <span className="line-clamp-2 break-all">{customerLabel(r.customer)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800 dark:text-gray-200">
                    {r.rating != null ? `${r.rating} / 5` : "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-gray-700 dark:text-gray-300">
                    <span className="line-clamp-3 whitespace-pre-wrap">{r.comment?.trim() || "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                    {r.photos?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Toplam {pagination.total} yorum — Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 dark:border-gray-700"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 dark:border-gray-700"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
