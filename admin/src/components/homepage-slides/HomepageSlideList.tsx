"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Button from "../ui/button/Button";
import { API_URL, getApiFetchUrl, mergeCsrfInit } from "@/lib/api";
import Image from "next/image";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface SubCategory {
  id: number;
  name: string;
  slug: string;
  category?: Category;
}

interface HomepageSlide {
  id: number;
  category_id: number | null;
  subcategory_id: number | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  category?: Category | null;
  subcategory?: SubCategory | null;
}

type SlideSortKey = "category" | "link" | "order" | "status";

const slideTh =
  "text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300";
const slideSortBtn =
  "group inline-flex w-full items-center gap-1 text-left font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";

const HomepageSlideList: React.FC = () => {
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SlideSortKey; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiFetchUrl("/api/homepage-slides?include_inactive=true")}`, {
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        setSlides(result.data);
      }
    } catch (error) {
      console.error("Slider'lar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (slideId: number, isActive: boolean) => {
    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/homepage-slides/${slideId}`)}`,
        await mergeCsrfInit({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active: !isActive }),
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchSlides();
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error);
    }
  };

  const handleDelete = async (slideId: number) => {
    if (!confirm("Bu slider'ı silmek istediğinize emin misiniz? Görsel de silinecektir.")) {
      return;
    }

    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/homepage-slides/${slideId}`)}`,
        await mergeCsrfInit({
          method: "DELETE",
          credentials: "include",
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchSlides();
      } else {
        alert(result.error || "Silme işlemi başarısız");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi sırasında bir hata oluştu");
    }
  };

  const handleEdit = (slideId: number) => {
    setEditingSlide(slideId);
    setShowAddForm(true);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingSlide(null);
    fetchSlides();
  };

  const requestSort = useCallback((key: SlideSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const orderedSlides = useMemo(
    () => [...slides].sort((a, b) => a.display_order - b.display_order),
    [slides]
  );

  const sortedSlides = useMemo(
    () =>
      sortRowData(orderedSlides, sort, {
        category: (s) => s.category?.name || s.subcategory?.name || "",
        link: (s) => s.link_url || "",
        order: (s) => s.display_order,
        status: (s) => s.is_active,
      }),
    [orderedSlides, sort]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="text-center py-10">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Ana Sayfa Kategori Slider'ı
          </h2>
          <Button
            onClick={() => {
              setEditingSlide(null);
              setShowAddForm(true);
            }}
            className="bg-black text-white hover:bg-gray-800"
          >
            Yeni Slider Ekle
          </Button>
        </div>

        {slides.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            Slider bulunamadı. İlk slider'ı ekleyin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    Görsel
                  </th>
                  <SortableTableTh
                    columnKey="category"
                    sort={sort}
                    onSort={requestSort}
                    thClassName={slideTh}
                    buttonClassName={slideSortBtn}
                  >
                    Kategori
                  </SortableTableTh>
                  <SortableTableTh
                    columnKey="link"
                    sort={sort}
                    onSort={requestSort}
                    thClassName={slideTh}
                    buttonClassName={slideSortBtn}
                  >
                    Link
                  </SortableTableTh>
                  <SortableTableTh
                    columnKey="order"
                    sort={sort}
                    onSort={requestSort}
                    thClassName={slideTh}
                    buttonClassName={slideSortBtn}
                  >
                    Sıra
                  </SortableTableTh>
                  <SortableTableTh
                    columnKey="status"
                    sort={sort}
                    onSort={requestSort}
                    thClassName={slideTh}
                    buttonClassName={slideSortBtn}
                  >
                    Durum
                  </SortableTableTh>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSlides.map((slide) => {
                    const categoryName = slide.category?.name || slide.subcategory?.name || "Belirtilmemiş";
                    const linkUrl = slide.link_url || "#";

                    return (
                      <tr
                        key={slide.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          {slide.image_url ? (
                            <div className="w-20 h-20 relative rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={`${API_URL}${slide.image_url}`}
                                alt={categoryName}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                              Görsel Yok
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {categoryName}
                          </div>
                          {slide.subcategory && slide.subcategory.category && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {slide.subcategory.category.name} &gt; {slide.subcategory.name}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate max-w-xs block"
                          >
                            {linkUrl}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {slide.display_order}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleStatus(slide.id, slide.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              slide.is_active
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {slide.is_active ? "Aktif" : "Pasif"}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(slide.id)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDelete(slide.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm dark:bg-red-900/30 dark:text-red-400"
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddForm && (
        <HomepageSlideForm
          slideId={editingSlide}
          onClose={handleFormClose}
          onSuccess={handleFormClose}
        />
      )}
    </>
  );
};

// Form bileşeni
interface HomepageSlideFormProps {
  slideId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const HomepageSlideForm: React.FC<HomepageSlideFormProps> = ({
  slideId,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    category_id: "",
    subcategory_id: "",
    link_url: "",
    display_order: "0",
    is_active: true,
  });
  const [image, setImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadingSlide, setLoadingSlide] = useState(!!slideId);

  useEffect(() => {
    fetchCategories();
    if (slideId) {
      fetchSlide();
    }
  }, [slideId]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${getApiFetchUrl("/api/categories?include_inactive=true")}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
        // Tüm alt kategorileri kategorilerden çıkar
        const allSubCategories: SubCategory[] = [];
        result.data.forEach((category: Category & { subCategories?: SubCategory[] }) => {
          if (category.subCategories && category.subCategories.length > 0) {
            allSubCategories.push(...category.subCategories);
          }
        });
        setSubCategories(allSubCategories);
      }
    } catch (error) {
      console.error("Kategoriler yüklenemedi:", error);
    }
  };

  const fetchSlide = async () => {
    try {
      setLoadingSlide(true);
      const response = await fetch(`${getApiFetchUrl(`/api/homepage-slides/${slideId}`)}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        const slide = result.data;
        setFormData({
          category_id: slide.category_id?.toString() || "",
          subcategory_id: slide.subcategory_id?.toString() || "",
          link_url: slide.link_url || "",
          display_order: slide.display_order?.toString() || "0",
          is_active: slide.is_active !== undefined ? slide.is_active : true,
        });
        if (slide.image_url) {
          setPreviewImage(`${API_URL}${slide.image_url}`);
        }
      }
    } catch (error) {
      console.error("Slider yüklenemedi:", error);
    } finally {
      setLoadingSlide(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validasyon - Ana kategori veya alt kategori seçilmeli
    if (!formData.category_id && !formData.subcategory_id) {
      setError("Ana kategori veya alt kategori seçilmelidir");
      setLoading(false);
      return;
    }

    if (formData.category_id && formData.subcategory_id) {
      setError("Sadece ana kategori VEYA alt kategori seçilebilir, ikisi birden seçilemez");
      setLoading(false);
      return;
    }

    // Görüntülenme sırası boşsa veya 0 ise, otomatik olarak en yüksek sıradan sonraki değeri ata
    let displayOrder = formData.display_order ? parseInt(formData.display_order) : 0;
    if (displayOrder === 0 || !formData.display_order) {
      try {
        const slidesResponse = await fetch(`${getApiFetchUrl("/api/homepage-slides?include_inactive=true")}`, {
          credentials: "include",
        });
        const slidesResult = await slidesResponse.json();
        if (slidesResult.success && slidesResult.data.length > 0) {
          const maxOrder = Math.max(...slidesResult.data.map((s: HomepageSlide) => s.display_order || 0));
          displayOrder = maxOrder + 1;
        }
      } catch (err) {
        // Hata durumunda 0 kalsın
      }
    }

    if (!slideId && !image) {
      setError("Görsel yüklenmelidir");
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      if (image) {
        formDataToSend.append("image", image);
      }
      if (formData.category_id) {
        formDataToSend.append("category_id", formData.category_id);
      }
      if (formData.subcategory_id) {
        formDataToSend.append("subcategory_id", formData.subcategory_id);
      }
      if (formData.link_url) {
        formDataToSend.append("link_url", formData.link_url);
      }
      formDataToSend.append("display_order", displayOrder.toString());
      formDataToSend.append("is_active", formData.is_active.toString());

      const url = slideId
        ? getApiFetchUrl(`/api/homepage-slides/${slideId}`)
        : getApiFetchUrl("/api/homepage-slides");

      const response = await fetch(
        url,
        await mergeCsrfInit({
          method: slideId ? "PUT" : "POST",
          credentials: "include",
          body: formDataToSend,
        })
      );

      const result = await response.json();
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "İşlem başarısız");
      }
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (loadingSlide) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="text-center">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {slideId ? "Slider Düzenle" : "Yeni Slider Ekle"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Kategori Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ana Kategori
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  category_id: e.target.value,
                  subcategory_id: "", // Ana kategori seçilince alt kategoriyi temizle
                });
              }}
              className="w-full h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Ana Kategori Seçin</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alt Kategori Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alt Kategori (Opsiyonel)
            </label>
            <select
              value={formData.subcategory_id}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  subcategory_id: e.target.value,
                  category_id: "", // Alt kategori seçilince ana kategoriyi temizle
                });
              }}
              className="w-full h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Alt Kategori Seçin</option>
              {subCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </div>

          {/* Link URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link URL (Opsiyonel - boş bırakılırsa kategori slug'ından otomatik oluşturulur)
            </label>
            <input
              type="text"
              value={formData.link_url}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              placeholder="/kategori/kategori-slug"
              className="w-full h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>

          {/* Sıralama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Görüntülenme Sırası (Boş bırakılırsa otomatik sıralanır)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
              placeholder="Otomatik"
              className="w-full h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>

          {/* Görsel Yükleme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Görsel {!slideId && "*"} (500x500 piksel önerilir)
            </label>
            {previewImage && (
              <div className="mb-4 relative w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={previewImage}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required={!slideId}
              className="w-full h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>

          {/* Aktif/Pasif */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-black border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Aktif
            </label>
          </div>

          {/* Butonlar */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Kaydediliyor..." : slideId ? "Güncelle" : "Ekle"}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            >
              İptal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HomepageSlideList;
