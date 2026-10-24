import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LogOut,
  Mail,
  MessageCircleQuestion,
  ShieldCheck,
  Target,
  Ticket,
  User,
  UsersRound,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { etkinVeliBaglantilari } from "@/lib/veli-raporu";
import { ogrenciOdevleri } from "@/lib/odev-sorgu";
import { okunmamisCevapSayisi } from "@/lib/koca-soru";
import { logoutAction } from "@/lib/actions/auth";
import { GRADE_LABEL, examShort, isGrade } from "@/lib/exams";
import { trDate } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { ProfileCard, type ProfileDetail } from "@/components/tailadmin/profile/ProfileCard";
import { SettingRow, SettingsCard } from "@/components/tailadmin/profile/SettingsCard";
import { GUNLUK_HEDEF_SECENEKLERI } from "@/lib/seri";
import { DeleteAccount, GunlukHedefForm, HedefForm, MailTercihForm, PasswordDialogButton, ProfileForm } from "./forms";
import { SessionsCard } from "./SessionsCard";
import { VeliBaglantisi } from "./VeliBaglantisi";

export const metadata: Metadata = { title: "Profil" };

/** "Koçum" bölümünün bir satırı: bütün satır dokunulabilir, 56 px. */
function KocumSatiri({
  href,
  ikon,
  baslik,
  ayrinti,
  vurgu,
}: {
  href: string;
  ikon: ReactNode;
  baslik: string;
  ayrinti: string;
  vurgu: boolean;
}) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-5 py-3 transition hover:bg-gray-50 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 [&_svg]:size-4.5">
          {ikon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-800">{baslik}</span>
          <span className={vurgu ? "block text-theme-xs font-semibold text-brand-500" : "block text-theme-xs text-gray-500"}>
            {ayrinti}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-gray-400 rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}

export default async function ProfilePage() {
  const oturum = await requirePageUser();
  const now = new Date();

  const [user, haklar, testSayisi, veliBaglantilari, odevler, yeniCevap] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: oturum.id },
      select: {
        name: true,
        email: true,
        grade: true,
        targetExam: true,
        targetNet: true,
        weeklyTestGoal: true,
        dailyQuestionGoal: true,
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
    etkinVeliBaglantilari(oturum.id, now),
    ogrenciOdevleri(oturum.id, now),
    okunmamisCevapSayisi(oturum.id),
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

        {/* Koçla olan işler: telefonda alt menüde kendi sekmeleri yok, girişleri burada
            (alt menüde bu sayfalardayken "Profil" yanar, components/shell/nav.tsx). */}
        <ComponentCard icon={<GraduationCap aria-hidden />} title="Koçum" desc="Ödevlerin ve koçuna sorduğun sorular" flush>
          <ul className="divide-y divide-gray-100">
            <KocumSatiri
              href="/odevler"
              ikon={<ClipboardCheck aria-hidden />}
              baslik="Ödevler"
              ayrinti={
                odevler.grupSayisi === 0
                  ? "Koçun seni bir gruba eklediğinde ödevlerin burada"
                  : odevler.acik.length > 0
                    ? `${odevler.acik.length} açık ödev`
                    : "Açık ödevin yok"
              }
              vurgu={odevler.acik.length > 0}
            />
            <KocumSatiri
              href="/sorularim"
              ikon={<MessageCircleQuestion aria-hidden />}
              baslik="Koça sorularım"
              ayrinti={yeniCevap > 0 ? `${yeniCevap} yeni cevap` : "Takıldığın soruyu koçuna sor, cevabı burada"}
              vurgu={yeniCevap > 0}
            />
          </ul>
        </ComponentCard>

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
          id="gunluk-hedef"
          icon={<Flame aria-hidden />}
          title="Günlük hedef"
          desc="Ana sayfadaki seri kartı bugünkü ilerlemeni buna göre gösterir"
        >
          <GunlukHedefForm hedef={user.dailyQuestionGoal} secenekler={GUNLUK_HEDEF_SECENEKLERI} />
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

        <ComponentCard
          id="veli-baglantisi"
          icon={<UsersRound aria-hidden />}
          title="Veli bağlantısı"
          desc="Velin girişsiz, salt okunur bir özet görsün"
        >
          <VeliBaglantisi baglantilar={veliBaglantilari} />
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
