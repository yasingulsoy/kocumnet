import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/site";
import { COLLECTED_DATA, NOT_COLLECTED, LAST_UPDATED } from "@/lib/legal";
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

        <section className="mt-8 space-y-4 text-base leading-relaxed text-gray-700">
          <p>
            Bu metin, Koçum.Net Matematik Check-up uygulamasını kullanırken hangi kişisel
            verilerinizin işlendiğini, bunun neden yapıldığını ve haklarınızı anlatır.
            6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu
            Koçum.Net&apos;tir.
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

        <h2 className={BASLIK}>Toplamadıklarımız</h2>
        <ul className="mt-3 space-y-2 text-base leading-relaxed text-gray-700">
          {NOT_COLLECTED.map((n) => (
            <li key={n} className="flex gap-2.5">
              <CircleCheck className="mt-1 size-4 shrink-0 text-success-600" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>

        <h2 className={BASLIK}>Saklama süresi</h2>
        <p className={METIN}>
          Hesabınız açık kaldığı sürece verileriniz saklanır; gelişiminizi geçmiş
          check-up&apos;larınızla karşılaştırabilmek bunu gerektirir. Hesabınızı sildirdiğinizde
          kişisel verileriniz silinir. Test cevapları, kimliğinizle ilişkisi koparılmış
          biçimde soru kalitesi ölçümü için istatistiksel olarak kullanılabilir.
        </p>

        <h2 className={BASLIK}>18 yaşından küçükseniz</h2>
        <p className={METIN}>
          Bu uygulama sınava hazırlanan öğrenciler içindir ve kullanıcılarımızın önemli bir
          bölümü 18 yaşın altındadır. 18 yaşından küçükseniz hesap oluşturmadan önce
          velinizin bilgisi ve onayı gerekir.
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
