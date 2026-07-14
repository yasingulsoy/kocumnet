"use client";
import React, { useState, useEffect, useRef } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import ReactQuillWrapper from "../form/ReactQuillWrapper";
import { API_URL } from "@/lib/api";

interface BlogFormData {
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  is_published: boolean;
  meta_title: string;
  meta_description: string;
  locale: string;
}

interface BlogFormProps {
  blogId?: number;
  onSubmit: (data: BlogFormData, imageFile?: File) => Promise<void>;
  initialData?: Partial<BlogFormData & { image?: string }>;
}

const BlogForm: React.FC<BlogFormProps> = ({
  blogId,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState<BlogFormData>({
    title: initialData?.title || "",
    content: initialData?.content || "",
    excerpt: initialData?.excerpt || "",
    tags: initialData?.tags || [],
    is_published: initialData?.is_published || false,
    meta_title: initialData?.meta_title || "",
    meta_description: initialData?.meta_description || "",
    locale: initialData?.locale || "tr",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image ? `${API_URL}${initialData.image}` : null
  );
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // React Quill modülleri
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      ["link", "image"],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "indent",
    "link",
    "image",
    "color",
    "background",
    "align",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContentChange = (value: string) => {
    setFormData((prev) => ({ ...prev, content: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("Başlık gerekli");
      return;
    }

    if (!formData.content.trim()) {
      setError("İçerik gerekli");
      return;
    }

    // Meta title yoksa title'dan oluştur
    if (!formData.meta_title.trim()) {
      formData.meta_title = formData.title;
    }

    try {
      setLoading(true);
      await onSubmit(formData, imageFile || undefined);
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Başlık */}
      <div>
        <Label htmlFor="title">Başlık *</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="Blog başlığını girin"
          required
        />
      </div>

      {/* Özet */}
      <div>
        <Label htmlFor="excerpt">Özet</Label>
        <textarea
          id="excerpt"
          name="excerpt"
          value={formData.excerpt}
          onChange={handleInputChange}
          placeholder="Blog özetini girin"
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
        />
      </div>

      {/* İçerik */}
      <div>
        <Label htmlFor="content">İçerik *</Label>
        <ReactQuillWrapper
          value={formData.content}
          onChange={handleContentChange}
          modules={modules}
          formats={formats}
          placeholder="Blog içeriğini yazın..."
          className="bg-white dark:bg-gray-800"
          style={{ minHeight: "400px" }}
        />
      </div>

      {/* Resim */}
      <div>
        <Label htmlFor="image">Kapak Resmi</Label>
        <div className="mt-2">
          {imagePreview && (
            <div className="mb-4 relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-64 h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            id="image"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-300 dark:hover:file:bg-gray-600"
          />
        </div>
      </div>

      {/* Etiketler */}
      <div>
        <Label htmlFor="tags">Etiketler</Label>
        <div className="flex gap-2 mb-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Etiket ekle ve Enter'a bas"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleAddTag}
            className="whitespace-nowrap"
          >
            Ekle
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SEO Ayarları */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          SEO Ayarları
        </h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="meta_title">Meta Başlık</Label>
            <Input
              id="meta_title"
              name="meta_title"
              value={formData.meta_title}
              onChange={handleInputChange}
              placeholder="SEO için başlık (boş bırakılırsa blog başlığı kullanılır)"
            />
          </div>

          <div>
            <Label htmlFor="meta_description">Meta Açıklama</Label>
            <textarea
              id="meta_description"
              name="meta_description"
              value={formData.meta_description}
              onChange={handleInputChange}
              placeholder="SEO için açıklama"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
            />
          </div>

          <div>
            <Label htmlFor="locale">Dil</Label>
            <select
              id="locale"
              name="locale"
              value={formData.locale}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Yayın Durumu */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_published"
          name="is_published"
          checked={formData.is_published}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, is_published: e.target.checked }))
          }
          className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
        />
        <Label htmlFor="is_published" className="!mb-0">
          Hemen yayınla
        </Label>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Kaydediliyor..." : blogId ? "Güncelle" : "Kaydet"}
        </Button>
        <Button
          type="button"
          onClick={() => window.history.back()}
          className="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          İptal
        </Button>
      </div>
    </form>
  );
};

export default BlogForm;
