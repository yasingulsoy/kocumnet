import { Alert } from "@/components/tailadmin/ui/Alert";

/** Formun üstünde genel hata ya da başarı iletisi (ekran okuyucu duyurur). */
export function FormIletisi({ hata, basari }: { hata?: string; basari?: string }) {
  if (hata) {
    return (
      <Alert variant="error" compact>
        {hata}
      </Alert>
    );
  }
  if (basari) {
    return (
      <Alert variant="success" compact>
        {basari}
      </Alert>
    );
  }
  return null;
}
