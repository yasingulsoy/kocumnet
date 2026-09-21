import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { PackageCard } from "@/components/PackageCard";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Testler" };

const SEKMELER = [
  { key: "", label: "Tümü" },
  { key: "TYT", label: "TYT" },
  { key: "AYT", label: "AYT" },
] as const;

export default async function CatalogPage({ searchParams }: PageProps<"/paketler">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const tur = typeof sp.tur === "string" ? sp.tur.toUpperCase() : "";

  const hepsi = await loadCatalog(user.id, new Date());
  const liste = tur ? hepsi.filter((p) => p.examScope === tur) : hepsi;

  const sayi = (key: string) => (key ? hepsi.filter((p) => p.examScope === key).length : hepsi.length);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="Testler"
        description="Her paket kısa ve odaklı: her konudan en az 3 soru, 15-30 dakika. Sonunda konu haritan ve yanlışlarının çözümü."
      />

      <div role="tablist" aria-label="Sınav türü" className="flex gap-2">
        {SEKMELER.map((s) => {
          const aktif = tur === s.key;
          return (
            <Link
              key={s.label}
              role="tab"
              aria-selected={aktif}
              href={s.key ? { pathname: "/paketler", query: { tur: s.key } } : "/paketler"}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                aktif
                  ? "bg-brand-deep text-white shadow-card"
                  : "bg-surface text-ink-soft ring-1 ring-line hover:text-ink"
              )}
            >
              {s.label}
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px]",
                  aktif ? "bg-white/15 text-white" : "bg-surface-sunk text-ink-faint"
                )}
              >
                {sayi(s.key)}
              </span>
            </Link>
          );
        })}
      </div>

      {liste.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((p) => (
            <PackageCard key={p.slug} p={p} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title="Bu türde paket yok"
            description="Yakında yeni paketler eklenecek."
          />
        </Card>
      )}
    </div>
  );
}
