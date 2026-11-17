import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { UygulamaLogosu } from "@/components/Logo";

export default function BulunamadiSayfasi() {
  return (
    <ErrorPage
      code="404"
      top={<UygulamaLogosu size="md" />}
      title="Bu sayfa bulunamadı"
      message="Bağlantı eskimiş ya da yanlış yazılmış olabilir. Ya da bu kayıt sana ait değil."
      actions={
        <>
          <ButtonLink href="/panel" size="md">
            Panele git
          </ButtonLink>
          <ButtonLink href="/" size="md" variant="outline">
            Ana sayfa
          </ButtonLink>
        </>
      }
    />
  );
}
