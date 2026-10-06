import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { paketHavuzu, paketKonulari } from "@/lib/checkup/pool";
import { PACKAGE_KIND_LABEL, examLabel, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PackageEditor } from "@/components/checkup/PackageEditor";
import { LinkButton, Notice, PageHeader } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Paketi düzenle" };

const CRUMBS = [
  { href: "/checkup", label: "Check-up" },
  { href: "/checkup/paketler", label: "Paketler" },
];

/**
 * Katalog paketini düzenle (yalnızca yönetici ve müdür). Tanışma, seviyeli
 * ve konu tekrar paketleri sistemindir: tohumdan gelir, burada yalnızca
 * neden düzenlenemediği söylenir.
 */
export default async function EditPackagePage({ params }: PageProps<"/checkup/paketler/[id]">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const { id } = await params;
  const now = new Date();

  const [paket, biten, suren] = await Promise.all([
    db.package.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        kind: true,
        examScope: true,
        name: true,
        summary: true,
        durationMinutes: true,
        status: true,
        topics: { orderBy: { sortOrder: "asc" }, select: { topicId: true, questionCount: true } },
      },
    }),
    db.checkupSession.count({ where: { packageId: id, status: "SUBMITTED" } }),
    db.checkupSession.count({ where: { packageId: id, status: "IN_PROGRESS", expiresAt: { gt: now } } }),
  ]);
  if (!paket) notFound();

  const aciklama =
    examLabel(paket.examScope) +
    " · " +
    paket.slug +
    " · " +
    trNumber(biten) +
    " tamamlanmış test" +
    (suren ? " · şu an " + trNumber(suren) + " test sürüyor" : "");

  if (paket.kind !== "STANDARD") {
    return (
      <>
        <PageHeader crumbs={CRUMBS} title={paket.name} description={aciklama} />
        <Notice tone="info" title={(PACKAGE_KIND_LABEL[paket.kind] ?? paket.kind) + " paketi panelden düzenlenmez"}>
          Bu bir sistem paketi: içeriği tohumdan gelir (tanışma ve konu tekrar testleri app/prisma/seed.ts,
          seviyeli check-up app/prisma/seed-levels.ts). Yayın durumu ve erişim ayarı Paketler listesinden değişir.
        </Notice>
        <div className="mt-4">
          <LinkButton href="/checkup/paketler" variant="outline" size="sm">
            Paketlere dön
          </LinkButton>
        </div>
      </>
    );
  }

  const [konular, havuz] = await Promise.all([paketKonulari(), paketHavuzu()]);

  return (
    <>
      <PageHeader crumbs={CRUMBS} title={paket.name} description={aciklama} />
      <PackageEditor
        // Başka bir paketin düzenleyicisine geçince durum taşınmasın.
        key={paket.id}
        paket={{
          id: paket.id,
          slug: paket.slug,
          examScope: paket.examScope,
          name: paket.name,
          summary: paket.summary ?? "",
          durationMinutes: paket.durationMinutes,
          status: paket.status,
          topics: paket.topics,
        }}
        konular={konular}
        havuz={havuz}
      />
    </>
  );
}
