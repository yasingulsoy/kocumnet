"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, ServerCrash } from "lucide-react";
import { Button, Container, LinkButton } from "@/components/ui";

const METIN = {
  tr: { baslik: "Bir şeyler ters gitti", metin: "Sayfa yüklenirken beklenmeyen bir hata oldu. Yeniden deneyebilirsin.", tekrar: "Tekrar dene", ana: "Ana sayfa" },
  en: { baslik: "Something went wrong", metin: "An unexpected error occurred while loading the page. You can try again.", tekrar: "Try again", ana: "Home" },
  ar: { baslik: "حدث خطأ ما", metin: "حدث خطأ غير متوقع أثناء تحميل الصفحة. يمكنك المحاولة مرة أخرى.", tekrar: "حاول مجدداً", ana: "الرئيسية" },
} as const;

/** Next 16: kurtarma fonksiyonunun adı `retry` (`reset` değil). */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname() ?? "/";
  const dil = pathname.startsWith("/en") ? "en" : pathname.startsWith("/ar") ? "ar" : "tr";
  const t = METIN[dil];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-bad-wash text-bad">
        <ServerCrash className="size-7" />
      </span>
      <h1 className="font-display mt-6 text-h2 font-semibold tracking-tight text-ink">{t.baslik}</h1>
      <p className="mt-3 max-w-md text-body text-ink-soft">{t.metin}</p>
      {error.digest ? <p className="mt-2 font-mono text-micro text-ink-faint">{error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>
          <RotateCcw /> {t.tekrar}
        </Button>
        <LinkButton href={dil === "tr" ? "/" : `/${dil}`} variant="secondary">
          {t.ana}
        </LinkButton>
      </div>
    </Container>
  );
}
