import Link from "next/link";
import { Compass } from "lucide-react";
import { LinkButton, Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Link href="/" aria-label="Ana sayfa">
        <Wordmark />
      </Link>
      <span className="mt-12 flex size-16 items-center justify-center rounded-2xl bg-brand-wash text-brand">
        <Compass className="size-7" />
      </span>
      <p className="font-display tabular mt-6 text-sm font-semibold text-brand">404</p>
      <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink">
        Aradığın sayfa burada değil
      </h1>
      <p className="mt-2 max-w-sm text-[15px] text-ink-soft">
        Bağlantı eskimiş ya da sonuç başka bir hesaba ait olabilir.
      </p>
      <div className="mt-8 flex gap-3">
        <LinkButton href="/panel">Ana sayfaya dön</LinkButton>
        <LinkButton href="/paketler" variant="secondary">
          Testler
        </LinkButton>
      </div>
    </main>
  );
}
