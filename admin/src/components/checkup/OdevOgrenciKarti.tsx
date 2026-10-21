import Link from "next/link";
import { examLabel, trDate, trNumber } from "@/lib/checkup/format";
import { ogrencininGruplari, type OgrencininOdevi } from "@/lib/checkup/gruplar";
import { ODEV_DURUM_ETIKETI, ODEV_DURUM_RENGI, ODEV_TURU_ETIKETI } from "@/lib/checkup/grup-kurallari";
import { kalanGunMetni } from "@/lib/checkup/shared/odev";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { qs } from "./ui";

/*
 * Öğrenci ayrıntısındaki "Gruplar ve ödevler" kartı: öğrencinin grupları,
 * açık ödevleri ve süresi dolan son ödevleri durumlarıyla. Kendi sorgusunu
 * yapan sunucu bileşeni; sayfa MANAGE rollerine açık (öğrenci verisi).
 * Durum öğrenci ekranıyla aynı kuraldan (shared/odev.ts).
 */

function OdevSatiri({ o, now }: { o: OgrencininOdevi; now: Date }) {
  const i = o.ilerleme;
  const ayrinti =
    o.kind === "TOPIC_PRACTICE"
      ? `${i.cozulen}/${i.hedef} soru`
      : i.net !== null
        ? `${trNumber(i.net, 2)} net`
        : null;
  return (
    <li className="relative flex items-start justify-between gap-3 px-5 py-3 transition hover:bg-gray-50 sm:px-6">
      <div className="min-w-0">
        <Link
          href={qs("/checkup/gruplar/" + o.groupId, { odev: o.id }) + "#ilerleme"}
          className="block truncate text-theme-sm font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
        >
          {o.title}
        </Link>
        <p className="truncate text-theme-xs text-gray-500">
          {[
            o.grupAdi,
            ODEV_TURU_ETIKETI[o.kind] ?? o.kind,
            "son tarih " + trDate(o.dueAt, { year: false }) + (o.dueAt.getTime() >= now.getTime() ? " (" + kalanGunMetni(o.dueAt, now) + ")" : ""),
            ayrinti,
            o.sayilir ? null : "son tarihten sonra katıldı",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Badge size="sm" color={ODEV_DURUM_RENGI[i.durum]}>
        {ODEV_DURUM_ETIKETI[i.durum]}
      </Badge>
    </li>
  );
}

export async function OdevOgrenciKarti({ userId, now }: { userId: string; now: Date }) {
  const { gruplar, acik, son } = await ogrencininGruplari(userId, now);

  return (
    <ComponentCard
      title="Gruplar ve ödevler"
      desc="Koçluk grupları; ödev durumu öğrencinin kayıtlarından çıkar."
      actions={
        gruplar.length === 0 ? (
          <ButtonLink href="/checkup/gruplar" variant="outline" size="xs">
            Gruplar
          </ButtonLink>
        ) : null
      }
      flush
    >
      {gruplar.length === 0 ? (
        <EmptyState title="Bir gruba üye değil" description="Grup sayfasından ad ya da e-postayla aratıp ekleyebilirsin." />
      ) : (
        <>
          <ul className="flex flex-wrap gap-2 border-t border-gray-100 px-5 py-3 sm:px-6" aria-label="Grupları">
            {gruplar.map((g) => (
              <li key={g.id}>
                <Link
                  href={"/checkup/gruplar/" + g.id}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-theme-xs font-medium text-gray-700 transition hover:border-brand-500 hover:text-brand-500"
                  title={"Katıldı: " + trDate(g.katildi)}
                >
                  {g.name}
                  {g.examScope ? <span className="text-gray-500">· {examLabel(g.examScope)}</span> : null}
                  {g.archivedAt ? (
                    <Badge size="sm" color="light">
                      arşiv
                    </Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="border-t border-gray-100 px-5 pt-3 text-theme-xs font-semibold tracking-[0.14em] text-gray-500 uppercase sm:px-6">
            Açık ödevler
          </h3>
          {acik.length === 0 ? (
            <p className="px-5 pt-1 pb-3 text-theme-sm text-gray-500 sm:px-6">Son tarihi gelmemiş ödevi yok.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {acik.map((o) => (
                <OdevSatiri key={o.id} o={o} now={now} />
              ))}
            </ul>
          )}

          {son.length > 0 ? (
            <>
              <h3 className="border-t border-gray-100 px-5 pt-3 text-theme-xs font-semibold tracking-[0.14em] text-gray-500 uppercase sm:px-6">
                Süresi dolan son ödevler
              </h3>
              <ul className="divide-y divide-gray-100">
                {son.map((o) => (
                  <OdevSatiri key={o.id} o={o} now={now} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </ComponentCard>
  );
}
