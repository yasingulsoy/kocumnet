import { Badge } from "@/components/tailadmin/ui/Badge";
import { staffStatus, type StaffUser } from "@/lib/admin/types";
import { remaining } from "./ui";

/**
 * Hesap durumu rozeti. Davet bekleyen hesapta kalan süre de görünür;
 * süresi dolan davet ayrı renkte — eskiden ikisi de "Davet bekliyor"du ve
 * kimse davetin çoktan geçersiz olduğunu fark etmiyordu.
 */
export function StaffStatusPill({ user }: { user: Pick<StaffUser, "is_active" | "has_password" | "invite_expires_at"> }) {
  const durum = staffStatus(user);
  if (durum === "inactive") return <Badge size="sm" color="error">Pasif</Badge>;
  if (durum === "active") return <Badge size="sm" color="success">Aktif</Badge>;
  if (durum === "invite_expired") return <Badge size="sm" color="error">Davet süresi doldu</Badge>;
  const kalan = remaining(user.invite_expires_at);
  return <Badge size="sm" color="warning">Davet bekliyor{kalan ? ` · ${kalan}` : ""}</Badge>;
}
