import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, Download } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { loadItemAnalysis, type ItemRow } from "@/lib/checkup/item-analysis";
import {
  BULGU_META,
  BULGU_SIRASI,
  ESIK,
  ayirtEdicilik,
  gorunenR,
  onerilenZorluk,
  rYaz,
} from "@/lib/checkup/item-flags";
import {
  DONEM_SECENEK,
  ILK_YON,
  MIN_SECENEK,
  analizKapsami,
  analizListesi,
  analizParametreleri,
  analizSuzgeci,
  donemAdi,
  type Sutun,
} from "@/lib/checkup/item-list";
import {
  EXAM_SCOPES,
  QUESTION_STATUS_LABEL,
  examLabel,
  percent,
  secondsLabel,
  trNumber,
} from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { ApplyDifficultyButton } from "@/components/checkup/ApplyDifficultyButton";
import { AyirtEdicilikGrafigi, ZorlukGrafigi } from "@/components/checkup/Grafikler";
import { BULGU_COLOR, QUESTION_STATUS_COLOR, SortHeader, qs } from "@/components/checkup/ui";
import { ChartCard } from "@/components/tailadmin/charts/ChartCard";
import { cx } from "@/components/tailadmin/cx";
import { Field } from "@/components/tailadmin/form/Field";
import { Select } from "@/components/tailadmin/form/Select";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink, buttonClass } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Madde analizi" };

const BASE = "/checkup/sorular/analiz";
const SAYFA_BOYU = 50;
/** Tek seferde önerilen zorluğu uygulanabilecek en fazla soru. */
const TOPLU_ZORLUK_SINIR = 300;

/** Ayırt edicilik tonu (item-flags.ts) → grafikteki bant sırası: ters, zayıf, orta, iyi. */
const AYIRT_BANDI = { bad: 0, warn: 1, neutral: 2, ok: 3 } as const;

export default async function ItemAnalysisPage({ searchParams }: PageProps<"/checkup/sorular/analiz">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const s = analizSuzgeci(await searchParams);

  const [satirlar, topics] = await Promise.all([
    loadItemAnalysis({ sinav: s.sinav, gun: s.gun }),
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { slug: true, name: true, examScope: true },
    }),
  ]);

  // Sekme sayıları konu ve en az cevap süzgecinden sonra, bulgu süzgecinden önce.
  const kapsam = analizKapsami(satirlar, s);
  const bulgulu = kapsam.filter((x) => x.bulgular.length > 0).length;
  const liste = analizListesi(satirlar, s);

  const sonSayfa = Math.max(1, Math.ceil(liste.length / SAYFA_BOYU));
  const gecerliSayfa = Math.min(s.sayfa, sonSayfa);
  const sayfadakiler = liste.slice((gecerliSayfa - 1) * SAYFA_BOYU, gecerliSayfa * SAYFA_BOYU);

  const adres = (ek: Parameters<typeof analizParametreleri>[1]) => qs(BASE, analizParametreleri(s, ek));
  const siralaAdresi = (sutun: Sutun) =>
    adres({
      sirala: sutun === "oncelik" ? undefined : sutun,
      yon: sutun === s.sirala ? (s.yon === "asc" ? "desc" : "asc") : ILK_YON[sutun],
      sayfa: undefined,
    });
  const csvAdresi = qs(BASE + "/csv", analizParametreleri(s, { sayfa: undefined }));

  // Önerilen zorluk: listedeki (bütün sayfalar) "zorluk etiketi uymuyor" bulgulu sorular.
  const zorlukDegisimleri = liste
    .filter((x) => x.bulgular.some((b) => b.key === "zorluk"))
    .slice(0, TOPLU_ZORLUK_SINIR)
    .map((x) => ({ id: x.questionId, from: x.difficulty, to: onerilenZorluk(x.p) }));

  // ── Dağılım grafikleri (süzgeçteki sorular, bulgu süzgecinden önce) ──
  // Zorluk: yalnızca bulgu üretecek kadar cevabı olanlar — az cevapta oran yazı-tura.
  const yeterli = kapsam.filter((x) => x.n >= ESIK.minN);
  const zorluklar = [1, 2, 3, 4, 5];
  const etiketlenen = zorluklar.map((z) => yeterli.filter((x) => x.difficulty === z).length);
  const gozlenen = zorluklar.map((z) => yeterli.filter((x) => onerilenZorluk(x.p) === z).length);
  const ayirtBantlari: [number, number, number, number] = [0, 0, 0, 0];
  let ayirtHesaplanmadi = 0;
  for (const x of kapsam) {
    const r = gorunenR(x);
    if (r === null) ayirtHesaplanmadi++;
    else ayirtBantlari[AYIRT_BANDI[ayirtEdicilik(r).ton]]++;
  }

  const kapsamYazisi = [s.sinav ? examLabel(s.sinav) + " testleri" : null, s.gun ? donemAdi(s.gun).toLocaleLowerCase("tr-TR") : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/sorular", label: "Sorular" },
        ]}
        pageTitle="Madde analizi"
        description={
          satirlar.length === 0
            ? "Tamamlanmış testlerdeki gerçek cevaplardan soru kalitesi." + (kapsamYazisi ? " Kapsam: " + kapsamYazisi + "." : "")
            : trNumber(satirlar.length) +
              " soru " +
              (kapsamYazisi ? "bu kapsamda (" + kapsamYazisi + ") " : "en az bir tamamlanmış testte ") +
              "cevaplandı. Hangi soru ayırt etmiyor, hangi çeldirici çalışmıyor, hangi zorluk etiketi yanlış?"
        }
        actions={
          liste.length > 0 ? (
            // Bağlantı: dosyayı tarayıcı indirir. Sayfadaki süzgeç ve sıralamanın aynısı, bütün sayfalar.
            <a href={csvAdresi} className={buttonClass({ variant: "outline", size: "xs" })} download>
              <Download aria-hidden /> CSV indir
            </a>
          ) : null
        }
      />

      {kapsam.length > 0 ? (
        <div className="mb-6 grid gap-4 md:gap-6 xl:grid-cols-2">
          <ChartCard
            title="Zorluk: etiketlenen ve gözlenen"
            description={
              yeterli.length
                ? "En az " + ESIK.minN + " cevaplı " + yeterli.length + " soru. Gözlenen zorluk doğru oranından; sütunlar ayrışıyorsa seçimin kolay/orta/zor bantları kayıyor."
                : "Henüz en az " + ESIK.minN + " cevaplı soru yok; gözlenen zorluk az veride anlamsız."
            }
          >
            {yeterli.length ? (
              <ZorlukGrafigi etiketlenen={etiketlenen} gozlenen={gozlenen} />
            ) : (
              <EmptyState icon={<ChartColumn />} title="Yeterli cevap yok" />
            )}
          </ChartCard>
          <ChartCard
            title="Ayırt edicilik"
            description={
              "Madde-kalan korelasyonu: " +
              rYaz(ESIK.iyiR) +
              " ve üstü iyi, " +
              rYaz(ESIK.zayifR) +
              " altı zayıf, negatif ters." +
              (ayirtHesaplanmadi ? " " + ayirtHesaplanmadi + " soruda henüz hesaplanmadı (" + ESIK.gosterR + " cevaptan az)." : "")
            }
          >
            {kapsam.length > ayirtHesaplanmadi ? (
              <AyirtEdicilikGrafigi sayilar={ayirtBantlari} />
            ) : (
              <EmptyState icon={<ChartColumn />} title="Yeterli cevap yok" />
            )}
          </ChartCard>
        </div>
      ) : null}

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
          <SegmentedTabs
            label="Bulgu süzgeci"
            items={[
              { key: "tumu", href: adres({ bulgu: undefined, sayfa: undefined }), label: "Tümü", active: !s.bulgu, count: kapsam.length },
              {
                key: "hepsi",
                href: adres({ bulgu: "hepsi", sayfa: undefined }),
                label: "Bulgulu",
                active: s.sadeceBulgulu,
                count: bulgulu,
              },
              ...BULGU_SIRASI.map((k) => ({
                key: k,
                href: adres({ bulgu: k, sayfa: undefined }),
                label: BULGU_META[k].baslik,
                active: s.bulguKey === k,
                count: kapsam.filter((x) => x.bulgular.some((b) => b.key === k)).length,
              })),
            ]}
          />
        </div>

        {/* Süzgeçler — GET formu: seçim adreste kalır. */}
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4 sm:px-6 sm:py-5">
          {s.bulgu ? <input type="hidden" name="bulgu" value={s.bulgu} /> : null}
          {s.sirala !== "oncelik" ? <input type="hidden" name="sirala" value={s.sirala} /> : null}
          {s.sirala !== "oncelik" ? <input type="hidden" name="yon" value={s.yon} /> : null}
          <Field label="Konu" className="min-w-0 grow basis-60">
            <Select name="konu" defaultValue={s.konu} compact>
              <option value="">Tümü</option>
              {topics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {examLabel(t.examScope)} · {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sınav" className="min-w-0 grow basis-40">
            <Select name="sinav" defaultValue={s.sinav} compact title="Cevabın geldiği testin sınavı">
              <option value="">Hepsi</option>
              {EXAM_SCOPES.map((e) => (
                <option key={e} value={e}>
                  {examLabel(e)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dönem" className="min-w-0 grow basis-40">
            <Select name="donem" defaultValue={s.gun ? String(s.gun) : ""} compact title="Testin bitiş tarihi">
              <option value="">Tüm zamanlar</option>
              {DONEM_SECENEK.map((d) => (
                <option key={d.gun} value={d.gun}>
                  {d.ad}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="En az cevap" className="min-w-0 grow basis-36">
            <Select name="min" defaultValue={String(s.minN)} compact>
              {MIN_SECENEK.map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "Hepsi" : m + " cevap"}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="xs">
              Süz
            </Button>
            {s.konu || s.minN > 1 || s.bulgu || s.sinav || s.gun ? (
              <ButtonLink href={BASE} variant="ghost" size="xs">
                Temizle
              </ButtonLink>
            ) : null}
          </div>
        </form>

        {yazabilir && zorlukDegisimleri.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
            <p className="min-w-0 flex-1 basis-72 text-theme-sm text-gray-500">
              <span className="font-semibold text-gray-800">{zorlukDegisimleri.length} sorunun</span> zorluk etiketi
              gözlenenden en az iki kademe farklı. Seçim kolay/orta/zor bantlarını bu etikete göre dolduruyor.
            </p>
            <ApplyDifficultyButton degisimler={zorlukDegisimleri} sinav={s.sinav} gun={s.gun} />
          </div>
        ) : null}

        {liste.length === 0 ? (
          <EmptyState
            icon={<ChartColumn />}
            title={satirlar.length === 0 ? "Henüz cevaplanan soru yok" : "Bu süzgeçlere uyan soru yok"}
            description={
              satirlar.length === 0
                ? kapsamYazisi
                  ? "Bu kapsamda tamamlanmış test yok; sınav ya da dönem süzgecini genişlet."
                  : "Öğrenciler test tamamladıkça her sorunun doğru oranı, ayırt ediciliği ve şık dağılımı burada birikir."
                : "Süzgeçleri gevşetmeyi dene."
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Soruların madde analizi. Sütun başlıklarıyla sıralanabilir.</caption>
            <TableHeader>
              <TableRow>
                <SortHeader label="Soru" href={siralaAdresi("oncelik")} active={s.sirala === "oncelik"} dir={s.yon} title="Önce en ciddi bulgusu olanlar" />
                <SortHeader label="Cevap" href={siralaAdresi("n")} active={s.sirala === "n"} dir={s.yon} align="end" />
                <SortHeader label="Doğru" href={siralaAdresi("p")} active={s.sirala === "p"} dir={s.yon} align="end" />
                <SortHeader label="Ayırt ed." href={siralaAdresi("r")} active={s.sirala === "r"} dir={s.yon} align="end" title="Madde-kalan korelasyonu" />
                <SortHeader label="Boş" href={siralaAdresi("bos")} active={s.sirala === "bos"} dir={s.yon} align="end" />
                <SortHeader label="Süre" href={siralaAdresi("sure")} active={s.sirala === "sure"} dir={s.yon} align="end" title="Medyan süre / hedef süre" />
                <TableCell isHeader align="end" title="Etiketlenen → gözlenen">
                  Zorluk
                </TableCell>
                <TableCell isHeader>Bulgular</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sayfadakiler.map((x) => (
                <Satir key={x.questionId} x={x} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pagination currentPage={gecerliSayfa} totalPages={sonSayfa} href={(p) => adres({ sayfa: p > 1 ? p : undefined })} />

      <details className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-theme-sm text-gray-500 sm:px-6">
        <summary className="cursor-pointer font-display text-base font-semibold text-gray-800 select-none">Nasıl okunur?</summary>
        <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-gray-800">Doğru oranı</dt>
            <dd>Soruyu doğru yapanların oranı; boş bırakan doğru yapmamış sayılır.</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-800">Ayırt edicilik</dt>
            <dd>
              Soruyu doğru yapmakla testin geri kalanındaki başarı arasındaki korelasyon.{" "}
              {rYaz(ESIK.iyiR)} ve üstü iyi, {rYaz(ESIK.zayifR)} altı zayıf, negatif ters. En az{" "}
              {ESIK.gosterR} cevapta gösterilir.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-800">Hangi cevaplar</dt>
            <dd>
              Yalnızca tamamlanmış testler ve sorunun şu anki sürümü — anahtar değişince sayım sıfırlanır. Alıştırma
              cevapları sayılmaz. Sınav süzgeci cevabın geldiği testin sınavına, dönem süzgeci testin bitiş tarihine bakar.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-800">Bulgular</dt>
            <dd>
              En az {ESIK.minN} cevapta (ayırt edicilik bulguları {ESIK.minNR}) üretilir. Eşikler araç
              içindir; içerik ekibi isterse değiştirilir (lib/checkup/item-flags.ts).
            </dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
          {BULGU_SIRASI.map((k) => (
            <li key={k} className="flex flex-wrap items-baseline gap-2">
              <Badge size="sm" color={BULGU_COLOR[BULGU_META[k].ton]}>
                {BULGU_META[k].baslik}
              </Badge>
              <span>{BULGU_META[k].kisa}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

function Satir({ x }: { x: ItemRow }) {
  const r = gorunenR(x);
  const ae = ayirtEdicilik(r);
  const bosOran = x.blank / x.n;
  const sureOran = x.medianMs === null ? null : x.medianMs / (x.targetTimeSeconds * 1000);
  const yeterli = x.n >= ESIK.minN;
  const oneri = onerilenZorluk(x.p);
  const gosterilen = x.bulgular.slice(0, 3);

  // Az cevaplı satır soluk: sayılar henüz güvenilmez.
  const ana = yeterli ? "text-gray-800" : "text-gray-500";

  return (
    <TableRow hover>
      <TableCell className="max-w-[28rem] min-w-72">
        <Link
          href={"/checkup/sorular/" + x.questionId + "#analiz"}
          className={cx("line-clamp-2 font-medium hover:text-brand-500", ana)}
        >
          {x.stemText || "(metinsiz soru)"}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500">
          <span>
            {examLabel(x.examScope)} · {x.topicName}
          </span>
          {x.status !== "PUBLISHED" ? (
            <Badge size="sm" color={QUESTION_STATUS_COLOR[x.status]}>
              {QUESTION_STATUS_LABEL[x.status]}
            </Badge>
          ) : null}
          {x.version > 1 ? <span>v{x.version}</span> : null}
        </p>
      </TableCell>
      <TableCell align="end">
        <span className={cx("tabular", ana)}>{x.n}</span>
      </TableCell>
      <TableCell align="end">
        <span className={cx("tabular", yeterli && x.p < ESIK.zorP ? "font-semibold text-error-600" : ana)}>{percent(x.p)}</span>
      </TableCell>
      <TableCell align="end" nowrap className="tabular">
        {r === null ? (
          <span className="text-gray-500">—</span>
        ) : (
          <span
            className={cx(
              ae.ton === "bad"
                ? "font-semibold text-error-600"
                : ae.ton === "warn"
                  ? "text-warning-700"
                  : ae.ton === "ok"
                    ? "text-success-700"
                    : ana
            )}
            title={"Ayırt edicilik: " + ae.etiket}
          >
            {rYaz(r)}
          </span>
        )}
      </TableCell>
      <TableCell align="end">
        <span className={cx("tabular", yeterli && bosOran >= ESIK.bos && "text-warning-700")}>{percent(bosOran)}</span>
      </TableCell>
      <TableCell align="end" nowrap title={"Hedef " + x.targetTimeSeconds + " sn"}>
        <span className={cx("tabular", sureOran !== null && sureOran > ESIK.yavas && "text-warning-700")}>
          {x.medianMs === null ? "—" : secondsLabel(x.medianMs)}
        </span>
      </TableCell>
      <TableCell align="end" nowrap className="tabular">
        {x.difficulty}
        {yeterli && oneri !== x.difficulty ? (
          <span className={cx(Math.abs(oneri - x.difficulty) >= ESIK.zorlukFarki ? "text-warning-700" : "text-gray-500")}>
            {" → "}
            {oneri}
          </span>
        ) : null}
      </TableCell>
      <TableCell className="min-w-48">
        {x.bulgular.length === 0 ? (
          <span className="text-theme-xs text-gray-500">{yeterli ? "—" : "az veri"}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {gosterilen.map((b) => (
              <Badge key={b.key} size="sm" color={BULGU_COLOR[b.ton]} title={b.aciklama}>
                {b.baslik}
              </Badge>
            ))}
            {x.bulgular.length > gosterilen.length ? (
              <Badge size="sm" color="light">
                +{x.bulgular.length - gosterilen.length}
              </Badge>
            ) : null}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
