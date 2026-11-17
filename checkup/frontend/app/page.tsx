import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, ClipboardCheck, ListChecks } from "lucide-react";
import { oturumluOgrenci } from "@/lib/backend";
import { SITE_URL } from "@/lib/site";
import { ADIMLAR } from "@/components/Adimlar";
import { UygulamaLogosu } from "@/components/Logo";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

const ADIM_IKONLARI = [ListChecks, ClipboardCheck, BarChart3];

/** Kısa tanıtım. Girişli öğrenci doğrudan panele gider. */
export default async function AnaSayfa({ searchParams }: PageProps<"/">) {
  if (await oturumluOgrenci()) redirect("/panel");
  const p = await searchParams;
  const silindi = p.hesap === "silindi";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <header className="border-b border-gray-100">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Koçum.Net Check-up ana sayfa" className="flex min-h-11 items-center">
            <UygulamaLogosu />
          </Link>
          <ButtonLink href="/giris" variant="ghost">
            Giriş yap
          </ButtonLink>
        </div>
      </header>

      <main id="icerik" className="flex-1">
        {silindi ? (
          <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
            <Alert variant="success" compact>
              Hesabın ve bütün verilerin silindi. Yeniden görüşmek dileğiyle!
            </Alert>
          </div>
        ) : null}

        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-brand-50 to-white" />
          <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-20">
            <h1 className="mx-auto max-w-4xl font-display text-display font-bold text-balance text-gray-900">
              Sınavına ne kadar hazırsın? <span className="marker">Check-up</span>&apos;la gör.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lead text-gray-600">
              Hazırlandığın sınava göre bir test çöz. Netini, ders ve konu başarını, önce neye çalışman gerektiğini ve her
              sorunun çözümünü tek raporda gör.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/kayit" size="md" endIcon={<ArrowRight className="rtl:rotate-180" />} className="w-full sm:w-auto">
                Ücretsiz kayıt ol
              </ButtonLink>
              <ButtonLink href="/giris" size="md" variant="outline" className="w-full sm:w-auto">
                Giriş yap
              </ButtonLink>
            </div>
          </div>
        </section>

        <section aria-labelledby="adimlar-baslik" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <h2 id="adimlar-baslik" className="text-center font-display text-h2 font-semibold text-gray-800">
            Üç adımda
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {ADIMLAR.map((a, i) => {
              const Ikon = ADIM_IKONLARI[i];
              return (
                <li key={a.baslik} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                      <Ikon className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-sm font-semibold text-gray-500">{i + 1}. adım</span>
                  </div>
                  <h3 className="mt-4 font-display text-h3 font-semibold text-gray-800">{a.baslik}</h3>
                  <p className="mt-2 text-body text-gray-600">{a.aciklama}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-caption text-gray-500 sm:px-6">
          <a href={SITE_URL} className="hover:text-gray-700 hover:underline">
            kocum.net
          </a>
          <Link href="/gizlilik" className="hover:text-gray-700 hover:underline">
            Gizlilik ve KVKK
          </Link>
        </div>
      </footer>
    </div>
  );
}
