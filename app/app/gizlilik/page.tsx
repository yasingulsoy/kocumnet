import type { Metadata } from "next";
import Link from "next/link";
import { COLLECTED_DATA, NOT_COLLECTED, LAST_UPDATED } from "@/lib/legal";
import { Card, Wordmark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK Aydınlatma Metni",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="inline-block">
        <Wordmark />
      </Link>

      <h1 className="font-display mt-8 text-3xl font-bold tracking-tight text-ink">
        Gizlilik ve KVKK Aydınlatma Metni
      </h1>
      <p className="mt-2 text-sm text-ink-faint">Son güncelleme: {LAST_UPDATED}</p>

      <section className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink-soft">
        <p>
          Bu metin, Koçum.Net Matematik Check-up uygulamasını kullanırken hangi kişisel
          verilerinizin işlendiğini, bunun neden yapıldığını ve haklarınızı anlatır.
          6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu
          Koçum.Net&apos;tir.
        </p>
      </section>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">Hangi veriler, neden</h2>
      <Card className="mt-4 divide-y divide-line">
        {COLLECTED_DATA.map((d) => (
          <div key={d.field} className="px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{d.field}</p>
              <span className="shrink-0 text-[11px] text-ink-faint">
                {d.required ? "zorunlu" : "isteğe bağlı"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">{d.purpose}</p>
          </div>
        ))}
      </Card>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">Toplamadıklarımız</h2>
      <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-soft">
        {NOT_COLLECTED.map((n) => (
          <li key={n} className="flex gap-2.5">
            <span aria-hidden className="text-ok">
              ✓
            </span>
            <span>{n}</span>
          </li>
        ))}
      </ul>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">Saklama süresi</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Hesabınız açık kaldığı sürece verileriniz saklanır; gelişiminizi geçmiş
        check-up&apos;larınızla karşılaştırabilmek bunu gerektirir. Hesabınızı sildirdiğinizde
        kişisel verileriniz silinir. Test cevapları, kimliğinizle ilişkisi koparılmış
        biçimde soru kalitesi ölçümü için istatistiksel olarak kullanılabilir.
      </p>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">18 yaşından küçükseniz</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Bu uygulama sınava hazırlanan öğrenciler içindir ve kullanıcılarımızın önemli bir
        bölümü 18 yaşın altındadır. 18 yaşından küçükseniz hesap oluşturmadan önce
        velinizin bilgisi ve onayı gerekir.
      </p>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">Haklarınız</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        KVKK 11. madde kapsamında; verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini
        veya silinmesini isteme, işlemeye itiraz etme haklarına sahipsiniz. Bu haklarınızı
        kullanmak için{" "}
        <a href="mailto:info@kocum.net" className="font-semibold text-brand hover:underline">
          info@kocum.net
        </a>{" "}
        adresine yazabilirsiniz.
      </p>

      <h2 className="font-display mt-10 text-xl font-bold text-ink">Güvenlik</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Parolanız geri çevrilemez biçimde (scrypt) özetlenerek saklanır; düz hâli hiçbir
        yerde tutulmaz. Oturum bilgileriniz de özetlenerek saklanır, böylece veritabanına
        erişen biri oturumunuzu taklit edemez.
      </p>

      <div className="mt-12 border-t border-line pt-6">
        <Link href="/" className="text-sm font-semibold text-brand hover:underline">
          ← Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
