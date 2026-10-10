import { TriangleAlert } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import type { BadgeColor } from "@/components/tailadmin/ui/Badge";
import type { MessageStatus } from "@/lib/admin/types";

/**
 * Site yönetimi yardımcıları. Görsel yapı taşları TailAdmin kitinden
 * (components/tailadmin, kaynak design/tailadmin); burada yalnızca
 * yönetime özgü biçimlendirme ve eşlemeler kaldı.
 */

/** Mesaj durumu → rozet rengi. */
export const MESAJ_RENGI: Record<MessageStatus, BadgeColor> = {
  new: "primary",
  read: "light",
  answered: "success",
  archived: "light",
  spam: "error",
};

/** Adres çubuğu için sorgu dizesi — boş değerleri atar. */
export function qs(base: string, params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

// ─── Biçimlendirme ─────────────────────────────────────────────

export function trDate(v: string | Date | null | undefined, opts: { time?: boolean } = {}) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** "3 saat önce", "2 gün önce" — son 7 gün için; sonrası tarih. */
export function relative(v: string | Date | null | undefined) {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  const dk = Math.round(ms / 60_000);
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.round(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.round(saat / 24);
  if (gun < 7) return `${gun} gün önce`;
  return trDate(v);
}

/** Bitişe kalan süre: "2 gün kaldı", "5 saat kaldı"; geçmişse null. */
export function remaining(v: string | Date | null | undefined) {
  if (!v) return null;
  const ms = new Date(v).getTime() - Date.now();
  if (ms <= 0) return null;
  const saat = Math.floor(ms / 3_600_000);
  if (saat < 1) return "1 saatten az kaldı";
  if (saat < 24) return `${saat} saat kaldı`;
  return `${Math.floor(saat / 24)} gün kaldı`;
}

/** Bir sayfanın tamamını kaplayan "yetkin yok" kutusu. */
export function Forbidden({ roles }: { roles: string }) {
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">Bu bölüm için yetkin yok</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Bu sayfayı yalnızca şu roller açabilir: {roles}. Kişisel veri ve hesap işlemleri, ihtiyacı olan en az kişiye açık
        tutuluyor.
      </p>
      <div className="mt-5">
        <ButtonLink href="/admin" variant="outline" size="xs">
          Panele dön
        </ButtonLink>
      </div>
    </div>
  );
}
