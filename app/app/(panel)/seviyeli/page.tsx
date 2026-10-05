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
import { Alert, Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
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
    <div className="animate-rise space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow={examShort(sinav)}
        title="Seviyeli check-up"
        description="Üç seviye, kapılı ilerleme. Nerede durduğunu ve hangi kazanımın eksik olduğunu tek tek gösterir."
      />

      {hata ? <Alert>{hata}</Alert> : null}

      {/* Nasıl işliyor */}
      <Card>
        <CardHeader
          className="p-4 sm:p-6"
          icon={<Layers />}
          title="Nasıl işliyor"
          description={`Toplam ${toplamSoru} soru. Her seviye ayrı çözülür, aralarında ara verebilirsin.`}
        />
        <ol className="divide-y divide-line border-t border-line">
          {seviyeler.map(({ seviye, ad, aciklama }) => {
            const a = seviye === 1 ? ayar.seviye1 : seviye === 2 ? ayar.seviye2 : ayar.seviye3;
            return (
              <li key={seviye} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-caption font-bold text-white">
                  {seviye}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-body font-semibold text-ink">{ad}</span>
                    <span className="tabular text-caption text-ink-faint">
                      {a.soruSayisi} soru · {a.dakika} dk
                    </span>
                  </p>
                  <p className="mt-1 text-caption leading-relaxed text-ink-soft">{aciklama}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="flex items-start gap-2 border-t border-line bg-surface-sunk px-4 py-3 text-caption leading-relaxed text-ink-soft sm:px-6">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Bir seviyeyi geçemezsen üstü açılmaz. Bu bilinçli: temel oturmadan çok
          adımlı sorular senin seviyeni değil, eksiğini ölçer.
        </p>
      </Card>

      {/* Başlat */}
      {!paket ? (
        <Alert tone="warn">
          {examShort(sinav)} için seviyeli check-up henüz hazır değil. Soru havuzu
          tamamlanınca burada görünecek.
        </Alert>
      ) : erisim && !erisim.allowed ? (
        <Card className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-body font-semibold text-ink">
            <Lock className="size-4 text-ink-faint" /> Bu check-up erişim hakkı gerektiriyor
          </p>
          <p className="mt-2 text-caption text-ink-soft">
            {EXAMS[sinav].short} seviyeli check-up&apos;ı açmak için bizimle iletişime geç.
          </p>
          <LinkButton href="/paketler" variant="secondary" className="mt-4">
            Diğer testlere bak
          </LinkButton>
        </Card>
      ) : (
        <Card className="bg-brand-gradient overflow-hidden border-0 p-5 text-white shadow-brand sm:p-6">
          <h2 className="font-display text-h2 font-bold text-balance">
            Nerede olduğunu öğren
          </h2>
          <p className="mt-2 max-w-xl text-body text-white/85">
            Seviye 1 ile başlıyorsun: {ayar.seviye1.soruSayisi} soru,{" "}
            {ayar.seviye1.dakika} dakika. Sorular arasında serbestçe gezinebilir,
            boş bıraktıklarına geri dönebilirsin.
          </p>
          <form action={seviyeliBaslatAction} className="mt-5">
            <input type="hidden" name="examScope" value={sinav} />
            <SubmitButton variant="white" size="lg" className="max-sm:w-full">
              <ClipboardList /> Seviye 1&apos;i başlat <ArrowRight />
            </SubmitButton>
          </form>
          <p className="mt-3 flex items-center gap-1.5 text-micro text-white/85">
            <Timer className="size-3.5" /> Süre başlat dediğin anda işlemeye başlar.
          </p>
        </Card>
      )}

      {/* Geçmiş denemeler */}
      {gecmis.length > 0 ? (
        <Card>
          <CardHeader className="p-4 sm:p-6" title="Önceki denemelerin" />
          <ul className="divide-y divide-line border-t border-line">
            {gecmis.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/seviye/${g.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface-hover sm:px-6"
                >
                  <Badge tone={g.status === "COMPLETED" ? "ok" : "bad"}>
                    {g.status === "COMPLETED"
                      ? "Seviye 3"
                      : `Seviye ${g.stoppedAtLevel ?? g.reachedLevel}`}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-body text-ink">
                    {examShort(g.examScope)} seviyeli check-up
                  </span>
                  <span className="shrink-0 text-micro text-ink-faint">
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
        </Card>
      ) : null}
    </div>
  );
}
