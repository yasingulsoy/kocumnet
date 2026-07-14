"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Button from "../ui/button/Button";
import { useRouter } from "next/navigation";
import { API_URL, getApiFetchUrl, mergeCsrfInit } from "@/lib/api";
import Image from "next/image";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface PaperType {
  id: number;
  name: string;
  slug: string;
  price: number | string | null;
  description: string[];
  image_url?: string;
  is_active: boolean;
  display_order: number;
}

type PaperSortKey = "name" | "price" | "order" | "status";

const paperTh = "text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300";
const paperSortBtn =
  "group inline-flex w-full items-center gap-1 text-left font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";

const PaperTypeList: React.FC = () => {
  const router = useRouter();
  const [paperTypes, setPaperTypes] = useState<PaperType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<{ key: PaperSortKey; dir: "asc" | "desc" } | null>(null);

  // Güvenli fiyat formatlama fonksiyonu
  const formatPrice = (price: number | string | null | undefined): string => {
    if (price == null || price === '') return '0.00';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '0.00';
    return numPrice.toFixed(2);
  };

  useEffect(() => {
    setSort(null);
    fetchPaperTypes();
  }, [filter]);

  const fetchPaperTypes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === "active") params.append("include_inactive", "false");
      if (filter === "inactive") params.append("include_inactive", "true");

      const response = await fetch(
        `${getApiFetchUrl(`/api/paper-types?${params.toString()}`)}`,
        { credentials: "include" }
      );
      const result = await response.json();

      if (result.success) {
        const filtered = filter === "inactive" 
          ? result.data.filter((pt: PaperType) => !pt.is_active)
          : filter === "active"
          ? result.data.filter((pt: PaperType) => pt.is_active)
          : result.data;
        setPaperTypes(filtered);
      }
    } catch (error) {
      console.error("Kağıt türleri yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (paperTypeId: number, isActive: boolean) => {
    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/paper-types/${paperTypeId}`)}`,
        await mergeCsrfInit({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active: !isActive }),
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchPaperTypes();
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error);
    }
  };

  const handleDelete = async (paperTypeId: number) => {
    if (!confirm("Bu kağıt türünü silmek istediğinize emin misiniz? Resim de silinecektir.")) {
      return;
    }

    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/paper-types/${paperTypeId}`)}`,
        await mergeCsrfInit({
          method: "DELETE",
          credentials: "include",
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchPaperTypes();
      } else {
        alert(result.error || "Silme işlemi başarısız");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi sırasında bir hata oluştu");
    }
  };

  const requestSort = useCallback((key: PaperSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedPaperTypes = useMemo(
    () =>
      sortRowData(paperTypes, sort, {
        name: (p) => p.name,
        price: (p) => {
          const raw = p.price;
          if (raw == null || raw === "") return 0;
          const n = typeof raw === "string" ? parseFloat(raw) : raw;
          return Number.isNaN(n) ? 0 : n;
        },
        order: (p) => p.display_order,
        status: (p) => p.is_active,
      }),
    [paperTypes, sort]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="text-center py-10">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "active"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Aktif
          </button>
          <button
            onClick={() => setFilter("inactive")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "inactive"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pasif
          </button>
        </div>
        <Button
          onClick={() => router.push("/paper-types/new")}
          className="bg-black text-white hover:bg-gray-800"
        >
          Yeni Kağıt Türü Ekle
        </Button>
      </div>

      {sortedPaperTypes.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Kağıt türü bulunamadı
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={paperTh}>Resim</th>
                <SortableTableTh
                  columnKey="name"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={paperTh}
                  buttonClassName={paperSortBtn}
                >
                  Ad
                </SortableTableTh>
                <SortableTableTh
                  columnKey="price"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={paperTh}
                  buttonClassName={paperSortBtn}
                >
                  m² Fiyatı
                </SortableTableTh>
                <SortableTableTh
                  columnKey="order"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={paperTh}
                  buttonClassName={paperSortBtn}
                >
                  Sıra
                </SortableTableTh>
                <SortableTableTh
                  columnKey="status"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={paperTh}
                  buttonClassName={paperSortBtn}
                >
                  Durum
                </SortableTableTh>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPaperTypes.map((paperType) => (
                <tr
                  key={paperType.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-3 px-4">
                    {paperType.image_url ? (
                      <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={`${API_URL}${paperType.image_url}`}
                          alt={paperType.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-xs">Resim Yok</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {paperType.name}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {formatPrice(paperType.price)} ₺ / m²
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {paperType.display_order}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleStatus(paperType.id, paperType.is_active)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        paperType.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {paperType.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/paper-types/${paperType.id}/edit`)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(paperType.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaperTypeList;
