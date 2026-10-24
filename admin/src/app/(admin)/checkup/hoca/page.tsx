import type { Metadata } from "next";
import { ANY_STAFF, CONTENT_ROLES, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { trDate } from "@/lib/checkup/format";
import { damgaAdi } from "@/lib/checkup/question-note";
import { cevapDurumu, degerOku, isSuzgec, soruListesi } from "@/lib/checkup/hoca/cevap";
import { hocaCevapKayitlari } from "@/lib/checkup/hoca/kayitlar";
import { HOCA_BOLUMLERI, HOCA_GIRIS, HOCA_KAPANIS } from "@/lib/checkup/hoca/sorular";
import { GateNotice } from "@/components/checkup/GateNotice";
import { HocaEkrani } from "@/components/checkup/HocaEkrani";
import type { KayitGorunumu } from "@/components/checkup/HocaSoruKarti";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · Hocaya sorular" };

/**
 * "Hocaya sorular" — Özgür Hoca içerik ve kural kararlarını buradan cevaplar.
 * Sorular kodda (lib/checkup/hoca/sorular.ts), cevaplar veritabanında
 * (TeacherAnswer). Okuma bütün personele; cevap içerik rollerine (hoca editör
 * hesabıyla girer); "uygulandı" işareti ve .md dökümü yönetime.
 *
 * Tarihler burada biçimlenir: istemci aynı metni çizsin (saat dilimi/ICU farkı
 * hydration uyarısı vermesin).
 */
export default async function HocaSorulariPage({ searchParams }: PageProps<"/checkup/hoca">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);
  const yonetebilir = MANAGE_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const ilkSuzgec = isSuzgec(sp.suzgec) ? sp.suzgec : "tumu";

  const harita = new Map((await hocaCevapKayitlari()).map((k) => [k.questionKey, k]));
  const kayitlar: Record<string, KayitGorunumu> = {};
  for (const { soru } of soruListesi(HOCA_BOLUMLERI)) {
    const k = harita.get(soru.anahtar);
    const durum = cevapDurumu(k);
    if (!k || durum === "bekliyor") continue;
    const { deger, uyumsuz } = degerOku(soru, k.value);
    kayitlar[soru.anahtar] = {
      durum,
      deger,
      uyumsuz,
      not: k.note,
      cevaplayan: k.answeredByStaff ? damgaAdi(k.answeredByStaff) : null,
      cevaplayanTam: k.answeredByStaff,
      cevapZamani: k.answeredAt ? trDate(k.answeredAt, { time: true }) : null,
      surum: k.answeredAt ? k.answeredAt.toISOString() : null,
      uygulama: k.appliedAt
        ? {
            zaman: trDate(k.appliedAt, { time: true }),
            kim: damgaAdi(k.appliedByStaff),
            kimTam: k.appliedByStaff,
            not: k.appliedNote,
          }
        : null,
    };
  }

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Hocaya sorular"
        description="Check-up'ı öğrenciye açmadan önce kararınızı bekleyen konular. Cevap vermediğiniz soruda sistemdeki şu anki hâli geçerli kalır."
      />
      <HocaEkrani
        bolumler={HOCA_BOLUMLERI}
        giris={HOCA_GIRIS}
        kapanis={HOCA_KAPANIS}
        kayitlar={kayitlar}
        yetki={{ yazabilir, yonetebilir }}
        ilkSuzgec={ilkSuzgec}
        indirmeAdresi={yonetebilir ? "/checkup/hoca/cevaplar.md" : undefined}
      />
    </>
  );
}
