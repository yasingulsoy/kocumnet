import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Wordmark } from "@/components/Logo";

/** Kök 404: panelde olmayan bir adres. */
export default function Bulunamadi() {
  return (
    <ErrorPage
      top={<Wordmark size="sm" />}
      title="Sayfa bulunamadı"
      message="Adres değişmiş ya da hiç olmamış olabilir."
      actions={<ButtonLink href="/">Panoya dön</ButtonLink>}
    />
  );
}
