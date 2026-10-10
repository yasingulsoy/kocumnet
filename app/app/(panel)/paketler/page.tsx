import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Layers } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { availableExamScopes, groupCatalog, loadCatalog } from "@/lib/catalog";
import { EXAMS, isExamScope } from "@/lib/exams";
import { PackageCard } from "@/components/PackageCard";
import { cx } from "@/components/tailadmin/cx";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/tailadmin/ui/SegmentedTabs";

export const metadata: Metadata = { title: "Testler" };

export default async function CatalogPage({ searchParams }: PageProps<"/paketler">) {
  const user = await requirePageUser();
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

  /*
   * Seviyeli check-up bu sınav için yayında mı.
   *
   * Odaklı paketlerden ayrı duruyor: o paketler haftalık ölçüm, bu
   * yerleştirme sınavı. Katalog listesine karıştırmak ikisini de bulanık
   * gösterirdi.
   */
  const seviyeliVar =
    tur !== null &&
    (await prisma.package.count({
      where: { kind: "LEVEL", examScope: tur as never, status: "PUBLISHED" },
    })) > 0;

  // Sınav rayı: öğrencinin kendi sınavı başta ve etiketinde işaretli, "Tümü" sonda.
  const sekmeler: SegmentedTabItem[] = [
    ...sinavlar.map((s) => ({
      key: s,
      href: `/paketler?tur=${s}`,
      active: tur === s,
      label:
        s === user.targetExam ? (
          <>
            {EXAMS[s].short}
            <span className="rounded-full bg-brand-50 px-1.5 text-theme-xs font-medium text-brand-500">
              senin sınavın
            </span>
          </>
        ) : (
          EXAMS[s].short
        ),
    })),
    { key: "TUMU", label: "Tümü", href: "/paketler?tur=TUMU", active: tur === null },
  ];

  return (
    <div className="animate-fade">
      <PageBreadcrumb
        pageTitle="Testler"
        description={`${aktifBaslik} · her paket kısa ve odaklı: her konudan en az 3 soru. Sonunda konu haritan ve yanlışlarının çözümü.`}
      />

      <div className="space-y-4 md:space-y-6">
        {/* Sınav rayı: altı sınav telefonda tek satıra sığmaz, kaydırılır. */}
        <SegmentedTabs label="Sınav seçimi" items={sekmeler} size="md" />

        {/* Seviyeli check-up — odaklı paketlerden farklı bir şey, ayrı duruyor:
            paket kartlarının arasında kaybolmasın diye lacivert bant. */}
        {seviyeliVar ? (
          <Link
            href="/seviyeli"
            className="group relative z-1 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-brand-950 p-5 text-white transition hover:bg-brand-900 sm:p-6"
          >
            <GridShape />
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Layers className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">Seviyeli Check-up</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-theme-xs font-medium">3 seviye</span>
              </p>
              <p className="mt-1 text-theme-sm text-white/80">
                Nerede durduğunu ve hangi kazanımın eksik olduğunu tek tek gösterir.
                Seviye geçemezsen üstü açılmaz.
              </p>
            </div>
            <ArrowRight
              className="size-5 shrink-0 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              aria-hidden
            />
          </Link>
        ) : null}

        {gruplar.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList aria-hidden />}
              title={`${aktifBaslik} için paket hazırlanıyor`}
              description={
                user.targetExam
                  ? "Bu sınavın soru havuzu henüz yeterli değil. Konular ortak olduğu için diğer sınavların paketleriyle de aynı konuları ölçebilirsin."
                  : "Yakında burada olacak."
              }
              action={<ButtonLink href="/paketler?tur=TUMU">Tüm paketleri gör</ButtonLink>}
            />
          </Card>
        ) : (
          gruplar.map((g) => (
            <section key={g.key} aria-labelledby={`grup-${g.key}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id={`grup-${g.key}`}
                  className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase"
                >
                  {g.title}
                </h2>
                <span className="tabular text-theme-xs text-gray-500">{g.items.length}</span>
              </div>
              {g.hint ? <p className="mt-1 text-theme-sm text-gray-500">{g.hint}</p> : null}

              <div
                className={cx(
                  "mt-3 grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3",
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
    </div>
  );
}
