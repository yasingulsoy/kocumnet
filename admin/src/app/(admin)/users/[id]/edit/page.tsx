"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet, apiPut } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Link from "next/link";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "viewer" as "admin" | "manager" | "editor" | "viewer",
    is_active: true,
  });

  useEffect(() => {
    if (!hasPermission(['admin', 'manager'])) {
      router.push("/users");
      return;
    }
    fetchUser();
  }, [userId, hasPermission, router]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await apiGet<{ success: boolean; data: any }>(`/api/admin/users/${userId}`);
      if (response.success) {
        const user = response.data;
        setFormData({
          username: user.username,
          email: user.email,
          password: "", // Şifre gösterilmez
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone || "",
          role: user.role,
          is_active: user.is_active,
        });
      }
    } catch (err: any) {
      setError(err.message || "Kullanıcı bilgileri yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const updateData = { ...formData };
      // Şifre boşsa gönderme
      if (!updateData.password) {
        delete (updateData as any).password;
      }
      
      const response = await apiPut<{ success: boolean; message: string }>(`/api/admin/users/${userId}`, updateData);
      if (response.success) {
        router.push("/users");
      }
    } catch (err: any) {
      setError(err.message || "Kullanıcı güncellenirken bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="mb-6">
        <Link href="/users" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          ← Kullanıcı listesine dön
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90 mt-4">
          Kullanıcı Düzenle
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>
              Kullanıcı Adı <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              E-posta <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)
            </Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              Telefon
            </Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              Ad <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              Soyad <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
              disabled={saving}
            />
          </div>

          <div>
            <Label>
              Rol <span className="text-error-500">*</span>
            </Label>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:border-gray-700 dark:focus:border-brand-800"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              required
              disabled={saving || !hasPermission(['admin'])}
            >
              <option value="viewer">Görüntüleyici</option>
              <option value="editor">Editör</option>
              <option value="manager">Müdür</option>
              <option value="admin">Yönetici</option>
            </select>
          </div>

          <div>
            <Label>
              Durum
            </Label>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:border-gray-700 dark:focus:border-brand-800"
              value={formData.is_active ? "true" : "false"}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
              disabled={saving}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
          </Button>
          <Link href="/users">
            <Button type="button" variant="outline" disabled={saving}>
              İptal
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
