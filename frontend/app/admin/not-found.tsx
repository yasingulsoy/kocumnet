import Link from "next/link";
import { Compass } from "lucide-react";
import { Wordmark } from "@/components/LogoMark";
import { buttonClass } from "@/components/ui";

export default function AdminNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-center">
      <Link href="/admin" aria-label="Panel">
        <Wordmark />
      </Link>
      <span className="mt-12 flex size-16 items-center justify-center rounded-2xl bg-brand-wash text-brand">
        <Compass className="size-7" />
      </span>
      <p className="font-display tabular mt-6 text-caption font-semibold text-brand">404</p>
      <h1 className="font-display mt-1 text-h3 font-bold tracking-tight text-ink">Sayfa bulunamadı</h1>
      <p className="mt-2 max-w-sm text-body text-ink-soft">Kayıt silinmiş ya da bağlantı eskimiş olabilir.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/admin" className={buttonClass({ size: "md" })}>Panele dön</Link>
        <Link href="/" className={buttonClass({ variant: "secondary", size: "md" })}>kocum.net</Link>
      </div>
    </main>
  );
}
