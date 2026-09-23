import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { availableExamScopes, groupCatalog, loadCatalog } from "@/lib/catalog";
import { EXAMS, isExamScope } from "@/lib/exams";
import { PackageCard } from "@/components/PackageCard";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Testler" };

export default async function CatalogPage({ searchParams }: PageProps<"/paketler">) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;

  /*
   * Varsayılan: öğrencinin KENDİ sınavı. Sınav labirentinin en iyi çözümü,
   * labirenti hiç göstermemek — DGS adayına AYT trigonometri paketi
   * göstermenin kimseye faydası yok. "Tümü" bilinçli bir tıklama.
   */
  const secim = typeof sp.tur === "string" ? sp.tur.toUpperCase() : null;
  const tur =
    secim === "TUMU" ? null : secim && isExamScope(secim) ? secim : (user.targetExam ?? null);

  const [hepsi, kapsamlar] = await Promise.all([
    loadCatalog(user.id, new Date(), { scope: tur }),
    availableExamScopes(),
  ]);

  const gruplar = groupCatalog(hepsi);
  const sinavlar = kapsamlar.filter(isExamScope).sort((a, b) => {
    if (a === user.targetExam) return -1;
    if (b === user.targetExam) return 1;
    return EXAMS[a].short.localeCompare(EXAMS[b].short, "tr");
  });

  const aktifBaslik = tur ? EXAMS[tur as keyof typeof EXAMS].short : "Tüm sınavlar";

  return (
    <div className="animate-fade space-y-5 sm:space-y-6">
      <PageHeader
        title="Testler"
        description={`${aktifBaslik} · her paket kısa ve odaklı: her konudan en az 3 soru. Sonunda konu haritan ve yanlışlarının çözümü.`}
      />

      {/* Sınav rayı: altı sınav telefonda tek satıra sığmaz, kaydırılır. */}
      <nav
        aria-label="Sınav seçimi"
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-2 pb-0.5">
          {sinavlar.map((s) => {
            const aktif = tur === s;
            return (
              <Link
                key={s}
                href={{ pathname: "/paketler", query: { tur: s } }}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-body font-medium transition",
                  aktif
                    ? "bg-brand-deep text-white shadow-card"
                    : "bg-surface text-ink-soft ring-1 ring-line active:bg-surface-sunk"
                )}
              >
                {EXAMS[s].short}
                {s === user.targetExam ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-micro font-semibold",
                      aktif ? "bg-white/15 text-white" : "bg-brand-wash text-brand"
                    )}
                  >
                    senin sınavın
                  </span>
                ) : null}
              </Link>
            );
          })}
          <Link
            href={{ pathname: "/paketler", query: { tur: "TUMU" } }}
            aria-current={tur === null ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-full px-4 text-body font-medium transition",
              tur === null
                ? "bg-brand-deep text-white shadow-card"
                : "bg-surface text-ink-soft ring-1 ring-line active:bg-surface-sunk"
            )}
          >
            Tümü
          </Link>
        </div>
      </nav>

      {gruplar.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title={`${aktifBaslik} için paket hazırlanıyor`}
            description={
              user.targetExam
                ? "Bu sınavın soru havuzu henüz yeterli değil. Konular ortak olduğu için diğer sınavların paketleriyle de aynı konuları ölçebilirsin."
                : "Yakında burada olacak."
            }
            action={<LinkButton href={{ pathname: "/paketler", query: { tur: "TUMU" } }}>Tüm paketleri gör</LinkButton>}
          />
        </Card>
      ) : (
        gruplar.map((g) => (
          <section key={g.key} aria-labelledby={`grup-${g.key}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id={`grup-${g.key}`}
                className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-faint"
              >
                {g.title}
              </h2>
              <span className="text-micro tabular text-ink-faint">{g.items.length}</span>
            </div>
            {g.hint ? <p className="mt-1 text-caption text-ink-soft">{g.hint}</p> : null}

            <div
              className={cn(
                "mt-3 grid gap-2.5 sm:gap-4",
                "sm:grid-cols-2 xl:grid-cols-3",
                g.key === "kilitli" && "opacity-75"
              )}
            >
              {g.items.map((p) => (
                <PackageCard key={p.slug} p={p} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
