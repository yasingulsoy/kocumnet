import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Download } from "lucide-react";
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
import {
  Card,
  EmptyState,
  FilterTabs,
  PageHeader,
  Pagination,
  Pill,
  QUESTION_STATUS_TONE,
  SELECT_CLASS,
  SortHeader,
  buttonClass,
  qs,
  type Tone,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Madde analizi" };

const BASE = "/checkup/sorular/analiz";
const SAYFA_BOYU = 50;
/** Tek seferde önerilen zorluğu uygulanabilecek en fazla soru. */
const TOPLU_ZORLUK_SINIR = 300;

const BULGU_TON: Record<string, Tone> = { bad: "bad", warn: "warn", info: "info" };

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

  const kapsamYazisi = [s.sinav ? examLabel(s.sinav) + " testleri" : null, s.gun ? donemAdi(s.gun).toLocaleLowerCase("tr-TR") : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/sorular", label: "Sorular" },
        ]}
        title="Madde analizi"
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
            <a href={csvAdresi} className={buttonClass("outline", "md")} download>
              <Download aria-hidden /> CSV indir
            </a>
          ) : null
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-2 sm:px-5">
          <FilterTabs
            label="Bulgu süzgeci"
            items={[
              { href: adres({ bulgu: undefined, sayfa: undefined }), label: "Tümü", active: !s.bulgu, count: kapsam.length },
              {
                href: adres({ bulgu: "hepsi", sayfa: undefined }),
                label: "Bulgulu",
                active: s.sadeceBulgulu,
                count: bulgulu,
                tone: "warn",
              },
              ...BULGU_SIRASI.map((k) => ({
                href: adres({ bulgu: k, sayfa: undefined }),
                label: BULGU_META[k].baslik,
                active: s.bulguKey === k,
                count: kapsam.filter((x) => x.bulgular.some((b) => b.key === k)).length,
                tone: BULGU_TON[BULGU_META[k].ton],
              })),
            ]}
          />
        </div>

        {/* Süzgeçler — GET formu: seçim adreste kalır. */}
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-line p-5 sm:px-6">
          {s.bulgu ? <input type="hidden" name="bulgu" value={s.bulgu} /> : null}
          {s.sirala !== "oncelik" ? <input type="hidden" name="sirala" value={s.sirala} /> : null}
          {s.sirala !== "oncelik" ? <input type="hidden" name="yon" value={s.yon} /> : null}
          <label className="min-w-0 flex-1 basis-60">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">Konu</span>
            <select name="konu" defaultValue={s.konu} className={SELECT_CLASS}>
              <option value="">Tümü</option>
              {topics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {examLabel(t.examScope)} · {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 basis-40" title="Cevabın geldiği testin sınavı">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">Sınav</span>
            <select name="sinav" defaultValue={s.sinav} className={SELECT_CLASS}>
              <option value="">Hepsi</option>
              {EXAM_SCOPES.map((e) => (
                <option key={e} value={e}>
                  {examLabel(e)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 basis-40" title="Testin bitiş tarihi">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">Dönem</span>
            <select name="donem" defaultValue={s.gun ? String(s.gun) : ""} className={SELECT_CLASS}>
              <option value="">Tüm zamanlar</option>
              {DONEM_SECENEK.map((d) => (
                <option key={d.gun} value={d.gun}>
                  {d.ad}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 basis-36">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">En az cevap</span>
            <select name="min" defaultValue={String(s.minN)} className={SELECT_CLASS}>
              {MIN_SECENEK.map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "Hepsi" : m + " cevap"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("outline", "md")}>
              Süz
            </button>
            {s.konu || s.minN > 1 || s.bulgu || s.sinav || s.gun ? (
              <Link href={BASE} className={buttonClass("ghost", "md")}>
                Temizle
              </Link>
            ) : null}
          </div>
        </form>

        {yazabilir && zorlukDegisimleri.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunk px-5 py-3 sm:px-6">
            <p className="min-w-0 flex-1 basis-72 text-caption text-ink-soft">
              <span className="font-semibold text-ink">{zorlukDegisimleri.length} sorunun</span> zorluk etiketi
              gözlenenden en az iki kademe farklı. Seçim kolay/orta/zor bantlarını bu etikete göre dolduruyor.
            </p>
            <ApplyDifficultyButton degisimler={zorlukDegisimleri} sinav={s.sinav} gun={s.gun} />
          </div>
        ) : null}

        {liste.length === 0 ? (
          <EmptyState
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
          <div className="scroll-x">
            <table className="data-table min-w-[60rem]">
              <caption className="sr-only">Soruların madde analizi. Sütun başlıklarıyla sıralanabilir.</caption>
              <thead>
                <tr>
                  <SortHeader label="Soru" href={siralaAdresi("oncelik")} active={s.sirala === "oncelik"} dir={s.yon} title="Önce en ciddi bulgusu olanlar" />
                  <SortHeader label="Cevap" href={siralaAdresi("n")} active={s.sirala === "n"} dir={s.yon} align="end" />
                  <SortHeader label="Doğru" href={siralaAdresi("p")} active={s.sirala === "p"} dir={s.yon} align="end" />
                  <SortHeader label="Ayırt ed." href={siralaAdresi("r")} active={s.sirala === "r"} dir={s.yon} align="end" title="Madde-kalan korelasyonu" />
                  <SortHeader label="Boş" href={siralaAdresi("bos")} active={s.sirala === "bos"} dir={s.yon} align="end" />
                  <SortHeader label="Süre" href={siralaAdresi("sure")} active={s.sirala === "sure"} dir={s.yon} align="end" title="Medyan süre / hedef süre" />
                  <th scope="col" className="text-end" title="Etiketlenen → gözlenen">
                    Zorluk
                  </th>
                  <th scope="col">Bulgular</th>
                </tr>
              </thead>
              <tbody>
                {sayfadakiler.map((x) => (
                  <Satir key={x.questionId} x={x} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={gecerliSayfa} pages={sonSayfa} href={(p) => adres({ sayfa: p > 1 ? p : undefined })} />

      <details className="mt-6 rounded-2xl border border-line bg-surface p-5 text-caption text-ink-soft shadow-card sm:px-6">
        <summary className="cursor-pointer select-none font-display text-body font-semibold text-ink">
          Nasıl okunur?
        </summary>
        <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Doğru oranı</dt>
            <dd>Soruyu doğru yapanların oranı; boş bırakan doğru yapmamış sayılır.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Ayırt edicilik</dt>
            <dd>
              Soruyu doğru yapmakla testin geri kalanındaki başarı arasındaki korelasyon.{" "}
              {rYaz(ESIK.iyiR)} ve üstü iyi, {rYaz(ESIK.zayifR)} altı zayıf, negatif ters. En az{" "}
              {ESIK.gosterR} cevapta gösterilir.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Hangi cevaplar</dt>
            <dd>
              Yalnızca tamamlanmış testler ve sorunun şu anki sürümü — anahtar değişince sayım sıfırlanır. Sınav
              süzgeci cevabın geldiği testin sınavına, dönem süzgeci testin bitiş tarihine bakar.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Bulgular</dt>
            <dd>
              En az {ESIK.minN} cevapta (ayırt edicilik bulguları {ESIK.minNR}) üretilir. Eşikler araç
              içindir; içerik ekibi isterse değiştirilir (lib/checkup/item-flags.ts).
            </dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
          {BULGU_SIRASI.map((k) => (
            <li key={k} className="flex flex-wrap items-baseline gap-2">
              <Pill tone={BULGU_TON[BULGU_META[k].ton]}>{BULGU_META[k].baslik}</Pill>
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

  return (
    <tr className={clsx(!yeterli && "text-ink-faint")}>
      <td className="min-w-72 max-w-[28rem]">
        <Link
          href={"/checkup/sorular/" + x.questionId + "#analiz"}
          className="line-clamp-2 font-medium text-ink hover:text-brand"
        >
          {x.stemText || "(metinsiz soru)"}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-faint">
          <span>
            {examLabel(x.examScope)} · {x.topicName}
          </span>
          {x.status !== "PUBLISHED" ? (
            <Pill tone={QUESTION_STATUS_TONE[x.status]}>{QUESTION_STATUS_LABEL[x.status]}</Pill>
          ) : null}
          {x.version > 1 ? <span>v{x.version}</span> : null}
        </p>
      </td>
      <td className="text-end tabular text-ink">{x.n}</td>
      <td className={clsx("text-end tabular", yeterli && x.p < ESIK.zorP ? "font-semibold text-bad" : "text-ink")}>
        {percent(x.p)}
      </td>
      <td className="whitespace-nowrap text-end tabular">
        {r === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span
            className={clsx(
              ae.ton === "bad" ? "font-semibold text-bad" : ae.ton === "warn" ? "text-warn" : ae.ton === "ok" ? "text-ok" : "text-ink"
            )}
            title={"Ayırt edicilik: " + ae.etiket}
          >
            {rYaz(r)}
          </span>
        )}
      </td>
      <td className={clsx("text-end tabular", yeterli && bosOran >= ESIK.bos ? "text-warn" : "text-ink-soft")}>
        {percent(bosOran)}
      </td>
      <td
        className={clsx(
          "whitespace-nowrap text-end tabular",
          sureOran !== null && sureOran > ESIK.yavas ? "text-warn" : "text-ink-soft"
        )}
        title={"Hedef " + x.targetTimeSeconds + " sn"}
      >
        {x.medianMs === null ? "—" : secondsLabel(x.medianMs)}
      </td>
      <td className="whitespace-nowrap text-end tabular text-ink-soft">
        {x.difficulty}
        {yeterli && oneri !== x.difficulty ? (
          <span className={clsx(Math.abs(oneri - x.difficulty) >= ESIK.zorlukFarki ? "text-warn" : "text-ink-faint")}>
            {" → "}
            {oneri}
          </span>
        ) : null}
      </td>
      <td className="min-w-48">
        {x.bulgular.length === 0 ? (
          <span className="text-micro text-ink-faint">{yeterli ? "—" : "az veri"}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {gosterilen.map((b) => (
              <Pill key={b.key} tone={BULGU_TON[b.ton]}>
                <span title={b.aciklama}>{b.baslik}</span>
              </Pill>
            ))}
            {x.bulgular.length > gosterilen.length ? <Pill>+{x.bulgular.length - gosterilen.length}</Pill> : null}
          </div>
        )}
      </td>
    </tr>
  );
}
