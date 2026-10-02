import { redirect } from "next/navigation";

/**
 * Panelin tek işi check-up: kök adres doğrudan genel bakışa gider.
 * Blog ve personel yönetimi kocum.net/admin'de.
 */
export default function RootPage() {
  redirect("/checkup");
}
