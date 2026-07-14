"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface EmailLog {
  id: number;
  recipient: string;
  subject: string;
  email_type: string;
  status: string;
  message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface EmailLogListResponse {
  success: boolean;
  data: EmailLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  order_confirmation: "Sipariş Onayı",
  order_tracking: "Kargo Takibi",
  order_status_change: "Sipariş Durumu",
  review_invite: "Yorum Daveti",
  password_reset: "Şifre Sıfırlama",
  verification: "E-posta Doğrulama",
  test: "Test",
  custom: "Diğer",
};

type EmailLogSortKey = "date" | "recipient" | "subject" | "type" | "status" | "error";

const EmailLogList: React.FC = () => {
  const router = useRouter();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<{ key: EmailLogSortKey; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [emailTypeFilter, statusFilter, search, currentPage]);

  useEffect(() => {
    setSort(null);
  }, [emailTypeFilter, statusFilter, search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (emailTypeFilter !== "all") params.append("email_type", emailTypeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", currentPage.toString());
      params.append("limit", pagination.limit.toString());

      const result = await apiGet<EmailLogListResponse>(
        `/api/admin/email-logs?${params.toString()}`
      );

      if (result.success) {
        setLogs(result.data);
        setPagination(result.pagination);
        setCurrentPage(result.pagination.page);
      }
    } catch (error) {
      console.error("E-posta logları yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getEmailTypeLabel = (type: string): string => {
    return EMAIL_TYPE_LABELS[type] || type;
  };

  const requestSort = useCallback((key: EmailLogSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedLogs = useMemo(
    () =>
      sortRowData(logs, sort, {
        date: (l) => new Date(l.created_at).getTime(),
        recipient: (l) => l.recipient,
        subject: (l) => l.subject,
        type: (l) => getEmailTypeLabel(l.email_type),
        status: (l) => (l.status === "sent" ? "Gönderildi" : "Başarısız"),
        error: (l) => l.error_message || "",
      }),
    [logs, sort]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filtreler ve Arama */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={emailTypeFilter}
            onChange={(e) => {
              setEmailTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">Tüm Tipler</option>
            {Object.entries(EMAIL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="sent">Gönderildi</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Alıcı veya konu ara..."
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Ara
          </button>
        </form>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black dark:border-gray-600 dark:border-t-white"></div>
        </div>
      )}

      {/* E-posta Log Listesi */}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <SortableTableTh columnKey="date" sort={sort} onSort={requestSort}>
                  Tarih
                </SortableTableTh>
                <SortableTableTh columnKey="recipient" sort={sort} onSort={requestSort}>
                  Alıcı
                </SortableTableTh>
                <SortableTableTh columnKey="subject" sort={sort} onSort={requestSort}>
                  Konu
                </SortableTableTh>
                <SortableTableTh columnKey="type" sort={sort} onSort={requestSort}>
                  Tip
                </SortableTableTh>
                <SortableTableTh columnKey="status" sort={sort} onSort={requestSort}>
                  Durum
                </SortableTableTh>
                <SortableTableTh columnKey="error" sort={sort} onSort={requestSort}>
                  Hata
                </SortableTableTh>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
              {sortedLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    E-posta kaydı bulunamadı
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px] truncate text-sm text-gray-900 dark:text-white/90">
                        {log.recipient}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[250px] truncate text-sm text-gray-600 dark:text-gray-400">
                        {log.subject}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        {getEmailTypeLabel(log.email_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          log.status === "sent"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {log.status === "sent" ? "Gönderildi" : "Başarısız"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[200px] truncate text-sm text-red-600 dark:text-red-400">
                        {log.error_message || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/email-logs/${log.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Toplam {pagination.total} kayıt
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage((prev) => prev - 1);
                }
              }}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Önceki
            </button>
            <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              Sayfa {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < pagination.totalPages) {
                  setCurrentPage((prev) => prev + 1);
                }
              }}
              disabled={currentPage === pagination.totalPages}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailLogList;
