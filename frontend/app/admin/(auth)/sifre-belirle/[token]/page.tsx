import type { Metadata } from "next";
import { TokenPage } from "../../TokenPage";

export const metadata: Metadata = { title: "Parola belirle" };

export default async function SifreBelirlePage({ params }: PageProps<"/admin/sifre-belirle/[token]">) {
  const { token } = await params;
  return <TokenPage token={token} beklenen="invite" />;
}
