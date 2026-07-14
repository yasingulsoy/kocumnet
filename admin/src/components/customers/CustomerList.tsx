"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiGet } from "@/lib/api";
import Link from "next/link";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface Customer {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  auth_provider: 'email' | 'google';
  is_email_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

interface Guest {
  id: string;
  source: 'guest_address' | 'order';
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address_line1?: string;
  city?: string;
  country?: string;
  order_number?: string;
  created_at: string;
  order_count: number;
}

interface CustomerListResponse {
  success: boolean;
  data: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GuestListResponse {
  success: boolean;
  data: Guest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type CustomerSortKey = "name" | "email" | "phone" | "auth" | "active" | "created" | "login";
type GuestSortKey = "name" | "email" | "phone" | "address" | "source" | "date";

const CustomerList: React.FC = () => {
  const router = useRouter();
  const [tab, setTab] = useState<"customers" | "guests">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [authProviderFilter, setAuthProviderFilter] = useState<"all" | "email" | "google">("all");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [customerSort, setCustomerSort] = useState<{
    key: CustomerSortKey;
    dir: "asc" | "desc";
  } | null>(null);
  const [guestSort, setGuestSort] = useState<{ key: GuestSortKey; dir: "asc" | "desc" } | null>(
    null
  );

  useEffect(() => {
    if (tab === "customers") fetchCustomers();
    else fetchGuests();
  }, [tab, authProviderFilter, search, currentPage]);

  useEffect(() => {
    setCustomerSort(null);
    setGuestSort(null);
  }, [tab, authProviderFilter, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (authProviderFilter !== "all") params.append("auth_provider", authProviderFilter);
      params.append("page", currentPage.toString());
      params.append("limit", pagination.limit.toString());

      const result = await apiGet<CustomerListResponse>(
        `/api/admin/customers?${params.toString()}`
      );

      if (result.success) {
        setCustomers(result.data);
        setPagination(result.pagination);
        setCurrentPage(result.pagination.page);
      }
    } catch (error) {
      console.error("Müşteriler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      params.append("page", currentPage.toString());
      params.append("limit", pagination.limit.toString());

      const result = await apiGet<GuestListResponse>(
        `/api/admin/guests?${params.toString()}`
      );

      if (result.success) {
        setGuests(result.data);
        setPagination(result.pagination);
        setCurrentPage(result.pagination.page);
      }
    } catch (error) {
      console.error("Misafirler yüklenemedi:", error);
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
    });
  };

  const getCustomerName = (customer: Customer): string => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name} ${customer.last_name}`;
    }
    if (customer.first_name) {
      return customer.first_name;
    }
    return customer.email;
  };

  const requestCustomerSort = useCallback((key: CustomerSortKey) => {
    setCustomerSort((prev) => toggleSortState(prev, key));
  }, []);

  const requestGuestSort = useCallback((key: GuestSortKey) => {
    setGuestSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedCustomers = useMemo(
    () =>
      sortRowData(customers, customerSort, {
        name: (c) => getCustomerName(c),
        email: (c) => c.email,
        phone: (c) => c.phone || "",
        auth: (c) => (c.auth_provider === "google" ? "Google" : "Email"),
        active: (c) => c.is_active,
        created: (c) => new Date(c.created_at).getTime(),
        login: (c) => (c.last_login ? new Date(c.last_login).getTime() : 0),
      }),
    [customers, customerSort]
  );

  const sortedGuests = useMemo(
    () =>
      sortRowData(guests, guestSort, {
        name: (g) => `${g.first_name} ${g.last_name}`.trim(),
        email: (g) => g.email,
        phone: (g) => g.phone || "",
        address: (g) => [g.address_line1, g.city].filter(Boolean).join(" "),
        source: (g) => (g.source === "order" ? "Sipariş" : "Adres"),
        date: (g) => new Date(g.created_at).getTime(),
      }),
    [guests, guestSort]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Tab: Müşteriler / Misafir */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => { setTab("customers"); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "customers" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Müşteriler
        </button>
        <button
          onClick={() => { setTab("guests"); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "guests" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Misafir
        </button>
      </div>

      {/* Filtreler ve Arama */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {tab === "customers" && (
            <>
              <button
                onClick={() => { setAuthProviderFilter("all"); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authProviderFilter === "all" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => { setAuthProviderFilter("email"); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authProviderFilter === "email" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Email
              </button>
              <button
                onClick={() => { setAuthProviderFilter("google"); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authProviderFilter === "google" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Google
              </button>
            </>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email, ad veya soyad ara..."
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

      {/* Müşteri Listesi */}
      {!loading && tab === "customers" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <SortableTableTh columnKey="name" sort={customerSort} onSort={requestCustomerSort}>
                  Ad Soyad
                </SortableTableTh>
                <SortableTableTh columnKey="email" sort={customerSort} onSort={requestCustomerSort}>
                  Email
                </SortableTableTh>
                <SortableTableTh columnKey="phone" sort={customerSort} onSort={requestCustomerSort}>
                  Telefon
                </SortableTableTh>
                <SortableTableTh columnKey="auth" sort={customerSort} onSort={requestCustomerSort}>
                  Giriş Yöntemi
                </SortableTableTh>
                <SortableTableTh columnKey="active" sort={customerSort} onSort={requestCustomerSort}>
                  Durum
                </SortableTableTh>
                <SortableTableTh columnKey="created" sort={customerSort} onSort={requestCustomerSort}>
                  Kayıt Tarihi
                </SortableTableTh>
                <SortableTableTh columnKey="login" sort={customerSort} onSort={requestCustomerSort}>
                  Son Giriş
                </SortableTableTh>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Müşteri bulunamadı
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white/90">
                        {getCustomerName(customer)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {customer.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {customer.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.auth_provider === "google"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {customer.auth_provider === "google" ? "Google" : "Email"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {customer.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(customer.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(customer.last_login)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/customers/${customer.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
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

      {/* Misafir Listesi */}
      {!loading && tab === "guests" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <SortableTableTh columnKey="name" sort={guestSort} onSort={requestGuestSort}>
                  Ad Soyad
                </SortableTableTh>
                <SortableTableTh columnKey="email" sort={guestSort} onSort={requestGuestSort}>
                  Email
                </SortableTableTh>
                <SortableTableTh columnKey="phone" sort={guestSort} onSort={requestGuestSort}>
                  Telefon
                </SortableTableTh>
                <SortableTableTh columnKey="address" sort={guestSort} onSort={requestGuestSort}>
                  Adres
                </SortableTableTh>
                <SortableTableTh columnKey="source" sort={guestSort} onSort={requestGuestSort}>
                  Kaynak
                </SortableTableTh>
                <SortableTableTh columnKey="date" sort={guestSort} onSort={requestGuestSort}>
                  Tarih
                </SortableTableTh>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-white/[0.03]">
              {sortedGuests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Misafir bulunamadı
                  </td>
                </tr>
              ) : (
                sortedGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white/90">
                        {guest.first_name} {guest.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{guest.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {guest.phone || "-"}
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={guest.address_line1}>
                        {guest.address_line1 || "-"}
                        {guest.city ? `, ${guest.city}` : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        {guest.source === "order" ? "Sipariş" : "Adres"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(guest.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/customers/guest/${encodeURIComponent(guest.id)}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Detay
                        </Link>
                        {guest.source === "order" && guest.id.startsWith("order-") && (
                          <Link
                            href={`/orders/${guest.id.replace("order-", "")}`}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Sipariş
                          </Link>
                        )}
                      </div>
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
            Toplam {pagination.total} {tab === "guests" ? "misafir" : "müşteri"} gösteriliyor
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(prev => prev - 1);
                }
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Önceki
            </button>
            <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              Sayfa {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < pagination.totalPages) {
                  setCurrentPage(prev => prev + 1);
                }
              }}
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
