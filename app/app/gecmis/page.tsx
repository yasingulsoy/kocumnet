import { permanentRedirect } from "next/navigation";

/** Eski adres — yer imleri kırılmasın. Geçmiş artık Gelişim sayfasında. */
export default function OldHistory() {
  permanentRedirect("/gelisim");
}
