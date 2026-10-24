import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { LEVEL_LABEL, examLabel, percent, trDate, trNumber } from "@/lib/checkup/format";
import { RAPOR_GUN, enZayifKonular, grupRaporu, odevKayitlari, odevOrani, oranaSayilir } from "@/lib/checkup/gruplar";
import { ODEV_TURU_ETIKETI } from "@/lib/checkup/grup-kurallari";
import type { OdevIlerlemesi } from "@/lib/checkup/shared/odev";
import { GateNotice } from "@/components/checkup/GateNotice";
import { YazdirDugmesi } from "@/components/checkup/YazdirDugmesi";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · Grubu yazdır" };

/** Yazdırılan ödev sütunu ve konu sayısı: A4 dikeyde okunur kalsın. */
const ODEV_SAYISI = 4;
const KONU_SAYISI = 5;

/**
 * Bir hücrenin kâğıttaki metni. Renk yok (siyah-beyaz yazıcı): durum yazıyla.
 * Süresi dolmamış ödevde "yapmadı" denmez; öğrencinin hâlâ vakti var.
 */
function hucreMetni(i: OdevIlerlemesi, dueAt: Date, now: Date): string {
  const doldu = dueAt.getTime() < now.getTime();
  switch (i.durum) {
    case "TAMAMLANDI":
      return "Tamamladı" + (i.net !== null ? " · " + trNumber(i.net, 2) + " net" : "");
    case "GEC_TAMAMLANDI":
      return "Geç tamamladı" + (i.net !== null ? " · " + trNumber(i.net, 2) + " net" : "");
    case "BASLADI":
      return doldu ? "Başladı, bitirmedi" : "Devam ediyor";
    case "BASLAMADI":
      return doldu ? "Yapmadı" : "Henüz başlamadı";
  }
}

/**
 * Veli toplantısı için grubun sade, yazdırılabilir özeti: üye × son
 * ODEV_SAYISI ödevin durumu, grubun en zayıf KONU_SAYISI konusu ve tarih.
 * Kurallar grup sayfasıyla aynı (shared/odev.ts tamamlanma, gruplar.ts
 * grupRaporu); ayrı hesap yok.
 *
 * Bilerek CSV ya da dışa aktarma YOK: ham öğrenci verisi panelden dosya
 * olarak çıkmasın (KVKK). Kâğıt bütün grubun adlarını taşır; ekrandaki uyarı
 * bunu söyler. Yalnızca yönetici ve müdür.
 */
export default async function GrupYazdirPage({ params }: PageProps<"/checkup/gruplar/[id]/yazdir">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const { id } = await params;
  const now = new Date();

  // Üyeler ada göre; ödevler iptal edilmemiş, verilmiş, son tarihi en yeni önce.
  const grup = await db.studyGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      examScope: true,
      members: {
        orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
        select: { userId: true, createdAt: true, user: { select: { name: true } } },
      },
      assignments: {
        where: { cancelledAt: null, startsAt: { lte: now } },
        orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
        take: ODEV_SAYISI,
        select: { id: true, kind: true, packageId: true, topicId: true, questionCount: true, title: true, startsAt: true, dueAt: true },
      },
    },
  });
  if (!grup) notFound();

  const uyeIdleri = grup.members.map((m) => m.userId);
  // Son ödevler: iptal edilmemiş, son tarihi en yeni dört; kâğıtta eskiden yeniye.
  const odevler = grup.assignments.slice(0, ODEV_SAYISI).reverse();
  const [kayitlar, rapor] = await Promise.all([odevKayitlari(uyeIdleri, odevler), grupRaporu(uyeIdleri, grup.examScope, now)]);
  const ilerlemeler = odevler.map((o) => odevOrani(o, grup.members, kayitlar));
  const zayif = enZayifKonular(rapor.konular, KONU_SAYISI);

  const hucre = "border border-gray-300 px-2 py-1.5 align-top";

  return (
    <>
      {/* Sayfa düzeni için: A4, dar kenar boşluğu. */}
      <style>{"@page { size: A4; margin: 12mm; }"}</style>

      <div className="print:hidden">
        <PageBreadcrumb
          crumbs={[
            { href: "/checkup", label: "Check-up" },
            { href: "/checkup/gruplar", label: "Gruplar ve ödevler" },
            { href: "/checkup/gruplar/" + grup.id, label: grup.name },
          ]}
          pageTitle="Yazdır"
          description="Veli toplantısı için sade görünüm. Tarayıcının yazdırma penceresinden kâğıda ya da PDF'e al."
          actions={
            <>
              <ButtonLink href={"/checkup/gruplar/" + grup.id} variant="ghost" size="xs">
                Gruba dön
              </ButtonLink>
              <YazdirDugmesi />
            </>
          }
        />
        <Alert variant="warning" compact className="mb-6">
          Kâğıtta grubun bütün öğrencilerinin adı var. Veliye yalnızca kendi çocuğunun satırını göster; toplantıdan sonra
          kâğıdı ortada bırakma.
        </Alert>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 text-theme-sm text-gray-800 sm:p-8 print:rounded-none print:border-0 print:p-0 print:text-black">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-300 pb-3">
          <div>
            <h1 className="font-display text-xl font-semibold">{grup.name}</h1>
            <p className="text-theme-xs text-gray-600 print:text-black">
              {[grup.examScope ? examLabel(grup.examScope) : null, trNumber(grup.members.length) + " öğrenci"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="text-theme-xs text-gray-600 print:text-black">Tarih: {trDate(now, { time: true })}</p>
        </header>

        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-semibold">Son ödevler</h2>
          {odevler.length === 0 ? (
            <p className="text-gray-600">Bu gruba henüz ödev verilmedi.</p>
          ) : grup.members.length === 0 ? (
            <p className="text-gray-600">Grupta üye yok.</p>
          ) : (
            <table className="w-full border-collapse text-theme-xs">
              <thead>
                <tr>
                  <th scope="col" className={hucre + " text-start"}>
                    Öğrenci
                  </th>
                  {odevler.map((o) => (
                    <th key={o.id} scope="col" className={hucre + " text-start font-semibold"}>
                      {o.title}
                      <span className="block font-normal text-gray-600 print:text-black">
                        {(ODEV_TURU_ETIKETI[o.kind] ?? o.kind) + " · son tarih " + trDate(o.dueAt, { year: false })}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grup.members.map((m) => (
                  <tr key={m.userId} className="break-inside-avoid">
                    <th scope="row" className={hucre + " text-start font-medium"}>
                      {m.user.name}
                    </th>
                    {odevler.map((o, n) => {
                      const i = ilerlemeler[n].ilerlemeler.get(m.userId);
                      return (
                        <td key={o.id} className={hucre}>
                          {!oranaSayilir(m, o) ? "— (sonra katıldı)" : i ? hucreMetni(i, o.dueAt, now) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-1 font-semibold">Grubun en zayıf {KONU_SAYISI} konusu</h2>
          <p className="mb-2 text-theme-xs text-gray-600 print:text-black">
            Son {RAPOR_GUN} günün testleri{grup.examScope ? ", " + examLabel(grup.examScope) : ""}; boş gönderilen ve yarım kalan testler
            sayılmaz.
          </p>
          {zayif.length === 0 ? (
            <p className="text-gray-600">Seviyesi ölçülebilen konu yok: üyeler son {RAPOR_GUN} günde yeterli test çözmemiş.</p>
          ) : (
            <table className="w-full border-collapse text-theme-xs">
              <thead>
                <tr>
                  <th scope="col" className={hucre + " text-start"}>
                    Konu
                  </th>
                  <th scope="col" className={hucre + " text-end"}>
                    Başarı
                  </th>
                  <th scope="col" className={hucre + " text-end"}>
                    Doğru / soru
                  </th>
                  <th scope="col" className={hucre + " text-end"}>
                    Zayıf çıkan öğrenci
                  </th>
                </tr>
              </thead>
              <tbody>
                {zayif.map((k, n) => (
                  <tr key={k.topicId}>
                    <th scope="row" className={hucre + " text-start font-medium"}>
                      {n + 1}. {k.name}
                      <span className="ms-1 font-normal text-gray-600 print:text-black">({k.level ? LEVEL_LABEL[k.level] : "—"})</span>
                    </th>
                    <td className={hucre + " tabular text-end"}>{percent(k.ratio)}</td>
                    <td className={hucre + " tabular text-end"}>
                      {k.correct}/{k.asked}
                    </td>
                    <td className={hucre + " tabular text-end"}>
                      {k.zayifUye}/{k.olculenUye}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-6 border-t border-gray-300 pt-2 text-theme-xs text-gray-600 print:text-black">
          Koçum.Net Check-up · Kişisel veri içerir; yalnızca ilgili veliyle paylaşın.
        </footer>
      </article>
    </>
  );
}
