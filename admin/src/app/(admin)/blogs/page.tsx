"use client";
import React from "react";
import BlogList from "@/components/blogs/BlogList";
import Button from "@/components/ui/button/Button";
import { useRouter } from "next/navigation";

export default function BlogsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
          Blog Yazıları
        </h1>
        <Button onClick={() => router.push("/blogs/new")}>
          Yeni Blog Yazısı
        </Button>
      </div>
      <BlogList />
    </div>
  );
}
