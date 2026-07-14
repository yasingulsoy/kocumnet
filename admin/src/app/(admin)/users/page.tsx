"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { apiGet, apiDelete } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/button/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  is_active: boolean;
  created_at: string;
}

type UserSortKey = "username" | "email" | "fullname" | "role" | "active" | "created";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [sort, setSort] = useState<{ key: UserSortKey; dir: "asc" | "desc" } | null>(null);

  const canManage = hasPermission(['admin', 'manager']);

  useEffect(() => {
    if (!canManage) {
      router.push("/");
      return;
    }
    fetchUsers();
  }, [canManage, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiGet<{ success: boolean; data: User[] }>('/api/admin/users');
      if (response.success) {
        setUsers(response.data);
      }
    } catch (err: any) {
      setError(err.message || "Kullanıcılar yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      await apiDelete(`/api/admin/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message || "Kullanıcı silinirken bir hata oluştu");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'manager':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Yönetici',
      manager: 'Müdür',
      editor: 'Editör',
      viewer: 'Görüntüleyici',
    };
    return labels[role] || role;
  };

  const requestSort = useCallback((key: UserSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedUsers = useMemo(
    () =>
      sortRowData(users, sort, {
        username: (u) => u.username,
        email: (u) => u.email,
        fullname: (u) => `${u.first_name} ${u.last_name}`.trim(),
        role: (u) => getRoleLabel(u.role),
        active: (u) => u.is_active,
        created: (u) => new Date(u.created_at).getTime(),
      }),
    [users, sort]
  );

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Kullanıcı Yönetimi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Admin panel kullanıcılarını yönetin
          </p>
        </div>
        {hasPermission(['admin']) && (
          <Link href="/users/new">
            <Button size="sm">Yeni Kullanıcı Ekle</Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <SortableTableTh columnKey="username" sort={sort} onSort={requestSort}>
                Kullanıcı Adı
              </SortableTableTh>
              <SortableTableTh columnKey="email" sort={sort} onSort={requestSort}>
                E-posta
              </SortableTableTh>
              <SortableTableTh columnKey="fullname" sort={sort} onSort={requestSort}>
                Ad Soyad
              </SortableTableTh>
              <SortableTableTh columnKey="role" sort={sort} onSort={requestSort}>
                Rol
              </SortableTableTh>
              <SortableTableTh columnKey="active" sort={sort} onSort={requestSort}>
                Durum
              </SortableTableTh>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Henüz kullanıcı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {user.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/users/${user.id}/edit`}>
                        <Button size="sm" variant="outline">Düzenle</Button>
                      </Link>
                      {hasPermission(['admin']) && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Sil
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
