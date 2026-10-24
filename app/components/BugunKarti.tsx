import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  CalendarCheck,
  ChartLine,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Hourglass,
  Layers,
  NotebookPen,
  Play,
  Printer,
  ScanLine,
  Sparkles,
} from "lucide-react";
import type { BugunIsi } from "@/lib/bugun";
import { konuTekrarBaslat } from "@/lib/actions/plan";
import { examShort } from "@/lib/exams";
import { sonGunMetni } from "@/lib/deneme";
import { kalanGun, kalanGunMetni } from "@/lib/odev";
import type { OgrenciOdevi } from "@/lib/odev-sorgu";
import { KONU_CALISMA_SORU } from "@/lib/review";
import { KonuOdevButonu } from "@/app/(panel)/odevler/KonuOdevButonu";
import { TekrarBaslatButonu } from "@/components/AlistirmaButonlari";
import { KonuBesSoruButonu } from "@/components/KonuBesSoruButonu";
import { PlanIsiBitirButonu } from "@/components/PlanIsiBitirButonu";
import { Progress } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { cx } from "@/components/tailadmin/cx";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { GridShape } from "@/components/tailadmin/ui/GridShape";

/*
 * Panonun en üstündeki "Bugün" kartı (kitin Card'ı): bugün yapılacak TEK iş
 * ve tek birincil düğme. Hangi işin seçildiği lib/bugun.ts'te (saf, testli);
 * burada yalnızca metin ve düğme. Kartın gösterdiği iş aşağıda ikinci kez
 * yazılmaz: pano o kartı (yarım test, seviyeli devam, defter) gizler.
 */

export interface BugunAcikTest {
  id: string;
  kind: string;
  /** ONLINE | PAPER. Kâğıtta sayaç yok; expiresAt = cevapları optik forma işleme son anı. */
  mode: string;
  stageLevel: number | null;
  stageKind: string | null;
  expiresAt: Date;
  package: { name: string };
  focusTopic: { name: string } | null;
  _count: { items: number };
  /** İşaretlenmiş maddeler. */
  items: { id: string }[];
}

export interface BugunSeviyeli {
  id: string;
  examScope: string;
  unlockedLevel: number;
  pendingRemedialIds: string[];
}

export interface BugunPlanIsi {
  id: string;
  kind: "STUDY" | "SOLVE" | "REVIEW" | "RETEST";
  title: string;
  topicId: string | null;
  topicName?: string | null;
  estimatedMinutes: number;
  done: boolean;
  /** Soru işi: bu hafta bu konuda uygulamada çözülen / hedef (lib/plan-ilerleme.ts). */
  ilerleme?: { cozulen: number; hedef: number } | null;
  /** Soru işi: "5 soru çöz" alıştırmasının kaynağı (planın kurulduğu test). */
  kaynakOturumId?: string | null;
  /** Konu tekrarı: önerilen yayın (lib/products.ts, sınava uygunsa). */
  urun?: { ad: string; adres: string } | null;
  /** Konu tekrarı: yanlış defterinde bu konunun kazanım özeti varsa oraya giden adres. */
  kazanimAdresi?: string | null;
}

/**
 * İş kalmayınca (ya da yalnızca önerilen test kaldıysa): en zayıf ölçülmüş
 * konudan 5 soruluk süresiz alıştırma. Kaynak test konunun son ölçüldüğü test.
 */
export interface BugunHizli {
  sessionId: string;
  topicId: string;
  topicName: string;
  /** 0-1 */
  oran: number;
}

export interface BugunOneri {
  slug: string;
  name: string;
  questionCount: number;
  durationMinutes: number;
  topicCount: number;
}

/** Son tarihi yakın ödev (lib/odev-sorgu.ts bugunkuOdev). */
export type BugunOdev = Pick<
  OgrenciOdevi,
  "id" | "kind" | "title" | "grupAdi" | "dueAt" | "paket" | "konu" | "ilerleme" | "acikOturumId"
>;

export type BugunKartIsi = BugunIsi<BugunAcikTest, BugunSeviyeli, BugunPlanIsi, BugunOneri, BugunOdev>;

const BASLIK_ID = "bugun-baslik";

function Kabuk({
  koyu = false,
  ikon,
  ust,
  baslik,
  metin,
  eylem,
  alt,
}: {
  koyu?: boolean;
  ikon: ReactNode;
  /** Üst satır: "Bugün · …" — işin neden seçildiği. */
  ust: string;
  baslik: ReactNode;
  metin?: ReactNode;
  eylem: ReactNode;
  alt?: ReactNode;
}) {
  return (
    <Card tone={koyu ? "dark" : "brand"} className={cx("p-5 sm:p-6", koyu && "relative z-1 overflow-hidden")}>
      {koyu ? <GridShape /> : null}
      <section aria-labelledby={BASLIK_ID} className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {/* "Yaptım" sonrası kart sıradaki işe geçer; ekran okuyucu yeni işi duysun. */}
        <div className="min-w-0 flex-[1_1_18rem]" aria-live="polite">
          <p
            className={cx(
              "flex items-center gap-1.5 text-theme-xs font-semibold tracking-[0.14em] uppercase [&_svg]:size-3.5 [&_svg]:shrink-0",
              koyu ? "text-gray-300" : "text-brand-500"
            )}
          >
            {ikon}
            {ust}
          </p>
          <h2
            id={BASLIK_ID}
            className={cx(
              "mt-1.5 font-display text-xl font-semibold text-balance sm:text-2xl",
              koyu ? "text-white" : "text-gray-800"
            )}
          >
            {baslik}
          </h2>
          {metin ? (
            <p className={cx("tabular mt-1 text-theme-sm leading-relaxed", koyu ? "text-gray-300" : "text-gray-500")}>{metin}</p>
          ) : null}
        </div>
        <div className="w-full sm:w-auto sm:min-w-52 sm:shrink-0">{eylem}</div>
        {alt}
      </section>
    </Card>
  );
}

const ileri = <ArrowRight className="rtl:rotate-180" />;

/** "Hızlı 5 soru" satırı: önerilen testin altında ikinci yol (vakti az olana). */
function HizliSatiri({ h }: { h: BugunHizli }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4">
      <p className="min-w-0 flex-[1_1_14rem] text-theme-sm text-gray-500">
        Vaktin azsa: en zayıf konun <span className="font-medium text-gray-700">{h.topicName}</span>, süresiz{" "}
        {KONU_CALISMA_SORU} soru.
      </p>
      <KonuBesSoruButonu
        sessionId={h.sessionId}
        topicId={h.topicId}
        topicName={h.topicName}
        etiket={`Hızlı ${KONU_CALISMA_SORU} soru`}
        variant="soft"
        size="xs"
      />
    </div>
  );
}

export function BugunKarti({ is, yeni, hizli = null }: { is: BugunKartIsi; yeni: boolean; hizli?: BugunHizli | null }) {
  switch (is.tur) {
    case "TEST": {
      const t = is.test;
      const ad =
        t.kind === "TOPIC_RETEST" && t.focusTopic
          ? `${t.focusTopic.name} kontrol testi`
          : t.kind === "LEVEL_STAGE"
            ? `${t.stageKind === "REMEDIAL" ? "Teyit turu" : `Seviye ${t.stageLevel ?? 1}`} · ${t.package.name}`
            : t.package.name;
      /*
       * Kâğıt oturumu: öğrenci kitapçıkta çözüyor, işleyen bir süre yok.
       * Kartın işi cevapları optik forma işletmek (son an expiresAt,
       * lib/deneme.ts KAGIT_ISLEME_SURESI_SAAT); kitapçık da yeniden açılabilsin.
       */
      if (t.mode === "PAPER") {
        return (
          <Kabuk
            ikon={<ClipboardPen aria-hidden />}
            ust="Bugün · kâğıtta çözdüğün test"
            baslik={ad}
            metin={`Cevaplarını optik forma işle · son gün ${sonGunMetni(t.expiresAt)}`}
            eylem={
              <div className="flex flex-col gap-2">
                <ButtonLink href={`/checkup/${t.id}`} block startIcon={<ScanLine />}>
                  Optik forma işle
                </ButtonLink>
                <ButtonLink href={`/kitapcik/${t.id}`} variant="outline" block startIcon={<Printer />}>
                  Kitapçığı aç
                </ButtonLink>
              </div>
            }
          />
        );
      }
      const bitis = t.expiresAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      });
      return (
        <Kabuk
          koyu
          ikon={<Hourglass aria-hidden />}
          ust="Bugün · yarım kalan test"
          baslik={ad}
          metin={`${t.items.length}/${t._count.items} işaretli · süre işliyor, bitiş ${bitis}`}
          eylem={
            <ButtonLink href={`/checkup/${t.id}`} variant="outline" block startIcon={<Play />}>
              Teste dön
            </ButtonLink>
          }
        />
      );
    }

    case "ODEV": {
      const o = is.odev;
      const simdi = new Date();
      const saat = o.dueAt.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
      const konuIlerlemesi = o.kind === "TOPIC_PRACTICE" ? ` · ${o.ilerleme.cozulen}/${o.ilerleme.hedef} soru` : "";
      // Kart başlatamıyorsa (paket yayında değil) nedeni ödevler sayfasında yazıyor.
      // Konu ödevi kaynak test istemez (lib/practice.ts odevKonuCalismasiBaslat).
      const eylem =
        o.kind === "PACKAGE" && o.paket?.yayinda ? (
          <ButtonLink href={`/paketler/${o.paket.slug}`} block startIcon={<Play />}>
            {o.acikOturumId ? "Teste dön" : "Teste başla"}
          </ButtonLink>
        ) : o.kind === "TOPIC_PRACTICE" && o.konu ? (
          <KonuOdevButonu
            assignmentId={o.id}
            topicName={o.konu.name}
            etiket={o.ilerleme.durum === "BASLADI" ? "Devam et" : "Alıştırmaya başla"}
            block
          />
        ) : (
          <ButtonLink href="/odevler" variant="outline" block endIcon={ileri}>
            Ödeve bak
          </ButtonLink>
        );
      return (
        <Kabuk
          ikon={<ClipboardCheck aria-hidden />}
          ust={kalanGun(o.dueAt, simdi) <= 0 ? "Bugün · ödevin son günü" : "Bugün · koçunun ödevi"}
          baslik={o.title}
          metin={`${o.grupAdi} · son tarih ${saat}, ${kalanGunMetni(o.dueAt, simdi)}${konuIlerlemesi}`}
          eylem={eylem}
        />
      );
    }

    case "SEVIYELI": {
      const k = is.kosu;
      return (
        <Kabuk
          ikon={<Layers aria-hidden />}
          ust="Bugün · seviyeli check-up"
          baslik={k.pendingRemedialIds.length > 0 ? "Teyit turun bekliyor" : `Seviye ${k.unlockedLevel} seni bekliyor`}
          metin={`${examShort(k.examScope)} seviyeli check-up yarım kaldı. Süre, aşamayı başlattığında işler.`}
          eylem={
            <ButtonLink href={`/seviye/${k.id}`} block endIcon={ileri}>
              Devam et
            </ButtonLink>
          }
        />
      );
    }

    case "TEKRAR_DEVAM":
      return (
        <Kabuk
          ikon={<NotebookPen aria-hidden />}
          ust="Bugün · yanlış defteri"
          baslik="Bugünkü tekrar yarım kaldı"
          metin={`${is.oturum.toplam} sorudan ${is.oturum.kalan} soru kaldı. Süre yok, kaldığın yerden devam et.`}
          eylem={
            <ButtonLink href={`/alistirma/${is.oturum.id}`} block startIcon={<Play />}>
              Devam et
            </ButtonLink>
          }
        />
      );

    case "TEKRAR":
      return (
        <Kabuk
          ikon={<NotebookPen aria-hidden />}
          ust="Bugün · yanlış defteri"
          baslik={`Bugünkü tekrar: ${is.soru} soru`}
          metin="Her biri bir yanlışının benzeri. Süre yok; her cevaptan sonra çözümü görürsün."
          eylem={<TekrarBaslatButonu block />}
        />
      );

    case "PLAN": {
      const p = is.is;
      const kalanMetni = is.kalan > 1 ? ` · bu hafta ${is.kalan} iş kaldı` : " · haftanın son işi";

      if (p.kind === "RETEST") {
        return (
          <Kabuk
            ikon={<CalendarCheck aria-hidden />}
            ust="Bugün · haftalık plan"
            baslik={p.title}
            metin={`~${p.estimatedMinutes} dk · çözünce plandan kendiliğinden düşer`}
            eylem={
              p.topicId ? (
                <form action={konuTekrarBaslat}>
                  <input type="hidden" name="topicId" value={p.topicId} />
                  {/* Açılamazsa (günlük hak, havuz) ana sayfaya, uyarıyla dönülür. */}
                  <input type="hidden" name="donus" value="/panel" />
                  <SubmitButton block pendingText="Açılıyor…" startIcon={<Play />}>
                    Kontrol testini çöz
                  </SubmitButton>
                </form>
              ) : (
                <PlanIsiBitirButonu itemId={p.id} title={p.title} />
              )
            }
          />
        );
      }

      /*
       * Soru işi ("40 soru"): uygulamada 5'er soruluk alıştırmayla çözülür,
       * bu hafta o konudan çözülen sorular sayılır; hedefe varınca iş
       * kendiliğinden kapanır (lib/plan-ilerleme.ts). "Yaptım" ikincil:
       * kitaptan çözen de işaretleyebilsin.
       */
      if (p.kind === "SOLVE") {
        const il = p.ilerleme ?? null;
        const coz =
          p.kaynakOturumId && p.topicId ? (
            <KonuBesSoruButonu
              block
              sessionId={p.kaynakOturumId}
              topicId={p.topicId}
              topicName={p.topicName ?? p.title}
            />
          ) : null;
        return (
          <Kabuk
            ikon={<CalendarCheck aria-hidden />}
            ust="Bugün · haftalık plan"
            baslik={p.title}
            metin={
              il
                ? `Bu hafta bu konuda ${il.cozulen}/${il.hedef} soru${is.kalan > 1 ? ` · ${is.kalan} iş kaldı` : " · haftanın son işi"}`
                : `~${p.estimatedMinutes} dk · bitirince işaretle${kalanMetni}`
            }
            eylem={
              <div className="flex flex-col gap-2">
                {coz}
                <PlanIsiBitirButonu itemId={p.id} title={p.title} variant={coz ? "outline" : "primary"} />
              </div>
            }
            alt={
              il ? (
                <div className="w-full">
                  <Progress
                    value={(Math.min(il.cozulen, il.hedef) / il.hedef) * 100}
                    label={`${p.title}: ${il.hedef} sorudan ${il.cozulen} soru çözüldü`}
                    className="h-1.5"
                  />
                  <p className="mt-1.5 text-theme-xs text-gray-500">
                    Uygulamada çözdüğün her soru sayılır; {il.hedef} soruya varınca iş kendiliğinden kapanır. Kitaptan
                    çözdüysen &ldquo;Yaptım&rdquo;a bas.
                  </p>
                </div>
              ) : undefined
            }
          />
        );
      }

      // Konu tekrarı ve yanlış analizi: öğrencinin işaretlediği işler.
      const baglantilar =
        p.kind === "STUDY" && (p.urun || p.kazanimAdresi) ? (
          <ul className="flex w-full flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-theme-sm">
            {p.kazanimAdresi ? (
              <li>
                <Link
                  href={p.kazanimAdresi}
                  className="inline-flex min-h-9 items-center gap-1.5 font-medium text-brand-500 transition hover:text-brand-600"
                >
                  <BookMarked className="size-4" aria-hidden />
                  Kazanım özetleri
                </Link>
              </li>
            ) : null}
            {p.urun ? (
              <li className="min-w-0">
                <a
                  href={p.urun.adres}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-9 max-w-full items-center gap-1.5 font-medium text-brand-500 transition hover:text-brand-600"
                >
                  <span className="truncate">Kaynak: {p.urun.ad}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                </a>
              </li>
            ) : null}
          </ul>
        ) : undefined;
      return (
        <Kabuk
          ikon={<CalendarCheck aria-hidden />}
          ust="Bugün · haftalık plan"
          baslik={p.title}
          metin={`~${p.estimatedMinutes} dk · bitirince işaretle${kalanMetni}`}
          eylem={<PlanIsiBitirButonu itemId={p.id} title={p.title} />}
          alt={baglantilar}
        />
      );
    }

    case "ONERI": {
      const o = is.paket;
      if (yeni) {
        return (
          <Kabuk
            ikon={<Sparkles aria-hidden />}
            ust="Bugün · ilk adım"
            baslik="Kısa bir testle başlayalım"
            metin="Sonunda hangi konuda güçlü, hangisinde eksiğin olduğunu ve her yanlışının çözümünü göreceksin."
            eylem={
              <ButtonLink href={`/paketler/${o.slug}`} block endIcon={ileri}>
                {o.name} · {o.durationMinutes} dk
              </ButtonLink>
            }
            alt={
              <ol className="flex w-full items-center gap-2 border-t border-gray-100 pt-4 text-theme-xs text-gray-500">
                {["Paket seç", "Soruları çöz", "Haritanı gör"].map((t, i) => (
                  <li key={t} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.625rem] font-bold text-brand-500">
                      {i + 1}
                    </span>
                    <span className="truncate">{t}</span>
                  </li>
                ))}
              </ol>
            }
          />
        );
      }
      return (
        <Kabuk
          ikon={<ClipboardList aria-hidden />}
          ust="Bugün · sıradaki test"
          baslik={o.name}
          metin={`${o.questionCount} soru · ${o.durationMinutes} dk · ${o.topicCount} konu`}
          eylem={
            <ButtonLink href={`/paketler/${o.slug}`} block endIcon={ileri}>
              Teste göz at
            </ButtonLink>
          }
          alt={hizli ? <HizliSatiri h={hizli} /> : undefined}
        />
      );
    }

    case "YOK":
      // İş kalmadı: boş bir "tamam" yerine en zayıf ölçülmüş konudan kısa bir alıştırma.
      if (hizli) {
        return (
          <Kabuk
            ikon={<CircleCheck aria-hidden />}
            ust="Bugün · işlerin tamam"
            baslik={`Hızlı ${KONU_CALISMA_SORU} soru: ${hizli.topicName}`}
            metin={`Planın da tekrarın da tamam. Vaktin varsa en zayıf konun (%${Math.round(hizli.oran * 100)}): süre yok, her cevaptan sonra çözümünü görürsün.`}
            eylem={
              <div className="flex flex-col gap-2">
                <KonuBesSoruButonu
                  block
                  sessionId={hizli.sessionId}
                  topicId={hizli.topicId}
                  topicName={hizli.topicName}
                  etiket={`Hızlı ${KONU_CALISMA_SORU} soru`}
                />
                <ButtonLink href="/gelisim" variant="outline" block startIcon={<ChartLine />}>
                  Gelişimine bak
                </ButtonLink>
              </div>
            }
          />
        );
      }
      return (
        <Kabuk
          ikon={<CircleCheck aria-hidden />}
          ust="Bugün"
          baslik="Bugünlük işin kalmadı"
          metin="Planın da tekrarın da tamam. Nerede ilerlediğine bir bak."
          eylem={
            <ButtonLink href="/gelisim" variant="outline" block startIcon={<ChartLine />}>
              Gelişimine bak
            </ButtonLink>
          }
        />
      );
  }
}
