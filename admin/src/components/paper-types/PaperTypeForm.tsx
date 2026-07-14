"use client";
import React, { useState, useEffect, useRef } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { API_URL } from "@/lib/api";
import Image from "next/image";

interface PaperTypeFormData {
  name: string;
  price: string;
  description: string[];
  is_active: boolean;
  display_order: string;
}

interface PaperTypeFormProps {
  paperTypeId?: number;
  onSubmit: (data: PaperTypeFormData, image: File | null, removeImage?: boolean) => Promise<void>;
  initialData?: Partial<PaperTypeFormData & { image_url?: string }>;
}

const PaperTypeForm: React.FC<PaperTypeFormProps> = ({
  paperTypeId,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState<PaperTypeFormData>({
    name: initialData?.name || "",
    price: initialData?.price?.toString() || "",
    description: initialData?.description || [],
    is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
    display_order: initialData?.display_order?.toString() || "0",
  });

  const [descriptionItems, setDescriptionItems] = useState<string[]>(
    initialData?.description || []
  );
  const [newDescriptionItem, setNewDescriptionItem] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(
    initialData?.image_url ? `${API_URL}${initialData.image_url}` : null
  );
  const [removeImage, setRemoveImage] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        price: initialData.price?.toString() || "",
        description: initialData.description || [],
        is_active: initialData.is_active !== undefined ? initialData.is_active : true,
        display_order: initialData.display_order?.toString() || "0",
      });
      setDescriptionItems(initialData.description || []);
      setPreviewImage(
        initialData.image_url ? `${API_URL}${initialData.image_url}` : null
      );
    }
  }, [initialData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setRemoveImage(false); // Yeni resim yükleniyorsa removeImage'i false yap
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setPreviewImage(null);
    setRemoveImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddDescriptionItem = () => {
    if (newDescriptionItem.trim()) {
      setDescriptionItems([...descriptionItems, newDescriptionItem.trim()]);
      setNewDescriptionItem("");
    }
  };

  const handleRemoveDescriptionItem = (index: number) => {
    setDescriptionItems(descriptionItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const submitData: PaperTypeFormData = {
        ...formData,
        description: descriptionItems,
      };
      await onSubmit(submitData, image, removeImage);
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="name">Kağıt Türü Adı *</Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Örn: Dokusuz Duvar Kağıdı"
          />
        </div>

        <div>
          <Label htmlFor="price">m² Fiyatı (₺) *</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step={0.01}
            value={formData.price}
            onChange={handleInputChange}
            required
            placeholder="100.00"
          />
          <p className="mt-1 text-xs text-gray-500">
            Bu fiyat, ürün base fiyatına eklenerek hesaplanır (m² başına)
          </p>
        </div>

        <div>
          <Label htmlFor="display_order">Görüntüleme Sırası</Label>
          <Input
            id="display_order"
            name="display_order"
            type="number"
            value={formData.display_order}
            onChange={handleInputChange}
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Açıklama Öğeleri</Label>
        <div className="space-y-2">
          {descriptionItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => {
                  const newItems = [...descriptionItems];
                  newItems[index] = e.target.value;
                  setDescriptionItems(newItems);
                }}
                placeholder="Açıklama öğesi"
              />
              <button
                type="button"
                onClick={() => handleRemoveDescriptionItem(index)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Sil
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newDescriptionItem}
              onChange={(e) => setNewDescriptionItem(e.target.value)}
              placeholder="Yeni açıklama öğesi ekle"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDescriptionItem();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddDescriptionItem}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="image">Resim</Label>
        <div className="mt-2">
          {previewImage && (
            <div className="relative w-32 h-32 mb-4">
              <Image
                src={previewImage}
                alt="Preview"
                fill
                className="object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            id="image"
            name="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="mt-1 text-sm text-gray-500">
            JPG, PNG veya WEBP formatında resim yükleyebilirsiniz (max 10MB)
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          checked={formData.is_active}
          onChange={handleInputChange}
          className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
        />
        <Label htmlFor="is_active" className="ml-2">
          Aktif
        </Label>
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={loading}
          className="bg-black text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Kaydediliyor..." : paperTypeId ? "Güncelle" : "Oluştur"}
        </Button>
      </div>
    </form>
  );
};

export default PaperTypeForm;
