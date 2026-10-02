import type { Metadata } from "next";
import { TokenPage } from "../../TokenPage";

export const metadata: Metadata = { title: "Yeni parola" };

export default async function SifreSifirlaPage({ params }: PageProps<"/admin/sifre-sifirla/[token]">) {
  const { token } = await params;
  return <TokenPage token={token} beklenen="reset" />;
}
