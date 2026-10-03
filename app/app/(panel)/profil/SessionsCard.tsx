import { MonitorSmartphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentSessionHash } from "@/lib/auth";
import { logoutOthersAction } from "@/lib/actions/profile";
import { Badge, Button, Card, CardHeader } from "@/components/ui";

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
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={<MonitorSmartphone />}
        title="Açık oturumların"
        description="Hesabına şu an giriş yapmış cihazlar"
        action={
          digerleri > 0 ? (
            <form action={logoutOthersAction}>
              <Button type="submit" variant="secondary" size="sm">
                Diğerlerinden çıkış ({digerleri})
              </Button>
            </form>
          ) : null
        }
      />
      <ul className="mt-5 divide-y divide-line">
        {oturumlar.map((o) => {
          const bu = o.tokenHash === suankiHash;
          return (
            <li key={o.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{cihazAdi(o.userAgent)}</p>
                <p className="text-xs text-ink-faint">
                  {o.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} tarihinde giriş
                </p>
              </div>
              {bu ? <Badge tone="ok">Bu cihaz</Badge> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
