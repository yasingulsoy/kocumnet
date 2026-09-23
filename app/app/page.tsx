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
import { EXAMS, SECILEBILIR_SINAVLAR, examShort } from "@/lib/exams";
import { ScoreRing, TopicBar } from "@/components/ui/charts";
import { Alert, Badge, Card, LinkButton, Wordmark } from "@/components/ui";

/**
 * Giriş yapmamış öğrencinin gördüğü sayfa. Girişliyse doğrudan panoya.
 *
 * Kahraman bölümündeki sonuç kartı gerçek bileşenlerle çiziliyor (skor
 * halkası, konu çubukları) — "ne alacağım" sorusunun cevabı bir görsel
 * değil, ürünün kendisi.
 */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  if (await getCurrentUser()) redirect("/panel");
  const sp = await searchParams;
  const yil = new Date().getFullYear();

  const paketler = await prisma.package.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, questionCount: true, durationMinutes: true, examScope: true },
  });

  return (
    <div className="min-h-screen bg-surface">
      {/* Üst çubuk */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Ana sayfa">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LinkButton href="/giris" variant="ghost" size="sm">
              Giriş yap
            </LinkButton>
            <LinkButton href="/kayit" size="sm">
              Ücretsiz başla
            </LinkButton>
          </div>
        </div>
      </header>

      {sp["hesap-silindi"] ? (
        <div className="mx-auto max-w-6xl px-5 pt-6">
          <Alert tone="ok">
            Hesabın ve tüm verilerin kalıcı olarak silindi. İstediğin zaman yeniden
            başlayabilirsin.
          </Alert>
        </div>
      ) : null}

      {/* Kahraman */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top_right,rgba(14,144,213,0.14),transparent_60%),radial-gradient(ellipse_at_top_left,rgba(26,95,180,0.10),transparent_55%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="animate-rise">
            <Badge tone="brand" className="py-1 text-xs">
              <Target /> Matematik · 6 sınav
            </Badge>
            <h1 className="font-display mt-5 text-[40px] font-bold leading-[1.08] tracking-tight text-ink sm:text-[54px] text-balance">
              Net kaç değil,{" "}
              <span className="bg-gradient-to-r from-brand to-brand-bright bg-clip-text text-transparent">
                nerede eksiğin var?
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              20 dakikalık bir testle matematikte hangi konuda güçlü, hangisinde zayıf
              olduğunu gör. Sonunda rapor değil <strong className="font-semibold text-ink">
              bu hafta ne çalışacağın</strong> çıkar: en fazla iki konu, sırayla.
            </p>

            {/* Hangi sınavlar — kapsam ilk ekranda görünmeli. */}
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {SECILEBILIR_SINAVLAR.map((s) => (
                <li
                  key={s}
                  className="rounded-lg bg-surface-sunk px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-line"
                  title={EXAMS[s].name}
                >
                  {examShort(s)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/kayit" size="lg">
                Ücretsiz dene <ArrowRight />
              </LinkButton>
              <LinkButton href="/giris" variant="secondary" size="lg">
                Hesabım var
              </LinkButton>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {["Kredi kartı gerekmez", "15-25 soru", "Anında sonuç"].map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <CircleCheck className="size-4 text-ok-fill" /> {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Ürün önizlemesi */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="bg-brand-gradient absolute -inset-4 -z-0 rotate-2 rounded-[28px] opacity-10 blur-2xl"
            />
            <Card className="relative p-6 shadow-pop">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Örnek sonuç
                  </p>
                  <p className="font-display mt-1 text-base font-semibold text-ink">Problemler</p>
                </div>
                <Badge tone="ok">
                  <TrendingUp /> +8,75 net
                </Badge>
              </div>

              <div className="mt-5 flex items-center gap-6">
                <ScoreRing value={75} size={120} stroke={11} label="Yüzde 75 başarı">
                  <span className="font-display tabular text-3xl font-bold text-ink">%75</span>
                  <span className="text-[11px] text-ink-faint">başarı</span>
                </ScoreRing>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-ok-fill" /> 15 doğru
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-bad-fill" /> 3 yanlış
                  </p>
                  <p className="flex items-center gap-2 text-ink-soft">
                    <span className="size-2.5 rounded-full bg-line-strong" /> 2 boş
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-line border-t border-line">
                <TopicBar name="Hareket - Hız" ratio={1} correct={4} asked={4} level="STRONG" />
                <TopicBar name="Yüzde - Kâr - Zarar" ratio={0.5} correct={2} asked={4} level="MEDIUM" />
                <TopicBar name="Sayı - Kesir" ratio={0.25} correct={1} asked={4} level="WEAK" slow />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Neden */}
      <section className="border-y border-line bg-bg py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <h2 className="font-display text-[28px] font-bold tracking-tight text-ink sm:text-[34px] text-balance">
              Deneme sana puan verir. Check-up yol gösterir.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              120 soruluk denemede bir konuya bir-iki soru düşer; tek soruya bakıp
              &quot;bu konuda zayıfsın&quot; demek yazı-tura atmaktır. Check-up her konudan en
              az 3 soru sorar.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
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
            ].map(({ icon: Icon, t, d }) => (
              <Card key={t} className="p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-wash text-brand">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display mt-4 text-[15px] font-semibold text-ink">{t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{d}</p>
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
              <h2 className="font-display text-[28px] font-bold tracking-tight text-ink text-balance">
                Odaklı paketler
              </h2>
              <p className="mt-2 text-[15px] text-ink-soft">
                Neyi ölçmek istiyorsan onu seç. Her biri 15-30 dakika.
              </p>
            </div>
            <LinkButton href="/kayit" variant="soft">
              Hepsini gör <ArrowRight />
            </LinkButton>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paketler.map((p) => (
              <Link key={p.slug} href="/kayit" className="group">
                <Card interactive className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">{examShort(p.examScope)}</Badge>
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                    </div>
                    <p className="mt-2 flex items-center gap-3 text-xs text-ink-faint">
                      <span className="flex items-center gap-1">
                        <ListChecks className="size-3.5" /> {p.questionCount} soru
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" /> {p.durationMinutes} dk
                      </span>
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Son çağrı */}
      <section className="px-5 pb-16 sm:pb-20">
        <div className="bg-brand-gradient relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-12 text-center text-white shadow-pop sm:px-12 sm:py-16">
          <div aria-hidden className="bg-grid-fade absolute inset-0" />
          <div className="relative">
            <h2 className="font-display text-[28px] font-bold tracking-tight sm:text-[36px] text-balance">
              İlk check-up&apos;ın bugün
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/80">
              Hesap aç, bir paket seç, 20 dakika sonra neyi çalışman gerektiğini bil.
            </p>
            <div className="mt-8 flex justify-center">
              <LinkButton href="/kayit" variant="white" size="lg">
                Ücretsiz başla <ArrowRight />
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-faint">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> © {yil} Koçum.Net
          </span>
          <nav className="flex gap-5">
            <a href={SITE_URL} className="hover:text-ink">
              kocum.net
            </a>
            <Link href="/gizlilik" className="hover:text-ink">
              Gizlilik ve KVKK
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
