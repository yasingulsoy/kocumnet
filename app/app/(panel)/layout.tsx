import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { StudentShell } from "@/components/shell/StudentShell";

/**
 * Öğrenci paneli: buradaki her sayfa giriş ister ve aynı çerçeveyi paylaşır.
 * Denetim düzende tek yerde — her sayfaya ayrı ayrı yazmak, birini unutmak
 * demekti.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  /*
   * Tanışmadan panele girilmiyor: hangi sınava hazırlandığını bilmeden
   * gösterilecek doğru bir katalog, doğru bir puanlama ya da anlamlı bir
   * tavsiye yok. Tanışma ekranı panelin DIŞINDA (/tanisma), yoksa bu
   * yönlendirme kendini tekrar ederdi.
   */
  if (!user.onboardedAt) redirect("/tanisma");

  return <StudentShell user={user}>{children}</StudentShell>;
}
