"use client";

import Link from "next/link";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { geriAlAction } from "@/lib/checkup/actions/question-import";
import type { GeriAlYaniti } from "@/lib/checkup/import-report";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

/**
 * İçe aktarma geçmişinin istemci parçaları. Tablo sunucuda çiziliyor;
 * "Geri al" düğmesi küçük bir istemci adacığı.
 *
 * Sonuç (ne silindi, ne korundu ve neden) kabukta tutulur: geri alınan parti
 * tablodan düşse bile mesaj ekranda kalsın.
 */

type Basarili = Extract<GeriAlYaniti, { ok: true }>;

const SonucCtx = createContext<((s: Basarili) => void) | null>(null);

export function ImportHistoryShell({ children }: { children: ReactNode }) {
  const [sonuc, setSonuc] = useState<Basarili | null>(null);
  return (
    <SonucCtx.Provider value={setSonuc}>
      {sonuc ? (
        <div className="border-b border-gray-100 p-4 sm:px-6">
          <Alert
            variant={sonuc.korunan ? "warning" : "success"}
            title={'"' + sonuc.dosyaAdi + '" ' + (sonuc.partiSilindi ? "geri alındı." : "kısmen geri alındı.")}
            onClose={() => setSonuc(null)}
            closeLabel="Mesajı kapat"
          >
            {sonuc.silinen} soru silindi.
            {sonuc.korunan ? (
              <>
                {" "}
                {sonuc.korunan} soru öğrencilere sorulduğu (testte ya da alıştırmada) için korundu: silinseydi
                öğrencilerin cevapları, geçmiş sonuçları ve yanlış defterleri bozulurdu. İstersen arşivle (yeni
                testlere seçilmez, geçmişte durur).{" "}
                <Link
                  href={"/checkup/sorular?parti=" + encodeURIComponent(sonuc.partiId)}
                  className="font-semibold text-gray-800 underline underline-offset-2"
                >
                  Korunan soruları aç
                </Link>
              </>
            ) : null}
            {sonuc.gorselSilinen ? " " + sonuc.gorselSilinen + " görsel silindi." : null}
            {sonuc.gorselKorunan ? " " + sonuc.gorselKorunan + " görsel hâlâ bir soruda kullanıldığı için kaldı." : null}
            {sonuc.kazanimSilinen ? " Bu içe aktarmayla açılan " + sonuc.kazanimSilinen + " kazanım da silindi." : null}
          </Alert>
        </div>
      ) : null}
      {children}
    </SonucCtx.Provider>
  );
}

export function ImportRollbackButton({
  partiId,
  dosyaAdi,
  silinecek,
  korunacak,
}: {
  partiId: string;
  dosyaAdi: string;
  /** Hiçbir teste girmemiş, silinecek soru sayısı. 0 ise yalnızca kayıt silinir. */
  silinecek: number;
  /** Öğrenci testine girmiş, korunacak soru sayısı. */
  korunacak: number;
}) {
  const bildir = useContext(SonucCtx);
  const onayla = useOnay();
  const [pending, start] = useTransition();
  const yalnizKayit = silinecek === 0 && korunacak === 0;

  const tikla = async () => {
    const evet = await onayla(
      yalnizKayit
        ? {
            title: '"' + dosyaAdi + '" kaydı silinsin mi?',
            description: "Bu içe aktarmanın havuzda sorusu kalmadı.",
            confirmLabel: "Kaydı sil",
            tone: "danger",
          }
        : {
            title: '"' + dosyaAdi + '" geri alınsın mı?',
            description: (
              <>
                {silinecek} soru silinecek (henüz hiçbir öğrenciye sorulmamış olanlar; yayındakiler dahil).
                {korunacak ? (
                  <span className="mt-2 block">
                    {korunacak} soru öğrencilere sorulduğu (testte ya da alıştırmada) için korunacak.
                  </span>
                ) : null}
              </>
            ),
            confirmLabel: "Geri al",
            tone: "danger",
          }
    );
    if (!evet) return;
    start(async () => {
      const r = await geriAlAction(partiId);
      if (!r.ok) {
        toast.error(r.hata);
        return;
      }
      bildir?.(r);
    });
  };

  return (
    <Button variant="danger-outline" size="xs" loading={pending} startIcon={<Undo2 />} onClick={() => void tikla()}>
      {yalnizKayit ? "Kaydı sil" : "Geri al"}
    </Button>
  );
}
