import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { GrantForm } from "./GrantForm";
import { RevokeButton } from "./RevokeButton";

export const metadata: Metadata = { title: "Öğrenciler" };

const SAYFA_BOYU = 25;

const GRADE_LABEL: Record<string, string> = {
  GRADE_9: "9. sınıf",
  GRADE_10: "10. sınıf",
  GRADE_11: "11. sınıf",
  GRADE_12: "12. sınıf",
  GRADUATE: "Mezun",
};

function tarih(d: Date) {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function StudentsPage({ searchParams }: PageProps<"/admin/ogrenciler">) {
  const sp = await searchParams;
  const ara = typeof sp.ara === "string" ? sp.ara.trim() : "";
  const sayfa = Math.max(1, Number(typeof sp.sayfa === "string" ? sp.sayfa : 1) || 1);

  const where = ara
    ? {
        OR: [
          { email: { contains: ara, mode: "insensitive" as const } },
          { name: { contains: ara, mode: "insensitive" as const } },
        ],
      }
    : {};

  const now = new Date();

  const [toplam, ogrenciler, paketler] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        grade: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { checkupSessions: true } },
        entitlements: {
          where: { revokedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            expiresAt: true,
            source: true,
            note: true,
            package: { select: { name: true } },
          },
        },
      },
    }),
    prisma.package.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, isFree: true },
    }),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const ucretliVar = paketler.some((p) => !p.isFree);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Öğrenciler</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        {toplam} kayıtlı kullanıcı.{" "}
        {ucretliVar
          ? "Ücretli paketlere erişim buradan verilir."
          : "Şu an tüm paketler ücretsiz; erişim hakkı vermeye gerek yok."}
      </p>

      <form method="get" className="mt-6 flex gap-2">
        <input
          name="ara"
          defaultValue={ara}
          placeholder="Ad veya e-posta…"
          className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-sunk"
        >
          Ara
        </button>
        {ara ? (
          <Link href="/admin/ogrenciler" className="py-2 text-sm text-ink-soft hover:text-ink">
            Temizle
          </Link>
        ) : null}
      </form>

      {ogrenciler.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <p className="text-sm text-ink-soft">Kayıt bulunamadı.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {ogrenciler.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {o.name}
                    {o.role === "ADMIN" ? (
                      <span className="ms-2 rounded bg-brand-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">
                        yönetici
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {o.email}
                    {o.grade ? " · " + GRADE_LABEL[o.grade] : ""} · kayıt {tarih(o.createdAt)}
                    {o.lastLoginAt ? " · son giriş " + tarih(o.lastLoginAt) : " · hiç girmedi"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-ink-soft">
                  {o._count.checkupSessions} test
                </span>
              </div>

              {o.entitlements.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {o.entitlements.map((e) => {
                    const gecti = e.expiresAt !== null && e.expiresAt < now;
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className={gecti ? "text-ink-faint line-through" : "text-ink-soft"}>
                          <strong className="font-semibold text-ink">
                            {e.package?.name ?? "Tüm paketler"}
                          </strong>
                          {" · "}
                          {e.expiresAt ? tarih(e.expiresAt) + " tarihine kadar" : "süresiz"}
                          {e.note ? " · " + e.note : ""}
                          {" · "}
                          {e.source}
                        </span>
                        <RevokeButton id={e.id} />
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {ucretliVar ? (
                <div className="mt-3 border-t border-line pt-3">
                  <GrantForm userId={o.id} packages={paketler} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {sonSayfa > 1 ? (
        <nav className="mt-6 flex items-center justify-between gap-4 text-sm">
          {sayfa > 1 ? (
            <Link
              href={{ pathname: "/admin/ogrenciler", query: { ...(ara && { ara }), sayfa: sayfa - 1 } }}
              className="font-medium text-brand"
            >
              ← Önceki
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-faint">
            {sayfa} / {sonSayfa}
          </span>
          {sayfa < sonSayfa ? (
            <Link
              href={{ pathname: "/admin/ogrenciler", query: { ...(ara && { ara }), sayfa: sayfa + 1 } }}
              className="font-medium text-brand"
            >
              Sonraki →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
