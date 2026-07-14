"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Button from "../ui/button/Button";
import { useRouter } from "next/navigation";
import { API_URL, getApiFetchUrl, mergeCsrfInit } from "@/lib/api";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface Blog {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  image?: string;
  is_published: boolean;
  published_at?: string;
  view_count: number;
  locale: string;
  created_at: string;
  updated_at: string;
}

type BlogSortKey = "title" | "published" | "views" | "date";

const BlogList: React.FC = () => {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [sort, setSort] = useState<{ key: BlogSortKey; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    setSort(null);
    fetchBlogs();
  }, [filter]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === "all") params.append("include_drafts", "true");
      if (filter === "published") params.append("is_published", "true");
      if (filter === "draft") params.append("is_published", "false");

      const response = await fetch(
        `${getApiFetchUrl(`/api/blogs?${params.toString()}`)}`,
        { credentials: "include" }
      );
      const result = await response.json();

      if (result.success) {
        setBlogs(result.data);
      }
    } catch (error) {
      console.error("Bloglar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blogId: number) => {
    if (!confirm("Bu blogu silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/blogs/${blogId}`)}`,
        await mergeCsrfInit({
          method: "DELETE",
          credentials: "include",
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchBlogs();
      } else {
        alert(result.error || "Blog silinirken bir hata oluştu");
      }
    } catch (error) {
      console.error("Blog silme hatası:", error);
      alert("Blog silinirken bir hata oluştu");
    }
  };

  const handleTogglePublish = async (blogId: number, isPublished: boolean) => {
    try {
      const response = await fetch(
        `${getApiFetchUrl(`/api/blogs/${blogId}`)}`,
        await mergeCsrfInit({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_published: !isPublished }),
        })
      );

      const result = await response.json();
      if (result.success) {
        fetchBlogs();
      }
    } catch (error) {
      console.error("Yayın durumu güncelleme hatası:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const requestSort = useCallback((key: BlogSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedBlogs = useMemo(
    () =>
      sortRowData(blogs, sort, {
        title: (b) => b.title,
        published: (b) => b.is_published,
        views: (b) => b.view_count,
        date: (b) => new Date(b.created_at).getTime(),
      }),
    [blogs, sort]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtreler */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Tümü
        </button>
        <button
          onClick={() => setFilter("published")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "published"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Yayında
        </button>
        <button
          onClick={() => setFilter("draft")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "draft"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Taslak
        </button>
      </div>

      {/* Blog Listesi */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <SortableTableTh columnKey="title" sort={sort} onSort={requestSort}>
                  Başlık
                </SortableTableTh>
                <SortableTableTh columnKey="published" sort={sort} onSort={requestSort}>
                  Durum
                </SortableTableTh>
                <SortableTableTh columnKey="views" sort={sort} onSort={requestSort}>
                  Görüntülenme
                </SortableTableTh>
                <SortableTableTh columnKey="date" sort={sort} onSort={requestSort}>
                  Tarih
                </SortableTableTh>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-white/[0.03] divide-y divide-gray-200 dark:divide-gray-800">
              {sortedBlogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Henüz blog yazısı eklenmemiş
                  </td>
                </tr>
              ) : (
                sortedBlogs.map((blog) => (
                  <tr key={blog.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {blog.image && (
                          <img
                            src={`${API_URL}${blog.image}`}
                            alt={blog.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {blog.title}
                          </div>
                          {blog.excerpt && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                              {blog.excerpt}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          blog.is_published
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {blog.is_published ? "Yayında" : "Taslak"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {blog.view_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(blog.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleTogglePublish(blog.id, blog.is_published)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            blog.is_published
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400"
                              : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400"
                          }`}
                        >
                          {blog.is_published ? "Yayından Kaldır" : "Yayınla"}
                        </button>
                        <button
                          onClick={() => router.push(`/blogs/${blog.id}/edit`)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(blog.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 transition-colors"
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
      </div>
    </div>
  );
};

export default BlogList;
