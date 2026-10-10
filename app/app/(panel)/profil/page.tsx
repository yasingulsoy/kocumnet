import type { Metadata } from "next";
import { LogOut, Mail, ShieldCheck, Target, Ticket, User } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { GRADE_LABEL, examShort, isGrade } from "@/lib/exams";
import { trDate } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { ProfileCard, type ProfileDetail } from "@/components/tailadmin/profile/ProfileCard";
import { SettingRow, SettingsCard } from "@/components/tailadmin/profile/SettingsCard";
import { DeleteAccount, HedefForm, MailTercihForm, PasswordDialogButton, ProfileForm } from "./forms";
import { SessionsCard } from "./SessionsCard";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const oturum = await requirePageUser();
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
        mailOptOut: true,
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
    prisma.checkupSession.count({ where: { userId: oturum.id, status: "SUBMITTED", kind: { not: "PRACTICE" } } }),
  ]);

  // Kişi kartının altındaki özet: yalnızca zaten okunan alanlar, boş olanlar yazılmaz.
  const ayrintilar: ProfileDetail[] = [{ label: "Çözülen test", value: <span className="tabular">{testSayisi}</span> }];
  if (user.targetExam) ayrintilar.push({ label: "Hedef sınav", value: examShort(user.targetExam) });
  if (isGrade(user.grade)) ayrintilar.push({ label: "Aşama", value: GRADE_LABEL[user.grade] });
  if (user.targetNet !== null) {
    ayrintilar.push({
      label: "Hedef net",
      value: <span className="tabular">{Number(user.targetNet).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</span>,
    });
  }
  ayrintilar.push({ label: "Haftalık tempo", value: `Haftada ${user.weeklyTestGoal} test` });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageBreadcrumb pageTitle="Profil" />

      <div className="space-y-4 md:space-y-6">
        {/* Kimlik kartı */}
        <ProfileCard
          name={user.name}
          meta={[user.email, `${trDate(user.createdAt)} tarihinden beri`]}
          details={ayrintilar}
          actions={
            <form action={logoutAction}>
              <SubmitButton variant="outline" startIcon={<LogOut />} pendingText="Çıkış yapılıyor…">
                Çıkış yap
              </SubmitButton>
            </form>
          }
        />

        <ComponentCard icon={<User aria-hidden />} title="Bilgilerin" desc="Öneriler bu bilgilere göre şekillenir">
          <ProfileForm name={user.name} email={user.email} />
        </ComponentCard>

        <ComponentCard
          icon={<Target aria-hidden />}
          title="Hedefin"
          desc="Katalog, plan ve koçluk metinleri buna göre şekillenir"
        >
          <HedefForm
            targetExam={user.targetExam}
            grade={user.grade}
            targetNet={user.targetNet === null ? null : Number(user.targetNet)}
            weeklyTestGoal={user.weeklyTestGoal}
          />
        </ComponentCard>

        <ComponentCard
          icon={<Ticket aria-hidden />}
          title="Erişimlerin"
          desc="Açık olan ücretli paketler"
          flush={haklar.length > 0}
        >
          {haklar.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {haklar.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0 text-sm font-medium text-gray-800">{h.package?.name ?? "Tüm paketler"}</span>
                  <Badge size="sm" color={h.expiresAt ? "primary" : "success"}>
                    {h.expiresAt ? trDate(h.expiresAt) + " tarihine kadar" : "Süresiz"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              Şu an ücretsiz paketleri kullanıyorsun. Kilitli paketlere erişim için Koçum.Net ile
              iletişime geçebilirsin.
            </p>
          )}
        </ComponentCard>

        <ComponentCard icon={<Mail aria-hidden />} title="E-posta" desc="Koçun sana ne zaman yazsın">
          <MailTercihForm optOut={user.mailOptOut} />
        </ComponentCard>

        <SessionsCard userId={oturum.id} />

        {/* Parola formu pencerede açılır; kapanınca form da kapanır (bir dahaki açılış temiz). */}
        <SettingsCard title="Güvenlik">
          <SettingRow
            title="Parola"
            description="Değiştirdiğinde diğer cihazlardaki oturumların kapanır"
            action={<PasswordDialogButton />}
          />
        </SettingsCard>

        <SettingsCard title="Hesabı sil" tone="danger">
          <SettingRow
            title="KVKK kapsamındaki silme hakkın"
            description="Tüm sonuçların ve kişisel bilgilerin kalıcı olarak silinir."
            action={<DeleteAccount />}
          />
        </SettingsCard>

        <p className="flex items-center justify-center gap-1.5 text-theme-xs text-gray-500">
          <ShieldCheck className="size-3.5" aria-hidden /> Parolan geri çevrilemez biçimde saklanır.
        </p>
      </div>
    </div>
  );
}
