"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { apiDelete, apiGet } from "@/lib/api";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

type CartTypeFilter = "all" | "guest" | "user";

interface AdminCartRow {
  id: number;
  cart_type: "user" | "guest";
  customer_id: number | null;
  session_id: string | null;
  customer: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  item_count: number;
  total_quantity: number | null;
  total_price: string | number | null;
  is_paid: boolean | null;
  updated_at: string;
  created_at: string;
}

interface CartListResponse {
  success: boolean;
  data: AdminCartRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type CartSortKey = "type" | "customer" | "email" | "items" | "amount" | "updated";

const cartTh =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";

const UserCartList: React.FC = () => {
  const [rows, setRows] = useState<AdminCartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CartTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminCartRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sort, setSort] = useState<{ key: CartSortKey; dir: "asc" | "desc" } | null>(null);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (search.trim()) params.append("search", search.trim());
      params.append("page", String(currentPage));
      params.append("limit", String(pagination.limit));

      const res = await apiGet<CartListResponse>(`/api/admin/carts?${params.toString()}`);
      if (res.success) {
        setRows(res.data);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.error("Sepetler yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, [typeFilter, currentPage]);

  useEffect(() => {
    setSort(null);
  }, [typeFilter]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (v: string | number | null | undefined): string => {
    if (v == null || v === "") return "-";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (Number.isNaN(n)) return String(v);
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
  };

  const customerLabel = (row: AdminCartRow): string => {
    if (row.cart_type === "guest") {
      return row.session_id ? `${row.session_id.slice(0, 12)}…` : "—";
    }
    const c = row.customer;
    if (!c) return "—";
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
    return name || c.email;
  };

  const requestSort = useCallback((key: CartSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedRows = useMemo(
    () =>
      sortRowData(rows, sort, {
        type: (r) => (r.cart_type === "guest" ? 0 : 1),
        customer: (r) => customerLabel(r),
        email: (r) => r.customer?.email || "",
        items: (r) => r.item_count,
        amount: (r) => {
          const v = r.total_price;
          if (v == null || v === "") return 0;
          const n = typeof v === "string" ? parseFloat(v) : v;
          return Number.isNaN(n) ? 0 : n;
        },
        updated: (r) => new Date(r.updated_at).getTime(),
      }),
    [rows, sort]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCarts();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiDelete<{ success: boolean }>(`/api/admin/carts/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchCarts();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Sepet silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all" as const, label: "Tümü" },
              { key: "user" as const, label: "Giriş yapmış" },
              { key: "guest" as const, label: "Misafir" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTypeFilter(key);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                typeFilter === key
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="E-posta, isim veya session ara…"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Ara
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <SortableTableTh
                columnKey="type"
                sort={sort}
                onSort={requestSort}
                thClassName={cartTh}
              >
                Tür
              </SortableTableTh>
              <SortableTableTh
                columnKey="customer"
                sort={sort}
                onSort={requestSort}
                thClassName={cartTh}
              >
                Müşteri / Session
              </SortableTableTh>
              <SortableTableTh
                columnKey="email"
                sort={sort}
                onSort={requestSort}
                thClassName={cartTh}
              >
                E-posta
              </SortableTableTh>
              <SortableTableTh
                columnKey="items"
                sort={sort}
                onSort={requestSort}
                thClassName={`${cartTh} text-right`}
                align="right"
              >
                Kalem
              </SortableTableTh>
              <SortableTableTh
                columnKey="amount"
                sort={sort}
                onSort={requestSort}
                thClassName={`${cartTh} text-right`}
                align="right"
              >
                Tutar
              </SortableTableTh>
              <SortableTableTh
                columnKey="updated"
                sort={sort}
                onSort={requestSort}
                thClassName={cartTh}
              >
                Güncellendi
              </SortableTableTh>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                İşlem
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  Yükleniyor…
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                  Sepet bulunamadı
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        row.cart_type === "user"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {row.cart_type === "user" ? "Kullanıcı" : "Misafir"}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-sm text-gray-900 dark:text-white/90" title={String(row.session_id || "")}>
                    {customerLabel(row)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {row.customer?.email || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {row.item_count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatPrice(row.total_price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(row.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/user-carts/${row.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Detay
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Toplam {pagination.total} sepet
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Önceki
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Sayfa {currentPage} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sepeti sil</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sepet #{deleteTarget.id} ({deleteTarget.cart_type === "user" ? "kullanıcı" : "misafir"}) ve içindeki tüm
              kalemler kalıcı olarak silinecek. Emin misiniz?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Siliniyor…" : "Evet, sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCartList;
