"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import BlogForm from "@/components/blogs/BlogForm";
import { getApiFetchUrl, apiGet, mergeCsrfInit } from "@/lib/api";

interface Blog {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  image?: string;
  tags?: string[];
  is_published: boolean;
  meta_title?: string;
  meta_description?: string;
  locale: string;
}

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const blogId = params.id as string;
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBlog();
  }, [blogId]);

  const fetchBlog = async () => {
    try {
      const result = await apiGet<{ success: boolean; data: Blog }>(`/api/blogs/${blogId}`);

      if (result.success) {
        setBlog(result.data);
      } else {
        alert("Blog bulunamadı");
        router.push("/blogs");
      }
    } catch (error: any) {
      console.error("Blog yüklenemedi:", error);
      alert(error.message || "Blog yüklenirken bir hata oluştu");
      router.push("/blogs");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any, imageFile?: File) => {
    setSaving(true);
    try {
      // Blogu güncelle
      const response = await fetch(
        `${getApiFetchUrl(`/api/blogs/${blogId}`)}`,
        await mergeCsrfInit({
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(formData),
        })
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Blog güncellenemedi");
      }

      // Eğer yeni resim varsa yükle
      if (imageFile) {
        const formDataImage = new FormData();
        formDataImage.append("image", imageFile);

        const imageResponse = await fetch(
          `${getApiFetchUrl(`/api/blogs/${blogId}/image`)}`,
          await mergeCsrfInit({
            method: "POST",
            credentials: "include",
            body: formDataImage,
          })
        );

        const imageResult = await imageResponse.json();
        if (!imageResult.success) {
          console.error("Resim yükleme hatası:", imageResult.error);
        }
      }

      router.push("/blogs");
    } catch (error: any) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

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

  if (!blog) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
        Blog Yazısını Düzenle
      </h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <BlogForm
          blogId={parseInt(blogId)}
          onSubmit={handleSubmit}
          initialData={{
            title: blog.title,
            content: blog.content,
            excerpt: blog.excerpt,
            tags: blog.tags || [],
            is_published: blog.is_published,
            meta_title: blog.meta_title,
            meta_description: blog.meta_description,
            locale: blog.locale,
            image: blog.image,
          }}
        />
      </div>
    </div>
  );
}
