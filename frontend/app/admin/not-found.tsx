import Link from "next/link";
import { Wordmark } from "@/components/LogoMark";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";

/** /admin altında bulunamayan adres — TailAdmin'in 404 sayfası düzeni. */
export default function AdminNotFound() {
  return (
    <ErrorPage
      code="404"
      title="Sayfa bulunamadı"
      message="Kayıt silinmiş ya da bağlantı eskimiş olabilir."
      top={
        <Link href="/admin" aria-label="Panel">
          <Wordmark />
        </Link>
      }
      actions={
        <>
          <ButtonLink href="/admin" size="md">
            Panele dön
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="md">
            kocum.net
          </ButtonLink>
        </>
      }
      footer="kocum.net · site yönetimi"
    />
  );
}
