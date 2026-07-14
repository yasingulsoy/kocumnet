import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { GridIcon, PageIcon, UserCircleIcon } from "@/icons/index";

export const metadata: Metadata = {
  title: "Kocumnet Admin Paneli",
  description: "Kocumnet yönetim paneli",
};

const quickLinks = [
  {
    title: "Blog Yazıları",
    description: "Blog içeriklerini yönetin",
    href: "/blogs",
    icon: <PageIcon />,
  },
  {
    title: "Kullanıcılar",
    description: "Admin kullanıcılarını yönetin",
    href: "/users",
    icon: <UserCircleIcon />,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
          Kocumnet Admin
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Eğitim danışmanlığı sitesi yönetim paneline hoş geldiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
            <GridIcon />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Genel Bakış
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Blog yazıları ve admin kullanıcılarını bu panelden yönetebilirsiniz.
          </p>
        </div>

        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/30"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {item.icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
