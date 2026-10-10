import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { guvenliSonraki, staffDurumu } from "@/lib/admin/auth";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { AuthHeading } from "../AuthHeading";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Giriş" };

export default async function GirisPage({ searchParams }: PageProps<"/admin/giris">) {
  const sp = await searchParams;
  // Yalnızca panelin kendi adresleri: dışarıya yönlendirme yok.
  const next = guvenliSonraki(sp.next) ?? undefined;

  const d = await staffDurumu();
  if (d.kind === "ok") redirect(next ?? "/admin");

  return (
    <>
      <AuthHeading title="Personel girişi" description="Blog, mesajlar ve ekip yönetimi için hesabınla gir." />

      <div className="space-y-5">
        {d.kind === "unreachable" || sp.hata === "backend" ? (
          <Alert variant="warning" title="Sunucuya ulaşılamıyor">
            Kimlik sunucusu yanıt vermiyor. Birkaç dakika sonra tekrar dene; sorun sürerse teknik ekibe haber ver.
          </Alert>
        ) : null}
        {sp.parola === "1" ? <Alert variant="success">Parolan kaydedildi. Şimdi giriş yapabilirsin.</Alert> : null}
        {sp.cikis === "1" ? <Alert variant="info">Çıkış yapıldı.</Alert> : null}
        {next && next !== "/admin" && sp.parola !== "1" ? (
          <Alert variant="info">Bu sayfa için giriş yapman gerekiyor; sonra kaldığın yere döneceksin.</Alert>
        ) : null}
        <LoginForm next={next} />
      </div>
    </>
  );
}
