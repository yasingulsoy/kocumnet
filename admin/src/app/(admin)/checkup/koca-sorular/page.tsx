import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, CircleCheck, Eye, EyeOff, MessageCircleQuestion } from "lucide-react";
import { CONTENT_ROLES, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL, relativeDay, trDate } from "@/lib/checkup/format";
import { KUTULAR, KUTU_ETIKETI, isKutu } from "@/lib/checkup/koca-soru";
import { SAYFA_BOYU, gelenSorular, kutuSayilari, type GelenSoru, type SoruBaglami } from "@/lib/checkup/koca-sorular";
import { damgaAdi } from "@/lib/checkup/question-note";
import { ContentPreview } from "@/components/checkup/ContentPreview";
import { GateNotice } from "@/components/checkup/GateNotice";
import { KocaSoruEylemleri } from "@/components/checkup/KocaSoruCevap";
import { QUESTION_STATUS_COLOR, qs } from "@/components/checkup/ui";
import { cx } from "@/components/tailadmin/cx";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

export const metadata: Metadata = { title: "Check-up · Öğrenci soruları" };

const BASE = "/checkup/koca-sorular";

const KAYNAK_ADI: Record<string, string> = {
  SONUC: "Sonuç ekranı",
  ALISTIRMA: "Alıştırma",
  SEVIYELI: "Seviyeli check-up",
  KONTROL: "Kontrol testi",
};

/** Öğrencinin o oturumdaki cevabı, tek cümle. */
function cevapCumlesi(s: SoruBaglami, alistirma: boolean): string | null {
  const c = s.ogrenciCevabi;
  if (!c) return null;
  if (c.durum === "SECTI") {
    const secilen = s.secenekler.find((x) => x.ogrencininki);
    return `Öğrenci ${secilen?.label ?? "?"} şıkkını seçti — ${c.dogru ? "doğru" : "yanlış"}.`;
  }
  if (c.durum === "BOS") return alistirma ? "Öğrenci “Bilmiyorum” dedi." : "Öğrenci boş bıraktı.";
  return "Öğrenci bu soruyu cevaplamadı.";
}

function SoruKutusu({ s, alistirma }: { s: SoruBaglami; alistirma: boolean }) {
  const cumle = cevapCumlesi(s, alistirma);
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-25 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500">
        <span className="font-medium text-gray-700">Soru · {s.konu}</span>
        {s.durum !== "PUBLISHED" ? (
          <Badge size="sm" color={QUESTION_STATUS_COLOR[s.durum] ?? "light"}>
            {QUESTION_STATUS_LABEL[s.durum] ?? s.durum}
          </Badge>
        ) : null}
        <Link
          href={"/checkup/sorular/" + s.id}
          className="ms-auto inline-flex min-h-8 items-center gap-1 font-medium text-brand-500 hover:text-brand-600"
        >
          Soruyu aç <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>
      <ContentPreview markup={s.govde} placeholder="(soru metni okunamadı)" />
      {s.secenekler.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {s.secenekler.map((c) => (
            <li
              key={c.id}
              className={cx(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                c.dogru ? "border-success-500 bg-success-50" : c.ogrencininki ? "border-error-500 bg-error-50" : "border-gray-200 bg-white"
              )}
            >
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-theme-xs font-semibold",
                  c.dogru ? "bg-success-500 text-white" : c.ogrencininki ? "bg-error-500 text-white" : "bg-gray-100 text-gray-700"
                )}
              >
                {c.label}
              </span>
              <span className="min-w-0 flex-1">
                <ContentPreview markup={c.markup} compact placeholder="—" />
              </span>
              {c.dogru || c.ogrencininki ? (
                <span className="shrink-0 text-theme-xs font-medium">
                  {c.dogru ? (
                    <span className="inline-flex items-center gap-1 text-success-700">
                      <Check className="size-3.5" aria-hidden />
                      doğru
                    </span>
                  ) : null}
                  {c.ogrencininki ? <span className={cx("block", c.dogru ? "text-success-700" : "text-error-700")}>öğrencinin cevabı</span> : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {cumle ? <p className="mt-3 text-theme-sm font-medium text-gray-700">{cumle}</p> : null}
    </div>
  );
}

function Satir({ q, now }: { q: GelenSoru; now: Date }) {
  return (
    <li className="space-y-4 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {q.ogrenci ? (
          <Link href={"/checkup/ogrenciler/" + q.ogrenci.id} className="group flex min-w-0 items-center gap-3">
            <Avatar name={q.ogrenci.name} size="small" decorative />
            <span className="min-w-0">
              <span className="block truncate text-theme-sm font-medium text-gray-800 group-hover:text-brand-500">{q.ogrenci.name}</span>
              <span className="block truncate text-theme-xs text-gray-500">{q.ogrenci.email}</span>
            </span>
          </Link>
        ) : (
          // Editör: yalnızca baş harfler (KVKK). Avatar adı baş harflerden üretir.
          <span className="flex items-center gap-3" title="Öğrencinin kimliğini yalnızca yönetici ve müdür görür">
            <Avatar name={q.basHarfler} size="small" decorative />
            <span className="text-theme-sm font-medium text-gray-800">{q.basHarfler}</span>
          </span>
        )}
        <span className="text-theme-xs text-gray-500" title={trDate(q.createdAt, { time: true })}>
          {relativeDay(q.createdAt, now)} · {trDate(q.createdAt, { time: true, year: false })}
        </span>
        {q.kaynak ? (
          <Badge size="sm" color="light">
            {KAYNAK_ADI[q.kaynak.tur]} · {q.kaynak.paket}
          </Badge>
        ) : null}
        <span className="ms-auto">
          {q.durum === "BEKLIYOR" ? (
            <Badge size="sm" color="warning">
              Bekliyor
            </Badge>
          ) : q.durum === "CEVAPLANDI" ? (
            <Badge size="sm" color="success" startIcon={<CircleCheck />}>
              Cevaplandı
            </Badge>
          ) : (
            <Badge size="sm" color="light">
              Kapatıldı
            </Badge>
          )}
        </span>
      </div>

      <div>
        <p className="mb-1 text-theme-xs font-medium text-gray-500">Öğrencinin sorusu</p>
        <p className="text-sm leading-relaxed break-words whitespace-pre-line text-gray-800">{q.body}</p>
      </div>

      {q.soru ? <SoruKutusu s={q.soru} alistirma={q.kaynak?.tur === "ALISTIRMA"} /> : null}

      {q.durum === "CEVAPLANDI" && q.answerBody ? (
        <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500">
            <span className="font-medium text-gray-700" title={q.answeredByStaff ?? undefined}>
              Cevap · {damgaAdi(q.answeredByStaff)}
            </span>
            {q.answeredAt ? <span>{trDate(q.answeredAt, { time: true })}</span> : null}
            <span className="ms-auto inline-flex items-center gap-1">
              {q.readAt ? (
                <>
                  <Eye className="size-3.5" aria-hidden /> Öğrenci okudu · {relativeDay(q.readAt, now)}
                </>
              ) : (
                <>
                  <EyeOff className="size-3.5" aria-hidden /> Henüz okunmadı
                </>
              )}
            </span>
          </div>
          <p className="text-sm leading-relaxed break-words whitespace-pre-line text-gray-800">{q.answerBody}</p>
        </div>
      ) : null}

      {q.durum === "KAPATILDI" && q.closedAt ? (
        <p className="text-theme-xs text-gray-500" title={q.closedByStaff ?? undefined}>
          Cevapsız kapatıldı · {damgaAdi(q.closedByStaff)} · {trDate(q.closedAt, { time: true })}
        </p>
      ) : null}

      <KocaSoruEylemleri id={q.id} durum={q.durum} cevap={q.answerBody} />
    </li>
  );
}

/**
 * "Koça sor" gelen kutusu. Soru içeriğini yazabilen roller (admin, müdür,
 * editör) cevaplar; öğrencinin adı ve e-postası yalnızca yönetici ve
 * müdüre görünür (KVKK), editör baş harfleri görür.
 */
export default async function KocaSorularPage({ searchParams }: PageProps<"/checkup/koca-sorular">) {
  const gate = await checkStaff(CONTENT_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={CONTENT_ROLES} />;
  const kisisel = MANAGE_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const kutu = isKutu(sp.kutu) ? sp.kutu : "bekleyen";
  const istenenSayfa = Math.max(1, Math.floor(Number(typeof sp.sayfa === "string" ? sp.sayfa : 1)) || 1);

  const now = new Date();
  const sayilar = await kutuSayilari();
  const sonSayfa = Math.max(1, Math.ceil(sayilar[kutu] / SAYFA_BOYU));
  const sayfa = Math.min(istenenSayfa, sonSayfa);
  const sorular = await gelenSorular(kutu, sayfa, kisisel);

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Öğrenci soruları"
        description={
          "Öğrencilerin “Koça sor” ile yazdıkları. Her soruya tek cevap; düzeltirsen öğrenci yeni cevap olarak görür." +
          (kisisel ? "" : " Öğrencinin kimliğini yalnızca yönetici ve müdür görür; sende baş harfler.")
        }
      />

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
          <SegmentedTabs
            label="Gelen kutusu"
            items={KUTULAR.map((k) => ({
              key: k,
              href: k === "bekleyen" ? BASE : qs(BASE, { kutu: k }),
              label: KUTU_ETIKETI[k],
              active: kutu === k,
              count: sayilar[k],
            }))}
          />
        </div>

        {sorular.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion />}
            title={kutu === "bekleyen" ? "Bekleyen soru yok" : kutu === "cevaplanan" ? "Cevaplanan soru yok" : "Kapatılan soru yok"}
            description={
              kutu === "bekleyen"
                ? "Öğrenciler sonuç ve alıştırma ekranındaki “Koça sor” ile yazdığında burada, en eskisi üstte görünür."
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorular.map((q) => (
              <Satir key={q.id} q={q} now={now} />
            ))}
          </ul>
        )}
      </Card>

      <Pagination
        currentPage={sayfa}
        totalPages={sonSayfa}
        href={(p) => qs(BASE, { kutu: kutu !== "bekleyen" ? kutu : undefined, sayfa: p > 1 ? p : undefined })}
      />
    </>
  );
}
