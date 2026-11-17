import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { SITE_URL } from "@/lib/site";
import { UygulamaLogosu } from "@/components/Logo";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Gizlilik ve KVKK aydınlatma metni" };

/*
 * KVKK aydınlatma metni — TASLAK, HUKUKİ GÖRÜŞ DEĞİL.
 *
 * Yalnızca programın GERÇEKTEN topladığı veriler yazıldı (checkup/API.md ve
 * MIMARI.md'den): ad soyad, e-posta, parola özeti, kayıt kaynağı etiketi,
 * check-up cevapları ve sonuçları, oturum, IP'ye dayalı geçici hız sınırı.
 * Veri sorumlusunun kimliği, adresi, başvuru yolu, barındırma ve e-posta
 * sağlayıcıları, hukuki sebepler ve saklama süreleri UYDURULMADI: hepsi
 * <YerTutucu> ile işaretli, yayından önce hukukçu ve işletme doldurmalı.
 * Toplanan veri değişirse (yeni alan) bu metin de değişir.
 */

const SON_GUNCELLEME = "17 Kasım 2026";

/** Doldurulması gereken hukuki bilgi: sayfada göze batan sarı işaret. */
function YerTutucu({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-warning-50 px-1 py-0.5 font-medium text-warning-700 ring-1 ring-warning-300 ring-inset">
      [Doldurulacak: {children}]
    </mark>
  );
}

const VERILER: { veri: string; neden: string; ne: string }[] = [
  {
    veri: "Ad soyad",
    neden: "Hesabını tanımak, sana adınla hitap etmek ve raporunu hazırlamak.",
    ne: "Kayıtta yazarsın, Profil'den değiştirebilirsin.",
  },
  {
    veri: "E-posta adresi",
    neden: "Giriş yapman ve parolanı unutursan sıfırlama bağlantısı göndermek.",
    ne: "Küçük harfe çevrilerek saklanır.",
  },
  {
    veri: "Parola",
    neden: "Hesabını korumak.",
    ne: "Parolanın kendisi saklanmaz; yalnızca geri çevrilemeyen özeti (scrypt) tutulur.",
  },
  {
    veri: "Kayıt kaynağı etiketi",
    neden: "kocum.net'teki hangi bağlantının işe yaradığını görmek.",
    ne: "Yalnızca kocum.net'teki etiketli bir bağlantıyla geldiysen: \"blog\", \"instagram\" gibi tek bir kelime. Kim olduğunu söylemez.",
  },
  {
    veri: "Check-up kayıtları",
    neden: "Testi yürütmek, raporunu hazırlamak ve yeni check-up'ta aynı soruları mümkün olduğunca tekrar göstermemek.",
    ne: "Seçtiğin sınav ve tür, sana gelen sorular, verdiğin cevaplar, başlangıç ve bitiş zamanı, net, doğru, yanlış, boş sayıları ve konu başarıların.",
  },
  {
    veri: "Oturum bilgisi",
    neden: "Giriş yaptıktan sonra seni tanımak.",
    ne: "Tarayıcına 30 gün geçerli bir oturum çerezi yazılır. Sunucuda bu anahtarın yalnızca özeti tutulur.",
  },
  {
    veri: "IP adresi",
    neden: "Kayıt, giriş ve parola sıfırlama denemelerini sınırlayarak hesapları korumak.",
    ne: "Geçici deneme sayaçlarında kullanılır (ör. bir IP'den saatte en fazla 10 kayıt, 15 dakikada en fazla 10 giriş denemesi).",
  },
];

const TOPLANMAYANLAR = [
  "Telefon numarası, adres, T.C. kimlik numarası, doğum tarihi ya da okul bilgisi istemiyoruz.",
  "Ödeme ya da kart bilgisi almıyoruz.",
  "Reklam, izleme ya da analiz çerezi kullanmıyoruz; davranışını üçüncü taraf araçlarla izlemiyoruz.",
  "Yazı tipleri bu sunucudan gelir: sayfayı açtığında tarayıcın Google'a istek göndermez.",
];

const BASLIK = "mt-10 font-display text-h3 font-semibold text-gray-800";
const METIN = "mt-3 text-body leading-relaxed text-gray-700";

export default function GizlilikSayfasi() {
  return (
    <div className="min-h-screen bg-white">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <header className="border-b border-gray-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Koçum.Net Check-up ana sayfa" className="flex min-h-11 items-center">
            <UygulamaLogosu />
          </Link>
          <Link
            href="/panel"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            Uygulamaya dön
          </Link>
        </div>
      </header>

      <main id="icerik" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 font-semibold text-balance text-gray-800">Gizlilik ve KVKK aydınlatma metni</h1>
          <Badge color="warning" size="sm">
            Taslak
          </Badge>
        </div>
        <p className="mt-2 text-caption text-gray-500">Son güncelleme: {SON_GUNCELLEME}</p>

        <p className={METIN}>
          Bu metin, Koçum.Net Check-up programını kullanırken hangi kişisel verilerinin işlendiğini, neden işlendiğini ve
          haklarını anlatır. Yalnızca gerçekten topladığımız verileri yazdık.
        </p>

        <h2 className={BASLIK}>Veri sorumlusu</h2>
        <p className={METIN}>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu{" "}
          <YerTutucu>veri sorumlusunun tam unvanı</YerTutucu>. Adres: <YerTutucu>açık adres</YerTutucu>. İletişim:{" "}
          <YerTutucu>KVKK başvuruları için e-posta adresi</YerTutucu>. <YerTutucu>varsa VERBİS kayıt bilgisi</YerTutucu>
        </p>

        <h2 className={BASLIK}>Hangi verileri, neden işliyoruz</h2>
        <Card className="mt-4 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Veri</TableCell>
                <TableCell isHeader>Neden ve nasıl</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {VERILER.map((v) => (
                <TableRow key={v.veri}>
                  <TableCell className="align-top sm:w-44">
                    <span className="font-medium text-gray-800">{v.veri}</span>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="block text-gray-700">{v.neden}</span>
                    <span className="mt-1 block">{v.ne}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <h2 className={BASLIK}>Hukuki sebep</h2>
        <p className={METIN}>
          <YerTutucu>her veri grubu için KVKK m.5 kapsamındaki işleme sebebi (hukukçu yazacak)</YerTutucu>
        </p>

        <h2 className={BASLIK}>Toplamadıklarımız</h2>
        <ul className="mt-3 space-y-2 text-body leading-relaxed text-gray-700">
          {TOPLANMAYANLAR.map((t) => (
            <li key={t} className="flex gap-2.5">
              <CircleCheck className="mt-1 size-4 shrink-0 text-success-600" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <h2 className={BASLIK}>Çerezler</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-body leading-relaxed text-gray-700">
          <li>
            <span className="font-medium text-gray-800">ogrenci_oturum:</span> giriş yaptığını hatırlar. Zorunludur, 30 gün
            geçerlidir. Çıkış yapınca silinir.
          </li>
          <li>
            <span className="font-medium text-gray-800">kaynak:</span> yalnızca kocum.net&apos;teki etiketli bir bağlantıyla
            geldiysen yazılır, 30 gün geçerlidir. Kayıt olunca etiket hesabına eklenir ve çerez silinir.
          </li>
        </ul>
        <p className={METIN}>Bunların dışında çerez kullanmıyoruz.</p>

        <h2 className={BASLIK}>Kim görür, kime aktarılır</h2>
        <p className={METIN}>
          Verilerini Koçum.Net&apos;in yetkili yöneticileri görebilir: öğrenci listesi ve check-up raporları yalnızca yönetici
          yetkisiyle açılır. Soru hazırlayan içerik editörleri öğrenci verisi görmez. Verilerin satılmaz, reklam için
          kullanılmaz.
        </p>
        <p className={METIN}>Hizmeti sunabilmek için şu hizmet sağlayıcılardan yararlanıyoruz:</p>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-body leading-relaxed text-gray-700">
          <li>
            <span className="font-medium text-gray-800">Cloudflare:</span> siteye giden trafik güvenlik ve hız için
            Cloudflare üzerinden geçer; IP adresin dahil istekler bu yoldan iletilir.
          </li>
          <li>
            <span className="font-medium text-gray-800">Sunucu barındırma:</span> <YerTutucu>sağlayıcının adı ve ülkesi</YerTutucu>
          </li>
          <li>
            <span className="font-medium text-gray-800">E-posta gönderimi:</span> parola sıfırlama postası bir e-posta
            hizmetiyle gönderilir; bu hizmet e-posta adresini ve postanın içeriğini görür.{" "}
            <YerTutucu>sağlayıcının adı ve ülkesi</YerTutucu>
          </li>
        </ul>
        <p className={METIN}>
          <YerTutucu>yurt dışına aktarım varsa dayanağı (KVKK m.9)</YerTutucu>
        </p>

        <h2 className={BASLIK}>Ne kadar saklanır</h2>
        <p className={METIN}>
          Hesabın açık kaldığı sürece verilerin saklanır; geçmiş check-up&apos;larını ve raporlarını görebilmen bunu gerektirir.
          Hesabını sildiğinde hesabın ve bütün check-up kayıtların silinir. <YerTutucu>yedeklerde kalma süresi</YerTutucu>
        </p>

        <h2 id="hesabi-silme" className={`${BASLIK} scroll-mt-6`}>
          Hesabını silmek
        </h2>
        <p className={METIN}>
          İstediğin an kendin silebilirsin: Profil → Hesabı sil. Parolan yeniden sorulur. Silme anında hesabın ve bütün
          check-up&apos;ların, raporların silinir.
        </p>

        <h2 className={BASLIK}>Hakların</h2>
        <p className={METIN}>KVKK&apos;nın 11. maddesine göre şu haklara sahipsin:</p>
        <ul className="mt-3 list-disc space-y-1.5 ps-5 text-body leading-relaxed text-gray-700">
          <li>Kişisel verilerinin işlenip işlenmediğini öğrenmek ve işlenmişse bilgi istemek,</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek,</li>
          <li>Yurt içinde ya da yurt dışında aktarıldığı üçüncü kişileri bilmek,</li>
          <li>Eksik ya da yanlış işlenmişse düzeltilmesini istemek,</li>
          <li>KVKK&apos;daki şartlar çerçevesinde silinmesini ya da yok edilmesini istemek,</li>
          <li>Düzeltme ve silme işlemlerinin, verilerin aktarıldığı üçüncü kişilere bildirilmesini istemek,</li>
          <li>Yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonuç çıkmasına itiraz etmek,</li>
          <li>Kanuna aykırı işleme yüzünden zarara uğrarsan zararın giderilmesini istemek.</li>
        </ul>
        <p className={METIN}>
          Başvuru için: <YerTutucu>başvuru yolu ve adresi</YerTutucu>
        </p>

        <p className="mt-12 border-t border-gray-100 pt-6 text-caption text-gray-500">
          Koçum.Net tanıtım sitesinin gizlilik metni için:{" "}
          <a href={`${SITE_URL}/gizlilik`} className="font-medium text-brand-500 hover:underline">
            kocum.net/gizlilik
          </a>
        </p>
      </main>
    </div>
  );
}
