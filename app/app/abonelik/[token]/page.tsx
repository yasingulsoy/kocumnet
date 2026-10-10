import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MailX } from "lucide-react";
import { prisma } from "@/lib/db";
import { Wordmark } from "@/components/ui/logo";
import { Card } from "@/components/tailadmin/ui/Card";
import { AbonelikForm } from "./AbonelikForm";

export const metadata: Metadata = { title: "Haftalık posta", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postadaki "haftalık postayı kapat" bağlantısı. Giriş istemez: öğrenci
 * telefondan postaya bakarken parola hatırlamak zorunda kalmasın.
 *
 * Kapatma bir DÜĞMEYLE yapılır, bağlantıya tıklamakla değil: posta
 * tarayıcıları (kurumsal güvenlik, önizleme) bağlantıları kendileri açıyor;
 * GET ile kapatsaydık öğrenci haberi olmadan abonelikten çıkardı.
 */
export default async function AbonelikPage({ params }: PageProps<"/abonelik/[token]">) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const user = await prisma.user.findUnique({
    where: { mailToken: token },
    select: { name: true, email: true, mailOptOut: true },
  });
  if (!user) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10 sm:px-5">
      <Link href="/" aria-label="Ana sayfa">
        <Wordmark />
      </Link>
      <Card className="animate-rise mt-10 w-full max-w-md p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <MailX className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold text-gray-800 sm:text-2xl">Haftalık koçluk postası</h1>
        <p className="mt-1.5 text-sm leading-relaxed break-words text-gray-500">
          {user.email} adresine her pazartesi o haftanın planı gönderiliyor. Parola ve hesap postaları bundan ayrı; onlar kapanmaz.
        </p>
        <div className="mt-6">
          <AbonelikForm token={token} kapali={user.mailOptOut} />
        </div>
      </Card>
      <p className="mt-6 text-center text-theme-xs text-gray-500">Tercihini istediğin zaman profil sayfandan da değiştirebilirsin.</p>
    </main>
  );
}
