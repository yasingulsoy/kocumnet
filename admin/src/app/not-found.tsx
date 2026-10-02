import Link from "next/link";
import { Compass } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/checkup/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-center">
      <Link href="/checkup" aria-label="Genel bakış">
        <Wordmark />
      </Link>
      <span className="mt-12 flex size-16 items-center justify-center rounded-2xl bg-brand-wash text-brand">
        <Compass className="size-7" />
      </span>
      <p className="font-display tabular mt-6 text-caption font-semibold text-brand">404</p>
      <h1 className="font-display mt-1 text-h1 font-bold tracking-tight text-ink">Sayfa bulunamadı</h1>
      <p className="mt-2 max-w-sm text-body text-ink-soft">
        Bağlantı eskimiş olabilir; blog ve personel ekranları kocum.net/admin&apos;e taşındı.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/checkup" className={buttonClass("primary", "md")}>
          Genel bakış
        </Link>
        <Link href="/checkup/sorular" className={buttonClass("outline", "md")}>
          Sorular
        </Link>
      </div>
    </main>
  );
}
