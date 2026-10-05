import { staffStatus, type StaffUser } from "@/lib/admin/types";
import { Pill, remaining } from "./ui";

/**
 * Hesap durumu rozeti. Davet bekleyen hesapta kalan süre de görünür;
 * süresi dolan davet ayrı renkte — eskiden ikisi de "Davet bekliyor"du ve
 * kimse davetin çoktan geçersiz olduğunu fark etmiyordu.
 */
export function StaffStatusPill({ user }: { user: Pick<StaffUser, "is_active" | "has_password" | "invite_expires_at"> }) {
  const durum = staffStatus(user);
  if (durum === "inactive") return <Pill tone="bad">Pasif</Pill>;
  if (durum === "active") return <Pill tone="ok">Aktif</Pill>;
  if (durum === "invite_expired") return <Pill tone="bad">Davet süresi doldu</Pill>;
  const kalan = remaining(user.invite_expires_at);
  return <Pill tone="warn">Davet bekliyor{kalan ? ` · ${kalan}` : ""}</Pill>;
}
