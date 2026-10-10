import { MonitorSmartphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentSessionHash } from "@/lib/auth";
import { logoutOthersAction } from "@/lib/actions/profile";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";

/**
 * Açık oturumlar. Aydınlatma metni "açık oturumlarınızı ayırt etmek için
 * tarayıcı bilgisi saklanır" diyor; o bilginin görünür olduğu yer burası.
 * "Diğer cihazlardan çıkış" hesabımı biri mi kullanıyor şüphesinin cevabı.
 */
function cihazAdi(ua: string | null): string {
  if (!ua) return "Bilinmeyen cihaz";
  const tarayici = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Tarayıcı";
  const sistem = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return sistem ? `${tarayici} · ${sistem}` : tarayici;
}

export async function SessionsCard({ userId }: { userId: string }) {
  const [oturumlar, suankiHash] = await Promise.all([
    prisma.authSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, tokenHash: true, userAgent: true, createdAt: true },
    }),
    currentSessionHash(),
  ]);
  const digerleri = oturumlar.filter((o) => o.tokenHash !== suankiHash).length;

  return (
    <ComponentCard
      icon={<MonitorSmartphone aria-hidden />}
      title="Açık oturumların"
      desc="Hesabına şu an giriş yapmış cihazlar"
      actions={
        digerleri > 0 ? (
          <form action={logoutOthersAction}>
            <SubmitButton variant="outline" size="xs" pendingText="Çıkış yapılıyor…">
              Diğerlerinden çıkış ({digerleri})
            </SubmitButton>
          </form>
        ) : null
      }
      flush
    >
      <ul className="divide-y divide-gray-100">
        {oturumlar.map((o) => {
          const bu = o.tokenHash === suankiHash;
          return (
            <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{cihazAdi(o.userAgent)}</p>
                <p className="text-theme-xs text-gray-500">
                  {o.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} tarihinde giriş
                </p>
              </div>
              {bu ? (
                <Badge size="sm" color="success">
                  Bu cihaz
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ComponentCard>
  );
}
