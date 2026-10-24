import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CheckupError, getKitapcik } from "@/lib/checkup";
import { cezaKurali, sonGunMetni } from "@/lib/deneme";
import { examInfo, examShort } from "@/lib/exams";
import { MathContent } from "@/components/MathContent";
import { LogoYazi } from "@/components/ui/logo";
import { trDate } from "@/components/ui";
import { YazdirDugmesi } from "./YazdirDugmesi";

/*
 * Kişiye özel belge: arama motoruna kapalı (kök düzen de kapatıyor, burada
 * ayrıca yazılı ki kök değişirse açılmasın). Sayfa oturum çerezine baktığı
 * için dinamik çiziliyor; Next dinamik sayfaya
 * "Cache-Control: private, no-cache, no-store" yazıyor — ara önbellek tutmaz.
 */
export const metadata: Metadata = {
  title: "Kitapçık",
  robots: { index: false, follow: false, nocache: true },
};

/** Cevap kâğıdında bir sütundaki en az satır: 15 soruluk test iki sütuna yayılmasın diye. */
const OPTIK_SATIR_EN_AZ = 10;
/** Cevap kâğıdında en fazla sütun (A4 dikey genişliğine sığan). */
const OPTIK_SUTUN_EN_FAZLA = 4;

function uygulamaAdresi() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://checkup.kocum.net").host;
  } catch {
    return "checkup.kocum.net";
  }
}

/**
 * Kâğıtta çözülecek testin kitapçığı: yazdırma odaklı, uygulama çerçevesi
 * dışında. Numaralı sorular ve şıklar (KaTeX ve görseller sunucuda çizilir),
 * sonda boş bir cevap kâğıdı. Yazdırırken iki sütun; soru sütun/sayfa
 * ortasından bölünmez.
 *
 * ⚠️ Cevap anahtarı, çözüm, ipucu, video ve hata tipi YOK (lib/checkup.ts
 * getKitapcik alanları tek tek seçer; leak-test denetler). Yalnızca oturumun
 * sahibi görür; başkasının oturumu ve ekran oturumu 404.
 */
export default async function KitapcikPage({ params }: PageProps<"/kitapcik/[sessionId]">) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  let k;
  try {
    k = await getKitapcik(sessionId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) notFound();
    throw e;
  }

  const acik = k.status === "IN_PROGRESS";
  const sonGun = sonGunMetni(k.expiresAt);
  const kural = cezaKurali(k.penaltyRatio);
  const satir = Math.max(OPTIK_SATIR_EN_AZ, Math.ceil(k.questions.length / OPTIK_SUTUN_EN_FAZLA));
  const sutunlar: (typeof k.questions)[] = [];
  for (let i = 0; i < k.questions.length; i += satir) sutunlar.push(k.questions.slice(i, i + satir));

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      {/* A4, dar kenar boşluğu: iki sütunlu kitapçık sayfaya sığsın. */}
      <style>{`@page { size: A4; margin: 14mm 12mm; }`}</style>

      {/* Ekran çubuğu — yazdırmada yok. */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link
            href={acik ? `/checkup/${k.id}` : k.status === "SUBMITTED" ? `/sonuc/${k.id}` : "/panel"}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-theme-sm font-medium text-gray-600 transition hover:text-gray-800"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {acik ? "Optik forma geç" : k.status === "SUBMITTED" ? "Sonuca git" : "Ana sayfa"}
          </Link>
          <span className="flex-1" />
          <YazdirDugmesi />
        </div>
        {!acik ? (
          <p className="border-t border-gray-100 bg-success-50 px-4 py-2 text-center text-theme-sm text-success-700">
            <CircleCheck className="me-1 inline size-4 align-[-3px]" aria-hidden />
            Bu testin cevapları gönderildi.
          </p>
        ) : null}
      </div>

      <div className="mx-auto max-w-[210mm] bg-white px-4 py-6 text-[15px] leading-relaxed text-gray-900 shadow-theme-sm sm:my-6 sm:px-10 sm:py-10 print:m-0 print:max-w-none print:p-0 print:text-[10.5pt] print:shadow-none">
        {/* ── Kapak bilgisi ─────────────────────────────── */}
        <header className="border-b-2 border-gray-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LogoYazi className="h-6" />
            <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase">
              Matematik Check-up · {examShort(k.examScope)}
            </span>
          </div>
          <h1 className="mt-3 font-display text-xl font-semibold text-gray-900 print:text-[15pt]">{k.packageName}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-theme-sm sm:grid-cols-4 print:grid-cols-4 print:text-[9.5pt]">
            <div>
              <dt className="text-gray-500">Öğrenci</dt>
              <dd className="font-medium text-gray-900">{k.studentName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tarih</dt>
              <dd className="font-medium text-gray-900">{trDate(k.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Önerilen süre</dt>
              <dd className="tabular font-medium text-gray-900">{k.durationMinutes} dakika</dd>
            </div>
            <div>
              <dt className="text-gray-500">Soru</dt>
              <dd className="tabular font-medium text-gray-900">{k.questions.length}</dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1 ps-5 text-theme-sm text-gray-700 print:text-[9.5pt]">
            <li>
              Süreyi kendin tut: <span className="tabular">{k.durationMinutes}</span> dakika dolunca kalemi bırak.
            </li>
            <li>
              Her sorunun tek doğru cevabı var. {kural}
              {/* Boş bırakma tavsiyesi ekrandakiyle aynı (sınavın kuralı): ayrı bir cümle
                  ekrandaki "iki şıkkı eleyebiliyorsan işaretle" ile çelişiyordu. */}
              {k.penaltyRatio > 0
                ? `. ${examInfo(k.examScope)?.blankAdvice ?? "Emin değilsen boş bırakmak daha iyi olabilir."}`
                : "; emin olmasan da işaretle."}
            </li>
            <li>Cevaplarını son sayfadaki cevap kâğıdına işaretle.</li>
            <li>
              En geç <strong className="font-semibold">{sonGun}</strong> tarihine kadar cevaplarını{" "}
              {uygulamaAdresi()} adresinde optik forma işle. Bu ana kadar göndermezsen işaretlediklerinle puanlanır.
            </li>
          </ul>
        </header>

        {/* ── Sorular ───────────────────────────────────── */}
        {/* Ekranda tek sütun (telefonda okunur), kâğıtta iki sütun ve aralarında çizgi. */}
        <ol className="mt-6 gap-x-8 print:columns-2 print:[column-rule:1px_solid_#d0d5dd]">
          {k.questions.map((q, i) => (
            <li key={q.order} className="mb-7 break-inside-avoid print:mb-5">
              <div className="flex gap-2">
                <span className="tabular shrink-0 font-display font-bold text-gray-900">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <MathContent content={q.stem} />
                  <ol className="mt-3 space-y-1.5 print:mt-2 print:space-y-1">
                    {q.choices.map((c) => (
                      <li key={c.label} className="flex gap-2">
                        <span className="shrink-0 font-semibold text-gray-900">{c.label})</span>
                        <span className="min-w-0 flex-1">
                          <MathContent content={c.content} compact />
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-2 border-t border-gray-200 pt-3 text-center text-theme-sm text-gray-500 print:text-[9pt]">
          Test bitti. Cevaplarını son sayfadaki cevap kâğıdına geçir.
        </p>

        {/* ── Cevap kâğıdı (boş optik form) ─────────────── */}
        <section aria-labelledby="cevap-kagidi" className="mt-10 break-before-page border-t-2 border-gray-800 pt-4 print:mt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="cevap-kagidi" className="font-display text-lg font-semibold text-gray-900">
              Cevap kâğıdı
            </h2>
            <LogoYazi className="h-5" />
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-theme-sm sm:grid-cols-2 print:grid-cols-2 print:text-[9.5pt]">
            <div className="flex gap-2">
              <dt className="text-gray-500">Öğrenci:</dt>
              <dd className="font-medium text-gray-900">{k.studentName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">Test:</dt>
              <dd className="font-medium text-gray-900">{k.packageName}</dd>
            </div>
            {/* Süreyi kendisi tutuyor: yazması kendine dürüst olmasını kolaylaştırır. */}
            <div className="flex gap-2">
              <dt className="text-gray-500">Başlama saati:</dt>
              <dd className="min-w-24 flex-1 border-b border-dotted border-gray-400" />
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">Bitirme saati:</dt>
              <dd className="min-w-24 flex-1 border-b border-dotted border-gray-400" />
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4 print:flex-nowrap print:justify-between">
            {sutunlar.map((sutun, s) => (
              <ol key={s} className="space-y-1.5 print:space-y-[2.2mm]">
                {sutun.map((q, j) => {
                  const no = s * satir + j + 1;
                  return (
                    <li key={q.order} className="flex items-center gap-1.5">
                      <span className="tabular w-6 shrink-0 text-end text-theme-sm font-semibold text-gray-900 print:text-[9pt]">
                        {no}
                      </span>
                      {q.choices.map((c) => (
                        <span
                          key={c.label}
                          className="flex size-6 items-center justify-center rounded-full border border-gray-500 text-[10px] font-medium text-gray-500 print:size-[5.5mm] print:text-[7pt]"
                        >
                          {c.label}
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ol>
            ))}
          </div>
          <p className="mt-6 text-theme-xs text-gray-500 print:text-[8pt]">
            İşaretlerini {uygulamaAdresi()} adresinde, “Testler” sayfasından bu teste girip optik forma geçir. Son gün: {sonGun}.
          </p>
        </section>
      </div>
    </main>
  );
}
