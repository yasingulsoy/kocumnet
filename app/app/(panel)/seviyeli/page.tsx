import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList, Layers, Lock, Timer } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { aktifKosu } from "@/lib/level-run";
import { ayarGetir, type Seviye } from "@/lib/levels";
import { EXAMS, examShort, isExamScope } from "@/lib/exams";
import { seviyeliBaslatAction } from "@/lib/actions/levels";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { GridShape } from "@/components/tailadmin/ui/GridShape";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { checkPackageAccess } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Seviyeli check-up" };

export default async function SeviyeliPage({ searchParams }: PageProps<"/seviyeli">) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const hata = typeof sp.hata === "string" ? sp.hata : null;

  // Devam eden deneme varsa doğrudan oraya.
  const acik = await aktifKosu(user.id);
  if (acik) redirect(`/seviye/${acik.id}`);

  const sinav = isExamScope(user.targetExam) ? user.targetExam : null;
  if (!sinav) redirect("/tanisma");

  const ayar = ayarGetir(sinav);
  const paket = await prisma.package.findFirst({
    where: { kind: "LEVEL", examScope: sinav as never, status: "PUBLISHED" },
    select: { id: true, name: true, isFree: true },
  });

  const erisim = paket ? await checkPackageAccess(user.id, paket.id, paket.isFree) : null;

  // Geçmiş denemeler
  const gecmis = await prisma.levelRun.findMany({
    where: { userId: user.id, status: { not: "IN_PROGRESS" } },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      examScope: true,
      status: true,
      reachedLevel: true,
      stoppedAtLevel: true,
      startedAt: true,
    },
  });

  const seviyeler: { seviye: Seviye; ad: string; aciklama: string }[] = [
    {
      seviye: 1,
      ad: "Temel",
      aciklama: "Her soru tek bir kazanımı ölçer. Barajın altında kalırsan eksik kazanımlardan kısa bir teyit turu gelir.",
    },
    {
      seviye: 2,
      ad: "Çok adımlı",
      aciklama: "İki konunun birleştiği ya da birden fazla işlem adımı isteyen sorular.",
    },
    {
      seviye: 3,
      ad: "Analiz",
      aciklama: "Sınav standardında analiz ve yorum soruları.",
    },
  ];

  const toplamSoru =
    ayar.seviye1.soruSayisi + ayar.seviye2.soruSayisi + ayar.seviye3.soruSayisi;

  return (
    <div className="animate-rise mx-auto w-full max-w-4xl">
      {/* Sınav başlığın yanında rozet (eskiden başlığın üstünde küçük yazıydı). */}
      <PageBreadcrumb
        pageTitle="Seviyeli check-up"
        badge={<Badge>{examShort(sinav)}</Badge>}
        description="Üç seviye, kapılı ilerleme. Nerede durduğunu ve hangi kazanımın eksik olduğunu tek tek gösterir."
      />

      <div className="space-y-4 md:space-y-6">
        {hata ? <Alert variant="error">{hata}</Alert> : null}

        {/* Nasıl işliyor */}
        <ComponentCard
          title="Nasıl işliyor"
          icon={<Layers aria-hidden />}
          desc={`Toplam ${toplamSoru} soru. Her seviye ayrı çözülür, aralarında ara verebilirsin.`}
          flush
          className="overflow-hidden"
        >
          <ol className="divide-y divide-gray-100">
            {seviyeler.map(({ seviye, ad, aciklama }) => {
              const a = seviye === 1 ? ayar.seviye1 : seviye === 2 ? ayar.seviye2 : ayar.seviye3;
              return (
                <li key={seviye} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-theme-sm font-semibold text-white">
                    {seviye}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-gray-800">{ad}</span>
                      <span className="tabular text-theme-xs text-gray-500">
                        {a.soruSayisi} soru · {a.dakika} dk
                      </span>
                    </p>
                    <p className="mt-1 text-theme-sm leading-relaxed text-gray-500">{aciklama}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="flex items-start gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 text-theme-sm leading-relaxed text-gray-500 sm:px-6">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Bir seviyeyi geçemezsen üstü açılmaz. Bu bilinçli: temel oturmadan çok
            adımlı sorular senin seviyeni değil, eksiğini ölçer.
          </p>
        </ComponentCard>

        {/* Başlat */}
        {!paket ? (
          <Alert variant="warning">
            {examShort(sinav)} için seviyeli check-up henüz hazır değil. Soru havuzu
            tamamlanınca burada görünecek.
          </Alert>
        ) : erisim && !erisim.allowed ? (
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <Lock className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-gray-800">
                  Bu check-up erişim hakkı gerektiriyor
                </p>
                <p className="mt-1 text-theme-sm text-gray-500">
                  {EXAMS[sinav].short} seviyeli check-up&apos;ı açmak için bizimle iletişime geç.
                </p>
                <ButtonLink href="/paketler" variant="outline" className="mt-4 max-sm:w-full">
                  Diğer testlere bak
                </ButtonLink>
              </div>
            </div>
          </Card>
        ) : (
          // Seviyeli check-up'ın kimliği lacivert bant (katalogdaki giriş kartı da öyle);
          // beyaz düğme kitin outline'ı.
          <Card tone="dark" className="relative z-1 overflow-hidden p-5 sm:p-6">
            <GridShape />
            <h2 className="font-display text-xl font-semibold text-balance">Nerede olduğunu öğren</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
              Seviye 1 ile başlıyorsun: {ayar.seviye1.soruSayisi} soru,{" "}
              {ayar.seviye1.dakika} dakika. Sorular arasında serbestçe gezinebilir,
              boş bıraktıklarına geri dönebilirsin.
            </p>
            <form action={seviyeliBaslatAction} className="mt-5">
              <input type="hidden" name="examScope" value={sinav} />
              <SubmitButton
                variant="outline"
                size="md"
                className="max-sm:w-full"
                startIcon={<ClipboardList aria-hidden />}
                endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}
              >
                Seviye 1&apos;i başlat
              </SubmitButton>
            </form>
            <p className="mt-3 flex items-center gap-1.5 text-theme-xs text-white/80">
              <Timer className="size-3.5 shrink-0" aria-hidden /> Süre başlat dediğin anda işlemeye başlar.
            </p>
          </Card>
        )}

        {/* Geçmiş denemeler */}
        {gecmis.length > 0 ? (
          <ComponentCard title="Önceki denemelerin" flush>
            <ul className="p-2 sm:p-3">
              {gecmis.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/seviye/${g.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-gray-50"
                  >
                    <Badge size="sm" color={g.status === "COMPLETED" ? "success" : "error"}>
                      {g.status === "COMPLETED"
                        ? "Seviye 3"
                        : `Seviye ${g.stoppedAtLevel ?? g.reachedLevel}`}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800">
                      {examShort(g.examScope)} seviyeli check-up
                    </span>
                    <span className="shrink-0 text-theme-xs text-gray-500">
                      {g.startedAt.toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Istanbul",
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </ComponentCard>
        ) : null}
      </div>
    </div>
  );
}
