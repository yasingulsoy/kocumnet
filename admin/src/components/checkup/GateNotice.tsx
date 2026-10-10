import { TriangleAlert } from "lucide-react";
import { ROLE_LABEL, type StaffCheck, type StaffRole } from "@/lib/checkup/staff";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { CODE } from "./ui";

/**
 * Sunucu tarafı denetim geçmediğinde sayfanın yerine çizilen kutu.
 * Hiçbir veri içermez — denetim, sayfa veritabanına gitmeden önce yapılır.
 *
 * Gerçekten çıkış yapmış biri bunu görmez: panel düzeni ((admin)/layout.tsx)
 * onu sunucuda giriş sayfasına yönlendiriyor. Bunu görenler ya yetkisi yetmeyen personel ya da
 * çerezi bu sunucuya ulaşmayan (yapılandırma) biri — mesajlar onlar için.
 */
export function GateNotice({
  gate,
  roles,
}: {
  gate: Extract<StaffCheck, { ok: false }>;
  roles: readonly StaffRole[];
}) {
  const kimler = roles.map((r) => ROLE_LABEL[r]).join(", ");

  const icerik = {
    "no-session": {
      baslik: "Oturumun bu sunucuya ulaşmadı",
      metin: (
        <>
          <p>
            Check-up ekranları verileri sunucuda hazırlıyor ve oturumunu her istekte
            doğruluyor. Tarayıcın oturum çerezini bu sunucuya göndermedi.
          </p>
          <p className="mt-2">
            Çıkış yapıp yeniden giriş yapmayı dene. Sorun sürerse teknik ekibe iletin:
            backend ortamında <code className={CODE}>AUTH_COOKIE_DOMAIN=.kocum.net</code>{" "}
            tanımlı olmalı; değilse oturum çerezi yalnızca API alan adına gidiyor.
          </p>
        </>
      ),
      eylem: (
        <ButtonLink href="/signin" size="xs">
          Giriş sayfasına git
        </ButtonLink>
      ),
    },
    forbidden: {
      baslik: "Bu bölüm için yetkin yok",
      metin: (
        <p>
          Rolün: <strong className="font-semibold text-gray-700">{gate.staff ? ROLE_LABEL[gate.staff.role] : "—"}</strong>.
          Bu sayfayı yalnızca şu roller açabilir: {kimler}. Öğrenci kişisel verileri ve satış
          ayarları, ihtiyacı olan en az kişiye açık tutuluyor.
        </p>
      ),
      eylem: (
        <ButtonLink href="/checkup" variant="outline" size="xs">
          Check-up özetine dön
        </ButtonLink>
      ),
    },
    unreachable: {
      baslik: "Kimlik doğrulama sunucusuna ulaşılamadı",
      metin: (
        <p>
          Backend yanıt vermiyor. Güvenlik gereği, oturum doğrulanmadan hiçbir veri
          gösterilmiyor. Birkaç dakika sonra sayfayı yenile.
        </p>
      ),
      eylem: null,
    },
  }[gate.reason];

  return (
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-gray-800">{icerik.baslik}</h1>
      <div className="mt-2 text-sm leading-relaxed text-gray-500">{icerik.metin}</div>
      {icerik.eylem ? <div className="mt-5">{icerik.eylem}</div> : null}
    </Card>
  );
}
