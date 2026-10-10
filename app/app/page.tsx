import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Brain,
  CircleCheck,
  Clock,
  Crosshair,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/products";
import { KATALOG_TURLERI } from "@/lib/catalog";
import { EXAMS, SECILEBILIR_SINAVLAR, examShort } from "@/lib/exams";
import { KonuHaritasi } from "@/components/KonuHaritasi";
import { Logo, LogoYazi, Wordmark } from "@/components/ui/logo";
import { RadialGauge } from "@/components/tailadmin/charts/RadialGauge";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { GridShape } from "@/components/tailadmin/ui/GridShape";

const OZELLIKLER = [
  {
    icon: Crosshair,
    t: "Konu haritası",
    d: "Her konu için güçlü, orta ya da zayıf — tek bakışta.",
  },
  {
    icon: Brain,
    t: "Hata teşhisi",
    d: "Yanlışların bilgi eksiği mi, işlem hatası mı? Farkı çalışma biçimini değiştirir.",
  },
  {
    icon: Lightbulb,
    t: "Adım adım çözüm",
    d: "Test bitince yanlış yaptığın her sorunun çözümü açılır.",
  },
  {
    icon: TrendingUp,
    t: "Gelişim takibi",
    d: "Aynı paketi tekrar çöz, hangi konuda ilerlediğini gör.",
  },
];

/**
 * Giriş yapmamış öğrencinin gördüğü sayfa. Girişliyse doğrudan panoya.
 *
 * Kahraman bölümündeki sonuç kartı gerçek bileşenlerle çiziliyor (kitin
 * yarım daire göstergesi, sonuç ekranındaki konu haritası) — "ne alacağım"
 * sorusunun cevabı bir görsel değil, ürünün kendisi.
 */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  if (await getCurrentUser()) redirect("/panel");
  const sp = await searchParams;
  const yil = new Date().getFullYear();

  // Yalnızca katalog paketleri: seviyeli (117 dk) ve gizli tekrar paketleri
  // "her biri 15-30 dakika" başlığının altında listeleniyordu.
  const paketler = await prisma.package.findMany({
    where: { status: "PUBLISHED", kind: { in: [...KATALOG_TURLERI] } },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, questionCount: true, durationMinutes: true, examScope: true },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Üst çubuk */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-5">
          {/* Telefonda yalnızca logo yazısı: altındaki "Matematik Check-up" satırı
              iki düğmeyle birlikte 360 px'e sığmıyor; 352 px altında (320'lik
              eski telefonlar) yazı da sığmıyor, kare işaret kalıyor. */}
          <Link href="/" aria-label="Ana sayfa" className="shrink-0">
            <Logo className="min-[22rem]:hidden" />
            <LogoYazi className="h-6 max-[22rem]:hidden sm:hidden" />
            <Wordmark className="max-sm:hidden" />
          </Link>
          <div className="flex items-center gap-2">
            <ButtonLink href="/giris" variant="ghost" size="xs">
              Giriş yap
            </ButtonLink>
            <ButtonLink href="/kayit" size="xs">
              Ücretsiz başla
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {sp["hesap-silindi"] ? (
          <div className="mx-auto max-w-6xl px-5 pt-6">
            <Alert variant="success">
              Hesabın ve tüm verilerin kalıcı olarak silindi. İstediğin zaman yeniden
              başlayabilirsin.
            </Alert>
          </div>
        ) : null}

        {/* Kahraman */}
        <section className="bg-linear-to-b from-brand-25 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
            <div className="animate-rise">
              <Badge startIcon={<Target aria-hidden />}>Matematik · 6 sınav</Badge>
              <h1 className="mt-5 font-display text-title-md leading-tight font-bold tracking-tight text-balance text-gray-800 sm:text-title-lg">
                Net kaç değil, <span className="marker">nerede eksiğin var?</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
                20 dakikalık bir testle matematikte hangi konuda güçlü, hangisinde zayıf
                olduğunu gör. Sonunda rapor değil{" "}
                <strong className="font-semibold text-gray-800">bu hafta ne çalışacağın</strong> çıkar: en
                fazla iki konu, sırayla.
              </p>

              {/* Hangi sınavlar — kapsam ilk ekranda görünmeli. */}
              <ul className="mt-6 flex flex-wrap gap-1.5">
                {SECILEBILIR_SINAVLAR.map((s) => (
                  <li key={s}>
                    <Badge color="light" size="sm" title={EXAMS[s].name}>
                      {examShort(s)}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/kayit" size="md" endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
                  Ücretsiz dene
                </ButtonLink>
                <ButtonLink href="/giris" variant="outline" size="md">
                  Hesabım var
                </ButtonLink>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                {["Kredi kartı gerekmez", "15-25 soru", "Anında sonuç"].map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <CircleCheck className="size-4 text-success-500" aria-hidden /> {m}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ürün önizlemesi */}
            <div className="mx-auto w-full max-w-md lg:max-w-none">
              <Card className="p-5 shadow-theme-lg sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase">Örnek sonuç</p>
                    <p className="mt-1 font-display text-base font-semibold text-gray-800">Problemler</p>
                  </div>
                  <Badge color="success" startIcon={<TrendingUp aria-hidden />}>
                    +8,75 net
                  </Badge>
                </div>

                <div className="mt-5 flex items-center gap-5 sm:gap-6">
                  <div className="w-36 shrink-0 sm:w-40">
                    <RadialGauge value={75} ariaLabel="Başarı" />
                    <p aria-hidden className="mt-1 text-center text-theme-xs text-gray-500">
                      başarı
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-full bg-success-500" /> 15 doğru
                    </p>
                    <p className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-full bg-error-500" /> 3 yanlış
                    </p>
                    <p className="flex items-center gap-2 text-gray-500">
                      <span aria-hidden className="size-2.5 rounded-full bg-gray-300" /> 2 boş
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <KonuHaritasi
                    konular={[
                      { topicId: "hiz", name: "Hareket - Hız", ratio: 1, correct: 4, asked: 4, level: "STRONG" },
                      { topicId: "yuzde", name: "Yüzde - Kâr - Zarar", ratio: 0.5, correct: 2, asked: 4, level: "MEDIUM" },
                      { topicId: "kesir", name: "Sayı - Kesir", ratio: 0.25, correct: 1, asked: 4, level: "WEAK", slow: true },
                    ]}
                  />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Neden */}
        <section className="border-y border-gray-200 bg-gray-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <h2 className="font-display text-title-sm font-bold tracking-tight text-balance text-gray-800 sm:text-title-md">
                Deneme sana puan verir. Check-up yol gösterir.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                120 soruluk denemede bir konuya bir-iki soru düşer; tek soruya bakıp
                &quot;bu konuda zayıfsın&quot; demek yazı-tura atmaktır. Check-up her konudan en
                az 3 soru sorar.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
              {OZELLIKLER.map(({ icon: Icon, t, d }) => (
                <Card key={t} className="p-5 sm:p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-gray-800">{t}</h3>
                  <p className="mt-1.5 text-theme-sm leading-relaxed text-gray-500">{d}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Paketler */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-title-sm font-bold tracking-tight text-balance text-gray-800">
                  Odaklı paketler
                </h2>
                <p className="mt-2 text-base text-gray-500">
                  Neyi ölçmek istiyorsan onu seç. Her biri 15-30 dakika.
                </p>
              </div>
              <ButtonLink href="/kayit" variant="soft" endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}>
                Hepsini gör
              </ButtonLink>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {paketler.map((p) => (
                <Link key={p.slug} href="/kayit" className="group block rounded-2xl">
                  <Card className="flex h-full items-center justify-between gap-4 p-4 transition group-hover:border-gray-300 group-hover:shadow-theme-md sm:p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge size="sm">{examShort(p.examScope)}</Badge>
                        <p className="truncate text-sm font-semibold text-gray-800">{p.name}</p>
                      </div>
                      <p className="tabular mt-2 flex items-center gap-3 text-theme-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ListChecks className="size-3.5" aria-hidden /> {p.questionCount} soru
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden /> {p.durationMinutes} dk
                        </span>
                      </p>
                    </div>
                    <ArrowRight
                      className="size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                      aria-hidden
                    />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Son çağrı: lacivert bant + kitin ızgara deseni, üstünde beyaz düğme */}
        <section className="px-5 pb-16 sm:pb-20">
          <div className="relative z-1 mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-950 px-6 py-12 text-center sm:px-12 sm:py-16">
            <GridShape />
            <h2 className="font-display text-title-sm font-bold tracking-tight text-balance text-white sm:text-title-md">
              İlk check-up&apos;ın bugün
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-gray-300">
              Hesap aç, bir paket seç, 20 dakika sonra neyi çalışman gerektiğini bil.
            </p>
            <div className="mt-8 flex justify-center">
              <ButtonLink
                href="/kayit"
                variant="outline"
                size="md"
                endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}
              >
                Ücretsiz başla
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden /> © {yil} Koçum.Net
          </span>
          <nav className="flex gap-5">
            <a href={SITE_URL} className="transition hover:text-gray-700">
              kocum.net
            </a>
            <Link href="/gizlilik" className="transition hover:text-gray-700">
              Gizlilik ve KVKK
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
