import type { Metadata } from "next";
import { KeyRound, LogOut, ShieldCheck, Target, Ticket, TriangleAlert, User } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader, trDate } from "@/components/ui";
import { DeleteAccount, HedefForm, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const oturum = (await getCurrentUser())!;
  const now = new Date();

  const [user, haklar, testSayisi] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: oturum.id },
      select: {
        name: true,
        email: true,
        grade: true,
        targetExam: true,
        targetNet: true,
        weeklyTestGoal: true,
        createdAt: true,
      },
    }),
    prisma.entitlement.findMany({
      where: {
        userId: oturum.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, package: { select: { name: true } } },
    }),
    prisma.checkupSession.count({ where: { userId: oturum.id, status: "SUBMITTED" } }),
  ]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="Profil" />

      {/* Kimlik kartı */}
      <Card className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg font-semibold text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {trDate(user.createdAt)} tarihinden beri · {testSayisi} test çözdü
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" size="sm">
            <LogOut /> Çıkış yap
          </Button>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={<User />} title="Bilgilerin" description="Öneriler bu bilgilere göre şekillenir" />
        <div className="mt-5">
          <ProfileForm name={user.name} email={user.email} />
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <CardHeader
          icon={<Target />}
          title="Hedefin"
          description="Katalog, plan ve koçluk metinleri buna göre şekillenir"
        />
        <div className="mt-5">
          <HedefForm
            targetExam={user.targetExam}
            grade={user.grade}
            targetNet={user.targetNet === null ? null : Number(user.targetNet)}
            weeklyTestGoal={user.weeklyTestGoal}
          />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={<Ticket />} title="Erişimlerin" description="Açık olan ücretli paketler" />
        {haklar.length > 0 ? (
          <ul className="mt-5 divide-y divide-line">
            {haklar.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm font-medium text-ink">
                  {h.package?.name ?? "Tüm paketler"}
                </span>
                <Badge tone={h.expiresAt ? "brand" : "ok"}>
                  {h.expiresAt ? trDate(h.expiresAt) + " tarihine kadar" : "Süresiz"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl bg-surface-sunk p-4 text-sm text-ink-soft">
            Şu an ücretsiz paketleri kullanıyorsun. Kilitli paketlere erişim için Koçum.Net ile
            iletişime geçebilirsin.
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader
          icon={<KeyRound />}
          title="Parola"
          description="Değiştirdiğinde diğer cihazlardaki oturumların kapanır"
        />
        <div className="mt-6">
          <PasswordForm />
        </div>
      </Card>

      <Card className="border-bad/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bad-wash text-bad">
              <TriangleAlert className="size-[18px]" />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">Hesabı sil</h2>
              <p className="mt-0.5 max-w-lg text-[13px] text-ink-soft">
                KVKK kapsamındaki silme hakkın. Tüm sonuçların ve kişisel bilgilerin kalıcı
                olarak silinir.
              </p>
            </div>
          </div>
          <DeleteAccount />
        </div>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
        <ShieldCheck className="size-3.5" /> Parolan geri çevrilemez biçimde saklanır.
      </p>
    </div>
  );
}
