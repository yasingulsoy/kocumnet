import Link from "next/link";
import { ROLE_LABEL, type StaffCheck, type StaffRole } from "@/lib/checkup/staff";
import { Card, buttonClass } from "./ui";

/**
 * Sunucu tarafı denetim geçmediğinde sayfanın yerine çizilen kutu.
 * Hiçbir veri içermez — denetim, sayfa veritabanına gitmeden önce yapılır.
 *
 * Gerçekten çıkış yapmış biri bunu görmez: istemci düzeni onu zaten giriş
 * sayfasına yönlendiriyor. Bunu görenler ya yetkisi yetmeyen personel ya da
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
            backend ortamında <code className="rounded bg-gray-100 px-1 py-0.5 text-theme-xs dark:bg-white/5">AUTH_COOKIE_DOMAIN=.kocum.net</code>{" "}
            tanımlı olmalı; değilse oturum çerezi yalnızca API alan adına gidiyor.
          </p>
        </>
      ),
      eylem: (
        <Link href="/signin" className={buttonClass("primary", "sm")}>
          Giriş sayfasına git
        </Link>
      ),
    },
    forbidden: {
      baslik: "Bu bölüm için yetkin yok",
      metin: (
        <p>
          Rolün: <strong className="font-semibold">{gate.staff ? ROLE_LABEL[gate.staff.role] : "—"}</strong>.
          Bu sayfayı yalnızca şu roller açabilir: {kimler}. Öğrenci kişisel verileri ve satış
          ayarları, ihtiyacı olan en az kişiye açık tutuluyor.
        </p>
      ),
      eylem: (
        <Link href="/checkup" className={buttonClass("outline", "sm")}>
          Check-up özetine dön
        </Link>
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
      <div className="flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        {icerik.baslik}
      </h1>
      <div className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {icerik.metin}
      </div>
      {icerik.eylem ? <div className="mt-5">{icerik.eylem}</div> : null}
    </Card>
  );
}
