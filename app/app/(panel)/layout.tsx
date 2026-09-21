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

  return <StudentShell user={user}>{children}</StudentShell>;
}
