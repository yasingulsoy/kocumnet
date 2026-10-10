import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";
import { ErrorPage } from "@/components/tailadmin/pages/ErrorPage";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

/** Bilinmeyen adres — TailAdmin'in 404 sayfası düzeni (kitin ErrorPage'i). */
export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="Sayfa bulunamadı"
      message="Bağlantı eskimiş olabilir; blog ve personel ekranları kocum.net/admin'e taşındı."
      top={
        <Link href="/checkup" aria-label="Genel bakış">
          <Wordmark />
        </Link>
      }
      actions={
        <>
          <ButtonLink href="/checkup" size="md">
            Genel bakış
          </ButtonLink>
          <ButtonLink href="/checkup/sorular" variant="outline" size="md">
            Sorular
          </ButtonLink>
        </>
      }
      footer="kocum.net · check-up paneli"
    />
  );
}
