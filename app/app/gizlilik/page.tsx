import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/site";
import { COLLECTED_DATA, NOT_COLLECTED, LAST_UPDATED, PILOT_DEGERLENDIRMESI, VELI_ONAYI_METNI } from "@/lib/legal";
import { Wordmark } from "@/components/ui/logo";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK Aydınlatma Metni",
  robots: { index: false, follow: false },
};

const BASLIK = "mt-10 font-display text-xl font-semibold text-gray-800";
const METIN = "mt-3 text-base leading-relaxed text-gray-700";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>

        <h1 className="mt-8 font-display text-2xl font-semibold text-balance text-gray-800 sm:text-title-sm">
          Gizlilik ve KVKK Aydınlatma Metni
        </h1>
        <p className="mt-2 text-sm text-gray-500">Son güncelleme: {LAST_UPDATED}</p>

        {/* HUKUK: veri sorumlusunun tam unvanı, adresi (ve varsa VERBİS kaydı) burada
            yazılmalı; şimdilik yalnızca "Koçum.Net" ve iletişim adresi. Her veri grubu
            için işlemenin hukuki sebebi (KVKK m.5/m.6) de hukukçudan gelecek; metin
            bilerek sebep saymıyor, yalnızca teknik olarak doğrulanmış olguları anlatıyor. */}
        <section className="mt-8 space-y-4 text-base leading-relaxed text-gray-700">
          <p>
            Bu metin, Koçum.Net Matematik Check-up uygulamasını kullanırken hangi kişisel
            verilerinizin işlendiğini, bunun neden yapıldığını ve haklarınızı anlatır.
            6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu
            Koçum.Net&apos;tir. İletişim:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-500 hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <h2 className={BASLIK}>Hangi veriler, neden</h2>
        {/* Telefonda iki sütun (amaç verinin altında), geniş ekranda üç: yatay kaydırma olmadan okunsun. */}
        <Card className="mt-4 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Veri</TableCell>
                <TableCell isHeader className="max-sm:hidden">
                  Amaç
                </TableCell>
                <TableCell isHeader align="end">
                  Zorunlu mu
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COLLECTED_DATA.map((d) => (
                <TableRow key={d.field}>
                  <TableCell className="align-top sm:w-1/3">
                    <span className="block font-medium text-gray-800">{d.field}</span>
                    <span className="mt-1 block sm:hidden">{d.purpose}</span>
                  </TableCell>
                  <TableCell className="align-top max-sm:hidden">{d.purpose}</TableCell>
                  <TableCell align="end" className="align-top">
                    <Badge size="sm" color={d.required ? "primary" : "light"}>
                      {d.required ? "zorunlu" : "isteğe bağlı"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* HUKUK: pilot değerlendirmesinin işleme sebebi (lib/legal.ts PILOT_DEGERLENDIRMESI). */}
        <h2 className={BASLIK}>Pilot değerlendirmesi</h2>
        <p className={METIN}>{PILOT_DEGERLENDIRMESI}</p>

        <h2 className={BASLIK}>Toplamadıklarımız</h2>
        <ul className="mt-3 space-y-2 text-base leading-relaxed text-gray-700">
          {NOT_COLLECTED.map((n) => (
            <li key={n} className="flex gap-2.5">
              <CircleCheck className="mt-1 size-4 shrink-0 text-success-600" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>

        <h2 className={BASLIK}>Kim görür</h2>
        <p className={METIN}>
          Verilerinizi yalnızca Koçum.Net&apos;in yetkili personeli görür. Sonuçlarınızı,
          planınızı, grup ve ödevlerinizi (davet bağlantısıyla katıldığınız dahil), son
          etkinlik zamanınızı, koça yazdığınız soruları ve otomatik takip uyarılarını öğrenci
          verisi yetkisi olan koçlar ve yöneticiler görür. Soru yazan
          içerik personeli hata bildirimlerinizin sebebini ve açıklamasını görür; bildirimi
          kimin yaptığını yalnızca öğrenci verisi yetkisi olanlar görür. Velinize ancak siz
          bir veli bağlantısı oluşturursanız sınırlı bir özet gider (aşağıda).
        </p>

        {/* HUKUK: yurt dışına aktarım. Cloudflare ve e-posta gönderim hizmetinin
            sunucuları yurt dışında olabilir; aktarımın dayanağı (KVKK m.9) ve sağlayıcıların
            adları/ülkeleri hukukçu ve kullanıcıyla netleşmeli. Sunucunun barındırma
            sağlayıcısı da burada anılmalı mı, ayrıca sorulmalı. Buraya yalnızca teknik
            olarak doğrulanan olgular yazıldı. */}
        <h2 className={BASLIK}>Hizmet sağlayıcılar</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700">
          <li>
            <span className="font-medium text-gray-800">Cloudflare:</span> uygulamaya giden bütün
            trafik güvenlik ve hız için Cloudflare üzerinden geçer; istekleriniz (IP adresiniz
            dahil) bu yolda Cloudflare&apos;den geçer.
          </li>
          <li>
            <span className="font-medium text-gray-800">E-posta gönderim hizmeti:</span> hoş geldin,
            parola sıfırlama, &quot;parolan değişti&quot; ve haftalık koçluk postaları bir e-posta
            gönderim hizmeti aracılığıyla gönderilir; bu hizmet adınızı, e-posta adresinizi ve
            postanın içeriğini görür.
          </li>
          <li>
            <span className="font-medium text-gray-800">YouTube ya da Vimeo:</span> bir soruda video
            çözüm varsa, oynatıcı yalnızca siz &quot;Video çözüm&quot;e dokunduğunuzda yüklenir.
            Dokunmadıkça bu hizmetlere hiçbir istek gitmez; açıldığında çerezsiz adresten
            (youtube-nocookie.com, Vimeo&apos;da izleme kapalı) gelir.
          </li>
        </ul>

        <h2 className={BASLIK}>Bu cihazda saklananlar</h2>
        <p className={METIN}>
          Bazı bilgiler sunucuya hiç gitmez, yalnızca kullandığınız tarayıcıda durur. Bunlar
          çerez değildir, tarayıcının yerel deposudur (localStorage):
        </p>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700">
          <li>Sınav ve alıştırmada soru üstüne çizdiğiniz karalamalar.</li>
          <li>Seçtiğiniz yazı boyutu.</li>
          <li>
            Bağlantı koptuğunda henüz sunucuya yazılamamış cevaplarınız ve &quot;sonra bak&quot;
            işaretleriniz; bağlantı gelince gönderilir, birkaç gün içinde kendiliğinden silinir.
          </li>
        </ul>
        <p className={METIN}>
          Tarayıcınızın site verilerini temizlediğinizde bunlar da silinir. Tek çerez,
          oturumunuzu açık tutan giriş çerezidir; uygulamayı kullandıkça süresi uzar, uzun
          süre (en az 15 gün) hiç kullanmazsanız oturum kapanır ve yeniden giriş istenir.
        </p>

        <h2 className={BASLIK}>Saklama süresi</h2>
        <p className={METIN}>
          Hesabınız açık kaldığı sürece verileriniz saklanır; gelişiminizi geçmiş
          check-up&apos;larınızla karşılaştırabilmek bunu gerektirir. Hesabınızı sildiğinizde
          kişisel verileriniz silinir. Test cevapları, kimliğinizle ilişkisi koparılmış
          biçimde soru kalitesi ölçümü için istatistiksel olarak kullanılabilir.
        </p>

        <h2 id="hesabi-silme" className={`${BASLIK} scroll-mt-6`}>
          Hesabı silme
        </h2>
        <p className={METIN}>
          Hesabınızı istediğiniz an kendiniz silebilirsiniz: Profil → Hesabı sil. Parolanız
          yeniden sorulur. Silme anında hesabınız, testleriniz, cevaplarınız, sonuçlarınız,
          planlarınız, yanlış defteriniz, koça yazdığınız sorular, grup üyelikleriniz ve veli
          bağlantılarınız silinir. Hata bildirimleriniz soru hatası kaydı olarak kalır, ama
          yazdığınız açıklama silinir ve bildirimin sizinle bağı kopar. Geriye yalnızca
          kimliksiz toplamlar kalır: bir sorunun kaç kez gösterildiği ve doğru cevaplandığı,
          şıkların kaç kez seçildiği.
        </p>

        <h2 className={BASLIK}>18 yaşından küçükseniz</h2>
        {/* HUKUK: kayıt kutusu yalnızca beyan alıyor, veli onayı kaydedilmiyor (E16). */}
        <p className={METIN}>
          Bu uygulama sınava hazırlanan öğrenciler içindir ve kullanıcılarımızın önemli bir
          bölümü 18 yaşın altındadır. 18 yaşından küçükseniz hesabı velinizin bilgisi ve
          onayıyla oluşturmalısınız. Kayıt ekranında bunu şu cümleyle beyan edersiniz:
          &ldquo;{VELI_ONAYI_METNI}&rdquo;
        </p>

        {/* TASLAK: hukuki inceleme bekliyor (lib/legal.ts başındaki not). Hoca kararı Hocaya sorular: motivasyon.veli-kapsam. */}
        <h2 id="veli-baglantisi" className={`${BASLIK} flex flex-wrap items-center gap-2 scroll-mt-6`}>
          Veli bağlantısı
          <Badge size="sm" color="warning">
            taslak
          </Badge>
        </h2>
        <p className={METIN}>
          Profil sayfanızdan velinizle paylaşmak için salt okunur bir bağlantı oluşturabilirsiniz. Bağlantıyı açan
          kişi giriş yapmadan yalnızca genel durumu görür: adınızın ilk kelimesi, hedef sınavınız, son ölçümünüz ve
          gelişim grafiğiniz, güçlü ve zayıf konularınız, son 5 check-up&apos;ınızın tarihi, adı ve puanı, bu haftaki
          planınızın ne kadarının tamamlandığı, yanlış defterinizde bekleyen soru sayısı ve koçunuzun verdiği
          ödevlerin adı, son tarihi ve tamamlanıp tamamlanmadığı. Sorular, cevaplarınız,
          çözümler, alıştırmalarınız, e-posta adresiniz ve diğer kişisel bilgileriniz bu sayfada yer almaz.
        </p>
        <p className={METIN}>
          Bağlantı seçtiğiniz süre kadar açık kalır: 7, 30 ya da 90 gün (varsayılan 30). Aynı anda en fazla 3
          bağlantınız olabilir. Profil sayfanızdaki &quot;Veli bağlantısı&quot; bölümünden istediğiniz an
          kaldırabilirsiniz; kaldırılan ya da süresi dolan bağlantı hemen kapanır. Bağlantıyı bilen herkes raporu
          görebileceği için yalnızca velinizle paylaşın. Bağlantının kendisini saklamayız, yalnızca geri çevrilemez
          özetini; kaç kez ve en son ne zaman açıldığını kaydederiz, açan kişinin IP adresini ya da tarayıcısını
          kaydetmeyiz. Sayfa arama motorlarına kapalıdır. Süresi dolan ya da kaldırılan bağlantının kaydı 30 gün
          sonra silinir.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Bu bölüm taslaktır; hukuki incelemeden sonra kesinleşecektir.
        </p>

        <h2 className={BASLIK}>Haklarınız</h2>
        <p className={METIN}>
          KVKK 11. madde kapsamında; verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini
          veya silinmesini isteme, işlemeye itiraz etme haklarına sahipsiniz. Bu haklarınızı
          kullanmak için{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-500 hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          adresine yazabilirsiniz.
        </p>

        <h2 className={BASLIK}>Güvenlik</h2>
        <p className={METIN}>
          Parolanız geri çevrilemez biçimde (scrypt) özetlenerek saklanır; düz hâli hiçbir
          yerde tutulmaz. Oturum bilgileriniz de özetlenerek saklanır, böylece veritabanına
          erişen biri oturumunuzu taklit edemez.
        </p>

        <div className="mt-12 border-t border-gray-200 pt-6">
          <Link
            href="/"
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> Ana sayfaya dön
          </Link>
        </div>
      </main>
    </div>
  );
}
