import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      top={
        <Link href="/" aria-label="Ana sayfa">
          <Wordmark />
        </Link>
      }
      title="Aradığın sayfa burada değil"
      message="Bağlantı eskimiş ya da sonuç başka bir hesaba ait olabilir."
      actions={
        <>
          <ButtonLink href="/panel">Ana sayfaya dön</ButtonLink>
          <ButtonLink href="/paketler" variant="outline">
            Testler
          </ButtonLink>
        </>
      }
    />
  );
}
