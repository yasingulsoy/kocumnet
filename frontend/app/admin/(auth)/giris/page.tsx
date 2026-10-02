import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { staffDurumu } from "@/lib/admin/auth";
import { Notice } from "@/components/admin/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

export default async function GirisPage({ searchParams }: PageProps<"/admin/giris">) {
  const d = await staffDurumu();
  if (d.kind === "ok") redirect("/admin");

  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;

  return (
    <>
      <h1 className="font-display text-h2 font-bold tracking-tight text-ink">Personel girişi</h1>
      <p className="mt-1.5 text-body text-ink-soft">Blog, mesajlar ve ekip yönetimi için hesabınla gir.</p>

      <div className="mt-6 space-y-4">
        {d.kind === "unreachable" || sp.hata === "backend" ? (
          <Notice tone="warn" title="Sunucuya ulaşılamıyor">
            Kimlik sunucusu yanıt vermiyor. Birkaç dakika sonra tekrar dene; sorun sürerse teknik ekibe haber ver.
          </Notice>
        ) : null}
        {sp.parola === "1" ? <Notice tone="ok">Parolan kaydedildi. Şimdi giriş yapabilirsin.</Notice> : null}
        {sp.cikis === "1" ? <Notice tone="info">Çıkış yapıldı.</Notice> : null}
        <LoginForm next={next} />
      </div>
    </>
  );
}
