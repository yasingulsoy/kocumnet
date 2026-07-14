"use client";
import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Button from "../ui/button/Button";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { EyeIcon, EyeCloseIcon } from "@/icons";

interface SubCategory {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  display_order: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  subCategories?: SubCategory[];
}

// Sıralanabilir kategori öğesi
const SortableCategoryItem: React.FC<{
  category: Category;
  editingCategory: number | null;
  editingSubCategory: number | null;
  showAddSubCategory: number | null;
  formData: any;
  onStartEdit: (category: Category) => void;
  onUpdate: (categoryId: number, e: React.FormEvent) => void;
  onDelete: (categoryId: number) => void;
  onShowAddSubCategory: (categoryId: number) => void;
  onAddSubCategory: (categoryId: number, e: React.FormEvent) => void;
  onStartEditSubCategory: (subCategory: SubCategory) => void;
  onUpdateSubCategory: (subCategoryId: number, e: React.FormEvent) => void;
  onDeleteSubCategory: (subCategoryId: number) => void;
  onSetFormData: (data: any) => void;
  onSetEditingCategory: (id: number | null) => void;
  onSetEditingSubCategory: (id: number | null) => void;
  onSetShowAddSubCategory: (id: number | null) => void;
  onRefresh: () => void;
}> = ({
  category,
  editingCategory,
  editingSubCategory,
  showAddSubCategory,
  formData,
  onStartEdit,
  onUpdate,
  onDelete,
  onShowAddSubCategory,
  onAddSubCategory,
  onStartEditSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onSetFormData,
  onSetEditingCategory,
  onSetEditingSubCategory,
  onSetShowAddSubCategory,
  onRefresh,
}) => {
  const [showSubCategories, setShowSubCategories] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        {editingCategory === category.id ? (
          <form onSubmit={(e) => onUpdate(category.id, e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Kategori Adı *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => onSetFormData({ ...formData, name: e.target.value })}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Kısa Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => onSetFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => onSetEditingCategory(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              >
                İptal
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Sürükle ve bırak"
                >
                  <svg
                    className="w-5 h-5 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    Sıra: {category.display_order}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {category.name}
                  </h3>
                  {/* Alt Kategorileri Gizle/Göster İkonu */}
                  {category.subCategories && category.subCategories.length > 0 && (
                    <button
                      onClick={() => setShowSubCategories(!showSubCategories)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title={showSubCategories ? "Alt kategorileri gizle" : "Alt kategorileri göster"}
                    >
                      {showSubCategories ? (
                        <EyeIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <EyeCloseIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    category.is_active
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {category.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onStartEdit(category)}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => {
                    setShowSubCategories(true);
                    onShowAddSubCategory(category.id);
                  }}
                  className="text-green-600 hover:text-green-900 dark:text-green-400"
                >
                  Alt Kategori Ekle
                </button>
                <button
                  onClick={() => onDelete(category.id)}
                  className="text-red-600 hover:text-red-900 dark:text-red-400"
                >
                  Sil
                </button>
              </div>
            </div>

            {/* Alt Kategoriler */}
            {showSubCategories && (
              <SortableSubCategoryList
                categoryId={category.id}
                subCategories={category.subCategories || []}
                editingSubCategory={editingSubCategory}
                showAddSubCategory={showAddSubCategory === category.id}
                formData={formData}
                onStartEditSubCategory={onStartEditSubCategory}
                onUpdateSubCategory={onUpdateSubCategory}
                onDeleteSubCategory={onDeleteSubCategory}
                onAddSubCategory={(e) => onAddSubCategory(category.id, e)}
                onSetFormData={onSetFormData}
                onSetEditingSubCategory={onSetEditingSubCategory}
                onSetShowAddSubCategory={onSetShowAddSubCategory}
                onRefresh={onRefresh}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Sıralanabilir alt kategori öğesi
const SortableSubCategoryItem: React.FC<{
  subCategory: SubCategory;
  categoryId: number;
  editingSubCategory: number | null;
  formData: any;
  onStartEdit: (subCategory: SubCategory) => void;
  onUpdate: (subCategoryId: number, e: React.FormEvent) => void;
  onDelete: (subCategoryId: number) => void;
  onSetFormData: (data: any) => void;
  onSetEditingSubCategory: (id: number | null) => void;
}> = ({
  subCategory,
  categoryId,
  editingSubCategory,
  formData,
  onStartEdit,
  onUpdate,
  onDelete,
  onSetFormData,
  onSetEditingSubCategory,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `subcategory-${subCategory.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {editingSubCategory === subCategory.id ? (
        <form
          onSubmit={(e) => onUpdate(subCategory.id, e)}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => onSetFormData({ ...formData, name: e.target.value })}
            className="h-9 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={() => onSetEditingSubCategory(null)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            İptal
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing flex items-center justify-center w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title="Sürükle ve bırak"
            >
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              Sıra: {subCategory.display_order}
            </span>
            <span className="text-sm text-gray-800 dark:text-white/90">
              {subCategory.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                subCategory.is_active
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {subCategory.is_active ? "Aktif" : "Pasif"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onStartEdit(subCategory)}
              className="text-xs text-blue-600 hover:text-blue-900 dark:text-blue-400"
            >
              Düzenle
            </button>
            <button
              onClick={() => onDelete(subCategory.id)}
              className="text-xs text-red-600 hover:text-red-900 dark:text-red-400"
            >
              Sil
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Alt kategori listesi
const SortableSubCategoryList: React.FC<{
  categoryId: number;
  subCategories: SubCategory[];
  editingSubCategory: number | null;
  showAddSubCategory: boolean;
  formData: any;
  onStartEditSubCategory: (subCategory: SubCategory) => void;
  onUpdateSubCategory: (subCategoryId: number, e: React.FormEvent) => void;
  onDeleteSubCategory: (subCategoryId: number) => void;
  onAddSubCategory: (e: React.FormEvent) => void;
  onSetFormData: (data: any) => void;
  onSetEditingSubCategory: (id: number | null) => void;
  onSetShowAddSubCategory: (id: number | null) => void;
  onRefresh: () => void;
}> = ({
  categoryId,
  subCategories,
  editingSubCategory,
  showAddSubCategory,
  formData,
  onStartEditSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onAddSubCategory,
  onSetFormData,
  onSetEditingSubCategory,
  onSetShowAddSubCategory,
  onRefresh,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = subCategories.findIndex(
      (item) => `subcategory-${item.id}` === active.id
    );
    const newIndex = subCategories.findIndex(
      (item) => `subcategory-${item.id}` === over.id
    );

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSubCategories = arrayMove(subCategories, oldIndex, newIndex);
      
      // Yeni sıralamaya göre display_order değerlerini güncelle
      const updatedSubCategories = newSubCategories.map((item, index) => ({
        ...item,
        display_order: index + 1,
      }));

      // Backend'e gönder
      try {
        const result = await apiPut<{ success: boolean }>(
          "/api/categories/sub-categories/reorder",
          {
            subCategoryOrders: updatedSubCategories.map((item) => ({
              id: item.id,
              display_order: item.display_order,
            })),
          }
        );

        if (result.success) {
          // Başarılı olduğunda kategorileri yeniden yükle
          onRefresh();
        }
      } catch (error: any) {
        console.error("Alt kategori sıralama güncelleme hatası:", error);
        alert(`Alt kategori sıralaması güncellenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
      }
    }
  };

  const subCategoryIds = subCategories.map((item) => `subcategory-${item.id}`);

  return (
    <div className="mt-4 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
      {subCategories.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={subCategoryIds} strategy={verticalListSortingStrategy}>
            {subCategories.map((subCategory) => (
              <div
                key={subCategory.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
              >
                <SortableSubCategoryItem
                  subCategory={subCategory}
                  categoryId={categoryId}
                  editingSubCategory={editingSubCategory}
                  formData={formData}
                  onStartEdit={onStartEditSubCategory}
                  onUpdate={onUpdateSubCategory}
                  onDelete={onDeleteSubCategory}
                  onSetFormData={onSetFormData}
                  onSetEditingSubCategory={onSetEditingSubCategory}
                />
              </div>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Alt kategori yok
        </p>
      )}

      {/* Alt Kategori Ekleme Formu */}
      {showAddSubCategory && (
        <form
          onSubmit={onAddSubCategory}
          className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
        >
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Alt kategori adı"
              value={formData.name}
              onChange={(e) => onSetFormData({ ...formData, name: e.target.value })}
              className="h-9 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              Ekle
            </button>
            <button
              type="button"
              onClick={() => {
                onSetShowAddSubCategory(null);
                onSetFormData({ name: "", description: "", display_order: 0, is_active: true });
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              İptal
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const CategoryList: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<number | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSubCategory, setShowAddSubCategory] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const result = await apiGet<{ success: boolean; data: Category[] }>(
        `/api/categories?include_inactive=true`
      );

      if (result.success) {
        setCategories(result.data);
      }
    } catch (error: any) {
      console.error("Kategoriler yüklenemedi:", error);
      alert(`Kategoriler yüklenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((item) => item.id === active.id);
    const newIndex = categories.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      
      // Yeni sıralamaya göre display_order değerlerini güncelle
      const updatedCategories = newCategories.map((item, index) => ({
        ...item,
        display_order: index + 1,
      }));

      // Backend'e gönder
      try {
        const result = await apiPut<{ success: boolean }>("/api/categories/reorder", {
          categoryOrders: updatedCategories.map((item) => ({
            id: item.id,
            display_order: item.display_order,
          })),
        });

        if (result.success) {
          // Başarılı olduğunda kategorileri yeniden yükle
          setCategories(updatedCategories);
        }
      } catch (error: any) {
        console.error("Kategori sıralama güncelleme hatası:", error);
        alert(`Sıralama güncellenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
      }
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiPost<{ success: boolean }>("/api/categories", formData);
      if (result.success) {
        setShowAddCategory(false);
        setFormData({ name: "", description: "", display_order: 0, is_active: true });
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Kategori ekleme hatası:", error);
      alert(`Kategori eklenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const handleAddSubCategory = async (categoryId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiPost<{ success: boolean }>(
        `/api/categories/${categoryId}/sub-categories`,
        formData
      );
      if (result.success) {
        setShowAddSubCategory(null);
        setFormData({ name: "", description: "", display_order: 0, is_active: true });
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Alt kategori ekleme hatası:", error);
      alert(`Alt kategori eklenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const handleUpdateCategory = async (categoryId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiPut<{ success: boolean }>(
        `/api/categories/${categoryId}`,
        formData
      );
      if (result.success) {
        setEditingCategory(null);
        setFormData({ name: "", description: "", display_order: 0, is_active: true });
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Kategori güncelleme hatası:", error);
      alert(`Kategori güncellenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const handleUpdateSubCategory = async (subCategoryId: number, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiPut<{ success: boolean }>(
        `/api/categories/sub-categories/${subCategoryId}`,
        formData
      );
      if (result.success) {
        setEditingSubCategory(null);
        setFormData({ name: "", description: "", display_order: 0, is_active: true });
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Alt kategori güncelleme hatası:", error);
      alert(`Alt kategori güncellenirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;

    try {
      const result = await apiDelete<{ success: boolean }>(`/api/categories/${categoryId}`);
      if (result.success) {
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Kategori silme hatası:", error);
      alert(`Kategori silinirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const handleDeleteSubCategory = async (subCategoryId: number) => {
    if (!confirm("Bu alt kategoriyi silmek istediğinize emin misiniz?")) return;

    try {
      const result = await apiDelete<{ success: boolean }>(
        `/api/categories/sub-categories/${subCategoryId}`
      );
      if (result.success) {
        fetchCategories();
      }
    } catch (error: any) {
      console.error("Alt kategori silme hatası:", error);
      alert(`Alt kategori silinirken hata oluştu: ${error.message || "Bilinmeyen hata"}`);
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category.id);
    setFormData({
      name: category.name,
      description: category.description || "",
      display_order: category.display_order,
      is_active: category.is_active,
    });
  };

  const startEditSubCategory = (subCategory: SubCategory) => {
    setEditingSubCategory(subCategory.id);
    setFormData({
      name: subCategory.name,
      description: "",
      display_order: subCategory.display_order,
      is_active: subCategory.is_active,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const categoryIds = categories.map((item) => item.id);

  return (
    <div className="space-y-6">
      {/* Kategori Ekle Butonu */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Kategoriler</h2>
        <Button onClick={() => setShowAddCategory(true)}>Yeni Kategori Ekle</Button>
      </div>

      {/* Kategori Ekleme Formu */}
      {showAddCategory && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="mb-4 text-lg font-semibold">Yeni Kategori</h3>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Kategori Adı *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Sıralama
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">Aktif</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false);
                  setFormData({ name: "", description: "", display_order: 0, is_active: true });
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kategori Listesi */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {categories.map((category) => (
              <SortableCategoryItem
                key={category.id}
                category={category}
                editingCategory={editingCategory}
                editingSubCategory={editingSubCategory}
                showAddSubCategory={showAddSubCategory}
                formData={formData}
                onStartEdit={startEditCategory}
                onUpdate={handleUpdateCategory}
                onDelete={handleDeleteCategory}
                onShowAddSubCategory={setShowAddSubCategory}
                onAddSubCategory={handleAddSubCategory}
                onStartEditSubCategory={startEditSubCategory}
                onUpdateSubCategory={handleUpdateSubCategory}
                onDeleteSubCategory={handleDeleteSubCategory}
                onSetFormData={setFormData}
                onSetEditingCategory={setEditingCategory}
                onSetEditingSubCategory={setEditingSubCategory}
                onSetShowAddSubCategory={setShowAddSubCategory}
                onRefresh={fetchCategories}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default CategoryList;
