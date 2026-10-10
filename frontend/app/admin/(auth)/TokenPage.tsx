import { BackendError, BackendUnreachable, backend } from "@/lib/admin/backend";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { AuthHeading } from "./AuthHeading";
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
      <Alert variant="warning" title="Sunucuya ulaşılamıyor">
        Birkaç dakika sonra bu sayfayı yenile; bağlantın geçerliliğini korur.
      </Alert>
    );
  }

  if (!bilgi) {
    return (
      <>
        <AuthHeading
          title="Bağlantı geçersiz"
          description={`Bu bağlantının süresi dolmuş ya da daha önce kullanılmış. ${
            beklenen === "invite" ? "Yöneticinden yeni bir davet iste." : "Yeni bir bağlantı isteyebilirsin."
          }`}
        />
        <div className="flex flex-wrap gap-3">
          {beklenen === "reset" ? <ButtonLink href="/admin/sifremi-unuttum">Yeni bağlantı iste</ButtonLink> : null}
          <ButtonLink href="/admin/giris" variant="outline">
            Girişe dön
          </ButtonLink>
        </div>
      </>
    );
  }

  const ilkParola = bilgi.purpose === "invite";
  return (
    <>
      <AuthHeading
        title={ilkParola ? `Hoş geldin${bilgi.name ? `, ${bilgi.name.split(" ")[0]}` : ""}` : "Yeni parola"}
        description={
          ilkParola
            ? "Hesabın hazır. Giriş yapabilmek için bir parola belirle."
            : "Hesabın için yeni bir parola belirle. Diğer cihazlardaki oturumların kapatılır."
        }
      />
      <ResetForm token={token} email={bilgi.email} ilkParola={ilkParola} />
    </>
  );
}
