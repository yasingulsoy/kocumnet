import type { Metadata } from "next";
import Link from "next/link";
import { YeniParolaFormu } from "./YeniParolaFormu";

export const metadata: Metadata = {
  title: "Yeni parola",
  // Jeton adreste: başka siteye giden bağlantılarda Referer ile sızmasın.
  referrer: "no-referrer",
};

export default async function ParolaSifirlaSayfasi({ params }: PageProps<"/parola-sifirla/[jeton]">) {
  const { jeton } = await params;

  return (
    <>
      <h1 className="font-display text-h1 font-semibold text-gray-800">Yeni parolanı belirle</h1>
      <p className="mt-2 text-body text-gray-600">Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.</p>
      <div className="mt-8">
        <YeniParolaFormu jeton={jeton} />
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        Bağlantının süresi mi doldu?{" "}
        <Link href="/parolami-unuttum" className="font-medium text-brand-500 hover:text-brand-600 hover:underline">
          Yeni bağlantı iste
        </Link>
      </p>
    </>
  );
}
