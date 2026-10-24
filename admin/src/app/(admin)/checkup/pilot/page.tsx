import type { Metadata } from "next";
import { Download } from "lucide-react";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { loadPilot, pilotGruplari } from "@/lib/checkup/pilot";
import {
  ALGI_ETIKETI,
  ANLAMLI_ARTIS_PUAN,
  HUNI_ADIMLARI,
  ZORLUK_EN_AZ_CEVAP,
  pilotParametreleri,
  pilotSuzgeci,
  puanMetni,
  sayiMetni,
  type KazancGrubu,
} from "@/lib/checkup/pilot-kurallari";
import { kazancMetni } from "@/lib/checkup/pilot-rapor";
import {
  ALGI_TANIMLARI,
  EK_GOSTERGE_ADI,
  EK_GOSTERGE_TANIMLARI,
  HUNI_ADI,
  HUNI_TANIMLARI,
  KAPSAM_TANIMLARI,
  KAYNAK_TANIMLARI,
  KAZANC_TANIMLARI,
  OZELLIK_ADI,
  OZELLIK_TANIMLARI,
  TEST_ADI,
  TEST_TANIMLARI,
} from "@/lib/checkup/pilot-tanimlar";
import { trDate } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PilotBolum, PilotOran, PilotSayi, PilotTanimlar } from "@/components/checkup/PilotParcalari";
import { qs } from "@/components/checkup/ui";
import { DateInput } from "@/components/tailadmin/form/DateInput";
import { Field } from "@/components/tailadmin/form/Field";
import { Select } from "@/components/tailadmin/form/Select";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink, buttonClass } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Pilot ölçümü" };

const BASE = "/checkup/pilot";

/**
 * Pilot ölçümü: "5 haftalık pilot işe yaradı mı?" sorusunun toplu sayıları.
 * Kişi yok, küçük sayılar "<5". Sayılar öğrenci verisinden türediği için
 * yalnızca yönetici ve müdür (sayfa ve rapor sunucuda denetler). Hesaplar
 * lib/checkup/pilot-kurallari.ts, tanımlar pilot-tanimlar.ts, sorgular pilot.ts.
 */
export default async function PilotPage({ searchParams }: PageProps<"/checkup/pilot">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const now = new Date();
  const istenen = pilotSuzgeci(await searchParams, now);
  const [v, gruplar] = await Promise.all([loadPilot(istenen), pilotGruplari()]);
  const s = v.suzgec;

  const raporAdresi = qs(BASE + "/rapor.md", pilotParametreleri(s));
  const basYazi = trDate(new Date(s.basAn.getTime() + 12 * 3600_000));
  const bitYazi = trDate(new Date(s.bitisAn.getTime() - 12 * 3600_000));
  const suruyor = s.gozlemSonu.getTime() < s.bitisAn.getTime();

  const t = v.testler;
  const yarimToplam = v.birakma.ceyrekler.reduce((a, b) => a + b, 0);
  const k = v.kazanc;
  const o = v.ozellik;

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Pilot ölçümü"
        description="Pilot işe yaradı mı: yalnızca toplu sayılar. Kişisel veri yok; yalnızca yönetici ve müdür görür."
        actions={
          // Bağlantı: dosyayı tarayıcı indirir; ekrandaki süzgeçlerin aynısı.
          <a href={raporAdresi} className={buttonClass({ variant: "outline", size: "xs" })} download>
            <Download aria-hidden /> Pilot sonu raporu (.md)
          </a>
        }
      />

      <Card className="mb-6">
        {/* Süzgeçler — GET formu: seçim adreste kalır, rapor bağlantısı da aynı seçimi taşır. */}
        <form method="get" className="flex flex-wrap items-end gap-3 p-4 sm:px-6 sm:py-5">
          <Field label="Grup" className="min-w-0 grow basis-60">
            <Select name="grup" defaultValue={s.grupId ?? "hepsi"} compact>
              <option value="hepsi">Hepsi (bütün öğrenciler)</option>
              {gruplar.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.arsiv ? " (arşivde)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç" className="min-w-0 grow basis-40">
            <DateInput name="bas" defaultValue={s.bas} compact />
          </Field>
          <Field label="Bitiş" className="min-w-0 grow basis-40">
            <DateInput name="bit" defaultValue={s.bit} compact />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="xs">
              Göster
            </Button>
            {s.grupId || !s.varsayilan ? (
              <ButtonLink href={BASE} variant="ghost" size="xs">
                Son 35 gün, hepsi
              </ButtonLink>
            ) : null}
          </div>
        </form>
        <p className="border-t border-gray-100 px-4 py-3 text-theme-sm text-gray-600 sm:px-6">
          <span className="font-medium text-gray-800">{v.grupAdi ? "Grup: " + v.grupAdi : "Bütün öğrenciler"}</span> ·{" "}
          {basYazi} – {bitYazi}
          {suruyor ? " (şu ana kadar)" : ""}
          {istenen.grupId && !s.grupId ? " · Seçilen grup bulunamadı, bütün öğrenciler gösteriliyor." : ""}
        </p>
        <PilotTanimlar tanimlar={KAPSAM_TANIMLARI} baslik="Okuma kuralları" />
      </Card>

      <nav aria-label="Bölümler" className="mb-6 flex flex-wrap gap-2 text-theme-sm">
        {[
          ["huni", "1. Huni"],
          ["testler", "2. Testler"],
          ["kullanim", "3. Özellik kullanımı"],
          ["kazanc", "4. Öğrenme kazancı"],
          ["algi", "5. Zorluk algısı"],
          ["kaynak", "6. Kayıt kaynağı"],
        ].map(([id, ad]) => (
          <a key={id} href={"#" + id} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-brand-300 hover:text-brand-600">
            {ad}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {/* ── 1. Huni ─────────────────────────────────────────── */}
        <PilotBolum
          id="huni"
          baslik="1. Huni"
          aciklama="Dönemde kayıt olanlar nereye kadar geldi."
          taban={<>Kayıt grubu: {sayiMetni(v.huni[0].sayi)} öğrenci</>}
          tanimlar={HUNI_TANIMLARI}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Adım</TableCell>
                <TableCell isHeader align="end">
                  Öğrenci
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Önceki adıma göre
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Kayda göre
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Henüz erken
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HUNI_ADIMLARI.map((anahtar, i) => {
                const a = v.huni[i];
                return (
                  <TableRow key={anahtar}>
                    <TableCell className="font-medium text-gray-800">{HUNI_ADI[anahtar]}</TableCell>
                    <TableCell align="end">
                      <PilotSayi n={a.sayi} className="font-medium text-gray-800" />
                    </TableCell>
                    <TableCell align="end" nowrap>
                      {i === 0 ? (
                        ""
                      ) : (
                        <>
                          <PilotOran pay={a.sayi} payda={a.taban} cubuk />
                          <span className="ms-1 text-theme-xs text-gray-500">({sayiMetni(a.taban)} kişiden)</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell align="end">{i === 0 ? "" : <PilotOran pay={a.sayi} payda={a.kayitTabani} />}</TableCell>
                    <TableCell align="end" className="text-gray-500">
                      {a.erken > 0 ? <PilotSayi n={a.erken} /> : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </PilotBolum>

        {/* ── 2. Testler ──────────────────────────────────────── */}
        <PilotBolum
          id="testler"
          baslik="2. Testler"
          aciklama="Dönemde başlatılan testler nasıl kapandı; yarım kalanlar nerede bırakıldı."
          taban={
            <>
              {sayiMetni(v.testOgrenci)} öğrenci · {sayiMetni(t.baslayan)} test
            </>
          }
          tanimlar={TEST_TANIMLARI}
        >
          <div className="grid gap-0 xl:grid-cols-[3fr_2fr] xl:divide-x xl:divide-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Durum</TableCell>
                  <TableCell isHeader align="end">
                    Test
                  </TableCell>
                  <TableCell isHeader align="end" nowrap>
                    Başlayana göre
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["baslayan", false],
                    ["ogrenciBitirdi", true],
                    ["suresiDoldu", true],
                    ["yenidenBaslatildi", true],
                    ["suruyor", true],
                    ["birakildi", true],
                    ["isaretsiz", false],
                    ["yarimKaldi", false],
                    ["olcumSayilan", false],
                  ] as const
                ).map(([anahtar, kapanis]) => (
                  <TableRow key={anahtar}>
                    <TableCell className={anahtar === "baslayan" || anahtar === "olcumSayilan" ? "font-medium text-gray-800" : ""}>
                      {kapanis ? <span className="me-1 text-gray-400">↳</span> : null}
                      {TEST_ADI[anahtar]}
                    </TableCell>
                    <TableCell align="end">
                      <PilotSayi n={t[anahtar]} />
                    </TableCell>
                    <TableCell align="end">{anahtar === "baslayan" ? "" : <PilotOran pay={t[anahtar]} payda={t.baslayan} cubuk />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table>
              <caption className="px-5 pt-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6">
                Yarım testte bırakılan yer · {sayiMetni(yarimToplam)} test
              </caption>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Testin</TableCell>
                  <TableCell isHeader align="end">
                    Yarım test
                  </TableCell>
                  <TableCell isHeader align="end">
                    Oran
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["İlk çeyreği", "İkinci çeyreği", "Üçüncü çeyreği", "Son çeyreği"].map((ad, i) => (
                  <TableRow key={ad}>
                    <TableCell>{ad}</TableCell>
                    <TableCell align="end">
                      <PilotSayi n={v.birakma.ceyrekler[i]} />
                    </TableCell>
                    <TableCell align="end">
                      <PilotOran pay={v.birakma.ceyrekler[i]} payda={yarimToplam} cubuk />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PilotBolum>

        {/* ── 3. Özellik kullanımı ────────────────────────────── */}
        <PilotBolum
          id="kullanim"
          baslik="3. Özellik kullanımı"
          aciklama="Dönemde hangi özelliği kaç öğrenci en az bir kez kullandı."
          taban={<>Etkin: {sayiMetni(o.etkin)} öğrenci</>}
          tanimlar={OZELLIK_TANIMLARI}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Özellik</TableCell>
                <TableCell isHeader align="end" nowrap>
                  Kullanan öğrenci
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Etkin öğrenciye göre
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.satirlar.map((r) => (
                <TableRow key={r.anahtar}>
                  <TableCell className={r.anahtar.startsWith("alistirma") && r.anahtar !== "alistirma" ? "ps-10" : ""}>
                    {OZELLIK_ADI[r.anahtar]}
                  </TableCell>
                  <TableCell align="end">
                    <PilotSayi n={r.sayi} />
                  </TableCell>
                  <TableCell align="end">
                    <PilotOran pay={r.sayi} payda={o.etkin} cubuk />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Ödevi olan → en az birini tamamlayan</TableCell>
                <TableCell align="end" nowrap>
                  <PilotSayi n={o.odev.odevli} /> → <PilotSayi n={o.odev.tamamlayan} />
                </TableCell>
                <TableCell align="end" nowrap>
                  <PilotOran pay={o.odev.tamamlayan} payda={o.odev.odevli} cubuk />
                  <span className="ms-1 text-theme-xs text-gray-500">ödevi olana göre</span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="ps-10">Öğrenci × ödev: tamamlanan</TableCell>
                <TableCell align="end" nowrap>
                  <PilotSayi n={o.odev.tamamlanan} /> / <PilotSayi n={o.odev.atama} />
                </TableCell>
                <TableCell align="end">
                  <PilotOran pay={o.odev.tamamlanan} payda={o.odev.atama} cubuk />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </PilotBolum>

        {/* ── 4. Öğrenme kazancı ──────────────────────────────── */}
        <PilotBolum
          id="kazanc"
          baslik="4. Öğrenme kazancı"
          aciklama="Aynı öğrencinin aynı konudaki ilk ve son ölçümü: planına giren konular, girmeyenlerden daha çok mu yükseldi?"
          taban={<>Eşleşen: {sayiMetni(k.hepsi.ogrenci)} öğrenci</>}
          tanimlar={KAZANC_TANIMLARI}
        >
          <div className="px-5 pt-4 sm:px-6">
            <Alert variant="info" title="Asıl kanıt iki grup arasındaki fark">
              Zayıf seçilen konu çalışılmasa da sonraki ölçümde yükselme eğilimindedir (ortalamaya dönüş). &quot;Planına giren
              konular yükseldi&quot; tek başına bir şey kanıtlamaz; planına giren ve girmeyen konuların farkına bakın.
            </Alert>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Konular</TableCell>
                <TableCell isHeader align="end" nowrap>
                  Eşleşen öğrenci
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Ortalama değişim
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  En az {ANLAMLI_ARTIS_PUAN} puan artan
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              <KazancSatiri ad="Planına giren" g={k.planda} vurgu />
              <KazancSatiri ad="Planına girmeyen" g={k.planDisi} vurgu />
              <KazancSatiri ad="Hepsi" g={k.hepsi} />
              <TableRow>
                <TableCell className="font-semibold text-gray-800">Fark (planına giren − girmeyen)</TableCell>
                <TableCell />
                <TableCell align="end" nowrap className="font-semibold text-gray-800">
                  {k.fark === null ? <span className="font-normal text-gray-500">iki grupta da yeterli veri yok</span> : puanMetni(k.fark)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>

          {k.konular.length > 0 ? (
            <Table wrapperClassName="border-t border-gray-100">
              <caption className="px-5 pt-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6">Konu başına</caption>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Konu</TableCell>
                  <TableCell isHeader align="end" nowrap>
                    Eşleşen öğrenci
                  </TableCell>
                  <TableCell isHeader align="end" nowrap>
                    Ortalama değişim
                  </TableCell>
                  <TableCell isHeader align="end" nowrap>
                    Planına giren
                  </TableCell>
                  <TableCell isHeader align="end" nowrap>
                    Planına girmeyen
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {k.konular.map((x) => (
                  <TableRow key={x.topicId}>
                    <TableCell className="font-medium text-gray-800">{x.name}</TableCell>
                    <TableCell align="end">
                      <PilotSayi n={x.hepsi.ogrenci} />
                    </TableCell>
                    <KazancHucresi g={x.hepsi} />
                    <KazancHucresi g={x.planda} />
                    <KazancHucresi g={x.planDisi} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          <Table wrapperClassName="border-t border-gray-100">
            <caption className="px-5 pt-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6">Ek göstergeler</caption>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Gösterge</TableCell>
                <TableCell isHeader align="end">
                  Sayı
                </TableCell>
                <TableCell isHeader align="end">
                  Oran
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Kaç öğrenciden
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              <EkSatir ad={EK_GOSTERGE_ADI.kontrol} pay={v.ek.kontrol.gecen} payda={v.ek.kontrol.olculen} birim="test" ogrenci={v.ek.kontrol.ogrenci} />
              <EkSatir ad={EK_GOSTERGE_ADI.defter} pay={v.ek.defter.cikan} payda={v.ek.defter.toplam} birim="madde" ogrenci={v.ek.defter.ogrenci} />
              <EkSatir ad={EK_GOSTERGE_ADI.ipucuDogru} pay={v.ek.ipucu.ipucuyla} payda={v.ek.ipucu.dogru} birim="doğru" ogrenci={v.ek.ipucu.ogrenci} />
            </TableBody>
          </Table>
          <PilotTanimlar tanimlar={EK_GOSTERGE_TANIMLARI} baslik="Ek göstergelerin tanımı" />
        </PilotBolum>

        {/* ── 5. Zorluk algısı ────────────────────────────────── */}
        <PilotBolum
          id="algi"
          baslik="5. Öğrencinin zorluk algısı"
          aciklama={
            "\"Kolay / uygun / zor\" cevapları ve aynı testlerin gerçek doğru oranı." +
            (v.algi.gizlenen > 0 ? " " + ZORLUK_EN_AZ_CEVAP + "'ten az cevaplı " + sayiMetni(v.algi.gizlenen) + " paket yazılmadı." : "")
          }
          taban={<>{sayiMetni(v.algi.ogrenci)} öğrenci</>}
          tanimlar={ALGI_TANIMLARI}
        >
          {v.algi.paketler.length === 0 ? (
            <p className="px-5 py-6 text-theme-sm text-gray-500 sm:px-6">
              Hiçbir paket en az {ZORLUK_EN_AZ_CEVAP} cevap almadı.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Paket</TableCell>
                  <TableCell isHeader align="end">
                    Cevap
                  </TableCell>
                  {([1, 2, 3] as const).map((a) => (
                    <TableCell key={a} isHeader align="end" nowrap>
                      {ALGI_ETIKETI[a]}
                      <span className="block text-theme-xs font-normal text-gray-500">cevap · doğru oranı</span>
                    </TableCell>
                  ))}
                  <TableCell isHeader align="end" nowrap>
                    Hepsinin doğru oranı
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.algi.paketler.map((p) => (
                  <TableRow key={p.packageId}>
                    <TableCell className="font-medium text-gray-800">{p.ad}</TableCell>
                    <TableCell align="end">
                      <PilotSayi n={p.cevap} />
                    </TableCell>
                    {p.kategoriler.map((c) => (
                      <TableCell key={c.algi} align="end" nowrap>
                        <PilotSayi n={c.cevap} /> ·{" "}
                        {c.cevap >= ZORLUK_EN_AZ_CEVAP ? <PilotOran pay={c.dogru} payda={c.soru} /> : <span className="text-gray-400">—</span>}
                      </TableCell>
                    ))}
                    <TableCell align="end">
                      <PilotOran pay={p.dogru} payda={p.soru} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PilotBolum>

        {/* ── 6. Kayıt kaynağı ────────────────────────────────── */}
        <PilotBolum
          id="kaynak"
          baslik="6. Kayıt kaynağı"
          aciklama="Kayıt olanlar kocum.net'te hangi bağlantıdan geldi, kaçı ilk ölçümünü yaptı."
          taban={<>Kayıt grubu: {sayiMetni(v.huni[0].sayi)} öğrenci</>}
          tanimlar={KAYNAK_TANIMLARI}
        >
          {v.kaynak.length === 0 ? (
            <p className="px-5 py-6 text-theme-sm text-gray-500 sm:px-6">Dönemde kayıt yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Kaynak</TableCell>
                  <TableCell isHeader align="end">
                    Kayıt
                  </TableCell>
                  <TableCell isHeader align="end" nowrap>
                    İlk ölçüm
                  </TableCell>
                  <TableCell isHeader align="end">
                    Oran
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.kaynak.map((r) => (
                  <TableRow key={r.kaynak}>
                    <TableCell className="font-medium text-gray-800">{r.ad}</TableCell>
                    <TableCell align="end">
                      <PilotSayi n={r.kayit} />
                    </TableCell>
                    <TableCell align="end">
                      <PilotSayi n={r.olcum} />
                    </TableCell>
                    <TableCell align="end">
                      <PilotOran pay={r.olcum} payda={r.kayit} cubuk />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PilotBolum>
      </div>
    </>
  );
}

function KazancHucresi({ g }: { g: KazancGrubu }) {
  return (
    <TableCell align="end" nowrap className={g.ortalama === null ? "text-theme-xs text-gray-500" : "tabular font-medium text-gray-800"}>
      {kazancMetni(g)}
    </TableCell>
  );
}

function KazancSatiri({ ad, g, vurgu = false }: { ad: string; g: KazancGrubu; vurgu?: boolean }) {
  return (
    <TableRow>
      <TableCell className={vurgu ? "font-medium text-gray-800" : ""}>{ad}</TableCell>
      <TableCell align="end">
        <PilotSayi n={g.ogrenci} />
      </TableCell>
      <KazancHucresi g={g} />
      <TableCell align="end">{g.yeterli ? <PilotOran pay={g.anlamliArtis} payda={g.eslesme} /> : ""}</TableCell>
    </TableRow>
  );
}

function EkSatir({ ad, pay, payda, birim, ogrenci }: { ad: string; pay: number; payda: number; birim: string; ogrenci: number }) {
  return (
    <TableRow>
      <TableCell>{ad}</TableCell>
      <TableCell align="end" nowrap>
        <PilotSayi n={pay} /> / <PilotSayi n={payda} /> {birim}
      </TableCell>
      <TableCell align="end">
        <PilotOran pay={pay} payda={payda} cubuk />
      </TableCell>
      <TableCell align="end">
        <PilotSayi n={ogrenci} />
      </TableCell>
    </TableRow>
  );
}
