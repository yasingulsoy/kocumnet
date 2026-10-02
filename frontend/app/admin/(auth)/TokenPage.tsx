import Link from "next/link";
import { BackendError, BackendUnreachable, backend } from "@/lib/admin/backend";
import { Notice, buttonClass } from "@/components/admin/ui";
import { ResetForm } from "./ResetForm";

interface TokenBilgisi {
  purpose: "invite" | "reset";
  email: string;
  name?: string;
}

/**
 * Davet ve sıfırlama sayfalarının ortak gövdesi. Bağlantı önce backend'e
 * sorulur: süresi dolmuşsa formu hiç göstermeyiz — kullanıcı parolayı yazıp
 * "geçersiz" cevabı almasın.
 */
export async function TokenPage({ token, beklenen }: { token: string; beklenen: "invite" | "reset" }) {
  let bilgi: TokenBilgisi | null = null;
  let ulasilamadi = false;
  try {
    bilgi = await backend<TokenBilgisi>(`/api/admin/auth/token/${encodeURIComponent(token)}`, { auth: false });
  } catch (e) {
    if (e instanceof BackendUnreachable) ulasilamadi = true;
    else if (!(e instanceof BackendError)) throw e;
  }

  if (ulasilamadi) {
    return (
      <Notice tone="warn" title="Sunucuya ulaşılamıyor">
        Birkaç dakika sonra bu sayfayı yenile; bağlantın geçerliliğini korur.
      </Notice>
    );
  }

  if (!bilgi) {
    return (
      <>
        <h1 className="font-display text-h2 font-bold tracking-tight text-ink">Bağlantı geçersiz</h1>
        <p className="mt-1.5 text-body text-ink-soft">
          Bu bağlantının süresi dolmuş ya da daha önce kullanılmış. {beklenen === "invite" ? "Yöneticinden yeni bir davet iste." : "Yeni bir bağlantı isteyebilirsin."}
        </p>
        <div className="mt-6 flex gap-3">
          {beklenen === "reset" ? (
            <Link href="/admin/sifremi-unuttum" className={buttonClass({ size: "md" })}>
              Yeni bağlantı iste
            </Link>
          ) : null}
          <Link href="/admin/giris" className={buttonClass({ variant: "secondary", size: "md" })}>
            Girişe dön
          </Link>
        </div>
      </>
    );
  }

  const ilkParola = bilgi.purpose === "invite";
  return (
    <>
      <h1 className="font-display text-h2 font-bold tracking-tight text-ink">
        {ilkParola ? `Hoş geldin${bilgi.name ? `, ${bilgi.name.split(" ")[0]}` : ""}` : "Yeni parola"}
      </h1>
      <p className="mt-1.5 text-body text-ink-soft">
        {ilkParola
          ? "Hesabın hazır. Giriş yapabilmek için bir parola belirle."
          : "Hesabın için yeni bir parola belirle. Diğer cihazlardaki oturumların kapatılır."}
      </p>
      <div className="mt-6">
        <ResetForm token={token} email={bilgi.email} ilkParola={ilkParola} />
      </div>
    </>
  );
}
