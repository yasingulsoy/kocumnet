/**
 * Pilot sonu raporu (Markdown) — ekrandaki toplu sayıların hepsi, tanımları ve
 * kaç kişiden hesaplandığı. Saf modül: veri pilot.ts'ten (loadPilot) gelir,
 * route handler (checkup/pilot/rapor.md) yalnızca yetkiyi denetleyip bunu
 * döndürür.
 *
 * Küçük sayı kuralı ekranla aynı fonksiyondan (pilot-kurallari.ts sayiMetni,
 * oranMetni). Raporda ad, e-posta ya da kimlik yok: veri zaten içermiyor.
 */

import { trDate } from "./format";
import type { PilotVerisi } from "./pilot";
import {
  ALGI_ETIKETI,
  ANLAMLI_ARTIS_PUAN,
  HUNI_ADIMLARI,
  ZORLUK_EN_AZ_CEVAP,
  oranMetni,
  pilotParametreleri,
  puanMetni,
  sayiMetni,
  veriYetersizMetni,
  type KazancGrubu,
} from "./pilot-kurallari";
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
  type Tanim,
} from "./pilot-tanimlar";

export const RAPOR_NOTU = "Toplu sayılardır; kişisel veri içermez.";

/** Tablo hücresi: dikey çizgi tabloyu bozmasın (konu ve paket adları serbest metin). */
function hucre(x: string): string {
  return x.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function tablo(baslik: string[], satirlar: string[][]): string {
  return [
    "| " + baslik.map(hucre).join(" | ") + " |",
    "| " + baslik.map((_, i) => (i === 0 ? "---" : "---:")).join(" | ") + " |",
    ...satirlar.map((s) => "| " + s.map(hucre).join(" | ") + " |"),
  ].join("\n");
}

function tanimlar(l: readonly Tanim[]): string {
  return l.map((t) => "- **" + t.ad + ":** " + t.metin).join("\n");
}

/** Kazanç grubu tek hücrede: ortalama ya da "veri yetersiz". */
export function kazancMetni(g: KazancGrubu): string {
  return g.ortalama === null ? veriYetersizMetni(g.ogrenci) : puanMetni(g.ortalama);
}

export function pilotRaporu(v: PilotVerisi, ek: { olusturma: Date; adres: string }): string {
  const s = v.suzgec;
  const bas = trDate(new Date(s.basAn.getTime() + 12 * 3600_000));
  const bit = trDate(new Date(s.bitisAn.getTime() - 12 * 3600_000));
  const parametreler = Object.entries(pilotParametreleri(s))
    .filter(([, d]) => d)
    .map(([k, d]) => k + "=" + d)
    .join("&");

  const huniSatirlari = HUNI_ADIMLARI.map((anahtar, i) => {
    const a = v.huni[i];
    return [
      HUNI_ADI[anahtar],
      sayiMetni(a.sayi),
      i === 0 ? "" : oranMetni(a.sayi, a.taban) + " (" + sayiMetni(a.taban) + " kişiden)",
      i === 0 ? "" : oranMetni(a.sayi, a.kayitTabani),
      a.erken > 0 ? sayiMetni(a.erken) : "",
    ];
  });

  const t = v.testler;
  const testSatiri = (k: keyof typeof TEST_ADI) => [TEST_ADI[k], sayiMetni(t[k]), k === "baslayan" ? "" : oranMetni(t[k], t.baslayan)];
  const yarimToplam = v.birakma.ceyrekler.reduce((a, b) => a + b, 0);

  const o = v.ozellik;
  const ozellikSatirlari = o.satirlar.map((r) => [OZELLIK_ADI[r.anahtar], sayiMetni(r.sayi), oranMetni(r.sayi, o.etkin)]);

  const k = v.kazanc;
  const kazancSatiri = (ad: string, g: KazancGrubu) => [
    ad,
    sayiMetni(g.ogrenci),
    kazancMetni(g),
    g.yeterli ? oranMetni(g.anlamliArtis, g.eslesme) : "",
  ];

  const bolumler = [
    "# Pilot ölçümü: pilot sonu raporu",
    "",
    "> **" + RAPOR_NOTU + "** Ad, e-posta ya da öğrenci kimliği yok; " + sayiMetni(0) + " yazan hücreler beşten az kişi ya da testtir.",
    "",
    "- **Kapsam:** " + (v.grupAdi ? "Grup: " + v.grupAdi : "Bütün öğrenciler"),
    "- **Dönem:** " + bas + " – " + bit + " (Türkiye saati" + (s.gozlemSonu.getTime() < s.bitisAn.getTime() ? ", şu ana kadar" : "") + ")",
    "- **Oluşturulma:** " + trDate(ek.olusturma, { time: true }),
    "- **Bu raporun adresi:** " + ek.adres + (parametreler ? "?" + parametreler : ""),
    "",
    "## Okuma kuralları",
    "",
    tanimlar(KAPSAM_TANIMLARI),
    "",
    "## 1. Huni",
    "",
    "Kayıt grubu: " + sayiMetni(v.huni[0].sayi) + " öğrenci.",
    "",
    tablo(["Adım", "Öğrenci", "Önceki adıma göre", "Kayda göre", "Henüz erken"], huniSatirlari),
    "",
    tanimlar(HUNI_TANIMLARI),
    "",
    "## 2. Testler",
    "",
    "Dönemde test başlatan " + sayiMetni(v.testOgrenci) + " öğrenci, " + sayiMetni(t.baslayan) + " test.",
    "",
    tablo(
      ["Durum", "Test", "Başlayana göre"],
      (["baslayan", "ogrenciBitirdi", "suresiDoldu", "yenidenBaslatildi", "suruyor", "birakildi", "isaretsiz", "yarimKaldi", "olcumSayilan"] as const).map(
        testSatiri
      )
    ),
    "",
    "**Yarım testlerde bırakılan yer** (" + sayiMetni(yarimToplam) + " test):",
    "",
    tablo(
      ["Çeyrek", "Yarım test", "Oran"],
      ["İlk çeyrek", "İkinci çeyrek", "Üçüncü çeyrek", "Son çeyrek"].map((ad, i) => [
        ad,
        sayiMetni(v.birakma.ceyrekler[i]),
        oranMetni(v.birakma.ceyrekler[i], yarimToplam),
      ])
    ),
    "",
    tanimlar(TEST_TANIMLARI),
    "",
    "## 3. Özellik kullanımı",
    "",
    "Dönemde etkin " + sayiMetni(o.etkin) + " öğrenci.",
    "",
    tablo(["Özellik", "Kullanan öğrenci", "Etkin öğrenciye göre"], ozellikSatirlari),
    "",
    "**Ödev:** ödevi olan " +
      sayiMetni(o.odev.odevli) +
      " öğrenci; en az birini tamamlayan " +
      sayiMetni(o.odev.tamamlayan) +
      " (" +
      oranMetni(o.odev.tamamlayan, o.odev.odevli) +
      "). Öğrenci × ödev: " +
      sayiMetni(o.odev.atama) +
      ", tamamlanan " +
      sayiMetni(o.odev.tamamlanan) +
      " (" +
      oranMetni(o.odev.tamamlanan, o.odev.atama) +
      ").",
    "",
    tanimlar(OZELLIK_TANIMLARI),
    "",
    "## 4. Öğrenme kazancı",
    "",
    "Eşleşen " + sayiMetni(k.hepsi.ogrenci) + " öğrenci, " + sayiMetni(k.hepsi.eslesme) + " öğrenci × konu.",
    "",
    tablo(
      ["Konular", "Eşleşen öğrenci", "Ortalama değişim", "En az " + ANLAMLI_ARTIS_PUAN + " puan artan"],
      [kazancSatiri("Planına giren", k.planda), kazancSatiri("Planına girmeyen", k.planDisi), kazancSatiri("Hepsi", k.hepsi)]
    ),
    "",
    "**Fark (planına giren − girmeyen):** " +
      (k.fark === null ? "iki grupta da yeterli veri yok" : puanMetni(k.fark)) +
      ".",
    "",
    k.konular.length
      ? tablo(
          ["Konu", "Eşleşen öğrenci", "Ortalama değişim", "Planına giren", "Planına girmeyen"],
          k.konular.map((x) => [x.name, sayiMetni(x.hepsi.ogrenci), kazancMetni(x.hepsi), kazancMetni(x.planda), kazancMetni(x.planDisi)])
        )
      : "Eşleşen konu yok.",
    "",
    tanimlar(KAZANC_TANIMLARI),
    "",
    "**Ek göstergeler**",
    "",
    tablo(
      ["Gösterge", "Sayı", "Oran", "Kaç öğrenciden"],
      [
        [
          EK_GOSTERGE_ADI.kontrol,
          sayiMetni(v.ek.kontrol.gecen) + " / " + sayiMetni(v.ek.kontrol.olculen) + " test",
          oranMetni(v.ek.kontrol.gecen, v.ek.kontrol.olculen),
          sayiMetni(v.ek.kontrol.ogrenci),
        ],
        [
          EK_GOSTERGE_ADI.defter,
          sayiMetni(v.ek.defter.cikan) + " / " + sayiMetni(v.ek.defter.toplam) + " madde",
          oranMetni(v.ek.defter.cikan, v.ek.defter.toplam),
          sayiMetni(v.ek.defter.ogrenci),
        ],
        [
          EK_GOSTERGE_ADI.ipucuDogru,
          sayiMetni(v.ek.ipucu.ipucuyla) + " / " + sayiMetni(v.ek.ipucu.dogru) + " doğru",
          oranMetni(v.ek.ipucu.ipucuyla, v.ek.ipucu.dogru),
          sayiMetni(v.ek.ipucu.ogrenci),
        ],
      ]
    ),
    "",
    tanimlar(EK_GOSTERGE_TANIMLARI),
    "",
    "## 5. Öğrencinin zorluk algısı",
    "",
    "Cevap veren " +
      sayiMetni(v.algi.ogrenci) +
      " öğrenci." +
      (v.algi.gizlenen > 0 ? " " + ZORLUK_EN_AZ_CEVAP + "'ten az cevaplı " + sayiMetni(v.algi.gizlenen) + " paket yazılmadı." : ""),
    "",
    v.algi.paketler.length
      ? tablo(
          ["Paket", "Cevap", ...([1, 2, 3] as const).map((a) => ALGI_ETIKETI[a] + ": cevap · doğru oranı"), "Hepsinin doğru oranı"],
          v.algi.paketler.map((p) => [
            p.ad,
            sayiMetni(p.cevap),
            ...p.kategoriler.map((c) => sayiMetni(c.cevap) + " · " + (c.cevap >= ZORLUK_EN_AZ_CEVAP ? oranMetni(c.dogru, c.soru) : "—")),
            oranMetni(p.dogru, p.soru),
          ])
        )
      : "Gösterilecek kadar cevaplı paket yok.",
    "",
    tanimlar(ALGI_TANIMLARI),
    "",
    "## 6. Kayıt kaynağı",
    "",
    v.kaynak.length
      ? tablo(
          ["Kaynak", "Kayıt", "İlk ölçüm", "Oran"],
          v.kaynak.map((r) => [r.ad, sayiMetni(r.kayit), sayiMetni(r.olcum), oranMetni(r.olcum, r.kayit)])
        )
      : "Dönemde kayıt yok.",
    "",
    tanimlar(KAYNAK_TANIMLARI),
    "",
  ];
  return bolumler.join("\n");
}
