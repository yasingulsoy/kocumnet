import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL, trDate } from "@/lib/checkup/format";
import { partiGecmisi, type PartiSatiri } from "@/lib/checkup/question-import";
import { ERROR_TYPES, ERROR_TYPE_LABELS } from "@/lib/checkup/shared/error-types";
import { EXAM_SCOPES } from "@/lib/checkup/shared/exams";
import { GateNotice } from "@/components/checkup/GateNotice";
import { ImportHistoryShell, ImportRollbackButton } from "@/components/checkup/ImportHistory";
import { QuestionImport } from "@/components/checkup/QuestionImport";
import { CODE } from "@/components/checkup/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Toplu içe aktar" };

const DURUM_RENGI: Record<string, BadgeColor> = { DONE: "success", FAILED: "error", PENDING: "warning", REVERTED_PARTIAL: "light" };

/**
 * Toplu soru içe aktarma: SORU-SABLONU biçimindeki .md dosyası + görseller.
 * Önce denetlenir (hiçbir şey yazılmaz), sonra geçerli sorular tek partide
 * taslak olarak kaydedilir. Kurallar komut satırı betiğiyle ortak
 * (shared/question-import.ts).
 *
 * Geçmişi herkes görür; içe aktarma ve geri alma yazma rollerine açık.
 */
export default async function ImportPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const partiler = await partiGecmisi();

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/sorular", label: "Sorular" },
        ]}
        pageTitle={yazabilir ? "Toplu içe aktar" : "İçe aktarma geçmişi"}
        description={
          yazabilir
            ? "Soru dosyasını ve görsellerini yükle: önce denetlenir, sonra geçerli sorular taslak olarak kaydedilir."
            : "Toplu içe aktarmalar ve sonuçları."
        }
      />

      {yazabilir ? (
        <QuestionImport />
      ) : (
        <Alert variant="info">
          Rolün içe aktarma yapmaya yetmiyor; geçmişi görebilirsin. İçe aktarma ve geri alma yönetici, müdür ve
          editöre açık.
        </Alert>
      )}

      <ComponentCard
        className="mt-6"
        title="İçe aktarma geçmişi"
        desc="Son 50 içe aktarma — panelden ve komut satırından yapılanlar birlikte."
        flush
      >
        <ImportHistoryShell>
          {partiler.length === 0 ? (
            <EmptyState
              icon={<History />}
              title="Henüz içe aktarma yok"
              description="İlk dosyayı yukarıdan denetleyip kaydettiğinde burada görünür."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>İçe aktarma</TableCell>
                  <TableCell isHeader>Durum</TableCell>
                  <TableCell isHeader>Sorular</TableCell>
                  <TableCell isHeader>Şu an havuzda</TableCell>
                  <TableCell isHeader align="end">
                    <span className="sr-only">İşlemler</span>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partiler.map((p) => (
                  <PartiSatir key={p.id} p={p} yazabilir={yazabilir} />
                ))}
              </TableBody>
            </Table>
          )}
        </ImportHistoryShell>
      </ComponentCard>

      <BicimHatirlatmasi />
    </>
  );
}

function PartiSatir({ p, yazabilir }: { p: PartiSatiri; yazabilir: boolean }) {
  const silinecek = p.kalan - p.korunacak;
  // Teste girmiş sorular hiç silinmez; hepsi öyleyse geri alacak bir şey yok.
  const geriAlinabilir = yazabilir && !p.suruyor && (silinecek > 0 || p.kalan === 0);
  const durumlar = Object.entries(p.durumlar)
    .sort(([, a], [, b]) => b - a)
    .map(([d, n]) => n + " " + (QUESTION_STATUS_LABEL[d] ?? d).toLocaleLowerCase("tr-TR"));
  const kim = p.kim?.replace(/\s*\(#\d+\)$/, "") ?? "—";

  return (
    <TableRow className="align-top">
      <TableCell className="min-w-56">
        <p className="font-medium text-gray-800">{p.dosyaAdi}</p>
        <p className="mt-0.5 text-theme-xs text-gray-500" title={p.kim ?? undefined}>
          {trDate(p.tarih, { time: true })} · {kim}
        </p>
        {p.hataMesaji ? <p className="mt-0.5 max-w-80 text-theme-xs text-error-600">{p.hataMesaji}</p> : null}
        {p.atlananlar.length ? (
          <details className="mt-1 text-theme-xs">
            <summary className="cursor-pointer font-medium text-gray-600 select-none hover:text-gray-800">
              Atlanan {p.atlananlar.length} soru
            </summary>
            <ul className="mt-1.5 max-w-md space-y-1">
              {p.atlananlar.map((a, i) => (
                <li key={i}>
                  <span className="font-medium text-gray-700">
                    satır {a.satir}
                    {a.etiket ? " · " + a.etiket : ""}
                  </span>
                  : {a.sebep}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge size="sm" color={DURUM_RENGI[p.durum] ?? "light"}>
          {p.durumEtiketi}
        </Badge>
      </TableCell>
      <TableCell nowrap>
        <span className="tabular text-gray-800">{p.alinan}</span> alındı
        {p.atlanan ? (
          <>
            {" · "}
            <span className="tabular text-error-600">{p.atlanan}</span> atlandı
          </>
        ) : null}
        <span className="block text-theme-xs">dosyada {p.toplam} soru</span>
      </TableCell>
      <TableCell className="min-w-40">
        {p.kalan ? (
          <>
            <span className="tabular text-gray-800">{p.kalan}</span> soru
            <span className="block text-theme-xs">{durumlar.join(" · ")}</span>
            {p.korunacak ? (
              <span className="block text-theme-xs text-warning-700">{p.korunacak} tanesi öğrencilere soruldu (geri almada kalır)</span>
            ) : null}
          </>
        ) : (
          <span>soru yok</span>
        )}
      </TableCell>
      <TableCell align="end" nowrap>
        <div className="flex justify-end gap-2">
          {p.kalan ? (
            <ButtonLink href={"/checkup/sorular?parti=" + encodeURIComponent(p.id)} variant="outline" size="xs">
              Soruları aç
            </ButtonLink>
          ) : null}
          {geriAlinabilir ? (
            <ImportRollbackButton partiId={p.id} dosyaAdi={p.dosyaAdi} silinecek={silinecek} korunacak={p.korunacak} />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Kısa biçim hatırlatması — ayrıntı SORU-SABLONU.md'de (içerik ekibinin elinde). */
function BicimHatirlatmasi() {
  return (
    <details className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-theme-sm text-gray-500 sm:px-6">
      <summary className="cursor-pointer font-display text-base font-semibold text-gray-800 select-none">
        Dosya biçimi (kısa hatırlatma)
      </summary>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p>
            Her soru <code className={CODE}>### Soru 01</code> başlığıyla başlar, alanlar{" "}
            <code className={CODE}>* **Alan:** değer</code> biçimindedir. Tam kurallar SORU-SABLONU.md (v3) belgesinde.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-gray-50 p-3 font-mono text-theme-xs leading-relaxed text-gray-800">
            {[
              "### Soru 01",
              "* **ID:** MAT-01-TK-01",
              "* **Konu Kodu:** temel-kavramlar",
              "* **Zorluk:** 2",
              "* **Seviye:** 1",
              "* **Kazanım Kodu:** TK-03",
              "* **Kazanım Adı:** (yalnızca ilk kullanımda)",
              "* **İdeal Süre:** 60",
              "* **Soru Metni:**",
              "![ABC üçgeni](sekil-01.png)",
              "$a$ ve $b$ pozitif tam sayılardır…",
              "* **Seçenekler:**",
              "  * [ ] A) 21 (EKSIK_OKUMA: açıklama)",
              "  * [x] B) 18",
              "  * [ ] C) 15 (ISLEM_HATASI: açıklama)",
              "  * [ ] D) 19 (KAVRAM_YANILGISI: açıklama)",
              "  * [ ] E) 16 (EKSIK_OKUMA: açıklama)",
              "* **Doğru Şık:** B",
              "* **Çözüm Açıklaması:**",
              "$b$ en küçük olmalı…",
            ].join("\n")}
          </pre>
        </div>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            Konu kodları{" "}
            <Link href="/checkup/havuz" className="font-medium text-brand-500 hover:text-brand-600">
              Havuz durumu
            </Link>{" "}
            ekranında, kazanım kodları{" "}
            <Link href="/checkup/kazanimlar" className="font-medium text-brand-500 hover:text-brand-600">
              Kazanımlar
            </Link>{" "}
            ekranında. Konu ağaçta yoksa soru reddedilir.
          </li>
          <li>
            Seviye <code className={CODE}>1</code>, <code className={CODE}>2</code> ya da <code className={CODE}>3</code>.
            Seviye 1&apos;de Kazanım Kodu zorunlu, 2-3&apos;te yazılmaz. Yeni kazanımın adı ilk kullanımda yazılır.
          </li>
          <li>
            Doğru şık iki yerde: <code className={CODE}>[x]</code> ve <code className={CODE}>Doğru Şık</code> satırı;
            çelişirse soru reddedilir. Şık değerleri birbirinden farklı olmalı.
          </li>
          <li>
            Her yanlış şıkta hata kodu:{" "}
            {ERROR_TYPES.map((k) => (
              <span key={k} title={ERROR_TYPE_LABELS[k]}>
                <code className={CODE}>{k}</code>{" "}
              </span>
            ))}
          </li>
          <li>
            Hedef Sınav isteğe bağlı (boş = konunun her sınavı):{" "}
            {EXAM_SCOPES.map((s) => (
              <span key={s}>
                <code className={CODE}>{s}</code>{" "}
              </span>
            ))}
          </li>
          <li>
            Görseller PNG, JPG ya da WebP; yalnızca Soru Metni&apos;nde ve alternatif metinle:{" "}
            <code className={CODE}>![ne gösteriyor](dosya.png)</code>. Dosyayı .md ile birlikte seç; 1200 piksele
            küçültülüp WebP olarak kaydedilir.
          </li>
          <li>
            Aynı metin havuzda varsa (farklı ID ile bile) ya da aynı ID daha önce içe aktarıldıysa soru reddedilir.
          </li>
        </ul>
      </div>
    </details>
  );
}
