import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { api, sayfaVerisi } from "@/lib/backend";
import type { TestEkrani } from "@/lib/tipler";
import { SinavEkrani } from "./SinavEkrani";

export const metadata: Metadata = { title: "Check-up" };

/*
 * Sınav ekranı. Üst çubuk ve menü yok: dikkat dağıtmayan tam ekran.
 * Oturum burada da sunucuda denetlenir (api jetonu backend'e götürür).
 * Bu yanıtta doğru şık ve çözüm YOK (API.md: cevap anahtarı sızmaz).
 */
export default async function TestSayfasi({ params }: PageProps<"/test/[id]">) {
  const { id } = await params;
  const checkupId = Number(id);
  if (!Number.isSafeInteger(checkupId) || checkupId <= 0) notFound();

  const veri = sayfaVerisi(await api<TestEkrani>(`/ogrenci/checkuplar/${checkupId}`));
  if (veri.durum !== "DEVAM") redirect(`/rapor/${checkupId}`);

  return <SinavEkrani veri={veri} />;
}
